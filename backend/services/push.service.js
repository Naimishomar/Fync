import admin from 'firebase-admin';

// NOTE: To initialize this, we need the service account credentials.
// For now, we will lazily initialize or try to initialize if FIREBASE_SERVICE_ACCOUNT is present.

let isInitialized = false;

try {
  // If the user provides a service account JSON string in env
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    isInitialized = true;
    console.log("Firebase Admin initialized successfully.");
  } else {
    console.log("Firebase Admin not initialized. Missing FIREBASE_SERVICE_ACCOUNT env var.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

/** Brand orange. Tints the small icon and the app name in Android's shade. */
const BRAND_COLOR = '#f97316';

/**
 * Android notification channel. It has to be one the device already created --
 * naming a channel that does not exist means Android 8+ falls back to a default
 * and ignores the importance and sound we asked for. The client creates
 * 'default' at startup in utils/notificationHelper.ts; keep the two in step.
 */
export const ANDROID_CHANNEL_ID = 'default';

/** Square logo shown as the large icon when a caller does not supply one. */
const DEFAULT_LARGE_ICON = process.env.PUSH_LOGO_URL || null;

/** FCM rejects a multicast of more than 500 tokens. */
export const FCM_MULTICAST_LIMIT = 500;

/** Token errors that mean the device is gone for good and should be pruned. */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Sends a push notification to an array of FCM tokens.
 *
 * The payload used to be `{ notification: { title, body } }` and nothing else,
 * which on Android renders as a grey system glyph with no branding -- not the
 * app-logo-and-image treatment people expect from Instagram and the like. The
 * platform blocks below add the small icon, brand tint, large icon, expandable
 * big-picture image and channel on Android, and the sound/badge/rich-media
 * flags on iOS.
 *
 * @param {string[]} tokens
 * @param {object} payload - { title, body, data, imageUrl, largeIcon }
 * @returns {Promise<{sent:number, failed:number, deadTokens:string[]}|false>}
 */
export const sendPushNotification = async (tokens, payload) => {
  if (!isInitialized) {
    console.log("Push notifications skipped (Firebase Admin not initialized).");
    return false;
  }

  const list = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
  if (list.length === 0) return false;

  if (list.length > FCM_MULTICAST_LIMIT) {
    // Caller should batch. Refusing loudly beats FCM rejecting the whole send.
    console.error(`sendPushNotification: ${list.length} tokens exceeds the ${FCM_MULTICAST_LIMIT} limit`);
    return false;
  }

  const imageUrl = payload.imageUrl || null;
  const largeIcon = payload.largeIcon || DEFAULT_LARGE_ICON;

  // FCM requires every data value to be a string.
  const data = Object.fromEntries(
    Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
  );

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
      ...(imageUrl ? { imageUrl } : {}),
    },
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: payload.channelId || ANDROID_CHANNEL_ID,
        // Matches the drawable the expo-notifications plugin installs from
        // app.json's `notification.icon`.
        icon: 'notification_icon',
        color: BRAND_COLOR,
        ...(largeIcon ? { imageUrl: largeIcon } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        defaultSound: true,
        // Collapse repeats of the same kind rather than stacking twenty rows.
        ...(payload.tag ? { tag: payload.tag } : {}),
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        // Required for the Notification Service Extension to attach an image.
        ...(imageUrl ? { 'apns-push-type': 'alert' } : {}),
      },
      payload: {
        aps: {
          sound: 'default',
          badge: payload.badge ?? undefined,
          ...(imageUrl ? { 'mutable-content': 1 } : {}),
        },
      },
      ...(imageUrl ? { fcmOptions: { imageUrl } } : {}),
    },
    tokens: list,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    // Dead tokens were previously logged and left in the database, so a user who
    // reinstalled kept a permanently failing token and every later broadcast
    // wasted a slot on it. Report them so the caller can prune.
    const deadTokens = [];
    response.responses.forEach((resp, idx) => {
      if (resp.success) return;
      const code = resp.error?.code;
      if (DEAD_TOKEN_CODES.has(code)) deadTokens.push(list[idx]);
      else console.log('Push send failure:', code, resp.error?.message);
    });

    console.log(`Push: ${response.successCount} sent, ${response.failureCount} failed, ${deadTokens.length} dead`);
    return { sent: response.successCount, failed: response.failureCount, deadTokens };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
};
