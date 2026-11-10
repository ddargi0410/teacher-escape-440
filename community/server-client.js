// Browser client for the server half (server/community-service.mjs).
// Same method names as the device-only store, so the game uses either one.
import {CommunityError} from './core.js';

export const SESSION_KEY = 'teacher-escape-community-session-v1';

export function createServerCommunity({base, fetcher = globalThis.fetch?.bind(globalThis), storage = globalThis.localStorage, timeoutMs = 8000} = {}) {
  const root = String(base || '').replace(/\/+$/, '');
  let session = null;
  try { const saved = JSON.parse(storage?.getItem(SESSION_KEY) || 'null'); if (saved?.base === root && typeof saved.token === 'string') session = saved; } catch {}
  const remember = value => { session = value; try { value ? storage?.setItem(SESSION_KEY, JSON.stringify(value)) : storage?.removeItem(SESSION_KEY); } catch {} };

  async function call(method, path, body, {auth = true, keepalive = false} = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : 0;
    const headers = {'Content-Type': 'application/json'};
    if (auth && session?.token) headers.Authorization = `Bearer ${session.token}`;
    let response, payload = null;
    try {
      response = await fetcher(root + path, {method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'omit', cache: 'no-store', keepalive, signal: controller?.signal});
      try { payload = await response.json(); } catch { payload = null; }
    } catch {
      throw new CommunityError('network', '서버에 연결하지 못했어요. 잠시 후 다시 해 주세요.');
    } finally { clearTimeout(timer); }
    if (!response.ok) {
      if (response.status === 401) remember(null);
      const {error, message, ...extra} = payload || {};
      throw new CommunityError(error || 'server_error', message || '잠시 후 다시 해 주세요.', extra);
    }
    return payload;
  }
  const query = params => '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();

  return {
    mode: 'server',
    get signedIn() { return !!session?.token; },
    get nickname() { return session?.nickname || null; },
    async status() { return call('GET', '/status', undefined, {auth: false}); },
    async login({nickname, code}) {
      const result = await call('POST', '/login', {nickname, code}, {auth: false});
      remember({base: root, token: result.token, nickname: result.account?.nickname || nickname});
      return result;
    },
    async logout() { try { await call('POST', '/logout', {}); } finally { remember(null); } },
    me: () => call('GET', '/me'),
    pushSave: (state, {keepalive = false} = {}) => call('PUT', '/save', {state}, {keepalive}),
    quiz: () => call('GET', '/quiz'),
    answerQuiz: (questionId, choice) => call('POST', '/quiz/answer', {questionId, choice}),
    trees: () => call('GET', '/trees'),
    searchTrees: q => call('GET', '/trees/search' + query({q})),
    plant: name => call('POST', '/trees', {name}),
    water: id => call('POST', `/trees/${encodeURIComponent(id)}/water`, {}),
    harvest: () => call('POST', '/trees/mine/harvest', {}),
    gift: id => call('POST', `/trees/${encodeURIComponent(id)}/gift`, {}),
    reportTree: id => call('POST', `/trees/${encodeURIComponent(id)}/report`, {}),
    notes: ({order = 'latest', offset = 0, limit = 20} = {}) => call('GET', '/notes' + query({order, offset, limit})),
    writeNote: (text, color) => call('POST', '/notes', {text, color}),
    deleteNote: id => call('DELETE', `/notes/${encodeURIComponent(id)}`),
    react: (id, type) => call('POST', `/notes/${encodeURIComponent(id)}/react`, {type}),
    reportNote: id => call('POST', `/notes/${encodeURIComponent(id)}/report`, {}),
    useCoffee: target => call('POST', '/coffee/use', {target}),
    importLocal: data => call('POST', '/import', data),
    async deleteAccount() { const result = await call('DELETE', '/me'); remember(null); return result; },
  };
}
