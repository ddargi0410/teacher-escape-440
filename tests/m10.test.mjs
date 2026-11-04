import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBossPrompt,createBossAttempt,applyBossDraft,advanceBossAttempt,submitBossAttempt,start} from '../minigames/m10.js';
import {SoftwareRenderer} from '../software-renderer.js';
import {createDocument} from './dom-stub.mjs';

const all='너는 과학 자료 개발 도우미야. 초등학교 5학년의 먹이 관계 퀴즈를 태블릿에서 쓰게 HTML 파일로 만들어 줘.';
const five='너는 과학 개발자야. 초등 5학년의 생태계 퀴즈를 HTML 파일로 만들어 줘.';
test('five meaningful shields are sufficient; format and output stay distinct',()=>{
  const result=evaluateBossPrompt(five);assert.equal(result.count,5);assert.equal(result.passed,true);assert.equal(result.checks.find(c=>c.id==='constraints').passed,false);
  assert.equal(evaluateBossPrompt('역할 대상 주제 형식 조건 출력').count,0);
  assert.equal(evaluateBossPrompt('HTML 파일').checks.find(c=>c.id==='format').passed,false);
  assert.equal(evaluateBossPrompt('퀴즈').checks.find(c=>c.id==='output').passed,false);
  assert.equal(evaluateBossPrompt('너는 개발자야. 초등학교 5학년 생태계').passed,false);
});
test('no minimum or maximum length; current draft re-evaluated rather than sticky success',()=>{
  assert.ok(five.length<120);assert.equal(evaluateBossPrompt(five).passed,true);
  const long=all+' 확인한 내용은 유지해 줘.'.repeat(1000);assert.ok(long.length>6000);assert.equal(evaluateBossPrompt(long).count,6);
  const state=createBossAttempt();applyBossDraft(state,all);applyBossDraft(state,'');assert.equal(submitBossAttempt(state),false);
});
test('one pushback per shield per attempt prevents toggling from farming protection',()=>{
  const state=createBossAttempt();assert.equal(applyBossDraft(state,all),6);const firstKick=state.kick;
  advanceBossAttempt(state,1);assert.ok(state.kick<firstKick);const reduced=state.kick;
  assert.equal(applyBossDraft(state,''),0);assert.equal(applyBossDraft(state,all),0);assert.equal(state.kick,reduced);
  assert.equal(state.result.count,6);assert.equal(state.earned.size,6);
});
test('deadline is bounded and timeout emitted once, retry keeps exactly the draft',()=>{
  const state=createBossAttempt(five);assert.equal(advanceBossAttempt(state,91),true);assert.equal(state.phase,'timeout');assert.equal(advanceBossAttempt(state,91),false);assert.equal(submitBossAttempt(state),false);
  const retry=createBossAttempt(state.draft,state.duration);assert.equal(retry.draft,five);assert.equal(retry.elapsed,0);assert.equal(submitBossAttempt(retry),true);assert.equal(submitBossAttempt(retry),false);
});

function fixture(initialPrompt=''){
  const previous=new Map(),assign=(key,value)=>{previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});};
  const doc=createDocument(),listeners=new Map();
  function emitter(target){const map=new Map();listeners.set(target,map);target.addEventListener=(type,fn)=>{if(!map.has(type))map.set(type,new Set());map.get(type).add(fn);};target.removeEventListener=(type,fn)=>map.get(type)?.delete(fn);target.dispatch=(type,props={})=>{const e={type,target,preventDefault(){},stopPropagation(){},...props};[...(map.get(type)||[])].forEach(fn=>fn(e));};return target;}
  emitter(doc);const proto=Object.getPrototypeOf(doc.createElement('div')),old=new Map();
  const patch=(name,descriptor)=>{old.set(name,Object.getOwnPropertyDescriptor(proto,name));Object.defineProperty(proto,name,{configurable:true,...('value'in descriptor?{writable:true}:{}),...descriptor});};
  patch('style',{get(){return this._style||={};}});patch('className',{get(){return this.attrs.class||'';},set(v){this.attrs.class=v;}});
  patch('setAttribute',{value(k,v){this.attrs[k]=String(v);}});patch('appendChild',{value(node){this.append(node);return node;}});
  patch('remove',{value(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}});
  patch('getBoundingClientRect',{value(){return{width:720,height:800,left:0,top:0};}});
  patch('addEventListener',{value(type,fn){if(!listeners.has(this))emitter(this);this.addEventListener(type,fn);}});patch('removeEventListener',{value(type,fn){listeners.get(this)?.get(type)?.delete(fn);}});
  const events=[];patch('dispatchEvent',{value(e){events.push(e);return true;}});
  patch('getContext',{value(type){return type==='2d'?{fillRect(){},fillText(){}}:null;}});
  const win=emitter({});let now=0,next=0,disposed=0,renderedScene;const frames=new Map();
  assign('document',doc);assign('window',win);assign('performance',{now:()=>now});assign('devicePixelRatio',1);assign('ResizeObserver',undefined);
  assign('CustomEvent',class{constructor(type,options){this.type=type;Object.assign(this,options);}});
  assign('requestAnimationFrame',fn=>{const id=++next;frames.set(id,fn);return id;});assign('cancelAnimationFrame',id=>frames.delete(id));
  const realRender=SoftwareRenderer.prototype.render,realDispose=SoftwareRenderer.prototype.dispose;SoftwareRenderer.prototype.render=function(scene,camera){scene.updateMatrixWorld();camera.updateMatrixWorld();renderedScene=scene;};SoftwareRenderer.prototype.dispose=function(){disposed++;realDispose.call(this);};
  const error=console.error;console.error=()=>{};const container=doc.createElement('div'),wins=[],fails=[];
  const game=start({container,data:{arcade:{duration:90},initialPrompt},onWin:r=>wins.push(r),onFail:r=>fails.push(r)});console.error=error;
  const tick=seconds=>{now+=seconds*1000;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));};
  const find=selector=>{const el=container.querySelector(selector);assert.ok(el,selector);return el;};
  return{game,doc,container,wins,fails,events,tick,find,get scene(){return renderedScene;},get pendingFrames(){return frames.size;},get disposed(){return disposed;},get listenerCount(){return[...listeners.values()].reduce((s,m)=>s+[...m.values()].reduce((n,set)=>n+set.size,0),0);},cleanup(){game.destroy();SoftwareRenderer.prototype.render=realRender;SoftwareRenderer.prototype.dispose=realDispose;for(const[k,d]of old)d?Object.defineProperty(proto,k,d):delete proto[k];for(const[k,d]of previous)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];}};
}

test('typing emits a persistent draft, five shields unlock exit and scene shrinks before one award',()=>{
  const f=fixture();try{
    const input=f.find('textarea'),button=f.find('.m10-leave');assert.equal(button.disabled,true);assert.equal(input.attrs.maxlength,undefined);
    input.value=five;input.dispatch('input');assert.equal(button.disabled,false);assert.equal(f.events.at(-1).detail.prompt,five);assert.equal(f.find('.m10-count').textContent,'5 / 6');
    button.dispatch('click');f.tick(.7);assert.equal(f.wins.length,0);assert.ok(f.scene.getObjectByName('m10-principal').scale.x<1);
    f.tick(.7);assert.equal(f.wins.length,1);assert.equal(f.wins[0].prompt,five);assert.equal(f.wins[0].rubric.filter(c=>c.passed).length,5);f.tick(120);assert.equal(f.wins.length,1);assert.equal(f.fails.length,0);
  }finally{f.cleanup();}
});
test('hidden and paused time is ignored; deadline retains text and retry becomes editable',()=>{
  const f=fixture(all);try{
    f.tick(10);const time=f.find('.m10-time').textContent;f.game.pause();f.tick(200);assert.equal(f.find('.m10-time').textContent,time);assert.equal(f.fails.length,0);f.game.resume();
    f.doc.hidden=true;f.doc.dispatch('visibilitychange');f.tick(200);assert.equal(f.fails.length,0);f.doc.hidden=false;f.doc.dispatch('visibilitychange');f.tick(81);
    assert.equal(f.fails.length,1);assert.equal(f.find('.m10-retry').hidden,false);assert.equal(f.find('textarea').value,all);assert.equal(f.find('textarea').readOnly,true);f.tick(100);assert.equal(f.fails.length,1);
    f.find('.m10-retry').dispatch('click');assert.equal(f.find('textarea').value,all);assert.equal(f.find('textarea').readOnly,false);assert.equal(f.find('.m10-leave').disabled,false);assert.equal(f.find('.m10-retry').hidden,true);
  }finally{f.cleanup();}
});
test('destroy releases RAF, events and rendering resources exactly once',()=>{
  const f=fixture();try{f.game.destroy();f.game.destroy();assert.equal(f.pendingFrames,0);assert.equal(f.listenerCount,0);assert.equal(f.disposed,1);assert.equal(f.container.children.length,0);f.tick(100);assert.equal(f.fails.length,0);}finally{f.cleanup();}
});
