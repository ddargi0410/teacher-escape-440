import test from 'node:test';
import assert from 'node:assert/strict';
import {createChannels,PUBLIC_CHANNELS,sanitizeChannels} from '../channels.js';

const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const directory=(overrides={})=>({channels:PUBLIC_CHANNELS.map(c=>({...c,count:0,occupiedBeds:0,freeBeds:5,...overrides[c.id]})),serverTime:100000,capacity:30});
function fixture({connect,fetch,beforeSwitch}={}){
  let clock=0,status={state:'offline',connected:false,count:0,room:'',wanted:false},api;
  const requests=[],joins=[],before=[],changes=[],doc={hidden:false};
  const presence={
    getSnapshotStatus:()=>({...status}),
    async connect(options){joins.push(options);status={...status,room:options.room,state:'connecting',wanted:true,connected:false};api.handlePresenceStatus(status);
      const response=connect?await connect(options,joins.length):{ok:true,count:1};
      status={...status,state:response.ok?'online':response.state||'reconnecting',connected:response.ok,count:response.ok?response.count||1:0,message:response.message||'',nickname:options.nickname};api.handlePresenceStatus(status);return response.ok;},
    disconnect(){status={...status,wanted:false,connected:false,count:0,state:'offline'};api?.handlePresenceStatus(status);},
  };
  api=createChannels({presence,endpoint:'https://relay.example/api/presence',getNickname:()=> '자동 별명',onBeforeSwitch:x=>{before.push(x);beforeSwitch?.(x);},onChange:x=>changes.push(x),
    runtime:{document:doc,now:()=>clock,fetch:(url,options)=>{requests.push({url,options});return fetch?fetch(url,options,requests.length):Promise.resolve({ok:true,json:async()=>directory()});}}});
  return {api,presence,requests,joins,before,changes,doc,setStatus(next){status={...status,...next};api.handlePresenceStatus(status);},async advance(ms,visible=true){clock+=ms;api.update(ms/1000,{visible});await flush();}};
}

test('game start enters channel 1 without a room form and directory counts include beds',async t=>{
  const f=fixture({fetch:async()=>({ok:true,json:async()=>directory({1:{count:3,occupiedBeds:2,freeBeds:3},2:{count:5,occupiedBeds:5,freeBeds:0}})})});t.after(()=>f.api.dispose());
  assert.equal(f.joins.length,0);assert.equal(f.api.getSnapshot().directoryKnown,false);
  assert.equal(await f.api.start(),true);await flush();
  assert.deepEqual(f.joins,[{room:'TEACHERS',nickname:'자동 별명'}]);
  assert.equal(f.api.getSnapshot().selected,1);assert.equal(f.api.getSnapshot().connected,true);
  assert.equal(f.api.getSnapshot().channels[1].freeBeds,0);
  assert.equal(f.requests[0].url,'https://relay.example/api/presence?channels=1');
  assert.equal(f.requests[0].options.credentials,'omit');assert.equal(await f.api.start(),true);assert.equal(f.joins.length,1);
});

test('automatic entry moves past a full channel while a failed network does not hop rooms',async t=>{
  const f=fixture({connect:async(options)=>options.room==='TEACHERS'?{ok:false,state:'full'}:{ok:true,count:2}});t.after(()=>f.api.dispose());
  assert.equal(await f.api.start(),true);assert.deepEqual(f.joins.map(x=>x.room),['TEACHERS','TEACHERS-2']);assert.equal(f.api.getSnapshot().selected,2);
  const offline=fixture({connect:async()=>({ok:false,state:'reconnecting',message:'인터넷 확인 중'})});t.after(()=>offline.api.dispose());
  assert.equal(await offline.api.start(),false);assert.equal(offline.joins.length,1);assert.equal(offline.api.getSnapshot().offline,false);assert.equal(offline.api.getSnapshot().connected,false);
  offline.setStatus({connected:true,state:'online',count:2});assert.equal(offline.api.getSnapshot().connected,true);
});

test('all full channels stop after a bounded pass and remain selectable later',async t=>{
  let full=true;const f=fixture({connect:async()=>full?{ok:false,state:'full'}:{ok:true}});t.after(()=>f.api.dispose());
  assert.equal(await f.api.start(),false);assert.equal(f.joins.length,10);assert.match(f.api.getSnapshot().error,/모든 채널/);assert.equal(f.api.getSnapshot().loading,false);
  full=false;assert.equal(await f.api.select(3),true);assert.equal(f.api.getSnapshot().selected,3);
});

test('manual channel switch preserves nickname and refuses known full channels without leaving',async t=>{
  const f=fixture({fetch:async()=>({ok:true,json:async()=>directory({3:{count:30,occupiedBeds:5,freeBeds:0}})})});t.after(()=>f.api.dispose());await f.api.start();
  assert.equal(await f.api.select(2),true);assert.equal(f.api.getSnapshot().selected,2);
  assert.deepEqual(f.before.at(-1),{from:1,to:2,automatic:false});assert.equal(f.joins.at(-1).nickname,'자동 별명');
  assert.equal(await f.api.select(3),false);assert.equal(f.joins.length,2);assert.equal(f.api.getSnapshot().selected,2);assert.equal(f.api.getSnapshot().connected,true);
  assert.match(f.api.getSnapshot().error,/채널 3/);
});

test('a channel that fills during switching restores the prior connection',async t=>{
  const f=fixture({connect:async({room})=>room==='TEACHERS-2'?{ok:false,state:'full'}:{ok:true}});t.after(()=>f.api.dispose());await f.api.start();
  assert.equal(await f.api.select(2),false);assert.deepEqual(f.joins.map(x=>x.room),['TEACHERS','TEACHERS-2','TEACHERS']);assert.equal(f.api.getSnapshot().selected,1);assert.equal(f.api.getSnapshot().connected,true);assert.match(f.api.getSnapshot().error,/돌아왔어요/);
});

test('directory polling has one request, fails to unknown counts, and pauses when hidden',async t=>{
  let answer,fail=false;
  const f=fixture({fetch:()=>new Promise(resolve=>answer=()=>resolve(fail?{ok:false}:{ok:true,json:async()=>directory({2:{count:6,occupiedBeds:4,freeBeds:1}})}))});t.after(()=>f.api.dispose());
  await f.api.start();await f.advance(8000);assert.equal(f.requests.length,1);
  answer();await flush();assert.equal(f.api.getSnapshot().channels[1].freeBeds,1);
  fail=true;await f.advance(8000);assert.equal(f.requests.length,2);answer();await flush();
  assert.equal(f.api.getSnapshot().directoryKnown,false);assert.equal(f.api.getSnapshot().channels[1].count,null);assert.equal(f.api.getSnapshot().channels[1].freeBeds,null);
  f.doc.hidden=true;await f.advance(30000);assert.equal(f.requests.length,2);
  f.doc.hidden=false;await f.advance(1);assert.equal(f.requests.length,3);
});

test('stopping rejects late directory and connection results',async t=>{
  let finishJoin,finishDirectory;
  const f=fixture({connect:()=>new Promise(resolve=>finishJoin=()=>resolve({ok:true})),fetch:()=>new Promise(resolve=>finishDirectory=()=>resolve({ok:true,json:async()=>directory()}))});t.after(()=>f.api.dispose());
  const start=f.api.start();await flush();f.api.stop();
  assert.equal(f.requests[0].options.signal.aborted,true);
  finishJoin();finishDirectory();assert.equal(await start,false);await flush();
  assert.equal(f.api.getSnapshot().running,false);assert.equal(f.api.getSnapshot().connected,false);assert.equal(f.api.getSnapshot().directoryKnown,false);
});

test('latest channel choice wins when an earlier connection finishes late',async t=>{
  let finishOld;
  const f=fixture({connect:async({room})=>room==='TEACHERS-2'?await new Promise(resolve=>finishOld=()=>resolve({ok:true})):{ok:true}});t.after(()=>f.api.dispose());await f.api.start();
  const old=f.api.select(2);await flush();assert.equal(await f.api.select(3),true);finishOld();assert.equal(await old,false);
  assert.equal(f.api.getSnapshot().selected,3);assert.equal(f.api.getSnapshot().connected,true);
});

test('directory validation rejects wrong rooms, impossible bed counts and missing channels',()=>{
  assert.equal(sanitizeChannels(directory()).length,10);
  for(const bad of [{room:'PRIVATE'}, {count:-1}, {occupiedBeds:6,freeBeds:-1}, {count:0,occupiedBeds:1,freeBeds:4}, {freeBeds:2}])assert.equal(sanitizeChannels(directory({1:bad})),null);
  const missing=directory();missing.channels.pop();assert.equal(sanitizeChannels(missing),null);
});

test('choosing solo mode can restart automatic entry and refresh the directory',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());
  assert.equal(f.api.getSnapshot().offline,true);
  await f.api.start();await flush();assert.equal(f.api.getSnapshot().offline,false);
  f.api.stop();assert.equal(f.api.getSnapshot().offline,true);assert.equal(f.api.getSnapshot().running,false);
  const previousRequests=f.requests.length;
  assert.equal(await f.api.start(),true);await flush();
  assert.equal(f.api.getSnapshot().offline,false);assert.equal(f.api.getSnapshot().connected,true);
  assert.equal(f.joins.length,2);assert.equal(f.joins.at(-1).room,'TEACHERS');assert(f.requests.length>previousRequests);
});

test('channel card totals remain consistent when the live roster changes after a directory snapshot',async t=>{
  const f=fixture({fetch:async()=>({ok:true,json:async()=>directory({1:{count:5,occupiedBeds:4,freeBeds:1}})})});t.after(()=>f.api.dispose());
  await f.api.start();await flush();f.setStatus({count:1,connected:true,state:'online'});
  const snapshot=f.api.getSnapshot();
  assert.equal(snapshot.count,1);assert.equal(snapshot.channels[0].count,5);
  assert.equal(snapshot.channels[0].occupiedBeds,4);assert.equal(snapshot.channels[0].freeBeds,1);
});

test('solo mode can explicitly refresh anonymous channel totals without joining or starting polling',async t=>{
  const f=fixture({fetch:async()=>({ok:true,json:async()=>directory({2:{count:4,occupiedBeds:3,freeBeds:2}})})});t.after(()=>f.api.dispose());
  assert.equal(await f.api.refresh(),true);assert.equal(f.joins.length,0);
  assert.equal(f.api.getSnapshot().offline,true);assert.equal(f.api.getSnapshot().directoryKnown,true);
  assert.equal(f.api.getSnapshot().channels[1].freeBeds,2);
  const requests=f.requests.length;await f.advance(10000);
  assert.equal(f.requests.length,requests);assert.equal(f.joins.length,0);
  assert.equal(await f.api.refresh(),true);assert.equal(f.requests.length,requests+1);assert.equal(f.joins.length,0);
});

test('solo channel chooser changes expired totals to unknown without an automatic network request',async t=>{
  const f=fixture();t.after(()=>f.api.dispose());await f.api.refresh();
  const knownReports=f.changes.length;await f.advance(20001);
  assert.equal(f.api.getSnapshot().directoryKnown,false);assert.equal(f.api.getSnapshot().channels[0].count,null);
  assert(f.changes.length>knownReports);assert.equal(f.changes.at(-1).directoryKnown,false);
  assert.equal(f.requests.length,1);assert.equal(f.joins.length,0);
});


test('automatic fallback preserves rest while a manual channel change may close the bed',async t=>{
  let resting=true;
  const f=fixture({connect:async({room})=>room==='TEACHERS'?{ok:false,state:'full'}:{ok:true},beforeSwitch:({automatic})=>{if(!automatic)resting=false;}});
  t.after(()=>f.api.dispose());
  assert.equal(await f.api.start(),true);assert.equal(resting,true);
  assert.deepEqual(f.before.map(x=>x.automatic),[true,true]);
  assert.equal(await f.api.select(3),true);assert.equal(resting,false);
  assert.equal(f.before.at(-1).automatic,false);
});
