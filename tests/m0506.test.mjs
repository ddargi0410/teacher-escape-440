import test from 'node:test';
import assert from 'node:assert/strict';
import {start as bugs,judgeReportDrop} from '../minigames/m05.js';
import {start as science,swipeHitsBubble,judgeScienceAction} from '../minigames/m06.js';
import {getStage2Arcade} from '../minigames/stage2-content.js';
import {MISSIONS} from '../missions-data.js';

// Small deterministic canvas/event harness. Tests drive actual controls and
// animation time; no private game state is patched to manufacture a victory.
function harness({width=800,height=700}={}){
  let now=0,nextId=0;const frames=new Map();
  function target(){const map=new Map();return{addEventListener(k,f){const s=map.get(k)||new Set();s.add(f);map.set(k,s);},removeEventListener(k,f){map.get(k)?.delete(f);},dispatch(k,event={}){for(const f of map.get(k)||[])f({type:k,target:{tagName:'CANVAS'},preventDefault(){},...event});},listenerCount(){return[...map.values()].reduce((n,s)=>n+s.size,0);}};}
  const context={draws:[],tx:0,ty:0,stack:[],save(){this.stack.push([this.tx,this.ty]);},restore(){[this.tx,this.ty]=this.stack.pop()||[0,0];},translate(x,y){this.tx+=x;this.ty+=y;},rotate(){},scale(){},clearRect(){this.draws=[];this.tx=0;this.ty=0;},measureText(s){return{width:String(s).length*11};},fillText(s,x,y){this.draws.push({text:String(s),x:x+this.tx,y:y+this.ty});}};
  for(const fn of ['beginPath','closePath','roundRect','rect','clip','fill','stroke','setTransform','fillRect','moveTo','lineTo','arc','ellipse','quadraticCurveTo'])context[fn]=()=>{};
  let doc;
  function node(tag){return{...target(),tagName:tag.toUpperCase(),children:[],style:{},attrs:{},classList:{add(){},remove(){}},offsetWidth:width,append(...children){for(const c of children){c.parent=this;this.children.push(c);}},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},setAttribute(k,v){this.attrs[k]=String(v);},getBoundingClientRect(){return{left:0,top:0,width,height};},focus(){doc.activeElement=this;},setPointerCapture(){},getContext(){return context;}};}
  doc={...target(),hidden:false,activeElement:null,createElement:node};const win=target(),container=node('div');
  const saved=Object.fromEntries(['document','window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','matchMedia'].map(k=>[k,globalThis[k]]));
  Object.assign(globalThis,{document:doc,window:win,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),matchMedia:()=>({matches:true})});
  const walk=n=>[n,...n.children.flatMap(walk)];
  return{container,context,doc,win,frames,step(seconds=.05,frameMs=50){for(let i=0;i<Math.ceil(seconds*1000/frameMs);i++){now+=frameMs;const current=[...frames.values()];frames.clear();current.forEach(f=>f(now));}},buttons(){return walk(container).filter(n=>n.tagName==='BUTTON');},canvas(){return walk(container).find(n=>n.tagName==='CANVAS');},restore(){for(const[k,v]of Object.entries(saved)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}
const data=id=>({...MISSIONS[id-1],arcade:getStage2Arcade(MISSIONS[id-1])});
function button(h,pattern){return h.buttons().find(b=>pattern.test(b.attrs['aria-label']));}
const click=(h,pattern)=>{const b=button(h,pattern);assert.ok(b,`Missing control: ${pattern}`);b.onclick();h.step(.05);return b;};
function fillBug(h,issue,slots){for(const fragment of issue.fragments){click(h,new RegExp(`^조각 선택: ${fragment.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`));click(h,new RegExp(`^${slots.find(s=>s.id===fragment.slot).label} 칸에 놓기$`));}h.step(.9);}

test('error report only accepts matching empty semantic slots',()=>{
  const fragment={slot:'symptom'};
  assert.equal(judgeReportDrop(fragment,'symptom'),true);
  assert.equal(judgeReportDrop(fragment,'error'),false);
  assert.equal(judgeReportDrop(fragment,'symptom',{symptom:fragment}),false);
});

test('bug hunt needs three complete reports; an incorrect drop reveals but never fills a slot',()=>{
  const h=harness(),d=data(5),wins=[],fails=[];let game;
  try{
    game=bugs({container:h.container,data:d,onWin:p=>wins.push(p),onFail:p=>fails.push(p)});h.step(.1);
    click(h,/모니터 벌레 잡기/);
    click(h,/조각 선택: 다시 시작해도 3점/);click(h,/^기대 칸에 놓기$/);
    assert.equal(fails.length,1);assert.ok(button(h,/^기대 칸에 놓기$/));assert.ok(button(h,/^증상 칸에 놓기$/));assert.equal(wins.length,0);
    for(let i=0;i<d.arcade.bugs.length;i++){if(i)click(h,/모니터 벌레 잡기/);fillBug(h,d.arcade.bugs[i],d.arcade.slots);}
    h.step(3);assert.equal(wins.length,1);assert.equal(wins[0].caught,3);assert.equal(wins[0].mistakes,1);h.step(3);assert.equal(wins.length,1);
    const root=h.container.children[0];game.destroy();assert.equal(root.listenerCount(),0);assert.equal(h.win.listenerCount(),0);assert.equal(h.doc.listenerCount(),0);assert.equal(h.frames.size,0);assert.equal(h.container.children.length,0);
  }finally{game?.destroy();h.restore();}
});

test('bug report drag-and-drop uses displayed geometry and commits once',()=>{
  const h=harness({width:390,height:740}),d=data(5),fails=[];let game;
  try{
    game=bugs({container:h.container,data:d,onFail:p=>fails.push(p)});h.step(.1);click(h,/모니터 벌레 잡기/);
    const piece=button(h,/조각 선택: 다시 시작해도 3점/),slot=button(h,/^증상 칸에 놓기$/),center=b=>({clientX:parseFloat(b.style.left)+parseFloat(b.style.width)/2,clientY:parseFloat(b.style.top)+parseFloat(b.style.height)/2,pointerId:1});
    const root=h.container.children[0];root.dispatch('pointerdown',center(piece));root.dispatch('pointermove',center(slot));root.dispatch('pointerup',center(slot));h.step(.1);
    assert.equal(fails.length,0);assert.equal(button(h,/조각 선택: 다시 시작해도 3점/),undefined);assert.equal(button(h,/^증상 칸에 놓기$/),undefined);
    assert.ok(button(h,/^기대 칸에 놓기$/));
  }finally{game?.destroy();h.restore();}
});

test('bug hunt pauses active time, times out once, and restarts with all bugs unresolved',()=>{
  const h=harness(),fails=[],wins=[];let game;
  try{
    game=bugs({container:h.container,data:data(5),onFail:p=>fails.push(p),onWin:p=>wins.push(p)});h.step(1);
    game.pause();h.step(100,1000);assert.equal(fails.length,0);game.resume();h.doc.hidden=true;h.step(100,1000);assert.equal(fails.length,0);h.doc.hidden=false;
    h.step(92,100);assert.equal(fails.filter(f=>f.reason==='timeout').length,1);h.step(5);assert.equal(fails.length,1);assert.equal(wins.length,0);
    click(h,/버그 잡기 다시 도전/);assert.ok(button(h,/모니터 벌레 잡기/));assert.ok(h.context.draws.some(d=>d.text==='✓ 0/3'));
  }finally{game?.destroy();h.restore();}
});

test('science swipe finds fast crossings and rejects unrelated trails; correct statements must be kept',()=>{
  const box={x:100,y:100,w:200,h:80};
  assert.equal(swipeHitsBubble({x:0,y:140},{x:400,y:140},box),true);
  assert.equal(swipeHitsBubble({x:0,y:20},{x:400,y:20},box),false);
  assert.equal(swipeHitsBubble({x:150,y:110},{x:150,y:150},box),true);
  assert.equal(judgeScienceAction({wrong:true},'slice'),true);
  assert.equal(judgeScienceAction({wrong:false},'slice'),false);
  assert.equal(judgeScienceAction({wrong:false},'keep'),true);
});

test('science game requires all nine correct classifications and replays an incorrectly cut true statement',()=>{
  const h=harness(),d=data(6),wins=[],fails=[];let game;
  try{
    game=science({container:h.container,data:d,onWin:p=>wins.push(p),onFail:p=>fails.push(p)});h.step(.2);
    for(let i=0;i<9;i++){
      const deliberatelyWrong=i===1;
      click(h,d.arcade.statements[i].wrong||deliberatelyWrong?/틀린 문장 자르기/:/맞는 문장 학습지로 보내기/);
      h.step(deliberatelyWrong?2.2:.8);
    }
    assert.equal(wins.length,0);assert.equal(fails.length,1);assert.equal(fails[0].reason,'cut-correct-statement');
    click(h,/맞는 문장 학습지로 보내기/);h.step(3);assert.equal(wins.length,1);assert.equal(wins[0].verified,9);h.step(3);assert.equal(wins.length,1);
    game.destroy();assert.equal(h.frames.size,0);assert.equal(h.win.listenerCount(),0);assert.equal(h.doc.listenerCount(),0);
  }finally{game?.destroy();h.restore();}
});

test('science bubble is actually sliced by a mouse or touch swipe across its visible sentence',()=>{
  const h=harness({width:390,height:740}),fails=[];let game;
  try{
    game=science({container:h.container,data:data(6),onFail:p=>fails.push(p)});h.step(1.3);
    const sentence=h.context.draws.find(d=>d.text.includes('AI가 준'));assert.ok(sentence);
    h.canvas().dispatch('pointerdown',{clientX:5,clientY:sentence.y,pointerType:'touch'});
    h.canvas().dispatch('pointermove',{clientX:385,clientY:sentence.y,pointerType:'touch'});h.canvas().dispatch('pointerup',{clientX:385,clientY:sentence.y,pointerType:'touch'});h.step(.1);
    assert.equal(fails.length,0);assert.ok(h.context.draws.some(d=>d.text==='✓ 1/9'));
  }finally{game?.destroy();h.restore();}
});

test('leaving wrong statements alone cannot win; pause and hidden tabs do not consume the science timer',()=>{
  const h=harness(),fails=[],wins=[];let game;
  try{
    game=science({container:h.container,data:data(6),onFail:p=>fails.push(p),onWin:p=>wins.push(p)});h.step(.2);game.pause();h.step(100,1000);assert.equal(fails.length,0);game.resume();h.doc.hidden=true;h.step(100,1000);assert.equal(fails.length,0);h.doc.hidden=false;
    h.step(95,100);assert.equal(wins.length,0);assert.equal(fails.filter(f=>f.reason==='timeout').length,1);const count=fails.length;h.step(10);assert.equal(fails.length,count);
    click(h,/AI 작업 습관 다시 검증하기/);assert.ok(h.context.draws.some(d=>d.text==='✓ 0/9'));assert.ok(button(h,/틀린 문장 자르기/));
  }finally{game?.destroy();h.restore();}
});
