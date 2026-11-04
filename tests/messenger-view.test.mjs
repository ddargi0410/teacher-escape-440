import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-stub.mjs';
import {createSchoolMessenger} from '../messenger.js';

// Extend the existing small DOM fixture locally for event-driven inbox behavior.
// Layout, animation and real keyboard focus are verified in the browser.
const prototype=Object.getPrototypeOf(createDocument().createElement('div'));
Object.defineProperty(prototype,'className',{
  get(){return this.attrs.class||'';},set(value){this.attrs.class=String(value);}
});
prototype.setAttribute=function(name,value){this.attrs[name]=String(value);};
prototype.addEventListener=function(type,handler){
  this.events??=new Map();const handlers=this.events.get(type)||new Set();
  handlers.add(handler);this.events.set(type,handlers);
};
prototype.removeEventListener=function(type,handler){this.events?.get(type)?.delete(handler);};
prototype.dispatch=function(type,event={}){
  for(const handler of this.events?.get(type)||[])handler({target:this,...event});
};
prototype.click=function(){if(!this.disabled)this.dispatch('click');};
prototype.contains=function(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;};
prototype.blur=function(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=null;};
prototype.remove=function(){
  if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);
  this.parentNode=null;
};

function fixture(name='정시퇴근 선생님'){
  const document=createDocument();document.body=document.createElement('body');
  globalThis.document=document;
  const state={name,completed:[],finished:false};
  let sounds=0;const located=[];
  const view=createSchoolMessenger({getState:()=>state,onSound:()=>sounds++,onLocate:id=>located.push(id)});
  const box=document.body.querySelector('.school-messenger');
  return {document,state,view,box,located,get sounds(){return sounds;},
    show(){view.update(26,true);assert.equal(view.isOpen(),true);},
    click(name){box.querySelector(`[data-note="${name}"]`).click();},
    field(name){return box.querySelector(`[data-field="${name}"]`);}};
}

test('inbox appears without stealing focus and treats player names as text',()=>{
  const f=fixture('<img src=x onerror=alert(1)>');
  const focus=f.document.createElement('button');focus.focus();
  f.show();
  assert.equal(f.document.activeElement,focus);
  assert.equal(f.sounds,1);
  assert.match(f.field('recipient').textContent,/<img src=x onerror=alert\(1\)>/);
  assert.equal(f.box.querySelector('img'),null);
  assert.match(f.field('task').textContent,/미완료/);
  f.view.dispose();
});

test('suspension preserves reading time and resuming does not ring twice',()=>{
  const f=fixture();f.show();f.view.update(5,true);
  f.view.suspend();assert.equal(f.view.isOpen(),false);
  f.view.update(1000,false);f.view.update(0,true);
  assert.equal(f.view.isOpen(),true);assert.equal(f.sounds,1);
  assert.equal(f.field('seconds').textContent,'9');
  f.view.update(8.9,true);assert.equal(f.view.isOpen(),true);
  f.view.update(.2,true);assert.equal(f.view.isOpen(),false);
  f.view.dispose();
});

test('completing the target while a minigame is open removes the stale reminder',()=>{
  const f=fixture();f.show();const first=Number(f.box.dataset.missionId);
  f.view.suspend();f.state.completed.push(first);f.view.update(10,false);
  f.view.update(0,true);assert.equal(f.view.isOpen(),false);
  f.view.update(60,true);assert.equal(f.view.isOpen(),true);
  assert.notEqual(Number(f.box.dataset.missionId),first);
  f.state.finished=true;f.view.update(0,false);assert.equal(f.view.isOpen(),false);
  f.view.dispose();
});

test('location button dismisses and routes once even if clicked twice',()=>{
  const f=fixture();f.show();const id=Number(f.box.dataset.missionId);
  f.click('go');f.click('go');
  assert.deepEqual(f.located,[id]);assert.equal(f.view.isOpen(),false);
  assert.deepEqual(f.state.completed,[]);
  f.view.dispose();
});

test('acknowledgement is local flavor and closes without completing the mission',()=>{
  const f=fixture();f.show();f.click('ack');
  assert.equal(f.field('reply').hidden,false);
  assert.match(f.field('status').textContent,/속마음/);
  f.view.update(1.3,true);assert.equal(f.view.isOpen(),true);
  f.view.update(.2,true);assert.equal(f.view.isOpen(),false);
  assert.deepEqual(f.state.completed,[]);assert.equal(f.sounds,1);
  f.view.dispose();
});

test('one-minute snooze cannot be bypassed by nearby vice-principal requests',()=>{
  const f=fixture();f.show();f.click('later');
  f.view.update(59,true);f.view.request();assert.equal(f.view.isOpen(),false);
  f.view.update(1000,false);f.view.request();assert.equal(f.view.isOpen(),false);
  f.view.update(1,true);assert.equal(f.view.isOpen(),true);
  assert.equal(f.sounds,2);f.view.dispose();
});

test('popup consumes its own hotkeys, preserves Escape and releases walking keyup',()=>{
  const f=fixture();f.show();let stopped=0;
  const event={stopPropagation:()=>stopped++};
  f.box.dispatch('keydown',{key:'w',...event});assert.equal(stopped,1);
  f.box.dispatch('keydown',{key:'Escape',...event});assert.equal(stopped,1);
  f.box.dispatch('keyup',{key:'w',...event});assert.equal(stopped,1);
  f.view.dispose();assert.equal(f.document.body.children.length,0);
  f.box.dispatch('keydown',{key:'w',...event});assert.equal(stopped,1);
  f.view.update(100,true);f.view.request();assert.equal(f.sounds,1);
  assert.equal(f.view.isOpen(),false);
});
