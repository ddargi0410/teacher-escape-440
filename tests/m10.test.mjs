import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateBossPrompt,createBossAttempt,applyBossDraft,advanceBossAttempt,submitBossAttempt,start} from '../minigames/m10.js';
import {MISSIONS} from '../missions-data.js';
import {getArcadeData} from '../minigames/content.js';
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
for(const phrase of ['글자는 크게','글씨를 크게','10분 안에','5분','쉽게','해설','틀리면 이유를 보여줘']){
  test(`natural condition activates only the constraints shield: ${phrase}`,()=>{
    const isolated=evaluateBossPrompt(phrase);
    assert.deepEqual(isolated.checks.filter(check=>check.passed).map(check=>check.id),['constraints']);
    const draft='너는 과학 개발자야. 초등 5학년의 생태계 퀴즈를 만들어 줘.';
    assert.equal(evaluateBossPrompt(draft).passed,false);
    const result=evaluateBossPrompt(`${draft} ${phrase}`);
    assert.equal(result.count,5);
    assert.equal(result.passed,true);
    assert.equal(result.checks.find(check=>check.id==='output').passed,false);
  });
}
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

test('hint opens clearly, freezes principal and timer, and never writes an answer by itself',()=>{
  const f=fixture();try{
    assert.match(f.find('.m10-task').textContent,/5학년 먹이사슬/);
    assert.match(f.find('textarea').attrs.placeholder,/생물 카드를 놓고 먹이사슬/);
    f.tick(10);const time=f.find('.m10-time').textContent,position=f.scene.getObjectByName('m10-principal').position.clone();
    f.find('.m10-hint-button').dispatch('click');assert.equal(f.find('.m10-hints').hidden,false);assert.equal(f.game.isPaused(),true);
    assert.match(f.find('.m10-hint-progress').textContent,/읽는 동안 시간 정지/);
    f.tick(200);assert.equal(f.find('.m10-time').textContent,time);assert.deepEqual(f.scene.getObjectByName('m10-principal').position,position);assert.equal(f.fails.length,0);
    f.find('.m10-hint-next').dispatch('click');f.find('.m10-hint-next').dispatch('click');assert.equal(f.find('.m10-hint-insert').hidden,false);
    assert.match(f.find('.m10-hint-copy').textContent,/화살표/);assert.equal(f.find('textarea').value,'');assert.equal(f.game.getDraft(),'');assert.equal(f.wins.length,0);
    f.find('.m10-hint-close').dispatch('click');assert.equal(f.game.isPaused(),false);f.tick(1);assert.equal(f.find('.m10-time').textContent,'79초');
  }finally{f.cleanup();}
});
test('explicit example insertion preserves existing writing and persists draft without automatic win',()=>{
  const f=fixture('나는 큰 글씨가 좋아.');try{
    f.game.hint();f.find('.m10-hint-next').dispatch('click');f.find('.m10-hint-next').dispatch('click');
    assert.equal(f.find('.m10-hint-insert').textContent,'쓴 글 뒤에 예시 붙이기');f.find('.m10-hint-insert').dispatch('click');
    assert.match(f.find('textarea').value,/^나는 큰 글씨가 좋아\.\n\n너는/);assert.equal(f.game.getDraft(),f.find('textarea').value);assert.equal(f.events.at(-1).detail.prompt,f.game.getDraft());
    assert.equal(f.find('.m10-hints').hidden,true);assert.equal(f.find('.m10-leave').disabled,false);assert.equal(f.wins.length,0);
  }finally{f.cleanup();}
});
test('hint pause remains independent from runner pause and Escape returns focus safely',()=>{
  const f=fixture();try{
    f.tick(5);f.game.hint();f.game.pause();f.find('.m10-hint-sheet').dispatch('keydown',{key:'Escape'});
    assert.equal(f.find('.m10-hints').hidden,true);assert.equal(f.game.isPaused(),true);f.tick(200);assert.equal(f.fails.length,0);
    assert.equal(f.doc.activeElement,f.find('.m10-hint-button'));f.game.resume();assert.equal(f.game.isPaused(),false);f.tick(1);assert.equal(f.find('.m10-time').textContent,'84초');
  }finally{f.cleanup();}
});

test('the actual food-chain activity example activates all six shields without the word quiz',()=>{
  const {arcade}=getArcadeData(MISSIONS.find(m=>m.id===10));
  assert.match(arcade.sample,/먹이사슬/);assert.match(arcade.sample,/화살표/);assert.equal(evaluateBossPrompt(arcade.sample).count,6);
  assert.equal(evaluateBossPrompt('생물 카드를 순서대로 놓고 화살표로 연결하는 활동').checks.find(c=>c.id==='format').passed,true);
});
