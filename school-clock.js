// One clock for the HUD and the downloaded certificate. A new day starts at 16:00.
export const START_MINUTES = 16 * 60;
export const TARGET_MINUTES = 16 * 60 + 40;
export const LATEST_MINUTES = 22 * 60;

const nonnegative = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
export function schoolMinutes(state = {}) {
  return Math.min(LATEST_MINUTES, START_MINUTES + Math.floor(nonnegative(state.elapsed) / 60) + Math.floor(nonnegative(state.penalty)));
}
export function schoolTime(state) {
  const minutes = schoolMinutes(state);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
