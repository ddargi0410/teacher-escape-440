import {createAnalytics} from './analytics.js?v=20261106-nicknames1';
import {subscribeAnalyticsNickname} from './analytics-identity.js?v=20261106-nicknames1';
import {PRESENCE_ENDPOINT} from './presence-config.js';

// Keep analytics failures isolated from the game entry module.
try {
  const endpoint = new URL('./analytics', PRESENCE_ENDPOINT).href;
  const tracker = createAnalytics({endpoint});
  subscribeAnalyticsNickname(nickname => tracker.setNickname(nickname));
  tracker.start();
} catch {}
