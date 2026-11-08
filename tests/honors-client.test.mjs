import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHonors,HONORS_HEARTBEAT_MS,HONORS_REFRESH_MS,honorsDate} from '../honors.js';
import {freshState,saveGame,loadGame} from '../save.js';
import {freezeDeparture} from '../school-clock.js';
import {ANALYTICS_STORAGE_KEY} from '../analytics.js';

const NOW=Date.parse('2026-11-06T03:00:00Z');
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};};
const won=(now)=>({date:honorsDate(now),generatedAt:now,fastest:{nickname:'칼퇴 용사',schoolMinutes:982,elapsedSeconds:600,achievedAt:now},rest:{nickname:'휴식 현자',restSeconds:120,achievedAt:now}});
function fixture({storage=memory(),hostname='ddargi0410.github.io',handler,clock=NOW,hidden=false,crypto=webcrypto}={}){
 const doc=new EventTarget(),win=new EventTarget();doc.hidden=hidden;
 let state=freshState('퇴근 도전자'),activity={visible:true,resting:false},id=0,stateChanges=0;
 const timers=new Map(),requests=[],data=[],statuses=[];
 const api=createHonors({endpoint:'https://relay.example/api/honors',getState:()=>state,getActivity:()=>activity,onStateChange:()=>stateChanges++,onData:value=>data.push(value),onStatus:value=>statuses.push(value),runtime:{document:doc,window:win,location:{hostname,protocol:'https:'},storage,crypto,now:()=>clock,
  fetch:(url,options)=>{const req={url,options,body:options.body?JSON.parse(options.body):null};requests.push(req);return handler?handler(req,clock):Promise.resolve({ok:true,json:async()=>won(clock)});},
  setTimeout(fn,delay){const n=++id;timers.set(n,{fn,at:clock+delay});return n;},clearTimeout(n){timers.delete(n);}
 }});
 return {api,doc,win,storage,requests,data,statuses,timers,get state(){return state;},get stateChanges(){return stateChanges;},setState(value){state=value;},posts:()=>requests.filter(x=>x.body),reads:()=>requests.filter(x=>!x.body),
  async activity(value){activity={...activity,...value};api.update();await flush();},
  async visible(value){doc.hidden=!value;doc.dispatchEvent(new Event('visibilitychange'));await flush();},
  async event(value){win.dispatchEvent(new Event(value));await flush();},
  async advance(ms){await flush();const end=clock+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;clock=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}clock=end;api.update();await flush();},
  setClock(value){clock=value;api.update();}
 };
}

test('home only reads winners; actual start records a shared browser id, saved run id and independent page session',async t=>{
 const f=fixture();t.after(()=>f.api.dispose());f.api.start();await flush();assert.equal(f.posts().length,0);assert.equal(f.storage.values.size,0);
 assert.equal(f.api.startRun(),true);await flush();
 const body=f.posts()[0].body;assert.equal(body.visitorId,f.storage.getItem(ANALYTICS_STORAGE_KEY));assert.equal(body.runId,f.state.honorsRunId);assert.notEqual(body.runId,body.sessionId);
 assert.equal(f.stateChanges,1);assert.deepEqual(Object.keys(body).sort(),['completed','elapsedSeconds','event','nickname','penaltyMinutes','resting','runId','seq','sessionId','visible','visitorId']);
 assert.equal(f.posts()[0].options.credentials,'omit');assert.equal(f.posts()[0].options.cache,'no-store');
 const original=f.state.honorsRunId;f.api.stopRun();f.api.startRun();await flush();assert.equal(f.state.honorsRunId,original);
 const second=fixture({storage:f.storage});t.after(()=>second.api.dispose());second.setState({...f.state});second.api.startRun();await flush();
 assert.equal(second.posts()[0].body.runId,original);assert.equal(second.posts()[0].body.visitorId,body.visitorId);assert.notEqual(second.posts()[0].body.sessionId,body.sessionId);
});

test('bed start/end, hiding, pause and home send accurate rest transitions without changing the game clock',async t=>{
 const f=fixture();t.after(()=>f.api.dispose());f.state.elapsed=300;f.api.startRun();await flush();
 await f.activity({resting:true});assert.equal(f.posts().at(-1).body.resting,true);
 await f.advance(HONORS_HEARTBEAT_MS);assert.equal(f.posts().at(-1).body.resting,true);
 assert.equal(f.state.elapsed,300);
 await f.visible(false);assert.equal(f.posts().at(-1).body.visible,false);assert.equal(f.posts().at(-1).body.resting,false);assert.equal(f.posts().at(-1).options.keepalive,true);
 const number=f.posts().length;await f.advance(90_000);assert.equal(f.posts().length,number);
 await f.visible(true);assert.equal(f.posts().at(-1).body.resting,true);
 await f.activity({resting:false});assert.equal(f.posts().at(-1).body.resting,false);
 await f.activity({visible:false});const paused=f.posts().length;await f.advance(40_000);assert.equal(f.posts().length,paused);
 await f.activity({visible:true});f.api.stopRun();await flush();const stopped=f.posts().length;await f.advance(40_000);assert.equal(f.posts().length,stopped);
});

test('pagehide and bfcache restore send a stop then restart with monotonically increasing sequence',async t=>{
 const f=fixture();t.after(()=>f.api.dispose());f.api.startRun();await flush();await f.activity({resting:true});
 await f.event('pagehide');assert.equal(f.posts().at(-1).body.visible,false);
 await f.event('pageshow');assert.equal(f.posts().at(-1).body.resting,true);
 const posts=f.posts();assert.equal(new Set(posts.map(x=>x.body.sessionId)).size,1);assert.deepEqual(posts.map(x=>x.body.seq),posts.map((_,i)=>i+1));
});

test('only a new genuine completion with all ten missions can submit finish, and repeated finish is ignored',async t=>{
 const f=fixture();t.after(()=>f.api.dispose());f.api.startRun();await flush();f.state.elapsed=601;f.state.penalty=5;f.state.finished=true;f.state.completed=[10];
 assert.equal(f.api.finish(),false);f.state.completed=Array.from({length:10},(_,i)=>i+1);
 assert.equal(f.api.finish(),true);assert.equal(f.api.finish(),false);await flush();const final=f.posts().at(-1);
 assert.equal(final.body.event,'finish');assert.equal(final.body.elapsedSeconds,601);assert.equal(final.body.penaltyMinutes,5);assert.equal(final.body.resting,false);assert.equal(final.options.keepalive,true);
 await f.advance(60_000);assert.equal(f.posts().filter(x=>x.body.event==='finish').length,1);
 const old=fixture();t.after(()=>old.api.dispose());old.setState({...f.state});assert.equal(old.api.startRun(),false);assert.equal(old.api.finish(),false);await flush();assert.equal(old.posts().length,0);
});

test('finish retries reuse exactly the same payload, and duplicate acknowledgements stop retries',async t=>{
 let tries=0;const f=fixture({handler:(req,clock)=>!req.body?Promise.resolve({ok:true,json:async()=>won(clock)}):req.body.event==='finish'&&++tries<3?Promise.reject(new Error('offline')):Promise.resolve({ok:true,json:async()=>({accepted:false})})});
 t.after(()=>f.api.dispose());f.api.startRun();await flush();f.state.elapsed=120;f.state.finished=true;f.state.completed=[1,2,3,4,5,6,7,8,9,10];f.api.finish();await flush();
 await f.advance(4_000);const records=f.posts().filter(x=>x.body.event==='finish');assert.equal(records.length,3);assert.deepEqual(records[0].body,records[2].body);
 await f.advance(20_000);assert.equal(f.posts().filter(x=>x.body.event==='finish').length,3);
});

test('hide interrupts a hanging heartbeat and a late response cannot reactivate it',async t=>{
 let resolve;const f=fixture({handler:(req,clock)=>!req.body?Promise.resolve({ok:true,json:async()=>won(clock)}):req.body.seq===1?new Promise(r=>resolve=r):Promise.resolve({ok:true})});t.after(()=>f.api.dispose());
 f.api.startRun();await flush();await f.activity({resting:true});await f.visible(false);
 assert.equal(f.posts()[0].options.signal.aborted,true);assert.equal(f.posts().at(-1).body.resting,false);resolve({ok:true});await flush();
 const number=f.posts().length;await f.advance(60_000);assert.equal(f.posts().length,number);
});

test('an unresponsive network times out without blocking new heartbeats or game state',async t=>{
 const f=fixture({handler:()=>new Promise(()=>{})});t.after(()=>f.api.dispose());assert.doesNotThrow(()=>f.api.startRun());await f.advance(8_000);
 assert.equal(f.posts()[0].options.signal.aborted,true);await f.advance(2_000);assert.equal(f.posts().length,2);assert.equal(f.state.finished,false);
});

test('midnight clears yesterday winners even when the next lookup fails',async t=>{
 const initial=Date.parse('2026-11-06T14:59:50Z');let failed=false;
 const f=fixture({clock:initial,handler:(req,clock)=>Promise.resolve(failed?{ok:false,status:503}:{ok:true,json:async()=>won(clock)})});t.after(()=>f.api.dispose());
 f.api.start();await flush();assert.equal(f.data.at(-1).fastest.nickname,'칼퇴 용사');failed=true;await f.advance(11_000);
 assert.equal(f.data.at(-1).date,'2026-11-07');assert.equal(f.data.at(-1).fastest,null);assert.equal(f.data.at(-1).rest,null);assert.equal(f.statuses.at(-1),'error');
});

test('preview and unavailable crypto never write rankings or fabricate winners',async()=>{
 for(const hostname of ['terminal.local','localhost','127.0.0.1']){
  const f=fixture({hostname});f.api.start();assert.equal(f.api.startRun(),false);await f.advance(60_000);assert.equal(f.requests.length,0);assert.equal(f.storage.values.size,0);assert.equal(f.state.honorsRunId,null);assert.equal(f.data.at(-1).fastest,null);f.api.dispose();
 }
 const f=fixture({crypto:null});assert.equal(f.api.startRun(),false);await flush();assert.equal(f.posts().length,0);f.api.dispose();
});

test('blocked storage uses an in-memory identity, and view callback errors stay isolated',async t=>{
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};const f=fixture({storage:blocked});t.after(()=>f.api.dispose());assert.equal(f.api.startRun(),true);await f.advance(20_000);
 assert.equal(new Set(f.posts().map(x=>x.body.visitorId)).size,1);
 const api=createHonors({endpoint:'',getState:()=>freshState(),onData(){throw Error('view');},onStatus(){throw Error('view');}});assert.doesNotThrow(()=>api.start());api.dispose();
});

test('saved run identity survives resume, new games start unassigned and old malformed IDs are discarded',()=>{
 const prior=globalThis.localStorage,storage=memory();globalThis.localStorage=storage;
 try{
  const state=freshState('퇴근');state.honorsRunId=webcrypto.randomUUID();assert.equal(saveGame(state),true);assert.equal(loadGame().honorsRunId,state.honorsRunId);
  assert.equal(freshState().honorsRunId,null);state.honorsRunId='not-a-uuid';saveGame(state);assert.equal(loadGame().honorsRunId,null);
 }finally{globalThis.localStorage=prior;}
});

test('actual mission success hook calls finish only for mission10 and does not report on resume',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');const from=source.indexOf('function recordSuccess('),to=source.indexOf('\nfunction ',from+1);
 const calls=[],state=freshState('기록');const context={state,freezeDeparture,world:{setCompleted(){}},audio:{play(){}},messenger:{notifyMissionSuccess(){}},persist(){},updateHUD(){},honors:{finish:()=>calls.push('finish'),sync:()=>calls.push('sync')}};
 vm.createContext(context);vm.runInContext(source.slice(from,to),context);context.recordSuccess(1,{});assert.deepEqual(calls,['sync']);context.recordSuccess(10,{});assert.deepEqual(calls,['sync','finish']);
 const start=source.slice(source.indexOf('function start('),source.indexOf('\nfunction home('));assert.ok(!start.includes('.finish('));assert.match(start,/if\(state.finished\)showCertificate\(\);\s*else \{honors\?\.startRun\(\)/);
});

test('a pending finish survives a new game and urgent hide, then both run completions are sent',async t=>{
 let release;
 const f=fixture({handler:(req,clock)=>!req.body?Promise.resolve({ok:true,json:async()=>won(clock)}):req.body.event==='finish'&&!release?new Promise(resolve=>{release=resolve;}):Promise.resolve({ok:true})});t.after(()=>f.api.dispose());
 f.api.startRun();await flush();f.state.elapsed=100;f.state.completed=[1,2,3,4,5,6,7,8,9,10];f.state.finished=true;f.api.finish();await flush();
 const first=f.posts().find(x=>x.body.event==='finish');
 f.setState(freshState('두 번째 용사'));f.api.startRun();await f.visible(false);assert.equal(first.options.signal.aborted,false);
 f.state.elapsed=120;f.state.completed=[1,2,3,4,5,6,7,8,9,10];f.state.finished=true;assert.equal(f.api.finish(),true);
 release({ok:true});await flush();const finishes=f.posts().filter(x=>x.body.event==='finish');assert.equal(finishes.length,2);assert.notEqual(finishes[0].body.runId,finishes[1].body.runId);
});

test('a retried finish cannot be overwritten by another run heartbeat, pause or visibility change',async t=>{
 let finishCalls=0,holdBeat=false;
 const f=fixture({handler:(req,clock)=>{
  if(!req.body)return Promise.resolve({ok:true,json:async()=>won(clock)});
  if(req.body.event==='finish')return ++finishCalls===1?Promise.reject(Error('offline')):Promise.resolve({ok:true});
  return holdBeat?new Promise(()=>{}):Promise.resolve({ok:true});
 }});t.after(()=>f.api.dispose());f.api.startRun();await flush();f.state.elapsed=100;f.state.completed=[1,2,3,4,5,6,7,8,9,10];f.state.finished=true;f.api.finish();await flush();
 const original=f.posts().find(x=>x.body.event==='finish').body;
 holdBeat=true;f.setState(freshState('다시 출근'));f.api.startRun();await flush();await f.advance(2_000);await f.activity({resting:true});await f.visible(false);
 const finishBodies=f.posts().filter(x=>x.body.event==='finish').map(x=>x.body);assert.equal(finishBodies.length,2);assert.deepEqual(finishBodies[1],original);
 await f.advance(20_000);assert.equal(f.posts().filter(x=>x.body.event==='finish').length,2,'acknowledged completion is not resent by a stale retry timer');
});
