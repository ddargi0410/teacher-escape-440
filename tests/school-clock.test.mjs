import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolTime, schoolMinutes, overtimeMinutes, overtimeLabel, TARGET_MINUTES, REST_CLOCK_RATE, advanceSchoolClock, actualPlaySeconds, freezeDeparture, departureState} from '../school-clock.js';
import {freshState, saveGame, loadGame} from '../save.js';

test('a fresh day begins at 16:00, and a quick finish can precede the 16:40 goal', () => {
  const state = freshState();
  assert.equal(schoolTime(state), '16:00');
  state.elapsed = 15 * 60;
  state.finished = true;
  assert.equal(schoolTime(state), '16:30');
  assert.ok(schoolMinutes(state) < TARGET_MINUTES);
});
test('each 30 real seconds advances one school minute; penalties are not doubled', () => {
  assert.equal(schoolTime({elapsed: 29.999, penalty: 0}), '16:00');
  assert.equal(schoolTime({elapsed: 30, penalty: 0}), '16:01');
  assert.equal(schoolTime({elapsed: 59.999, penalty: 0}), '16:01');
  assert.equal(schoolTime({elapsed: 60, penalty: 0}), '16:02');
  assert.equal(schoolTime({elapsed: 0, penalty: 5}), '16:05');
  assert.equal(schoolTime({elapsed: 60, penalty: 5}), '16:07');
  assert.equal(schoolMinutes({elapsed: 20 * 60, penalty: 0}), TARGET_MINUTES);
  assert.equal(schoolTime({elapsed: 20 * 60, penalty: 1}), '16:41');
});
test('the doubled clock stays bounded at 22:00 and ignores invalid input', () => {
  assert.equal(schoolTime({elapsed: 3 * 60 * 60 - .001, penalty: 0}), '21:59');
  assert.equal(schoolTime({elapsed: 3 * 60 * 60, penalty: 0}), '22:00');
  assert.equal(schoolTime({elapsed: 604800, penalty: 360}), '22:00');
  assert.equal(schoolTime({elapsed: -20, penalty: NaN}), '16:00');
});
test('overtime begins after 16:40 and uses the same doubled clock and penalties', () => {
  assert.equal(overtimeMinutes({elapsed: 19 * 60}), 0);
  assert.equal(overtimeMinutes({elapsed: 20 * 60}), 0);
  assert.equal(overtimeMinutes({elapsed: 20 * 60 + 29.999}), 0);
  assert.equal(overtimeMinutes({elapsed: 20 * 60 + 30}), 1);
  assert.equal(overtimeMinutes({elapsed: 20 * 60, penalty: 5}), 5);
  assert.equal(overtimeMinutes({elapsed: 17.5 * 60, penalty: 5}), 0);
  assert.equal(overtimeMinutes({elapsed: 3 * 60 * 60}), 320);
  assert.equal(overtimeMinutes({elapsed: -1, penalty: Infinity}), 0);
});
test('overtime labels show minutes and hours, including a zero-overtime finish', () => {
  assert.equal(overtimeLabel({elapsed: 5 * 60}), '0분');
  assert.equal(overtimeLabel({elapsed: 20 * 60, penalty: 5}), '5분');
  assert.equal(overtimeLabel({elapsed: 50 * 60}), '1시간 0분');
  assert.equal(overtimeLabel({elapsed: 50 * 60, penalty: 5}), '1시간 5분');
});
test('continuing uses saved active time and penalties instead of resetting the clock', () => {
  let raw;
  const prior = globalThis.localStorage;
  globalThis.localStorage = {setItem: (_key, value) => {raw = value;}, getItem: () => raw};
  try {
    const state = {...freshState(), elapsed: 727, penalty: 5};
    assert.equal(saveGame(state), true);
    const restored = loadGame();
    assert.equal(restored.elapsed, 727);
    assert.equal(restored.penalty, 5);
    assert.equal(schoolTime(restored), '16:29');
    assert.equal(restored.elapsed, 727, 'formatting the school clock does not alter real playtime');
    restored.elapsed += 30;
    assert.equal(saveGame(restored), true);
    assert.equal(schoolTime(loadGame()), '16:30');
    assert.equal(schoolTime(freshState()), '16:00');
  } finally {globalThis.localStorage = prior;}
});

test('rest advances the school clock at one quarter speed while actual playtime keeps real seconds', () => {
  const state = freshState();
  assert.equal(REST_CLOCK_RATE, .25);
  advanceSchoolClock(state, 30);
  assert.equal(schoolTime(state), '16:01');
  advanceSchoolClock(state, 120, {resting:true});
  assert.equal(schoolTime(state), '16:02', 'two real rest minutes add one school minute');
  assert.equal(state.elapsed, 60, 'the honors API still receives school-clock equivalent seconds');
  assert.equal(actualPlaySeconds(state), 150, 'the certificate can report the real elapsed duration');
  advanceSchoolClock(state, 30);
  assert.equal(schoolTime(state), '16:03', 'standing up restores the normal rate');
  assert.equal(actualPlaySeconds(state), 180);
});

test('clock updates ignore invalid deltas and remain bounded', () => {
  const state = freshState();
  for (const dt of [NaN, Infinity, -1, undefined, '1']) advanceSchoolClock(state, dt, {resting:true});
  assert.equal(state.elapsed, 0);
  assert.equal(state.playElapsed, 0);
  advanceSchoolClock(state, 1e12);
  assert.equal(state.elapsed, 604800);
  assert.equal(state.playElapsed, 604800);
  assert.equal(schoolTime(state), '22:00');
});

test('a completed departure stays frozen during later walks, rests and repeated certificate views', () => {
  const state = freshState('퇴근한 교사');
  advanceSchoolClock(state, 1110);
  state.penalty = 5;
  state.completed = Array.from({length:10}, (_, i) => i + 1);
  state.finished = true;
  const record = freezeDeparture(state);
  assert.equal(schoolTime(departureState(state)), '16:42');
  assert.equal(Object.isFrozen(record), true);
  advanceSchoolClock(state, 300);
  advanceSchoolClock(state, 120, {resting:true});
  state.penalty += 1;
  assert.equal(freezeDeparture(state), record, 'reopening the certificate does not capture a later finish');
  assert.deepEqual(state.departureRecord, {elapsed:1110, playElapsed:1110, penalty:5});
  assert.equal(schoolTime(departureState(state)), '16:42');
  assert.equal(overtimeLabel(departureState(state)), '2분');
  assert.equal(actualPlaySeconds(departureState(state)), 1110);
  assert.equal(actualPlaySeconds(state), 1530);
  assert.equal(schoolTime(state), '16:54', 'the live world still moves forward');
  assert.throws(() => {record.elapsed = 9999;}, TypeError);
});

test('reading a certificate cannot create a record before all missions finish', () => {
  const state = freshState();
  state.elapsed = 60;
  const displayed = departureState(state);
  assert.equal(schoolTime(displayed), '16:02');
  assert.equal(state.departureRecord, null);
  assert.equal(freezeDeparture(state), null);
  state.finished = true;
  assert.equal(freezeDeparture(state), null, 'a malformed finished flag is not sufficient');
  assert.equal(actualPlaySeconds({elapsed:60}), 60, 'old saves need no duration field');
});
