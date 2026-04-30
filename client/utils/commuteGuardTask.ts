import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';

export const COMMUTE_GUARD_TASK = 'COMMUTE_GUARD_LOCATION_TASK';

// Distance calculation helper (Haversine formula)
const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

TaskManager.defineTask(COMMUTE_GUARD_TASK, async ({ data, error }: any) => {
  if (error) {
    console.error('[CommuteGuard] Task Error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (!location) return;

    try {
        const destinationJson = await AsyncStorage.getItem('COMMUTE_DESTINATION');
        if (!destinationJson) {
            console.log('[CommuteGuard] No destination, stopping task.');
            await Location.stopLocationUpdatesAsync(COMMUTE_GUARD_TASK);
            return;
        }

        const destination = JSON.parse(destinationJson);
        const distance = getDistanceInKm(
            location.coords.latitude, 
            location.coords.longitude, 
            destination.latitude, 
            destination.longitude
        );

        console.log(`[CommuteGuard] ${distance.toFixed(2)} km remaining`);

        if (distance <= 2.0) {
            console.log('[CommuteGuard] 📍 Proximity Threshold Reached!');

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: "📍 Destination Proximity Alert!",
                    body: "Wake up! You are approximately 2km away from your destination.",
                    sound: true,
                    android: {
                        channelId: 'commute-guard',
                        priority: Notifications.AndroidNotificationPriority.MAX,
                    },
                    data: { type: 'commute-alert' },
                } as any,
                trigger: null,
            });

            Vibration.vibrate([0, 1000, 500, 1000], false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            await Location.stopLocationUpdatesAsync(COMMUTE_GUARD_TASK);
            await AsyncStorage.removeItem('COMMUTE_DESTINATION');
            await AsyncStorage.removeItem('INITIAL_DISTANCE');
        }
    } catch (e) {
        console.error('[CommuteGuard] Task execution failed:', e);
    }
  }
});
