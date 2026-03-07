import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Alert, Vibration, Platform, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import * as Location from 'expo-location';
import axios from '../../context/axiosConfig';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import MatchRevealModal from './MatchRevealModal';
import { navigationRef } from '../../App';
import { useAuth } from '../../context/auth.context';

const NearbyCrushDetector = () => {
    const [nearbyCrushes, setNearbyCrushes] = useState<any[]>([]);
    const [matchedCrush, setMatchedCrush] = useState<any>(null);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [lastAlertTime, setLastAlertTime] = useState<number>(0);
    const [isDetecting, setIsDetecting] = useState(false);
    const isUpdating = useRef(false);
    const { isLoggedIn, loading } = useAuth();

    useEffect(() => {
        if (!isLoggedIn || loading) {
            setIsDetecting(false);
            setNearbyCrushes([]);
            return;
        }

        let intervalId: any;

        const startDetection = async () => {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                return; // Do not request permission automatically
            }
            setIsDetecting(true);

            // Initial check
            await updateLocation();

            // Check every 5 minutes (300,000 ms) instead of 30 seconds
            intervalId = setInterval(updateLocation, 300000);
        };

        const updateLocation = async (force = false) => {
            if (isUpdating.current) {
                if (force) DeviceEventEmitter.emit('crush-scan-finished');
                return;
            }

            if (force) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Toast.show({
                        type: 'error',
                        text1: 'Location Required 🗺️',
                        text2: "We need location to find your crushes."
                    });
                    DeviceEventEmitter.emit('crush-scan-finished');
                    return;
                }
            } else {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status !== 'granted') return;
            }

            isUpdating.current = true;
            try {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High
                });

                const res = await axios.post('/crush/update-location', {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    force: force
                });

                if (res.data.success) {
                    if (res.data.nearby.length > 0) {
                        processNearby(res.data.nearby, force);
                    } else if (force) {
                        if (res.data.crushesWithoutLocation && res.data.crushesWithoutLocation > 0) {
                            Toast.show({
                                type: 'info',
                                text1: 'Radar Empty 📡',
                                text2: "Your crush hasn't shared their location yet."
                            });
                        } else {
                            Toast.show({
                                type: 'info',
                                text1: 'No crushes nearby 🧊',
                                text2: "Keep looking, maybe they're just not here right now."
                            });
                        }
                    }
                }
            } catch (err) {
                console.error("Location update failed:", err);
                if (force) {
                    Toast.show({
                        type: 'error',
                        text1: 'Failed to scan',
                        text2: "Make sure location is enabled."
                    });
                }
            } finally {
                isUpdating.current = false;
                if (force) DeviceEventEmitter.emit('crush-scan-finished');
            }
        };

        const processNearby = (nearby: any[], isManual = false) => {
            setNearbyCrushes(nearby);
            const now = Date.now();

            nearby.forEach(c => {
                if (c.isMutual) {
                    // Secret revealed!
                    setMatchedCrush(c.crushUserId);
                    setShowMatchModal(true);
                    Vibration.vibrate([0, 500, 200, 500]);
                    setLastAlertTime(now);
                } else {
                    // Anonymous alert
                    Toast.show({
                        type: 'info',
                        text1: 'Someone special is nearby! ❤️',
                        text2: "A secret crush is within 50 meters.",
                        visibilityTime: 6000,
                        autoHide: true,
                    });
                    Vibration.vibrate(800);
                    setLastAlertTime(now);
                }
            });
        };

        const subscription = DeviceEventEmitter.addListener('manual-crush-check', () => {
            updateLocation(true);
        });

        startDetection();
        return () => {
            if (intervalId) clearInterval(intervalId);
            subscription.remove();
        };
    }, [isLoggedIn, loading]);

    if (!isLoggedIn || loading) return null;

    return (
        <MatchRevealModal
            isVisible={showMatchModal}
            onClose={() => setShowMatchModal(false)}
            crushUser={matchedCrush}
            navigation={navigationRef}
        />
    );
};

export default NearbyCrushDetector;
