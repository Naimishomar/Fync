import { Platform, PermissionsAndroid } from 'react-native';
import axios from '../context/axiosConfig';
import messaging from '@react-native-firebase/messaging';

export const requestUserPermission = async () => {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  // Android 13 (API 33) made notifications a runtime permission. This used to
  // return true without asking for anything: the token was fetched and stored,
  // FCM accepted every send, and the phone silently dropped the notification.
  // Nothing in the logs said so — delivery looked successful end to end.
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (already) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  return true;
};

/** Returns the token once the server has it (skips the POST when it equals
 *  `lastSent`), or null when nothing was saved. */
export const syncFcmToken = async (lastSent?: string): Promise<string | null> => {
  try {
    const hasPermission = await requestUserPermission();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return null;
    }

    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    console.log('FCM Token:', token);

    if (!token) return null;
    if (token !== lastSent) await axios.post('/user/fcm-token', { fcmToken: token });
    return token;
  } catch (error) {
    console.error('Error syncing FCM token:', error);
    return null;
  }
};

export const setupBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    console.log('Message handled in the background!', remoteMessage);
  });
};
