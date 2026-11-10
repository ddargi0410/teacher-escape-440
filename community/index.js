// One entry point for the game. Uses the server when it answers /status,
// otherwise keeps everything on this device. Moves device data to the server
// the first time the same nickname signs in there.
import {createLocalCommunity} from './local-store.js';
import {createServerCommunity} from './server-client.js';
import {normalizeNickname} from './core.js';

const SAVE_DELAY_MS = 20000;

export function createCommunity({base = '', fetcher, storage = globalThis.localStorage, probeTimeoutMs = 4000, now} = {}) {
  const local = createLocalCommunity({storage, now});
  let active = local, saveTimer = null, pendingState = null;
  const ready = (async () => {
    if (!base) return 'local';
    const server = createServerCommunity({base, fetcher, storage});
    try {
      const status = await Promise.race([server.status(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), probeTimeoutMs))]);
      if (status?.ok && Number(status.version) >= 1) { active = server; return 'server'; }
    } catch {}
    return 'local';
  })();
  const delegate = name => async (...args) => { await ready; return active[name](...args); };

  async function flushSave({keepalive = false} = {}) {
    clearTimeout(saveTimer); saveTimer = null;
    if (!pendingState || active.mode !== 'server' || !active.signedIn) return false;
    const state = pendingState; pendingState = null;
    try { await active.pushSave(state, {keepalive}); return true; } catch { pendingState ??= state; return false; }
  }

  return {
    ready,
    get mode() { return active.mode; },
    get deviceOnly() { return active.mode !== 'server'; },
    get signedIn() { return active.signedIn; },
    get nickname() { return active.nickname; },
    /** Signs in or creates the account. Returns the server save, if any. */
    async login({nickname, code}) {
      await ready;
      const result = await active.login({nickname, code});
      if (active.mode === 'server' && !result.importedLocal) {
        const key = normalizeNickname(nickname).key, data = local.exportFor(key);
        if (data && (data.tree || data.coffee || data.notes.length)) {
          try { await active.importLocal(data); local.markMigrated(key); result.migrated = true; } catch {}
        }
      }
      return result;
    },
    async logout() { await ready; clearTimeout(saveTimer); pendingState = null; return active.logout(); },
    /** Same person as the save? Shared school PCs switch teachers often. */
    matches(name) { const signed = active.nickname; return !!signed && normalizeNickname(signed).key === normalizeNickname(name).key; },
    queueSave(state) {
      if (active.mode !== 'server' || !active.signedIn || !state) return;
      pendingState = JSON.parse(JSON.stringify({...state, settings: undefined}));
      if (!saveTimer) saveTimer = setTimeout(() => void flushSave(), SAVE_DELAY_MS);
    },
    flushSave,
    me: delegate('me'), quiz: delegate('quiz'), answerQuiz: delegate('answerQuiz'),
    trees: delegate('trees'), searchTrees: delegate('searchTrees'), plant: delegate('plant'), water: delegate('water'),
    harvest: delegate('harvest'), gift: delegate('gift'), reportTree: delegate('reportTree'),
    notes: delegate('notes'), writeNote: delegate('writeNote'), deleteNote: delegate('deleteNote'),
    react: delegate('react'), reportNote: delegate('reportNote'), useCoffee: delegate('useCoffee'),
    async deleteAccount() { await ready; clearTimeout(saveTimer); pendingState = null; return active.deleteAccount(); },
  };
}
