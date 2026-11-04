// Deliberately small DOM simulation for mission state-machine tests.
// This is not a browser or a layout/accessibility test. It supports only the
// HTML and selectors emitted by missions-ui.js and requires no dependencies.
const decode = text => String(text).replace(/&(amp|lt|gt|quot|#39);/g,
  (_, key) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));
const voidTags = new Set(['input','br','hr','img','meta','link']);

function matches(node, selector) {
  if (node.tagName === '#text') return false;
  if (selector.includes(':not(:disabled)') && node.disabled) return false;
  selector = selector.replace(':not(:disabled)', '');
  if (selector.includes(':disabled') && !node.disabled) return false;
  selector = selector.replace(':disabled', '');
  for (const [,name,,value] of selector.matchAll(/\[([^=\]]+)(?:=(["']?)(.*?)\2)?\]/g)) {
    if (!Object.hasOwn(node.attrs, name)) return false;
    if (value !== undefined && node.attrs[name] !== value) return false;
  }
  selector = selector.replace(/\[[^\]]+\]/g, '');
  const id = selector.match(/#([\w-]+)/)?.[1];
  if (id && node.attrs.id !== id) return false;
  for (const [,name] of selector.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(name)) return false;
  const tag = selector.match(/^[\w-]+/)?.[0];
  return !tag || node.tagName === tag.toLowerCase();
}

class Node {
  constructor(tagName, doc, attrs = {}, text = '') {
    this.tagName=tagName;this.ownerDocument=doc;this.attrs=attrs;
    this.children=[];this.parentNode=null;this._text=text;
    this.disabled=Object.hasOwn(attrs,'disabled');this.checked=Object.hasOwn(attrs,'checked');
    this.hidden=Object.hasOwn(attrs,'hidden');this.scrollTop=0;
    this.dataset=Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-'))
      .map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));
    this.classList={
      contains:name=>(this.attrs.class||'').split(/\s+/).includes(name),
      add:(...names)=>{this.attrs.class=[...new Set([...(this.attrs.class||'').split(/\s+/),...names])].filter(Boolean).join(' ');},
      remove:(...names)=>{this.attrs.class=(this.attrs.class||'').split(/\s+/).filter(x=>!names.includes(x)).join(' ');},
      toggle:(name,force)=>{const add=force??!this.classList.contains(name);this.classList[add?'add':'remove'](name);return add;}
    };
  }
  get value(){return this._value??(this.tagName==='textarea'?this.textContent:this.attrs.value||'');}
  set value(value){this._value=String(value);}
  get textContent(){return this.tagName==='#text'?this._text:this.children.map(n=>n.textContent).join('');}
  set textContent(value){this.children=[];this.append(new Node('#text',this.ownerDocument,{},String(value)));}
  set innerHTML(html){this.children=[];parse(String(html),this);}
  append(node){node.parentNode=this;this.children.push(node);}
  replaceChildren(...nodes){this.children=[];nodes.forEach(n=>this.append(n));}
  querySelectorAll(selector){
    const selectors=selector.split(',').map(s=>s.trim()), found=[];
    const visit=node=>{for(const child of node.children){if(selectors.some(s=>matches(child,s)))found.push(child);visit(child);}};
    visit(this);return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  insertAdjacentHTML(position,html){
    const fragment=new Node('fragment',this.ownerDocument);parse(html,fragment);
    if(position==='afterbegin'){fragment.children.forEach(n=>n.parentNode=this);this.children.unshift(...fragment.children);}
    else if(position==='beforebegin'){
      const parent=this.parentNode,index=parent.children.indexOf(this);
      fragment.children.forEach(n=>n.parentNode=parent);parent.children.splice(index,0,...fragment.children);
    } else throw new Error(`Unsupported DOM insertion: ${position}`);
  }
  focus(){this.ownerDocument.activeElement=this;}
  scrollIntoView(){}
  click(){if(!this.disabled)this.onclick?.({target:this,preventDefault(){},stopPropagation(){}});}
}

function parse(html,root){
  const stack=[root];
  for(const token of html.matchAll(/<\/?([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g)){
    if(token[3]!==undefined){stack.at(-1).append(new Node('#text',root.ownerDocument,{},decode(token[3])));continue;}
    const tag=token[1].toLowerCase();
    if(token[0].startsWith('</')){
      for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag){stack.length=i;break;}
      continue;
    }
    const attrs={};
    for(const [,key,double,single,bare] of token[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[key]=decode(double??single??bare??'');
    const node=new Node(tag,root.ownerDocument,attrs);stack.at(-1).append(node);
    if(!voidTags.has(tag)&&!token[0].endsWith('/>'))stack.push(node);
  }
}

export function createDocument(){
  const listeners=new Map();
  const doc={hidden:false,activeElement:null,
    createElement:tag=>new Node(tag,doc),
    addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},
    dispatch(type){for(const fn of listeners.get(type)||[])fn();}
  };
  return doc;
}
