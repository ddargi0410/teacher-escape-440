/** Browser-only progress, answers and results. The entered nickname is also used by live presence. */
import {normalizeAvatarId} from './character-appearance.js?v=20261106-cute1';
const STORAGE_KEY = 'teacher-escape-440-v1';
const VERSION = 1;

const number = (value, fallback, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
};
const nameOf = value => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) || '퇴근희망 교사'
  : '퇴근희망 교사';

export function freshState(name = '퇴근희망 교사') {
  return {
    version: VERSION,
    name: nameOf(name),
    avatarId: normalizeAvatarId(),
    completed: [],
    elapsed: 0,
    playElapsed: 0,
    penalty: 0,
    floor: 1,
    zone: 'school',
    bossDraft: '',
    finished: false,
    departureRecord: null,
    honorsRunId: null,
    beginnerLearned: false,
    settings: { quality: 'medium', sound: false, relaxed: false, cameraMode: 'shoulder' }
  };
}

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== VERSION) return null;
  const state = freshState(value.name);
  state.avatarId = normalizeAvatarId(value.avatarId);
  const completed = Array.isArray(value.completed)
    ? [...new Set(value.completed.filter(id => Number.isInteger(id) && id >= 1 && id <= 10))]
    : [];
  const firstNineDone = Array.from({ length: 9 }, (_, i) => i + 1).every(id => completed.includes(id));
  state.completed = completed.filter(id => id !== 10 || firstNineDone).sort((a, b) => a - b);
  state.elapsed = number(value.elapsed, 0, 0, 604800);
  state.playElapsed = Math.max(state.elapsed, number(value.playElapsed, state.elapsed, 0, 604800));
  state.penalty = number(value.penalty, 0, 0, 360);
  state.floor = Math.round(number(value.floor, 1, 1, 5));
  // The playground is reached from the first floor only.
  state.zone = value.zone === 'yard' && state.floor === 1 ? 'yard' : 'school';
  state.bossDraft = typeof value.bossDraft === 'string' ? value.bossDraft : '';
  state.beginnerLearned = value.beginnerLearned === true;
  state.finished = value.finished === true && state.completed.length === 10;
  if (state.finished) {
    // Completed saves made before free roaming have no snapshot. Their current
    // timing is already the departure record, so capture it during migration.
    const candidate = value.departureRecord;
    const record = candidate && !Array.isArray(candidate) && ['elapsed', 'playElapsed', 'penalty'].every(key =>
      typeof candidate[key] === 'number' && Number.isFinite(candidate[key]) && candidate[key] >= 0)
      ? candidate : state;
    const elapsed = number(record.elapsed, state.elapsed, 0, state.elapsed);
    state.departureRecord = Object.freeze({
      elapsed,
      playElapsed: Math.max(elapsed, number(record.playElapsed, state.playElapsed, 0, state.playElapsed)),
      penalty: number(record.penalty, state.penalty, 0, state.penalty)
    });
  }
  state.honorsRunId = typeof value.honorsRunId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.honorsRunId) ? value.honorsRunId.toLowerCase() : null;
  const settings = value.settings || {};
  state.settings = {
    quality: ['low', 'medium', 'high'].includes(settings.quality) ? settings.quality : 'medium',
    sound: settings.sound === true,
    relaxed: settings.relaxed === true,
    cameraMode: ['shoulder','overview','first'].includes(settings.cameraMode) ? settings.cameraMode : 'shoulder'
  };
  return state;
}

export function storageAvailable() {
  try {
    const probe = `${STORAGE_KEY}-probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const safe = normalize(state);
    if (!safe) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
