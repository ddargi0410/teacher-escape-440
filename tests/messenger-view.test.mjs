import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './dom-stub.mjs';
import {createSchoolMessenger} from '../messenger.js';
import {MESSENGER_STORAGE_KEY} from '../messenger-history.js';

// Extend the small DOM fixture for event-driven inbox behavior. Real layout and
// browser focus are checked separately; these tests exercise actual state/actions.
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
prototype.click=function(){if(!this.disabled){this.dispatch('click');this.onclick?.({target:this});}};
prototype.contains=function(node){for(let n=node;n;n=n.parentNode)if(n===this)return true;return false;};
prototype.blur=function(){if(this.ownerDocument.activeElement===this)this.ownerDocument.activeElement=null;};
prototype.remove=function(){
  if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);
  this.parentNode=null;
};
const memoryStorage=()=>{
  const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
};

function fixture({name='정시퇴근 선생님',storage=memoryStorage(),random=()=>0}={}){
  const document=createDocument();document.body=document.createElement('body');
  globalThis.document=document;
  const state={name,completed:[],finished:false};
  let sounds=0;const located=[],archiveEvents=[],counts=[];
  const view=createSchoolMessenger({getState:()=>state,storage,random,onSound:()=>sounds++,
    onLocate:id=>located.push({id,archiveOpen:view.isArchiveOpen()}),
    onArchiveChange:open=>archiveEvents.push(open),onHistoryChange:count=>counts.push(count)});
  const box=document.body.querySelector('.school-messenger'),archive=document.body.querySelector('.messenger-archive');
  return {document,state,view,box,archive,located,archiveEvents,counts,storage,get sounds(){return sounds;},
    show(){view.update(26,true);assert.equal(view.isOpen(),true);},
    click(name){box.querySelector(`[data-note="${name}"]`).click();},
    archiveClick(name){archive.querySelector(`[data-archive="${name}"]`).click();},
    field(name){return box.querySelector(`[data-field="${name}"]`);}};
}

test('inbox appears without stealing focus and treats player names as text',()=>{
  const f=fixture({name:'<img src=x onerror=alert(1)>'});
  const focus=f.document.createElement('button');focus.focus();f.show();
  assert.equal(f.document.activeElement,focus);assert.equal(f.sounds,1);
  assert.match(f.field('recipient').textContent,/<img src=x onerror=alert\(1\)>/);
  assert.equal(f.box.querySelector('img'),null);assert.match(f.field('task').textContent,/미완료/);
  assert.equal(f.view.historyCount(),1);assert.deepEqual(f.counts,[0,1]);
  assert.ok(!f.storage.getItem(MESSENGER_STORAGE_KEY).includes('onerror'));
  f.view.dispose();
});

test('a received message never times out or gets replaced, including after suspension',()=>{
  const f=fixture();f.show();const subject=f.field('subject').textContent;
  f.view.update(10000,true);f.view.request();
  assert.equal(f.view.isOpen(),true);assert.equal(f.field('subject').textContent,subject);
  f.view.suspend();assert.equal(f.view.isOpen(),false);
  f.view.update(10000,false);f.view.update(0,true);
  assert.equal(f.view.isOpen(),true);assert.equal(f.sounds,1);
  assert.equal(f.view.historyCount(),1);
  assert.equal(f.box.querySelector('[data-field="seconds"]'),null);
  for(const name of ['close','later','minimize','delete'])assert.equal(f.box.querySelector(`[data-note="${name}"]`),null);
  f.view.dispose();
});

test('finishing a target elsewhere preserves the received note and updates its completion label',()=>{
  const f=fixture();f.show();const first=Number(f.box.dataset.missionId);
  f.view.suspend();f.state.completed.push(first);f.view.update(10,false);f.view.update(0,true);
  assert.equal(f.view.isOpen(),true);assert.equal(Number(f.box.dataset.missionId),first);
  assert.match(f.field('task').textContent,/완료한 업무/);
  f.click('ack');f.view.update(60,true);
  assert.notEqual(Number(f.box.dataset.missionId),first);
  assert.equal(f.view.historyCount(),2);f.view.dispose();
});

test('location confirms once and routes without completing the mission',()=>{
  const f=fixture();f.show();const id=Number(f.box.dataset.missionId);
  f.click('go');f.click('go');
  assert.deepEqual(f.located,[{id,archiveOpen:false}]);assert.equal(f.view.isOpen(),false);
  assert.deepEqual(f.state.completed,[]);
  const saved=JSON.parse(f.storage.getItem(MESSENGER_STORAGE_KEY));
  assert.equal(saved.entries.length,1);assert.ok(saved.entries[0].acknowledgedAt!==null);
  f.view.dispose();
});

test('confirmation closes immediately and starts the next-message wait only afterward',()=>{
  const f=fixture();f.show();f.view.update(10000,true);f.click('ack');
  assert.equal(f.view.isOpen(),false);f.view.request();assert.equal(f.view.isOpen(),false);
  f.view.update(34.9,true);assert.equal(f.view.isOpen(),false);
  f.view.update(.1,true);assert.equal(f.view.isOpen(),true);
  assert.deepEqual(f.state.completed,[]);assert.equal(f.sounds,2);f.view.dispose();
});

test('unrelated random notes have no task travel and remain in the archive after confirmation',()=>{
  const f=fixture({random:()=>.99});f.show();f.click('ack');f.view.update(60,true);
  assert.equal(f.view.isOpen(),true);assert.match(f.field('task').textContent,/수다/);
  assert.equal(f.box.querySelector('[data-note="go"]').hidden,true);
  f.click('go');assert.equal(f.view.isOpen(),true);assert.deepEqual(f.located,[]);
  const subject=f.field('subject').textContent;f.click('ack');f.view.openArchive();
  assert.equal(f.archive.querySelector('[data-history="subject"]').textContent,subject);
  assert.equal(f.archive.querySelector('[data-archive="go"]').hidden,true);
  assert.equal(f.archive.querySelectorAll('.messenger-history-row').length,2);
  assert.match(f.archive.querySelector('[data-history="reply"]').textContent,/내 속마음/);
  f.view.dispose();
});

test('archive viewing does not acknowledge; mission travel closes archive before its callback',()=>{
  const f=fixture();f.show();const id=Number(f.box.dataset.missionId);
  assert.deepEqual(f.archiveEvents,[],'constructor must not call archive hooks before game initialization');
  f.click('archive');assert.equal(f.view.isArchiveOpen(),true);assert.equal(f.view.isOpen(),false);
  assert.match(f.archive.querySelector('[data-history="meta"]').textContent,/확인 전/);
  f.view.update(500,false);f.view.closeArchive();f.view.update(0,true);
  assert.equal(f.view.isOpen(),true);assert.equal(f.sounds,1);
  f.view.openArchive();f.archiveClick('go');f.archiveClick('go');
  assert.deepEqual(f.located,[{id,archiveOpen:false}]);assert.equal(f.view.isOpen(),false);
  assert.equal(f.view.isArchiveOpen(),false);assert.deepEqual(f.archiveEvents,[true,false,true,false]);
  f.view.dispose();
});

test('archive traps keyboard focus, restores origin and lets the game handle Escape',()=>{
  const f=fixture();const origin=f.document.createElement('button');f.document.body.append(origin);origin.focus();
  f.view.openArchive();const close=f.archive.querySelector('[data-archive="close"]');
  assert.equal(f.document.activeElement,close);let stopped=0,prevented=0;
  const event={stopPropagation:()=>stopped++,preventDefault:()=>prevented++};
  f.archive.dispatch('keydown',{key:'Tab',shiftKey:true,...event});
  assert.equal(f.document.activeElement,close);assert.equal(prevented,1);
  f.archive.dispatch('keydown',{key:'Escape',...event});assert.equal(stopped,1);
  f.view.closeArchive();assert.equal(f.document.activeElement,origin);f.view.dispose();
});

test('reload and continue restore unread notes; only new-game reset clears history',()=>{
  const storage=memoryStorage(),first=fixture({storage});first.show();
  const subject=first.field('subject').textContent;first.view.dispose();
  const resumed=fixture({storage});resumed.view.update(0,true);
  assert.equal(resumed.field('subject').textContent,subject);assert.equal(resumed.sounds,0);
  resumed.view.reset();assert.equal(resumed.view.isOpen(),false);assert.equal(resumed.view.historyCount(),1);
  resumed.view.update(0,true);assert.equal(resumed.view.isOpen(),true);
  resumed.click('ack');resumed.view.reset();assert.equal(resumed.view.historyCount(),1);
  resumed.view.openArchive();assert.match(resumed.archive.querySelector('[data-history="meta"]').textContent,/확인함/);
  resumed.view.reset({clearHistory:true});assert.equal(resumed.view.historyCount(),0);
  resumed.view.update(0,true);assert.equal(resumed.view.isOpen(),false);
  assert.deepEqual(JSON.parse(storage.getItem(MESSENGER_STORAGE_KEY)).entries,[]);
  resumed.view.dispose();
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

test('legacy inbox senders display current names without changing stored messages',()=>{
  const storage=memoryStorage();
  const entry={id:'legacy-note',kind:'mission',missionId:1,sender:'학년부장 · 교실 담당',
    subject:'기존 쪽지 제목',lines:['기존 첫 문장','기존 둘째 문장'],reply:'기존 답장',receivedAt:1,acknowledgedAt:null};
  const saved=JSON.stringify({version:1,entries:[entry]});storage.setItem(MESSENGER_STORAGE_KEY,saved);
  const f=fixture({storage});f.view.update(0,true);
  assert.equal(f.field('sender').textContent,'나수합(학년부장)');
  assert.equal(f.field('subject').textContent,entry.subject);
  assert.equal(f.field('line-one').textContent,entry.lines[0]);
  f.view.openArchive();
  assert.match(f.archive.querySelector('[data-history="meta"]').textContent,/^나수합\(학년부장\) ·/);
  assert.match(f.archive.querySelector('.messenger-history-time').textContent,/^나수합\(학년부장\) ·/);
  assert.equal(storage.getItem(MESSENGER_STORAGE_KEY),saved);
  assert.equal(f.view.historyCount(),1);f.view.dispose();
});
