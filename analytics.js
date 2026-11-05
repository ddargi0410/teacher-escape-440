// Aggregate visit counting is independent of game progress and multiplayer.
export const ANALYTICS_STORAGE_KEY = 'teacher-escape-440:analytics-visitor-v1';
export const HEARTBEAT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuid(crypto) {
  try {
    if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto?.getRandomValues !== 'function') return null;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(n => n.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  } catch { return null; }
}

export function isAnalyticsPreview(location) {
  const host = String(location?.hostname || '').toLowerCase();
  return !host || location?.protocol === 'file:' || host === 'localhost' || host.endsWith('.localhost') ||
    host === 'terminal.local' || host.endsWith('.local') || /^127\./.test(host) || host === '[::1]' || host === '::1';
}

/** One visit per loaded page, one anonymous visitor ID per browser storage. */
export function createAnalytics({endpoint, runtime = {}}) {
  const doc = runtime.document ?? globalThis.document;
  const win = runtime.window ?? globalThis.window;
  const location = runtime.location ?? win?.location;
  const fetcher = runtime.fetch ?? globalThis.fetch?.bind(globalThis);
  const crypto = Object.hasOwn(runtime, 'crypto') ? runtime.crypto : globalThis.crypto;
  const Controller = runtime.AbortController ?? globalThis.AbortController;
  const later = runtime.setTimeout ?? globalThis.setTimeout;
  const cancel = runtime.clearTimeout ?? globalThis.clearTimeout;
  let storage;
  try { storage = Object.hasOwn(runtime, 'storage') ? runtime.storage : win?.localStorage; } catch { storage = null; }
  let visitorId, visitId, sequence = 0, started = false, disposed = false, active = false, pageHidden = false;
  let timer = null, pending = null;
  const enabled = typeof endpoint === 'string' && /^https:\/\//.test(endpoint) && !isAnalyticsPreview(location) &&
    typeof fetcher === 'function' && typeof Controller === 'function' && !!doc?.addEventListener && !!win?.addEventListener;

  function clearTimer() { if (timer !== null) cancel(timer); timer = null; }
  function schedule() {
    clearTimer();
    if (active && !disposed) timer = later(() => { timer = null; send('heartbeat'); }, HEARTBEAT_MS);
  }
  function abortPending() {
    const request = pending;
    if (!request) return;
    pending = null;
    cancel(request.timeout);
    try { request.controller.abort(); } catch {}
  }
  function send(event) {
    if (!visitorId || !visitId || (event === 'heartbeat' && (!active || disposed || pending))) return;
    const controller = new Controller();
    const request = {controller, timeout:null};
    pending = request;
    const finish = () => {
      if (pending !== request) return;
      cancel(request.timeout);
      pending = null;
      if (event === 'heartbeat') schedule();
    };
    request.timeout = later(() => { try { controller.abort(); } catch {} finish(); }, REQUEST_TIMEOUT_MS);
    const body = JSON.stringify({visitorId, visitId, seq:++sequence, event});
    try {
      // keepalive lets the final small leave request finish during navigation.
      Promise.resolve(fetcher(endpoint, {method:'POST', headers:{'Content-Type':'application/json'},
        body, credentials:'omit', cache:'no-store', keepalive:event === 'leave', signal:controller.signal}))
        .catch(() => {}).finally(finish);
    } catch { finish(); }
  }
  function setActive(next) {
    if (next === active) return;
    active = next;
    clearTimer();
    abortPending();
    send(next ? 'heartbeat' : 'leave');
  }
  function visibility() { if (started && !disposed) setActive(!doc.hidden && !pageHidden); }
  function hide() { pageHidden = true; visibility(); }
  function show() { pageHidden = false; visibility(); }

  return {
    start() {
      if (disposed) return false;
      if (started) return !!visitorId;
      if (!enabled) return false;
      try { visitorId = storage?.getItem(ANALYTICS_STORAGE_KEY); } catch {}
      if (!UUID.test(visitorId || '')) {
        visitorId = uuid(crypto);
        if (visitorId) { try { storage?.setItem(ANALYTICS_STORAGE_KEY, visitorId); } catch {} }
      }
      visitId = uuid(crypto);
      if (!UUID.test(visitorId || '') || !UUID.test(visitId || '')) return false;
      started = true;
      doc.addEventListener('visibilitychange', visibility);
      win.addEventListener('pagehide', hide);
      win.addEventListener('pageshow', show);
      visibility();
      return true;
    },
    dispose() {
      if (disposed) return;
      setActive(false);
      disposed = true;
      clearTimer();
      doc?.removeEventListener('visibilitychange', visibility);
      win?.removeEventListener('pagehide', hide);
      win?.removeEventListener('pageshow', show);
    }
  };
}
