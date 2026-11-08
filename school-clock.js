// The school clock advances independently of actual play duration. A new day starts at 16:00.
export const START_MINUTES = 16 * 60;
export const TARGET_MINUTES = 16 * 60 + 40;
export const LATEST_MINUTES = 22 * 60;
export const CLOCK_SPEED = 2;
export const REST_CLOCK_RATE = .25;
const MAX_ELAPSED_SECONDS = 604800;

const nonnegative = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
const complete = state => state?.finished === true && Array.isArray(state.completed)
  && Array.from({length:10}, (_, index) => index + 1).every(id => state.completed.includes(id));
const validRecord = record => record && ['elapsed', 'playElapsed', 'penalty'].every(key =>
  typeof record[key] === 'number' && Number.isFinite(record[key]) && record[key] >= 0)
  && record.elapsed <= MAX_ELAPSED_SECONDS && record.playElapsed <= MAX_ELAPSED_SECONDS
  && record.playElapsed >= record.elapsed && record.penalty <= 360;

export function actualPlaySeconds(state = {}) {
  // Older saves have only elapsed. Actual duration can never be shorter than
  // the school-clock equivalent, including older test/resume fixtures.
  return Math.min(MAX_ELAPSED_SECONDS, Math.max(nonnegative(state.elapsed), nonnegative(state.playElapsed)));
}

export function advanceSchoolClock(state, dt, {resting = false} = {}) {
  const step = Math.min(MAX_ELAPSED_SECONDS, nonnegative(dt));
  if (!state || !step) return;
  const actual = actualPlaySeconds(state);
  state.elapsed = Math.min(MAX_ELAPSED_SECONDS, nonnegative(state.elapsed) + step * (resting ? REST_CLOCK_RATE : 1));
  state.playElapsed = Math.min(MAX_ELAPSED_SECONDS, actual + step);
}

export function freezeDeparture(state) {
  if (!complete(state)) return null;
  if (validRecord(state.departureRecord)) return Object.freeze(state.departureRecord);
  state.departureRecord = Object.freeze({
    elapsed: Math.min(MAX_ELAPSED_SECONDS, nonnegative(state.elapsed)),
    playElapsed: actualPlaySeconds(state),
    penalty: Math.min(360, nonnegative(state.penalty))
  });
  return state.departureRecord;
}

export function departureState(state = {}) {
  // Formatting or downloading a certificate must not update the running clock
  // or recapture a later departure after the player chooses to stay at school.
  return {...state, ...(complete(state) && validRecord(state.departureRecord) ? state.departureRecord : {})};
}

export function schoolMinutes(state = {}) {
  // Elapsed is active-time equivalent seconds; resting contributes one quarter.
  // Keeping this field preserves the existing honors API's clock calculation.
  return Math.min(LATEST_MINUTES, START_MINUTES + Math.floor(nonnegative(state.elapsed) * CLOCK_SPEED / 60) + Math.floor(nonnegative(state.penalty)));
}
export function schoolTime(state) {
  const minutes = schoolMinutes(state);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function overtimeMinutes(state) {
  return Math.max(0, schoolMinutes(state) - TARGET_MINUTES);
}
export function overtimeLabel(state) {
  const minutes = overtimeMinutes(state);
  const hours = Math.floor(minutes / 60);
  return `${hours ? `${hours}시간 ` : ''}${minutes % 60}분`;
}
