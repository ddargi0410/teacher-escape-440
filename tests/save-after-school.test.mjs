import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState, saveGame, loadGame} from '../save.js';
import {advanceSchoolClock, actualPlaySeconds, freezeDeparture, departureState, schoolTime} from '../school-clock.js';

function withStorage(run) {
  let raw;
  const previous = globalThis.localStorage;
  globalThis.localStorage = {setItem:(_key,value)=>{raw=value;},getItem:()=>raw};
  try {run(value=>{raw=JSON.stringify(value);});}
  finally {globalThis.localStorage=previous;}
}
function completedState() {
  return {...freshState('퇴근 완료'), completed:Array.from({length:10},(_,i)=>i+1), finished:true};
}

test('save and resume preserve both the running clock and the original certificate', () => withStorage(() => {
  const state=completedState();
  advanceSchoolClock(state, 900);
  advanceSchoolClock(state, 120, {resting:true});
  freezeDeparture(state);
  advanceSchoolClock(state, 600);
  assert.equal(saveGame(state), true);
  const resumed=loadGame();
  assert.equal(resumed.elapsed, 1530);
  assert.equal(actualPlaySeconds(resumed), 1620);
  assert.equal(schoolTime(resumed), '16:51');
  assert.equal(schoolTime(departureState(resumed)), '16:31');
  assert.equal(actualPlaySeconds(departureState(resumed)), 1020);
  assert.equal(Object.isFrozen(resumed.departureRecord), true);
  advanceSchoolClock(resumed, 120, {resting:true});
  freezeDeparture(resumed);
  assert.equal(saveGame(resumed), true);
  assert.equal(schoolTime(departureState(loadGame())), '16:31');
}));

test('old completed saves acquire a fixed departure without resetting their existing time', () => withStorage(write => {
  const old=completedState();old.elapsed=1110;old.penalty=5;
  delete old.playElapsed;delete old.departureRecord;
  write(old);
  const migrated=loadGame();
  assert.equal(actualPlaySeconds(migrated),1110);
  assert.deepEqual(migrated.departureRecord,{elapsed:1110,playElapsed:1110,penalty:5});
  advanceSchoolClock(migrated,60);
  assert.equal(schoolTime(departureState(migrated)),'16:42');
  assert.equal(saveGame(migrated),true);
  assert.equal(schoolTime(departureState(loadGame())),'16:42');
}));

test('unfinished and new games cannot inherit an old departure record', () => withStorage(write => {
  const state=freshState();state.elapsed=300;state.completed=[1];
  state.departureRecord={elapsed:100,playElapsed:100,penalty:0};
  state.finished=true;
  write(state);
  const resumed=loadGame();
  assert.equal(resumed.finished,false);
  assert.equal(resumed.departureRecord,null);
  assert.equal(resumed.playElapsed,300);
  assert.equal(freshState().departureRecord,null);
}));

test('invalid duration and snapshot fields are normalized to valid bounded records', () => withStorage(write => {
  const state=completedState();state.elapsed=120;state.playElapsed=-1;state.penalty=5;
  state.departureRecord={elapsed:'bad',playElapsed:-99,penalty:Infinity};
  write(state);
  const restored=loadGame();
  assert.equal(restored.playElapsed,120);
  assert.deepEqual(restored.departureRecord,{elapsed:120,playElapsed:120,penalty:5});
}));
