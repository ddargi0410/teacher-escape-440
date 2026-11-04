import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearchModel,start as screening} from '../minigames/m07.js';
import {createBroadcastModel,start as broadcast} from '../minigames/m08.js';
import {getStage2Arcade} from '../minigames/stage2-content.js';
import {MISSIONS} from '../missions-data.js';

function harness(width=800,height=700){
  let now=0,nextId=0;const frames=new Map();
  function target(){const map=new Map();return{addEventListener(k,f){const s=map.get(k)||new Set();s.add(f);map.set(k,s);},removeEventListener(k,f){map.get(k)?.delete(f);},dispatch(k,event={}){for(const f of map.get(k)||[])f({type:k,target:{tagName:'CANVAS'},preventDefault(){},...event});},listenerCount(){return[...map.values()].reduce((n,s)=>n+s.size,0);}};}
  const context={draws:[],save(){},restore(){},translate(){},rotate(){},scale(){},clearRect(){this.draws=[];},measureText(s){return{width:String(s).length*10};},fillText(s,x,y){this.draws.push({text:String(s),x,y});}};
  for(const fn of ['beginPath','roundRect','fill','stroke','setTransform','fillRect','strokeRect','setLineDash','moveTo','lineTo','arc','ellipse','quadraticCurveTo'])context[fn]=()=>{};
  let doc;
  function node(tag){const n={...target(),tagName:tag.toUpperCase(),children:[],style:{},attrs:{},classList:{add(){},remove(){}},offsetWidth:width,append(...children){for(const c of children){c.parent=this;this.children.push(c);}},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},setAttribute(k,v){this.attrs[k]=String(v);},getBoundingClientRect(){return{left:0,top:0,width,height};},focus(){doc.activeElement=this;},setPointerCapture(){},getContext(){return context;}};return n;}
  doc={...target(),hidden:false,activeElement:null,createElement:node};const win=target(),container=node('div');
  const saved=Object.fromEntries(['document','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{document:doc,window:win,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:true})});
  const walk=n=>[n,...n.children.flatMap(walk)];
  return{container,context,doc,win,frames,step(seconds=.05){for(let i=0;i<Math.ceil(seconds*20);i++){now+=50;const current=[...frames.values()];frames.clear();current.forEach(f=>f(now));}},button(pattern){return walk(container).find(n=>n.tagName==='BUTTON'&&pattern.test(n.attrs['aria-label']));},root(){return container.children[0];},restore(){for(const[k,v]of Object.entries(saved)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
function data(id){const mission=MISSIONS.find(m=>m.id===id);return{...mission,arcade:getStage2Arcade(mission)};}

test('screening never passes an incorrect category, and keeps original sensitive records confiscated',()=>{
  const items=data(7).arcade.items,model=createSearchModel(items),first=model.current;
  assert.equal(model.choose(first.action==='pass'?'confiscate':'pass').correct,false);
  assert.equal(model.cleared,0);for(let i=0;i<11;i++){assert.equal(model.choose(model.current.action).correct,true);}
  assert.equal(model.done,true);assert.equal(model.cleared,11);assert.equal(model.mistakes,1);assert.equal(model.choose('pass'),null);
  for(const item of items.filter(i=>['phone','counsel','character'].includes(i.sourceId)))assert.equal(item.action,'confiscate');
});

test('broadcast applies one change only, cancels overlapping chips, and never wins before saving',()=>{
  const model=createBroadcastModel();assert.equal(model.apply('font'),null);model.connect();assert.equal(model.apply(null).reason,'vague');
  model.apply('font');assert.equal(model.apply('color').reason,'overlap');model.tick(2);assert.equal(model.fixed.size,0);
  for(const fix of ['font','color','button']){model.apply(fix);model.tick(1);}
  assert.equal(model.phase,'save');assert.equal(model.saveLeft,10);assert.equal(model.save().type,'win');assert.equal(model.save(),null);assert.equal(model.tick(100),null);
});

test('broadcast unsaved countdown expires exactly once and cannot be saved late',()=>{
  const model=createBroadcastModel();model.connect();for(const fix of ['font','color','button']){model.apply(fix);model.tick(1);}
  assert.equal(model.tick(9),null);assert.equal(model.tick(1).reason,'unsaved');assert.equal(model.tick(1),null);assert.equal(model.save(),null);
});

test('screening actual keys/buttons require all 11 items and dispose all listeners',()=>{
  const h=harness(),wins=[],fails=[],d=data(7);let game;
  try{game=screening({container:h.container,data:d,onWin:v=>wins.push(v),onFail:v=>fails.push(v)});h.step();
    const labels={pass:/^←/,alias:/^↓/,confiscate:/^→/};
    for(const item of d.arcade.items){h.button(labels[item.action]).onclick();h.step(.8);}
    h.step(2);assert.equal(wins.length,1);assert.equal(wins[0].classified,11);assert.equal(fails.length,0);h.step(4);assert.equal(wins.length,1);
    game.destroy();assert.equal(h.container.children.length,0);assert.equal(h.frames.size,0);assert.equal(h.win.listenerCount(),0);assert.equal(h.doc.listenerCount(),0);
  }finally{game?.destroy();h.restore();}
});

test('broadcast tap interaction, pause/hidden time, saved success and cleanup work together',()=>{
  const h=harness(390,780),wins=[],fails=[],d=data(8);let game;
  try{game=broadcast({container:h.container,data:d,onWin:v=>wins.push(v),onFail:v=>fails.push(v)});h.step();h.button(/현장 입력/).onclick();h.step();
    for(const chip of d.arcade.chips.filter(c=>c.fix)){h.button(new RegExp(chip.label)).onclick();h.step();h.button(/AI 입력칸에/).onclick();h.step(1.1);}
    assert.ok(h.button(/저장하고/));game.pause();h.step(20);game.resume();h.doc.hidden=true;h.step(20);h.doc.hidden=false;h.step(1);
    assert.equal(fails.length,0);h.button(/저장하고/).onclick();h.step(2);assert.equal(wins.length,1);assert.equal(wins[0].saved,true);h.step(20);assert.equal(wins.length,1);
    const root=h.root();game.destroy();assert.equal(root.listenerCount(),0);assert.equal(h.frames.size,0);assert.equal(h.win.listenerCount(),0);assert.equal(h.doc.listenerCount(),0);
  }finally{game?.destroy();h.restore();}
});

test('broadcast drag places a chip and a timeout can be retried without duplicate failure',()=>{
  const h=harness(),fails=[],d=data(8);let game;
  try{game=broadcast({container:h.container,data:d,onFail:v=>fails.push(v)});h.step();h.button(/현장 입력/).onclick();h.step();
    const chip=h.button(/수정 칩 1/),input=h.button(/AI 입력칸에/),center=n=>({clientX:parseFloat(n.style.left)+parseFloat(n.style.width)/2,clientY:parseFloat(n.style.top)+parseFloat(n.style.height)/2,pointerId:1});
    h.root().dispatch('pointerdown',center(chip));h.root().dispatch('pointermove',center(input));h.root().dispatch('pointerup',center(input));h.step(1.1);assert.equal(h.button(/수정 칩 1/).disabled,true);
    h.step(82);assert.equal(fails.length,1);assert.ok(h.button(/방송 다시 복구/));h.step(10);assert.equal(fails.length,1);h.button(/방송 다시 복구/).onclick();h.step();assert.ok(h.button(/현장 입력/));
  }finally{game?.destroy();h.restore();}
});

test('screening active time freezes while paused or hidden; timeout is one event and retry restarts',()=>{
  const h=harness(),fails=[];let game;
  try{game=screening({container:h.container,data:data(7),onFail:v=>fails.push(v)});h.step();game.pause();h.step(100);assert.equal(fails.length,0);game.resume();h.doc.hidden=true;h.step(100);assert.equal(fails.length,0);h.doc.hidden=false;h.step(92);assert.equal(fails.filter(f=>f.reason==='timeout').length,1);h.step(10);assert.equal(fails.filter(f=>f.reason==='timeout').length,1);h.button(/다시 검색/).onclick();h.step();assert.ok(h.button(/^←/));assert.ok(h.context.draws.some(d=>d.text==='✓ 0/11'));
  }finally{game?.destroy();h.restore();}
});
