// One clock for the HUD and the downloaded certificate. A new day starts at 16:00.
export const START_MINUTES = 16 * 60;
export const TARGET_MINUTES = 16 * 60 + 40;
export const LATEST_MINUTES = 22 * 60;
export const CLOCK_SPEED = 2;

const nonnegative = value => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
export function schoolMinutes(state = {}) {
  // Elapsed is saved in real seconds; penalties are already school-clock minutes.
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
