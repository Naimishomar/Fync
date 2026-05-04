import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import {
  View, Text, ScrollView, Pressable, Dimensions,
  StatusBar, ActivityIndicator, Image, Alert, RefreshControl,
  Platform, Vibration, Modal
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

import DestinationPickerModal from './DestinationPickerModal';
import { COMMUTE_GUARD_TASK } from '../../utils/commuteGuardTask';

const { width, height: screenHeight } = Dimensions.get('window');

// Memoized Map Component to prevent lag
const TravelMap = React.memo(({ currentLocation, destination, isCommuteGuardActive, onOpenPicker }: any) => {
    const mapRef = useRef<MapView>(null);

    useEffect(() => {
        if (destination && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: destination.latitude,
                longitude: destination.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }, 1000);
        }
    }, [destination]);

    return (
        <View className="w-full h-80 rounded-[32px] overflow-hidden">
            <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={currentLocation ? {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                } : {
                    latitude: 28.6139,
                    longitude: 77.2090,
                    latitudeDelta: 0.1,
                    longitudeDelta: 0.1,
                }}
            >
                {currentLocation && (
                    <Marker coordinate={currentLocation}>
                        <View className="w-6 h-6 bg-blue-500/20 items-center justify-center rounded-full">
                            <View className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                        </View>
                    </Marker>
                )}
                {destination && (
                    <Marker coordinate={destination}>
                        <View className="bg-orange-500 p-2 rounded-2xl shadow-lg">
                            <Ionicons name="location" size={20} color="white" />
                        </View>
                    </Marker>
                )}
            </MapView>

            {!isCommuteGuardActive && (
                <Pressable 
                    onPress={onOpenPicker}
                    className="absolute inset-0 bg-black/30 items-center justify-center backdrop-blur-sm"
                >
                    <View className="bg-white/90 px-6 py-4 rounded-[24px] items-center flex-row">
                        <Ionicons name="map" size={20} color="#f97316" />
                        <Text className="text-zinc-900 font-black uppercase text-xs tracking-widest ml-3">Select Destination</Text>
                    </View>
                </Pressable>
            )}
        </View>
    );
}, (prev, next) => {
    // Only re-render if destination changes or activity status changes
    // Location changes are handled by the native MapView mostly, or small jitters are ignored
    return prev.destination?._id === next.destination?._id && 
           prev.isCommuteGuardActive === next.isCommuteGuardActive &&
           Math.abs(prev.currentLocation?.latitude - next.currentLocation?.latitude) < 0.001;
});

// Distance calculation helper
const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Notification configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Configure notification channel for Android
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('commute-guard', {
    name: 'Travel Safety Alerts',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#f97316',
  });
}

const TravelSafetyDashboard = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Commute Guard States
  const [isCommuteGuardActive, setIsCommuteGuardActive] = useState(false);
  const [destination, setDestination] = useState<any>(null);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);

  // Travel Alarm States
  const [showTravelAlarm, setShowTravelAlarm] = useState(false);
  const isAlarmActive = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      const guardRes = await AsyncStorage.getItem('COMMUTE_DESTINATION');
      const initDistRes = await AsyncStorage.getItem('INITIAL_DISTANCE');
      
      setIsCommuteGuardActive(!!guardRes);
      if (guardRes) setDestination(JSON.parse(guardRes));
      if (initDistRes) setInitialDistance(parseFloat(initDistRes));
      
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    // Live location tracking for UI
    let locationSubscription: any;
    const startLiveTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
            locationSubscription = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, distanceInterval: 30 }, // Reduced frequency for smoother UI
                (location) => {
                    setCurrentLocation(location.coords);
                }
            );
        }
    };
    startLiveTracking();

    return () => {
        if (locationSubscription) locationSubscription.remove();
        stopTravelAlarm();
    };
  }, []);

  const startTravelAlarm = async () => {
    if (isAlarmActive.current) return;
    isAlarmActive.current = true;
    
    setShowTravelAlarm(true);
    Vibration.vibrate([0, 500, 200, 500], true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    try {
        if (soundRef.current) {
            await soundRef.current.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync(
            { uri: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
            { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        soundRef.current = sound;
    } catch (e) {
        console.error("Alarm sound failed:", e);
    }
  };

  const stopTravelAlarm = async () => {
    isAlarmActive.current = false;
    Vibration.vibrate(0); // Reset vibration state
    Vibration.cancel();
    setShowTravelAlarm(false);
    
    try {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
        }
    } catch (e) {
        console.error("Error stopping sound:", e);
    }
  };

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(notification => {
        if (notification.request.content.data?.type === 'commute-alert') {
            startTravelAlarm();
        }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        if (response.notification.request.content.data?.type === 'commute-alert') {
            startTravelAlarm();
        }
    });

    return () => {
        subscription.remove();
        responseSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (currentLocation && destination) {
      const dist = getDistanceInKm(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude
      );
      setDistanceToTarget(dist);
    }
  }, [currentLocation, destination]);

  const handleSetDestination = async (dest: any) => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Required", "Background location is needed to wake you up during your travel.");
      return;
    }

    // Calculate initial distance to track progress
    let startingDist = 0;
    if (currentLocation) {
        startingDist = getDistanceInKm(
            currentLocation.latitude,
            currentLocation.longitude,
            dest.latitude,
            dest.longitude
        );
        setInitialDistance(startingDist);
        await AsyncStorage.setItem('INITIAL_DISTANCE', startingDist.toString());

        if (startingDist <= 2.0) {
            console.log("[CommuteGuard] Destination already within 2km. Triggering immediate alert.");
            startTravelAlarm();
        }
    }

    await AsyncStorage.setItem('COMMUTE_DESTINATION', JSON.stringify(dest));
    
    await Location.startLocationUpdatesAsync(COMMUTE_GUARD_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      deferredUpdatesInterval: 60000,
      foregroundService: {
        notificationTitle: "Commute Guard Active",
        notificationBody: "Monitoring your distance to destination...",
        notificationColor: "#f97316"
      }
    });

    setDestination(dest);
    setIsCommuteGuardActive(true);
    Toast.show({ type: 'success', text1: 'Commute Guard Active', text2: 'We will wake you up 2km away!' });
  };

  const toggleCommuteGuard = async () => {
    if (isCommuteGuardActive) {
      await Location.stopLocationUpdatesAsync(COMMUTE_GUARD_TASK);
      await AsyncStorage.removeItem('COMMUTE_DESTINATION');
      await AsyncStorage.removeItem('INITIAL_DISTANCE');
      setIsCommuteGuardActive(false);
      setDestination(null);
      setDistanceToTarget(null);
      setInitialDistance(null);
      Toast.show({ type: 'info', text1: 'Commute Guard Deactivated' });
    } else {
      setShowDestinationPicker(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInitialData();
    setRefreshing(false);
  };

  if (loading) return (
    <View className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <View className="absolute top-0 w-full h-96 opacity-10">
        <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-8 pt-6 flex-row items-center justify-between mb-8">
          <View>
            <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">Travel <Text className="text-orange-500">Guard</Text></Text>
            <View className="flex-row items-center mt-0.5">
              <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 shadow-sm shadow-emerald-500/50" />
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Smart Commute Safety</Text>
            </View>
          </View>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        >
          
          {/* Main Map Visualization */}
          <View className="px-6 mb-8">
            <View className="bg-white rounded-[40px] p-2 shadow-2xl shadow-black/5 overflow-hidden border border-slate-100">
               <TravelMap 
                  currentLocation={currentLocation} 
                  destination={destination} 
                  isCommuteGuardActive={isCommuteGuardActive} 
                  onOpenPicker={() => setShowDestinationPicker(true)}
               />

               <View className="p-6">
                    <View className="flex-row items-center justify-between mb-4">
                        <View>
                            <Text className="text-zinc-400 font-black uppercase text-[10px] tracking-widest">Safety Status</Text>
                            <Text className="text-zinc-900 font-black text-lg uppercase tracking-tight">
                                {isCommuteGuardActive ? 'Guardian Active' : 'System Standby'}
                            </Text>
                        </View>
                        <Pressable 
                            onPress={toggleCommuteGuard}
                            className={`px-6 py-3 rounded-2xl ${isCommuteGuardActive ? 'bg-red-50' : 'bg-zinc-900'}`}
                        >
                            <Text className={`font-black uppercase text-[10px] tracking-widest ${isCommuteGuardActive ? 'text-red-500' : 'text-white'}`}>
                                {isCommuteGuardActive ? 'Deactivate' : 'Initialize'}
                            </Text>
                        </Pressable>
                    </View>

                    {isCommuteGuardActive && distanceToTarget !== null && (
                        <View className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                             <View className="flex-row justify-between items-end mb-4">
                                <View>
                                    <Text className="text-zinc-400 font-black uppercase text-[9px] tracking-widest">Remaining Distance</Text>
                                    <Text className="text-zinc-900 font-black text-3xl tracking-tighter">
                                        {distanceToTarget.toFixed(1)} <Text className="text-orange-500 text-sm">KM</Text>
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-zinc-400 font-black uppercase text-[9px] tracking-widest">Journey Progress</Text>
                                    <Text className="text-orange-500 font-black text-xl">
                                        {initialDistance ? Math.max(0, Math.min(100, Math.round(((initialDistance - distanceToTarget) / initialDistance) * 100))) : 0}%
                                    </Text>
                                </View>
                             </View>
                             
                             <View className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <View 
                                    className="h-full bg-orange-500" 
                                    style={{ 
                                        width: `${initialDistance ? Math.max(0, Math.min(100, ((initialDistance - distanceToTarget) / initialDistance) * 100)) : 0}%` 
                                    }} 
                                />
                             </View>
                        </View>
                    )}
               </View>
            </View>
          </View>

          {/* Safety Tips */}
          <View className="px-8">
             <Text className="text-zinc-900 font-black uppercase text-xs tracking-widest mb-4">Travel Protocols</Text>
             <View className="bg-white p-6 rounded-[32px] border border-slate-100 flex-row items-center mb-4">
                <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center">
                    <Ionicons name="notifications-outline" size={20} color="#3b82f6" />
                </View>
                <View className="ml-4 flex-1">
                    <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-tight">Proximity Alert</Text>
                    <Text className="text-slate-400 font-bold text-[9px] leading-3 mt-0.5">We will vibrate and alert you when you are 2km away from your target.</Text>
                </View>
             </View>
             <View className="bg-white p-6 rounded-[32px] border border-slate-100 flex-row items-center">
                <View className="w-12 h-12 bg-emerald-50 rounded-2xl items-center justify-center">
                    <Ionicons name="location-outline" size={20} color="#10b981" />
                </View>
                <View className="ml-4 flex-1">
                    <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-tight">Live Tracking</Text>
                    <Text className="text-slate-400 font-bold text-[9px] leading-3 mt-0.5">System monitors your location in the background for continuous safety.</Text>
                </View>
             </View>
          </View>

        </ScrollView>
      </SafeAreaView>

      <DestinationPickerModal
        visible={showDestinationPicker}
        onClose={() => setShowDestinationPicker(false)}
        onSelect={handleSetDestination}
      />

      {/* Persistent Travel Alarm Overlay */}
      {showTravelAlarm && (
          <Modal transparent animationType="fade" visible={showTravelAlarm}>
              <View className="flex-1 bg-zinc-950 items-center justify-center px-8">
                  <LinearGradient colors={['#18181b', '#000']} className="absolute inset-0" />
                  
                  <View className="w-24 h-24 bg-orange-500/10 rounded-full items-center justify-center mb-8">
                    <MaterialCommunityIcons name="bus-alert" size={48} color="#f97316" />
                  </View>

                  <Text className="text-white/40 font-black uppercase text-xs tracking-[4px] mb-2">Security Protocol</Text>
                  <Text className="text-white font-black uppercase text-4xl tracking-tighter text-center mb-4">
                    Target Approaching
                  </Text>
                  <Text className="text-slate-400 font-bold text-sm text-center mb-16 leading-6">
                    You are within the 2km security perimeter. Wake up and prepare for arrival.
                  </Text>

                  <Pressable 
                    onPress={stopTravelAlarm}
                    className="bg-white w-full py-6 rounded-[32px] items-center shadow-2xl shadow-white/5"
                  >
                    <Text className="text-zinc-900 font-black uppercase text-xs tracking-[3px]">Acknowledge Arrival</Text>
                  </Pressable>

                  <Text className="text-white/20 font-black uppercase text-[10px] tracking-widest mt-8">Persistent Alarm & Vibration Active</Text>
              </View>
          </Modal>
      )}
    </View>
  );
};

export default TravelSafetyDashboard;
