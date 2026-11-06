// In-memory bridge: home-page visits do not read names from saved games.
export function normalizeAnalyticsNickname(value) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/.test(value)) return '';
  const nickname = value.trim();
  const characters = Array.from(nickname);
  if (!nickname || characters.length > 24 || characters.some(character => {
    const point = character.codePointAt(0);
    return point >= 0xd800 && point <= 0xdfff;
  })) return '';
  return nickname;
}

export function createAnalyticsIdentity() {
  let latest = '';
  const listeners = new Set();
  function deliver(listener, nickname) { try { listener(nickname); } catch {} }
  return {
    publish(value) {
      const nickname = normalizeAnalyticsNickname(value);
      if (!nickname) return false;
      if (latest === nickname) return true;
      latest = nickname;
      for (const listener of listeners) deliver(listener, nickname);
      return true;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      if (latest) deliver(listener, latest);
      return () => listeners.delete(listener);
    }
  };
}

const identity = createAnalyticsIdentity();
export const publishAnalyticsNickname = value => identity.publish(value);
export const subscribeAnalyticsNickname = listener => identity.subscribe(listener);
