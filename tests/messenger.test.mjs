import test from 'node:test';
import assert from 'node:assert/strict';
import {REMINDERS,BANTER,COMPUTER_SUCCESS_NOTE} from '../messenger-data.js';
import {createReminderScheduler} from '../messenger-scheduler.js';

const create=()=>createReminderScheduler({random:()=>0});
const play=(s,dt,completed=[])=>s.tick(dt,{enabled:true,completed});

test('reminder copy uses short fictional content for every mission',()=>{
  assert.deepEqual(Object.keys(REMINDERS).map(Number),[1,2,3,4,5,6,7,8,9,10]);
  for(const options of Object.values(REMINDERS))for(const m of options){
    assert.equal(m.lines.length,2);
    for(const line of m.lines)assert.ok([...line].length<=30,line);
    assert.ok(m.sender&&m.subject&&m.reply);
    assert.match(m.sender,/^[가-힣]{3}\([가-힣 ]+\)$/);
  }
  assert.match(REMINDERS[8][0].lines.join(' '),/행사 당일/);
});

test('first reminder arrives after18 active seconds and not during other screens',()=>{
  const s=create();
  assert.equal(s.tick(1000,{enabled:false,completed:[]}),null);
  assert.equal(play(s,17.9),null);
  assert.equal(play(s,.1).missionId,1);
});

test('completed targets and locked final mission are skipped',()=>{
  const s=create();
  assert.equal(play(s,18,[1,3,4,5,6,7,8,9]).missionId,2);
  s.dismiss(0);
  assert.equal(play(s,15,[1,3,4,5,6,7,8,9]).missionId,2);
});

test('only the final mission is nagged once first nine are complete',()=>{
  const s=create(),nine=[1,2,3,4,5,6,7,8,9];
  const message=play(s,18,nine);assert.equal(message.missionId,10);
  assert.equal(s.tick(100,{enabled:true,completed:[...nine,10],finished:true}),message);
  s.dismiss();
  assert.equal(s.request({completed:[...nine,10],finished:true}),null);
});

test('suspension retains a message without treating paused time as active cooldown',()=>{
  const s=create(),m=play(s,18);
  assert.equal(s.tick(1000,{enabled:false,completed:[]}),m);
  s.dismiss();
  assert.equal(s.request({completed:[]}),null);
  assert.equal(play(s,14.9),null);
  assert.equal(s.request({completed:[]}),null);
  play(s,.1);
  assert.equal(s.request({completed:[]}).missionId,2);
});

test('vice requests never overwrite an open reminder or flood after dismissal',()=>{
  const s=create(),first=s.request({completed:[]});
  assert.equal(s.request({completed:[]}),first);
  s.dismiss();
  for(let i=0;i<20;i++)assert.equal(s.request({completed:[]}),null);
  play(s,15);
  assert.equal(s.request({completed:[]}).missionId,2);
});

test('explicit snooze cannot be bypassed by a vice request',()=>{
  const s=create();s.request({completed:[]});s.dismiss(60);
  assert.equal(play(s,59),null);
  assert.equal(s.request({completed:[]}),null);
  assert.equal(play(s,1).missionId,2);
});

test('received target remains until acknowledgment even if completed while hidden',()=>{
  const s=create(),message=play(s,18);assert.equal(message.missionId,1);
  assert.equal(s.tick(10000,{enabled:false,completed:[1]}),message);
  assert.equal(play(s,10000,[1]),message);
  assert.equal(s.request({completed:[1]}),message);
  s.dismiss();
  assert.equal(play(s,14,[1]),null);
  assert.equal(play(s,1,[1]).missionId,2);
});

test('fair cycle visits each unresolved mission before repeating',()=>{
  const s=create(),ids=[];
  for(let i=0;i<9;i++){
    ids.push(play(s,i?35:18).missionId);s.dismiss();
  }
  assert.equal(new Set(ids).size,9);
  assert.ok(!ids.includes(10));
  const next=play(s,35);
  assert.notEqual(next.missionId,ids.at(-1));
  assert.notEqual(next.lines[0],REMINDERS[next.missionId][0].lines[0]);
});

test('finished game stays silent and reset clears cooldown and variant history',()=>{
  const s=create();s.request();s.dismiss(999);
  assert.equal(s.tick(1000,{enabled:true,completed:[],finished:true}),null);
  assert.equal(s.request({finished:true}),null);
  s.reset();assert.equal(play(s,17),null);
  assert.equal(play(s,1).lines[0],REMINDERS[1][0].lines[0]);
});

test('invalid frame deltas never make the timer fire or poison future updates',()=>{
  const s=create();for(const delta of [NaN,Infinity,-3])assert.equal(play(s,delta),null);
  assert.equal(play(s,18).missionId,1);
});

test('random staffroom banter alternates with useful unresolved reminders',()=>{
  const s=createReminderScheduler({random:()=>.99}),completed=[1,2,3,4,5,6,7,8];
  const first=play(s,26,completed);
  assert.equal(first.kind,'mission');assert.equal(first.missionId,9);
  s.dismiss();const chat=play(s,60,completed);
  assert.equal(chat.kind,'banter');assert.equal(chat.missionId,null);
  assert.ok(BANTER.some(item=>item.subject===chat.subject));
  assert.equal(s.request({completed}),chat,'a vice request must not overwrite a received chat');
  assert.equal(play(s,100000,completed),chat,'reading never creates or replaces another message');
  s.dismiss();const next=play(s,60,completed);
  assert.equal(next.kind,'mission');assert.equal(next.missionId,9);
});

test('unrelated copy stays short and cannot masquerade as a new mission',()=>{
  assert.ok(BANTER.length>=6);
  for(const message of BANTER){
    assert.equal(message.missionId,undefined);assert.equal(message.lines.length,2);
    for(const line of message.lines)assert.ok([...line].length<=32,line);
    assert.ok(message.sender&&message.subject&&message.reply);
  }
});

test('banter senders use fictional name(position) and consistent staff identities',()=>{
  for(const message of BANTER)assert.match(message.sender,/^[가-힣]{3}\([가-힣 ]+\)$/);
  assert.equal(REMINDERS[1][0].sender,REMINDERS[2][0].sender);
  assert.equal(REMINDERS[1][1].sender,BANTER[0].sender);
  assert.equal(REMINDERS[8][1].sender,BANTER[5].sender);
});

test('new school-life notes include all twelve requested situations',()=>{
  const copy=BANTER.map(item=>`${item.subject} ${item.lines.join(' ')}`).join('\n');
  for(const phrase of ['간단히 10분만 하겠습니다.','장소가 시청각실로 변경되었습니다.',
    '협의회 취소… 가 아니라 그대로 진행합니다.','학급 현황 조사, 16:30까지 제출 바랍니다.',
    '2층 복사기 용지 걸림.','선생님 요거트 포함','오늘 우리 아이 표정이 좀 안 좋던데',
    '우리 아이가 오늘 칭찬을 못 받았다고 해서요.','어젯밤 22:47 수신',
    '지금 연수 중인데요?','학급자치비 개산급 영수증 제출바랍니다~','발송 시각 16:29']){
    assert.ok(copy.includes(phrase),phrase);
  }
  assert.equal(BANTER.length,20,'the original eight notes are preserved');
});

test('chatter can arrive within 15–25 active seconds after acknowledgment',()=>{
  const s=createReminderScheduler({random:()=>.5});
  assert.equal(play(s,22).kind,'mission');s.dismiss();
  assert.equal(play(s,19.9),null);
  assert.equal(s.tick(1000,{enabled:false,completed:[]}),null);
  assert.equal(play(s,.1).kind,'banter');
  s.dismiss();assert.equal(play(s,20).kind,'mission');
});

test('completion notes queue once behind unread messages and wait for active play',()=>{
  const s=create(),original=play(s,18);
  const note={...COMPUTER_SUCCESS_NOTE,lines:[...COMPUTER_SUCCESS_NOTE.lines]};
  assert.equal(s.enqueue('computer-success',note),true);
  note.lines[0]='changed after queue';
  assert.equal(s.enqueue('computer-success',COMPUTER_SUCCESS_NOTE),false);
  assert.equal(play(s,10000),original);
  s.dismiss();assert.equal(s.request(),null,'manual reminders must not jump the queue');
  assert.equal(s.tick(10000,{enabled:false}),null);
  const delivered=play(s,0);
  assert.equal(delivered.lines[0],'와... 선생님, 내년에 정보부장 하실래요?');
  assert.equal(delivered.missionId,null);assert.equal(delivered.kind,'banter');
  s.dismiss();assert.equal(s.enqueue('computer-success',COMPUTER_SUCCESS_NOTE),false);
  s.reset();assert.equal(s.enqueue('computer-success',COMPUTER_SUCCESS_NOTE),true);
  assert.equal(s.tick(0,{enabled:true,finished:true}),null);
});
