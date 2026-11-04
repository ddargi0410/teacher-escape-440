import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createPresence,sanitizePresencePlayer} from '../presence.js';

class Element {
  constructor(){this.children=[];this.hidden=false;this.style={};this.attributes={};this.textContent='';}
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  setAttribute(name,value){this.attributes[name]=String(value);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);this.parent=null;}
}
class Document extends EventTarget {
  constructor(){super();this.hidden=false;this.body=new Element();}
  createElement(){return new Element();}
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const remote=(id='remote-1',extra={})=>({id,nickname:'동료',x:1,y:16,z:1,yaw:0,floor:5,action:'idle',...extra});
function fixture(handler, runtimeOverrides={}) {
  const doc=new Document(),win=new EventTarget();win.innerWidth=1200;win.innerHeight=800;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1.5,.1,220);
  camera.position.set(0,28,19);camera.lookAt(0,17,0);camera.updateMatrixWorld();
  const local={x:0,y:16,z:4,yaw:0,floor:5,action:'idle'};
  const statuses=[],greetings=[],sentGreetings=[],requests=[];let clock=0,players=[],fail=false;
  const world={createTeacher(){const model=new THREE.Group();model.userData.arms=[new THREE.Group(),new THREE.Group()];model.userData.legs=[new THREE.Group(),new THREE.Group()];return model;},
    animateCharacter(){},setRestPose(model,bed){model.rotation.x=-Math.PI/2;model.userData.restingBed=bed;},clearRestPose(model){model.rotation.x=0;delete model.userData.restingBed;}};
  const fetcher=(url,options)=>{
    const body=JSON.parse(options.body),request={url,options,body};requests.push(request);
    if(handler)return handler(request);
    if(fail)return Promise.reject(new Error('offline'));
    return Promise.resolve({ok:true,json:async()=>({self:body.id,players:[{...local,id:body.id,nickname:body.nickname},...players],serverTime:100000+clock,capacity:30})});
  };
  const api=createPresence({scene,world,camera,getLocal:()=>local,onStatus:value=>statuses.push(value),onGreeting:value=>greetings.push(value),onGreetingSent:value=>sentGreetings.push(value),endpoint:'https://relay.example/api/presence',
    runtime:{document:doc,window:win,fetch:fetcher,crypto:webcrypto,now:()=>clock,...runtimeOverrides}});
  return {api,scene,doc,win,local,statuses,greetings,sentGreetings,requests,
    get labels(){return doc.body.children[0];},
    peers(value){players=value;},fail(value=true){fail=value;},
    async advance(milliseconds,{visible=true,floor=local.floor}={}){clock+=milliseconds;api.update(milliseconds/1000,{visible,floor});await flush();},
    async connect(){return await api.connect({room:'teacher2026',nickname:'퇴근 희망'});}};
}

test('no visitors or networking exist before an explicit successful connection',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());
  await f.advance(10000);assert.equal(f.requests.length,0);assert.equal(f.api.count,0);assert.equal(f.scene.children.length,0);
  f.fail();assert.equal(await f.connect(),false);assert.equal(f.api.isConnected(),false);assert.equal(f.api.count,0);
  assert.equal(f.api.getSnapshotStatus().state,'reconnecting');
  f.fail(false);await f.advance(2000);assert.equal(f.api.isConnected(),true);assert.equal(f.api.count,1);
  assert.equal(f.requests[0].options.credentials,'omit');assert.match(f.requests[0].body.token,/^[0-9a-f]{64}$/);
  assert.equal(f.requests[0].body.room,'TEACHER2026');
});

test('snapshots exclude self, reject malformed players and prune departed peers',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());f.peers([remote(),remote(),remote('bad',{x:Infinity}),remote('other',{floor:4}),remote('name',{nickname:'<script>alert(1)'})]);
  await f.connect();await f.advance(0);assert.equal(f.api.count,4);assert.equal(f.scene.children.length,3);
  assert.equal(f.scene.children.filter(model=>model.visible).length,2);
  assert.equal(f.labels.children[2].children[1].textContent,'<script>alert(1)');
  f.peers([]);await f.advance(1000);assert.equal(f.api.count,1);assert.equal(f.scene.children.length,0);assert.equal(f.labels.children.length,0);
  assert.equal(sanitizePresencePlayer(remote('bad',{z:900})),null);
});

test('cancellation rejects a late response from a disconnected session',async t=>{
  let resolve;
  const f=fixture(request=>request.body.leave?Promise.resolve({ok:true,json:async()=>({})}):new Promise(done=>resolve=()=>done({ok:true,json:async()=>({self:request.body.id,players:[remote()],serverTime:100000})})));
  t.after(()=>f.api.dispose());
  const joining=f.connect();assert.equal(f.requests.length,1);
  f.api.disconnect();assert.equal(f.requests[0].options.signal.aborted,true);assert.equal(f.requests[1].body.leave,true);
  resolve();assert.equal(await joining,false);assert.equal(f.api.count,0);assert.equal(f.scene.children.length,0);
});

test('only one heartbeat is in flight, and disconnection removes render resources',async t=>{
  let answer;
  const f=fixture(request=>request.body.leave?Promise.resolve({ok:true,json:async()=>({})}):new Promise(resolve=>answer=()=>resolve({ok:true,json:async()=>({self:request.body.id,players:[remote()],serverTime:100000})})));
  t.after(()=>f.api.dispose());const joining=f.connect();
  await f.advance(600);await f.advance(600);assert.equal(f.requests.length,1);
  answer();await joining;assert.equal(f.scene.children.length,1);
  f.api.dispose();assert.equal(f.api.isConnected(),false);assert.equal(f.doc.body.children.length,0);assert.equal(f.scene.children.length,0);
  await f.advance(60000);assert.equal(f.requests.length,2);
});

test('hidden tabs leave the room and reconnect on return without ghost characters',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());f.peers([remote()]);await f.connect();
  f.doc.hidden=true;f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.api.getSnapshotStatus().state,'hidden');assert.equal(f.api.count,0);assert.equal(f.scene.children.length,0);
  const total=f.requests.length;await f.advance(10000);assert.equal(f.requests.length,total);
  f.doc.hidden=false;f.doc.dispatchEvent(new Event('visibilitychange'));await flush();
  assert.equal(f.api.count,2);assert.equal(f.api.getSnapshotStatus().state,'online');
});

test('greetings appear once, expire off-floor, and sending is throttled',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());await f.advance(0);
  f.peers([remote('waving',{greeting:{seq:1,type:'wave',at:100000}})]);await f.connect();await f.advance(0);
  assert.equal(f.greetings.length,1);assert.equal(f.labels.children[0].children[0].hidden,false);
  assert.equal(f.api.greet('thanks'),true);assert.equal(f.api.greet('wave'),false);assert.equal(f.sentGreetings.length,0);
  await f.advance(1000);assert.equal(f.greetings.length,1);assert.equal(f.requests.at(-1).body.greeting.type,'thanks');assert.deepEqual(f.sentGreetings,[{seq:1,type:'thanks'}]);
  await f.advance(2500,{floor:4});await f.advance(0,{floor:5});
  assert.equal(f.labels.children[0].children[0].hidden,true);
  assert.equal(f.sentGreetings.length,1);assert.equal(f.api.greet('cheer'),true);
});

test('menu visibility hides remote avatars without pretending the participant left',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());f.peers([remote('resting',{floor:1,y:1,x:18,z:-.2,action:'rest',bedId:'bed-1'})]);
  await f.connect();await f.advance(0,{floor:1});assert.equal(f.scene.children[0].userData.restingBed,'bed-1');
  await f.advance(0,{visible:false,floor:1});assert.equal(f.labels.hidden,true);assert.equal(f.scene.children[0].visible,false);assert.equal(f.api.count,2);
  await f.advance(0,{visible:true,floor:1});assert.equal(f.scene.children[0].visible,true);
});

test('five beds are shared in the roster and occupied beds exclude self and stale peers',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());
  Object.assign(f.local,{floor:1,y:1,action:'rest',bedId:'bed-5'});
  f.peers([remote('bedmate',{floor:1,y:1,action:'rest',bedId:'bed-4',nickname:'잠깐 쉬는 동료'}),
    remote('standing',{floor:1,y:0,action:'idle',bedId:'bed-2'}),
    remote('invalid',{floor:1,y:0,action:'rest',bedId:'bed-6'})]);
  await f.connect();
  assert.equal(f.requests[0].body.bedId,'bed-5');
  assert.equal(sanitizePresencePlayer(remote('fifth',{floor:1,action:'rest',bedId:'bed-5'})).action,'rest');
  assert.equal(sanitizePresencePlayer(remote('sixth',{floor:1,action:'rest',bedId:'bed-6'})).action,'idle');
  assert.deepEqual(f.api.getOccupiedBeds(),[{bedId:'bed-4',nickname:'잠깐 쉬는 동료',id:'bedmate'}]);
  f.peers([]);await f.advance(1000);assert.deepEqual(f.api.getOccupiedBeds(),[]);
  f.api.disconnect();assert.deepEqual(f.api.getOccupiedBeds(),[]);
});

test('local HTTP browsers without randomUUID use a secure UUID fallback',async t=>{
  const f=fixture(undefined,{crypto:{getRandomValues:array=>webcrypto.getRandomValues(array)}});t.after(()=>f.api.dispose());
  assert.equal(await f.connect(),true);
  assert.match(f.requests[0].body.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(f.requests[0].body.token,/^[0-9a-f]{64}$/);
  assert.equal(f.api.getSnapshotStatus().selfId,f.requests[0].body.id);
});

test('missing or blocked crypto disables together mode without breaking the solo game',async t=>{
  for(const crypto of [null,{}, {getRandomValues(){throw new Error('unavailable');}}]){
    const f=fixture(undefined,{crypto});t.after(()=>f.api.dispose());
    await f.advance(10000);assert.equal(await f.connect(),false);
    assert.equal(f.requests.length,0);assert.equal(f.api.getSnapshotStatus().wanted,false);
    assert.equal(f.api.getSnapshotStatus().state,'offline');assert.match(f.api.getSnapshotStatus().message,/혼자 탐색/);
  }
});

test('simultaneous bed claims keep the lower peer id and offer the loser a free bed',async t=>{
  const self='80000000-0000-4000-8000-000000000000';
  const smaller='10000000-0000-4000-8000-000000000000',larger='f0000000-0000-4000-8000-000000000000';
  const f=fixture(undefined,{crypto:{randomUUID:()=>self,getRandomValues:array=>webcrypto.getRandomValues(array)}});t.after(()=>f.api.dispose());
  const sleeper=(id,bedId)=>remote(id,{floor:1,y:1,action:'rest',bedId});
  f.peers([sleeper(smaller,'bed-5'),sleeper('another','bed-1')]);await f.connect();
  assert.deepEqual(f.api.getBedConflict('bed-5'),{conflict:true,freeBedId:'bed-2'});
  assert.equal(f.api.getBedConflict('bed-4'),null);
  f.peers([sleeper(larger,'bed-5')]);await f.advance(1000);assert.equal(f.api.getBedConflict('bed-5'),null);
  f.peers([sleeper(smaller,'bed-5'),...[1,2,3,4].map(n=>sleeper('other-'+n,'bed-'+n))]);await f.advance(1000);
  assert.deepEqual(f.api.getBedConflict('bed-5'),{conflict:true,freeBedId:null});
  f.api.disconnect();assert.equal(f.api.getBedConflict('bed-5'),null);
});

test('switching channels uses a fresh identity and delayed leaves retain the old room credentials',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());await f.connect();
  const first=f.requests[0].body;
  assert.equal(await f.api.connect({room:'TEACHERS-2',nickname:'퇴근 희망'}),true);
  const leave=f.requests.find(r=>r.body.leave).body,next=f.requests.at(-1).body;
  assert.deepEqual(leave,{room:first.room,id:first.id,token:first.token,leave:true});
  assert.notEqual(next.id,first.id);assert.notEqual(next.token,first.token);assert.equal(next.room,'TEACHERS-2');
  assert.equal(f.api.getSnapshotStatus().selfId,next.id);assert.equal(f.api.getSnapshotStatus().room,'TEACHERS-2');
});

test('a late old-channel heartbeat cannot populate the newly joined channel',async t=>{
  let finishOld;
  const f=fixture(request=>{
    if(request.body.leave)return Promise.resolve({ok:true,json:async()=>({})});
    if(request.body.room==='TEACHER2026')return new Promise(resolve=>finishOld=()=>resolve({ok:true,json:async()=>({self:request.body.id,players:[remote('old-room')],serverTime:100000})}));
    return Promise.resolve({ok:true,json:async()=>({self:request.body.id,players:[remote('new-room')],serverTime:100000})});
  });t.after(()=>f.api.dispose());
  const old=f.connect();await f.api.connect({room:'TEACHERS-2',nickname:'새 채널'});finishOld();assert.equal(await old,false);
  assert.equal(f.api.count,2);assert.equal(f.labels.children.length,1);assert.equal(f.api.getSnapshotStatus().room,'TEACHERS-2');
  assert.equal(f.scene.children[0].name,'online-teacher');
});

test('local greeting acknowledgement waits for a successful response and retries without a false success',async t=>{
 const f=fixture();t.after(()=>f.api.dispose());await f.connect();assert.equal(f.api.greet('wave'),true);
 f.fail();await f.advance(1000);assert.equal(f.sentGreetings.length,0);
 f.fail(false);await f.advance(2000);assert.deepEqual(f.sentGreetings,[{seq:1,type:'wave'}]);
 await f.advance(1000);assert.equal(f.sentGreetings.length,1);
});
