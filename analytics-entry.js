import {createAnalytics} from './analytics.js';
import {PRESENCE_ENDPOINT} from './presence-config.js';

// Keep analytics failures isolated from the game entry module.
try {
  const endpoint = new URL('./analytics', PRESENCE_ENDPOINT).href;
  createAnalytics({endpoint}).start();
} catch {}
