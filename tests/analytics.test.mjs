import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createAnalytics, ANALYTICS_STORAGE_KEY, HEARTBEAT_MS} from '../analytics.js';

const flush = async () => { for (let i=0; i<12; i++) await Promise.resolve(); };
const memoryStorage = () => {
  const data = new Map();
  return {getItem:key=>data.get(key) ?? null, setItem:(key,value)=>data.set(key,value), data};
};
function fixture({storage=memoryStorage(), hidden=false, hostname='ddargi0410.github.io', protocol='https:', handler, crypto=webcrypto}={}) {
  const doc = new EventTarget(), win = new EventTarget(); doc.hidden = hidden;
  let clock=0, timerId=0;
  const timers = new Map(), requests=[];
  const fetcher = (url, options) => {
    const request = {url, options, body:JSON.parse(options.body)};
    requests.push(request);
    return handler ? handler(request) : Promise.resolve({ok:true});
  };
  const api = createAnalytics({endpoint:'https://relay.example/api/analytics', runtime:{document:doc, window:win,
    location:{hostname,protocol}, storage, crypto, fetch:fetcher,
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:clock+delay});return id;},
    clearTimeout(id){timers.delete(id);}
  }});
  return {api, doc, win, storage, requests, timers,
    async advance(ms){
      await flush(); const end=clock+ms;
      while(true){
        const next=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next || next[1].at>end)break;
        clock=next[1].at;timers.delete(next[0]);next[1].fn();await flush();
      }
      clock=end;await flush();
    },
    async visible(value){doc.hidden=!value;doc.dispatchEvent(new Event('visibilitychange'));await flush();},
    async event(value){win.dispatchEvent(new Event(value));await flush();}
  };
}

test('a loaded visible page sends only anonymous visit identifiers, never game state', async t=>{
  const f=fixture();t.after(()=>f.api.dispose());
  assert.equal(f.requests.length,0);assert.equal(f.api.start(),true);await flush();
  const {body,options}=f.requests[0];
  assert.deepEqual(Object.keys(body).sort(),['event','seq','visitId','visitorId']);
  assert.equal(body.event,'heartbeat');assert.equal(body.seq,1);
  assert.notEqual(body.visitorId,body.visitId);
  assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
  assert.equal(f.storage.getItem(ANALYTICS_STORAGE_KEY),body.visitorId);
  assert.equal(f.api.start(),true);assert.equal(f.requests.length,1);
});

test('reloads and other tabs reuse the browser ID while each page load has its own visit',async t=>{
  const storage=memoryStorage(), first=fixture({storage}), reload=fixture({storage}), otherTab=fixture({storage});
  t.after(()=>{first.api.dispose();reload.api.dispose();otherTab.api.dispose();});
  first.api.start();reload.api.start();otherTab.api.start();await flush();
  const bodies=[first,reload,otherTab].map(f=>f.requests[0].body);
  assert.equal(new Set(bodies.map(x=>x.visitorId)).size,1);
  assert.equal(new Set(bodies.map(x=>x.visitId)).size,3);
  assert.equal(storage.data.size,1);
});

test('heartbeats preserve visit identity and send at a bounded interval',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());f.api.start();await flush();
  await f.advance(HEARTBEAT_MS-1);assert.equal(f.requests.length,1);
  await f.advance(1);assert.equal(f.requests.length,2);
  await f.advance(HEARTBEAT_MS);assert.equal(f.requests.length,3);
  assert.equal(new Set(f.requests.map(x=>x.body.visitId)).size,1);
  assert.deepEqual(f.requests.map(x=>x.body.seq),[1,2,3]);
});

test('hidden pages do not start a visit until shown',async t=>{
  const f=fixture({hidden:true});t.after(()=>f.api.dispose());f.api.start();
  await f.advance(120_000);assert.equal(f.requests.length,0);
  await f.visible(true);assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].body.seq,1);
});

test('hide, tab return, pagehide and bfcache return preserve a single visit',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());f.api.start();await flush();
  await f.visible(false);assert.equal(f.requests.at(-1).body.event,'leave');
  assert.equal(f.requests.at(-1).options.keepalive,true);
  await f.event('pagehide');await f.advance(120_000);assert.equal(f.requests.length,2);
  await f.visible(true);assert.equal(f.requests.length,2);
  await f.event('pageshow');assert.equal(f.requests.length,3);
  await f.event('pageshow');await f.visible(true);assert.equal(f.requests.length,3);
  assert.deepEqual(f.requests.map(x=>x.body.event),['heartbeat','leave','heartbeat']);
  assert.deepEqual(f.requests.map(x=>x.body.seq),[1,2,3]);
  assert.equal(new Set(f.requests.map(x=>x.body.visitId)).size,1);
});

test('a slow old heartbeat is cancelled on hide and cannot create a late timer',async t=>{
  let finishFirst;
  const f=fixture({handler:request=>request.body.seq===1?new Promise(resolve=>finishFirst=resolve):Promise.resolve({ok:true})});
  t.after(()=>f.api.dispose());f.api.start();await flush();
  await f.advance(7_000);assert.equal(f.requests.length,1);
  await f.visible(false);assert.equal(f.requests[0].options.signal.aborted,true);
  await f.visible(true);assert.equal(f.requests.at(-1).body.seq,3);
  finishFirst({ok:true});await flush();
  await f.advance(HEARTBEAT_MS);assert.equal(f.requests.length,4);
  assert.deepEqual(f.requests.map(x=>x.body.seq),[1,2,3,4]);
});

test('requests time out even when fetch never settles; retries keep the same visit',async t=>{
  const f=fixture({handler:()=>new Promise(()=>{})});t.after(()=>f.api.dispose());
  f.api.start();await f.advance(7_999);assert.equal(f.requests.length,1);
  await f.advance(1);assert.equal(f.requests[0].options.signal.aborted,true);
  await f.advance(HEARTBEAT_MS-1);assert.equal(f.requests.length,1);
  await f.advance(1);assert.equal(f.requests.length,2);
  assert.equal(f.requests[0].body.visitId,f.requests[1].body.visitId);
  assert.equal(f.requests[1].body.seq,2);
});

test('network exceptions and non-success responses are isolated and retried later',async t=>{
  for(const handler of [()=>{throw new Error('offline');},()=>Promise.reject(new Error('offline')),()=>Promise.resolve({ok:false,status:503})]){
    const f=fixture({handler});t.after(()=>f.api.dispose());
    assert.doesNotThrow(()=>f.api.start());await flush();
    await f.advance(HEARTBEAT_MS);assert.equal(f.requests.length,2);
    assert.equal(f.requests[0].body.visitorId,f.requests[1].body.visitorId);
  }
});

test('blocked storage uses an in-memory visitor and does not affect gameplay',async t=>{
  const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
  const f=fixture({storage});t.after(()=>f.api.dispose());
  assert.equal(f.api.start(),true);await f.advance(HEARTBEAT_MS);
  assert.equal(f.requests.length,2);assert.equal(f.requests[0].body.visitorId,f.requests[1].body.visitorId);
});

test('invalid saved IDs are replaced, secure random fallback works, and missing crypto disables counting',async t=>{
  const storage=memoryStorage();storage.setItem(ANALYTICS_STORAGE_KEY,'old-invalid-value');
  const f=fixture({storage,crypto:{getRandomValues:a=>webcrypto.getRandomValues(a)}});t.after(()=>f.api.dispose());
  assert.equal(f.api.start(),true);assert.notEqual(f.requests[0].body.visitorId,'old-invalid-value');
  for(const crypto of [null,{}, {randomUUID(){throw new Error('blocked');}}]){
    const disabled=fixture({crypto});assert.equal(disabled.api.start(),false);assert.equal(disabled.requests.length,0);disabled.api.dispose();
  }
});

test('preview environments never write storage or send telemetry',async()=>{
  for(const hostname of ['localhost','127.0.0.1','127.0.1.2','[::1]','terminal.local','test.localhost','']){
    const f=fixture({hostname});assert.equal(f.api.start(),false);await f.advance(90_000);
    assert.equal(f.requests.length,0);assert.equal(f.storage.data.size,0);f.api.dispose();
  }
  const file=fixture({hostname:'example.com',protocol:'file:'});assert.equal(file.api.start(),false);file.api.dispose();
});

test('disposing sends one final leave and removes all future lifecycle effects',async()=>{
  const f=fixture();f.api.start();await flush();f.api.dispose();f.api.dispose();await flush();
  assert.deepEqual(f.requests.map(x=>x.body.event),['heartbeat','leave']);
  await f.event('pageshow');await f.visible(false);await f.visible(true);await f.advance(120_000);
  assert.equal(f.requests.length,2);assert.equal(f.timers.size,0);assert.equal(f.api.start(),false);
});
