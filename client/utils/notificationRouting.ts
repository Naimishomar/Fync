import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { navigationRef } from './navigation';

/**
 * Tapping a push opens the screen it is about. Pushes arrive two ways (Expo
 * tokens and FCM tokens, see backend utils/notifyUser.js) plus local reminders;
 * all three land here with the push's `data`.
 *
 * The tap can come before the navigator exists (cold start) or before login
 * (auth stack has no app screens), so the target waits in `pending` and
 * `flushNotificationRoute` retries on every navigation state change.
 */

type Data = Record<string, any> | undefined | null;
type Target = { name: string; params?: object } | { url: string };

// `type` values the backend sends without a `screen`.
const BY_TYPE: Record<string, string> = {
  chat: 'ChatList',
  gift_order: 'MyGifts',
  sunday_match: 'SundayMatch',
  crush: 'CrushMatch',
  ask: 'AskInbox',
  couple: 'CoupleSpace',
  weekly_recap: 'Profile',
  streak_nudge: 'Tabs',
};

/** Pure: push data → where to go. Unknown pushes open the notifications list. */
export const resolveTarget = (data: Data): Target => {
  const url = typeof data?.url === 'string' ? data.url : '';
  if (url.startsWith('fync://')) return { url };
  const screen = typeof data?.screen === 'string' ? data.screen : '';
  if (screen === 'Home') return { name: 'Tabs' };
  if (screen) return { name: screen };
  const byType = BY_TYPE[String(data?.type || '')];
  return { name: byType || 'Notification' };
};

let pending: Target | null = null;
let lastHandled = '';

export const flushNotificationRoute = () => {
  if (!pending || !navigationRef.isReady()) return;
  if ('url' in pending) {
    const { url } = pending;
    pending = null;
    Linking.openURL(url).catch(() => {});
    return;
  }
  // Not in the current navigator yet (still on login/splash): try again later.
  const names: string[] = navigationRef.getRootState()?.routeNames ?? [];
  if (!names.includes(pending.name)) return;
  const { name, params } = pending;
  pending = null;
  (navigationRef as any).navigate(name, params);
};

const open = (id: string, data: Data) => {
  if (id && id === lastHandled) return; // same tap reported twice (listener + cold-start read)
  lastHandled = id;
  pending = resolveTarget(data);
  flushNotificationRoute();
};

/** Call once at app start. Returns an unsubscribe. */
export const listenForNotificationTaps = () => {
  const expoSub = Notifications.addNotificationResponseReceivedListener((r) =>
    open(r.notification.request.identifier, r.notification.request.content.data as Data));
  Notifications.getLastNotificationResponseAsync()
    .then((r) => r && open(r.notification.request.identifier, r.notification.request.content.data as Data))
    .catch(() => {});

  const fcmUnsub = messaging().onNotificationOpenedApp((m) => open(m.messageId || '', m.data as Data));
  messaging().getInitialNotification()
    .then((m) => m && open(m.messageId || '', m.data as Data))
    .catch(() => {});

  return () => { expoSub.remove(); fcmUnsub(); };
};
