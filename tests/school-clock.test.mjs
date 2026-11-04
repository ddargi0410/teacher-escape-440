import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolTime, schoolMinutes, overtimeMinutes, overtimeLabel, TARGET_MINUTES} from '../school-clock.js';
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
