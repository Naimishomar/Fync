import { Platform } from 'react-native';
import axios from '../context/axiosConfig';
import messaging from '@react-native-firebase/messaging';

export const requestUserPermission = async () => {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('Authorization status:', authStatus);
      return true;
    }
    return false;
  }
  return true;
};

export const syncFcmToken = async () => {
  try {
    const hasPermission = await requestUserPermission();
    if (!hasPermission) {
      console.log('Push notification permission denied');
      return;
    }

    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    console.log('FCM Token:', token);

    await axios.post('/auth/fcm-token', { fcmToken: token });
  } catch (error) {
    console.error('Error syncing FCM token:', error);
  }
};

export const setupBackgroundHandler = () => {
  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    console.log('Message handled in the background!', remoteMessage);
  });
};
