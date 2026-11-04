import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessengerHistory,MESSENGER_STORAGE_KEY,MAX_RECEIVED_MESSAGES} from '../messenger-history.js';
import {REMINDERS,BANTER} from '../messenger-data.js';

const memoryStorage=()=>{
  const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
};
const mission={kind:'mission',missionId:2,...REMINDERS[2][0]};

test('received notes and explicit acknowledgments survive separate game instances',()=>{
  const storage=memoryStorage();let time=100;
  const first=createMessengerHistory({storage,now:()=>time});
  const received=first.receive(mission);assert.equal(first.pending().id,received.id);
  const resumed=createMessengerHistory({storage,now:()=>++time});
  assert.deepEqual(resumed.pending(),received);assert.equal(resumed.acknowledge(received.id),true);
  assert.equal(resumed.acknowledge(received.id),false);
  const reloaded=createMessengerHistory({storage});
  assert.equal(reloaded.pending(),null);assert.equal(reloaded.count(),1);
  assert.equal(reloaded.get(received.id).acknowledgedAt,101);
  assert.deepEqual(reloaded.get(received.id).lines,mission.lines);
});

test('history retains the latest 60 complete notes without leaking player profile fields',()=>{
  const storage=memoryStorage(),history=createMessengerHistory({storage,now:()=>10});
  for(let i=0;i<MAX_RECEIVED_MESSAGES+7;i++){
    const entry=history.receive({...mission,subject:`가상 쪽지 ${i}`,name:'실제 이름 저장 금지',email:'not-stored'});
    if(i<MAX_RECEIVED_MESSAGES+6)history.acknowledge(entry.id);
  }
  assert.equal(history.count(),60);
  assert.equal(history.list()[0].subject,'가상 쪽지 7');
  assert.equal(history.pending().subject,'가상 쪽지 66');
  assert.equal(new Set(history.list().map(entry=>entry.id)).size,60);
  const raw=storage.getItem(MESSENGER_STORAGE_KEY);assert.ok(!raw.includes('실제 이름'));assert.ok(!raw.includes('not-stored'));
  history.list()[0].lines[0]='external edit';assert.notEqual(history.list()[0].lines[0],'external edit');
  history.clear();assert.equal(createMessengerHistory({storage}).count(),0);
});

test('corrupt or unavailable storage never prevents receiving and reading notes',()=>{
  const broken={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
  const history=createMessengerHistory({storage:broken});
  const entry=history.receive({kind:'banter',missionId:null,...BANTER[0]});
  assert.equal(history.count(),1);assert.equal(history.acknowledge(entry.id),true);
  const storage=memoryStorage();storage.setItem(MESSENGER_STORAGE_KEY,'broken json');
  assert.equal(createMessengerHistory({storage}).count(),0);
  storage.setItem(MESSENGER_STORAGE_KEY,JSON.stringify({version:1,entries:[null,{},
    {id:'bad',subject:'bad',lines:[],missionId:99},
    {...entry,id:'safe',acknowledgedAt:null}, {...entry,id:'safe',acknowledgedAt:null}]}));
  const recovered=createMessengerHistory({storage});
  assert.equal(recovered.count(),1);assert.equal(recovered.pending().id,'safe');
});
