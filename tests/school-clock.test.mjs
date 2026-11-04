import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolTime, schoolMinutes, TARGET_MINUTES} from '../school-clock.js';
import {freshState, saveGame, loadGame} from '../save.js';

test('a fresh day begins at 16:00, and a quick finish can precede the 16:40 goal', () => {
  const state = freshState();
  assert.equal(schoolTime(state), '16:00');
  state.elapsed = 15 * 60;
  state.finished = true;
  assert.equal(schoolTime(state), '16:15');
  assert.ok(schoolMinutes(state) < TARGET_MINUTES);
});
test('active time and penalties advance the same clock, bounded at 22:00', () => {
  assert.equal(schoolTime({elapsed: 59, penalty: 0}), '16:00');
  assert.equal(schoolTime({elapsed: 60, penalty: 5}), '16:06');
  assert.equal(schoolTime({elapsed: 20 * 60, penalty: 1}), '16:21');
  assert.equal(schoolTime({elapsed: 604800, penalty: 360}), '22:00');
  assert.equal(schoolTime({elapsed: -20, penalty: NaN}), '16:00');
});
test('continuing uses saved active time and penalties instead of resetting the clock', () => {
  let raw;
  const prior = globalThis.localStorage;
  globalThis.localStorage = {setItem: (_key, value) => {raw = value;}, getItem: () => raw};
  try {
    const state = {...freshState(), elapsed: 727, penalty: 5};
    assert.equal(saveGame(state), true);
    assert.equal(schoolTime(loadGame()), '16:17');
    assert.equal(schoolTime(freshState()), '16:00');
  } finally {globalThis.localStorage = prior;}
});
