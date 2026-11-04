import test from 'node:test';
import assert from 'node:assert/strict';
import {start,trayCompartment,trayComplete,trayGeometry,fallingFoodGeometry,dropLane,trayPointerPosition} from '../minigames/m09.js';
import {getStage2Arcade} from '../minigames/stage2-content.js';
import {MISSIONS} from '../missions-data.js';

function harness(width=800,height=700){
  let now=0,nextId=0;const frames=new Map();
  function target(){const map=new Map();return{addEventListener(k,f){const s=map.get(k)||new Set();s.add(f);map.set(k,s);},removeEventListener(k,f){map.get(k)?.delete(f);},dispatch(k,event={}){for(const f of map.get(k)||[])f({type:k,target:{tagName:'CANVAS'},preventDefault(){},...event});},listenerCount(){return[...map.values()].reduce((n,s)=>n+s.size,0);}};}
  const context={draws:[],boxes:[],tx:0,ty:0,stack:[],save(){this.stack.push([this.tx,this.ty]);},restore(){[this.tx,this.ty]=this.stack.pop()||[0,0];},translate(x,y){this.tx+=x;this.ty+=y;},rotate(){},clearRect(){this.draws=[];this.boxes=[];this.tx=0;this.ty=0;},measureText(s){const size=Number(this.font?.match(/([\d.]+)px/)?.[1]||20);return{width:[...String(s)].reduce((n,c)=>n+size*(c.charCodeAt(0)<128?.55:1),0)};},fillText(s,x,y){this.draws.push({text:String(s),x:x+this.tx,y:y+this.ty,size:Number(this.font?.match(/([\d.]+)px/)?.[1]||20),width:this.measureText(s).width});},roundRect(x,y,w,h){this.boxes.push({x:x+this.tx,y:y+this.ty,w,h});}};
  for(const fn of ['beginPath','fill','stroke','setTransform','fillRect','moveTo','lineTo','arc','ellipse'])context[fn]=()=>{};
  let doc;
  function node(tag){return{...target(),tagName:tag.toUpperCase(),children:[],style:{},attrs:{},classList:{add(){},remove(){}},offsetWidth:width,append(...children){for(const c of children){c.parent=this;this.children.push(c);}},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},setAttribute(k,v){this.attrs[k]=String(v);},getBoundingClientRect(){return{left:0,top:0,width,height};},focus(){doc.activeElement=this;},setPointerCapture(){},getContext(){return context;}};}
  doc={...target(),hidden:false,activeElement:null,createElement:node};const win=target(),container=node('div');
  const saved=Object.fromEntries(['document','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{document:doc,window:win,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:true})});
  const walk=n=>[n,...n.children.flatMap(walk)];
  return{container,context,doc,win,frames,width,height,step(seconds=.05){for(let i=0;i<Math.ceil(seconds*20);i++){now+=50;const current=[...frames.values()];frames.clear();current.forEach(f=>f(now));}},buttons(){return walk(container).filter(n=>n.tagName==='BUTTON');},canvas(){return walk(container).find(n=>n.tagName==='CANVAS');},restore(){for(const[k,v]of Object.entries(saved)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
const data=()=>({...MISSIONS[8],arcade:getStage2Arcade(MISSIONS[8])});
function fallingCard(h){
  const g=fallingFoodGeometry(h.width,h.height,0),box=h.context.boxes.findLast(b=>b.w===g.width&&b.h===g.height);
  if(!box)return null;
  const size=h.width<600?20:24,lines=h.context.draws.filter(d=>d.size===size&&Math.abs(d.x-(box.x+box.w/2))<.01&&d.y>box.y&&d.y<box.y+box.h);
  return {box,lines,label:lines.map(d=>d.text).join('')};
}
function playFrame(h,cfg){
  const card=fallingCard(h),food=card&&[...cfg.foods,...cfg.bonus].find(f=>f.label===card.label);
  if(food){const answer=food.options?food.answer:['html','css','js'].indexOf(food.kind),g=trayGeometry(h.width,h.height),trayX=card.box.x+card.box.w/2-(answer-1)*g.compartment;h.canvas().dispatch('pointermove',{clientX:(trayX-g.min)/(g.max-g.min)*h.width,clientY:g.y,pointerType:'mouse'});}
  h.step();
}

test('all three tray compartments are physically reachable at phone and desktop widths',()=>{
  for(const width of [320,390,600,1366]){const g=trayGeometry(width,700);for(const lane of [.465,.5,.535])for(let index=0;index<3;index++){const desired=lane*width-(index-1)*g.compartment,center=Math.max(g.min,Math.min(g.max,desired));assert.equal(trayCompartment(lane*width,center,g.width),index);assert.ok(Math.abs(center-desired)<1e-8,'alignment never loses room to whole-tray clamping');const pointerX=(desired-g.min)/(g.max-g.min)*width;assert.ok(pointerX>=-1e-8&&pointerX<=width+1e-8,'pointer can reach each bin from inside the viewport');assert.ok(Math.abs(trayPointerPosition(pointerX,width,700)-desired)<1e-8);}}
  assert.equal(trayCompartment(-100,400,432),-1);assert.equal(trayCompartment(184,400,432),-1);
  assert.equal(trayComplete({html:20,css:0,js:20},10),false);assert.equal(trayComplete({html:2,css:2,js:2},2),false);assert.equal(trayComplete({html:2,css:2,js:2},3),true);
});

test('physical pointer catches balance HTML/CSS/JS and bonus meanings, winning only at60 active seconds',()=>{
  const h=harness(390,740),d=data(),wins=[],fails=[];let game;
  try{
    game=start({container:h.container,data:d,onWin:p=>wins.push(p),onFail:p=>fails.push(p)});h.step();
    let sawBonusDefinitions=false;
    for(let i=0;i<1198;i++){playFrame(h,d.arcade);if(h.buttons().some(b=>b.attrs['aria-label']?.includes('웹에')))sawBonusDefinitions=true;assert.equal(wins.length,0);}
    for(let i=0;i<12;i++)playFrame(h,d.arcade);
    assert.equal(wins.length,1,JSON.stringify({fails,draws:h.context.draws}));assert.equal(wins[0].seconds,60);assert.ok(['html','css','js'].every(k=>wins[0].counts[k]>=2));assert.ok(wins[0].bonus>=3);assert.ok(sawBonusDefinitions);assert.equal(fails.length,0);
    h.step(3);assert.equal(wins.length,1);game.destroy();assert.equal(h.frames.size,0);assert.equal(h.container.children.length,0);assert.equal(h.win.listenerCount(),0);assert.equal(h.doc.listenerCount(),0);
  }finally{game?.destroy();h.restore();}
});

test('unanswered play fails once at the deadline, supports retry, and pauses hidden time',()=>{
  const h=harness(),wins=[],fails=[];let game;
  try{
    game=start({container:h.container,data:data(),onWin:p=>wins.push(p),onFail:p=>fails.push(p)});h.step(1);game.pause();h.step(80);assert.equal(fails.length,0);game.resume();h.doc.hidden=true;h.step(80);assert.equal(fails.length,0);h.doc.hidden=false;h.step(61);assert.equal(wins.length,0);assert.equal(fails.filter(f=>f.reason==='timeout').length,1);h.step(10);assert.equal(fails.filter(f=>f.reason==='timeout').length,1);
    const retry=h.buttons().find(b=>b.attrs['aria-label']==='식판 다시 받기');assert.ok(retry);retry.onclick();h.step(.5);assert.ok(h.buttons().some(b=>b.attrs['aria-label'].startsWith('1번 칸 맞추기')));assert.equal(wins.length,0);
  }finally{game?.destroy();h.restore();}
});

test('relaxed mode has no timeout failure and continues missing learning goals after60 seconds',()=>{
  const h=harness(),d={...data(),runtime:{relaxed:true}},wins=[],fails=[];let game;
  try{
    game=start({container:h.container,data:d,onWin:p=>wins.push(p),onFail:p=>fails.push(p)});h.step(61);assert.equal(wins.length,0);assert.equal(fails.filter(f=>f.reason==='timeout').length,0);assert.ok(h.context.draws.some(d=>d.text==='천천히'));
    for(let i=0;i<1400&&!wins.length;i++)playFrame(h,d.arcade);
    assert.equal(wins.length,1);assert.equal(wins[0].relaxed,true);assert.ok(wins[0].seconds>60);
  }finally{game?.destroy();h.restore();}
});


test('falling food silhouette fits completely inside every reachable slot at phone, tablet and desktop widths',()=>{
  for(const [width,height] of [[320,560],[390,630],[768,860],[1366,720]]){
    const g=trayGeometry(width,height);
    for(let sequence=0;sequence<20;sequence++)for(let slot=0;slot<3;slot++){
      const lane=dropLane(width,sequence),food=fallingFoodGeometry(width,height,.9,lane);
      const trayX=lane*width-(slot-1)*g.compartment;
      assert.ok(trayX>=g.min-1e-8&&trayX<=g.max+1e-8,'full centering is reachable');
      const left=trayX-g.width/2+slot*g.compartment+4,right=left+g.compartment-8;
      assert.ok(food.width<=g.compartment-16,'food is visibly narrower than the bin');
      assert.ok(food.width>=150,'readable term card stays large on phones');
      assert.ok(g.width>=510&&g.height>=160,'tray is enlarged, not the card shrunk');
      assert.ok(food.x-food.width/2>=left&&food.x+food.width/2<=right,'whole text card fits, not just center');
      assert.ok(left>=0&&right<=width,'the receiving bin is fully visible even if idle bins slide out');
      assert.ok(food.x-food.width/2>=0&&food.x+food.width/2<=width,'the complete term never leaves the viewport');
      const landed=fallingFoodGeometry(width,height,1,lane);
      assert.ok(landed.y-landed.height/2>=g.y&&landed.y+landed.height/2<g.y+g.height,'card also fits vertically');
      assert.equal(trayCompartment(food.x,trayX,g.width),slot);
      assert.equal(trayCompartment(food.x+g.compartment,trayX,g.width),slot<2?slot+1:-1,'adjacent compartment does not award requested one');
      assert.equal(trayCompartment(trayX+g.width/2+food.width,trayX,g.width),-1,'outside tray is a miss');
    }
  }
});

test('full readable terms travel inside falling cards, with all three controls visible',()=>{
  for(const [width,height]of [[320,560],[390,740],[1366,720]]){
    const h=harness(width,height),d=data(),seen=new Set();let game;
    try{
      game=start({container:h.container,data:d});h.step(.6);
      for(let frame=0;frame<1180;frame++){
        const card=fallingCard(h);
        if(card){
          assert.ok([...d.arcade.foods,...d.arcade.bonus].some(f=>f.label===card.label),`whole term remains inside card: ${card.label}`);seen.add(card.label);
          assert.ok(card.lines.every(line=>line.size>=(width<600?20:24)));
          assert.ok(card.lines.every(line=>line.width<=card.box.w-20&&line.y-line.size/2>=card.box.y&&line.y+line.size/2<=card.box.y+card.box.h),'wrapped text is wholly inside its moving card');
          const buttons=h.buttons();assert.equal(buttons.length,3);assert.ok(buttons.every(b=>parseFloat(b.style.height)>=64&&parseFloat(b.style.left)>=0&&parseFloat(b.style.left)+parseFloat(b.style.width)<=width+.01));
          assert.ok(!h.context.draws.some(line=>line.text===card.label&&line.y<145),'no duplicate fixed term billboard');
        }
        playFrame(h,d.arcade);
      }
      assert.ok(seen.has('제목 구조')&&seen.has('할루시네이션')&&seen.has('GitHub Pages'),'core and long bonus terms are all rendered in their cards');
    }finally{game?.destroy();h.restore();}
  }
});


test('cafeteria answer feedback appears once, outside the tray and buttons',()=>{
  const h=harness(),fails=[];let game;
  try{
    game=start({container:h.container,data:data(),onFail:p=>fails.push(p)});h.step(.6);
    h.buttons().find(b=>b.attrs['aria-label'].startsWith('2번')).onclick();h.step(2.4);
    assert.equal(fails.length,1);
    const root=h.container.children[0],tip=root.children.find(n=>n.className.startsWith('arcade-feedback-tip'));
    assert.equal(tip.textContent,`! ${fails[0].tip}`);
    assert.equal(root.children.filter(n=>n.className.startsWith('arcade-feedback')).length,1);
    assert.ok(!h.context.draws.some(d=>d.text===fails[0].tip));
    assert.ok(!h.context.draws.some(d=>d.text==='3칸 식판'));
  }finally{game?.destroy();h.restore();}
});
