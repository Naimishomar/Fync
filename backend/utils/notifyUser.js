import { sendPushNotification as sendFcm } from '../services/push.service.js';
import { sendPushNotification as sendExpo } from './notification.js';

/**
 * Push one user on whichever channel they registered: FCM tokens first,
 * else the Expo token. Never both, so nobody gets the same push twice.
 * Never throws: a missed nudge is not worth failing a cron batch over.
 * user: { fcmTokens?, expoPushToken? }
 */
export const pushUser = async (user, { title, body, data = {}, tag }) => {
  try {
    if (user?.fcmTokens?.length) return await sendFcm(user.fcmTokens.slice(0, 500), { title, body, data, tag });
    // The Expo helper returns nothing and logs its own failures.
    if (user?.expoPushToken) { await sendExpo(user.expoPushToken, title, body, data); return true; }
  } catch (err) {
    console.error('pushUser:', err.message);
  }
  return false;
};
