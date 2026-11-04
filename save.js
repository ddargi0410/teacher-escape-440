/** Browser-only progress. No names, answers or results are sent to a server. */
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
    completed: [],
    elapsed: 0,
    penalty: 0,
    floor: 1,
    bossDraft: '',
    finished: false,
    beginnerLearned: false,
    settings: { quality: 'medium', sound: false, relaxed: false }
  };
}

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== VERSION) return null;
  const state = freshState(value.name);
  const completed = Array.isArray(value.completed)
    ? [...new Set(value.completed.filter(id => Number.isInteger(id) && id >= 1 && id <= 10))]
    : [];
  const firstNineDone = Array.from({ length: 9 }, (_, i) => i + 1).every(id => completed.includes(id));
  state.completed = completed.filter(id => id !== 10 || firstNineDone).sort((a, b) => a - b);
  state.elapsed = number(value.elapsed, 0, 0, 604800);
  state.penalty = number(value.penalty, 0, 0, 360);
  state.floor = Math.round(number(value.floor, 1, 1, 5));
  state.bossDraft = typeof value.bossDraft === 'string' ? value.bossDraft : '';
  state.beginnerLearned = value.beginnerLearned === true;
  state.finished = value.finished === true && state.completed.length === 10;
  const settings = value.settings || {};
  state.settings = {
    quality: ['low', 'medium', 'high'].includes(settings.quality) ? settings.quality : 'medium',
    sound: settings.sound === true,
    relaxed: settings.relaxed === true
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
