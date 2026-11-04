import test from 'node:test';
import assert from 'node:assert/strict';
import {start as coffee} from '../minigames/m02.js';
import {start as phones} from '../minigames/m03.js';
import {getArcadeData} from '../minigames/content.js';
import {MISSIONS} from '../missions-data.js';

// A deterministic clock and minimal canvas recorder exercise actual game
// input/timers, without substituting private state or relying on a browser.
function harness(){
  let now=0,nextId=0;const frames=new Map(),listeners=new Map();
  function target(){const map=new Map();return{addEventListener(k,f){const s=map.get(k)||new Set();s.add(f);map.set(k,s);},removeEventListener(k,f){map.get(k)?.delete(f);},dispatch(k,event={}){for(const f of map.get(k)||[])f({type:k,target:{tagName:'CANVAS'},preventDefault(){},...event});},listenerCount(){return[...map.values()].reduce((n,s)=>n+s.size,0);}};}
  const context={draws:[],tx:0,ty:0,stack:[],save(){this.stack.push([this.tx,this.ty]);},restore(){[this.tx,this.ty]=this.stack.pop()||[0,0];},translate(x,y){this.tx+=x;this.ty+=y;},rotate(){},scale(){},clearRect(){this.draws=[];this.tx=0;this.ty=0;},measureText(s){return{width:String(s).length*11};},fillText(s,x,y){this.draws.push({text:String(s),x:x+this.tx,y:y+this.ty});}};
  for(const fn of ['beginPath','roundRect','fill','stroke','setTransform','fillRect','moveTo','lineTo','arc','ellipse','quadraticCurveTo'])context[fn]=()=>{};
  let doc;
  function node(tag){const n={...target(),tagName:tag.toUpperCase(),children:[],style:{},attrs:{},classList:{add(){},remove(){}},offsetWidth:800,append(...children){for(const c of children){c.parent=this;this.children.push(c);}},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},setAttribute(k,v){this.attrs[k]=String(v);},getBoundingClientRect(){return{left:0,top:0,width:800,height:700};},focus(){doc.activeElement=this;},setPointerCapture(){},getContext(){return context;}};return n;}
  doc={...target(),hidden:false,activeElement:null,createElement:node};const win=target(),container=node('div');
  const saved=Object.fromEntries(['document','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{document:doc,window:win,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:true})});
  const walk=n=>[n,...n.children.flatMap(walk)];
  return{container,context,doc,win,frames,step(seconds=.05,frameMs=50){for(let i=0;i<Math.ceil(seconds*1000/frameMs);i++){now+=frameMs;const current=[...frames.values()];frames.clear();current.forEach(f=>f(now));}},buttons(){return walk(container).filter(n=>n.tagName==='BUTTON');},canvas(){return walk(container).find(n=>n.tagName==='CANVAS');},restore(){for(const[k,v]of Object.entries(saved)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
function button(h,pattern){return h.buttons().find(b=>pattern.test(b.attrs['aria-label']));}

test('phone game requires five actual correct answers, emits one win, and disposes all inputs',()=>{
  const h=harness(),wins=[],failures=[],data=getArcadeData(MISSIONS[2]);let game;
  try{
    game=phones({container:h.container,data,onWin:p=>wins.push(p),onFail:p=>failures.push(p)});h.step(1);
    button(h,/전화 받기/).onclick();h.step(.05);
    const wrong=1-data.arcade.calls[0].answer;button(h,new RegExp(`^${wrong+1}번 `)).onclick();h.step(1.3);
    assert.equal(wins.length,0);assert.equal(failures.length,1);
    for(const call of data.arcade.calls){h.step(1);button(h,/전화 받기/).onclick();h.step(.05);button(h,new RegExp(`^${call.answer+1}번 `)).onclick();h.step(1.3);}
    h.step(3);assert.equal(wins.length,1);assert.equal(wins[0].answered,5);h.step(3);assert.equal(wins.length,1);
    game.destroy();assert.equal(h.container.children.length,0);assert.equal(h.frames.size,0);assert.equal(h.win.listenerCount(),0);assert.equal(h.doc.listenerCount(),0);
  }finally{game?.destroy();h.restore();}
});

test('phone answer timer pauses with game and hidden page; unanswered calls cannot win',()=>{
  const h=harness(),wins=[],failures=[];let game;
  try{
    game=phones({container:h.container,data:getArcadeData(MISSIONS[2]),onWin:p=>wins.push(p),onFail:p=>failures.push(p)});h.step(1);button(h,/전화 받기/).onclick();h.step(.05);
    game.pause();h.step(10);assert.equal(failures.length,0);game.resume();h.doc.hidden=true;h.step(10);assert.equal(failures.length,0);h.doc.hidden=false;h.step(3.2,100);assert.equal(failures.length,1);assert.equal(wins.length,0);
    h.step(95);assert.ok(button(h,/다시 받기/));assert.equal(wins.length,0);button(h,/다시 받기/).onclick();h.step(1);assert.ok(button(h,/전화 받기/));
  }finally{game?.destroy();h.restore();}
});

test('coffee game is won by moving mug under five matching falling cards',()=>{
  const h=harness(),data=getArcadeData(MISSIONS[1]),wins=[];let game;
  try{
    game=coffee({container:h.container,data,onWin:p=>wins.push(p)});
    for(let n=0;n<1700&&!wins.length;n++){
      h.step(.05);
      const progress=h.context.draws.find(d=>/^\d\/5$/.test(d.text));const index=progress?Number(progress.text[0]):5;
      if(index<5){const wanted=data.arcade.cards.find(c=>c.slot===data.arcade.slots[index].id);const falling=h.context.draws.find(d=>d.text===wanted.label&&d.y>145&&d.y<600);if(falling)h.canvas().dispatch('pointermove',{clientX:falling.x,clientY:falling.y,pointerType:'mouse'});}
    }
    assert.equal(wins.length,1,JSON.stringify(h.context.draws));assert.equal(wins[0].collected.length,5);h.step(4);assert.equal(wins.length,1);
  }finally{game?.destroy();h.restore();}
});
