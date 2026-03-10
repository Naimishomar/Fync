import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput, Modal, Alert,
    Vibration, FlatList, Animated, Dimensions, Linking,
    Platform, ActivityIndicator, ScrollView, KeyboardAvoidingView
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// ─── Config ───────────────────────────────────────────────────
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';
const DEVIATION_THRESHOLD_METERS = 400; // alert if >400m off route
const SAFETY_CHECK_INTERVAL = 20000;    // check every 20 seconds
const SOS_RESPONSE_WINDOW = 30;         // seconds to respond before auto-SOS
const SOS_CONTACTS_KEY = 'fync:sos:contacts';

// ─── Types ────────────────────────────────────────────────────
interface LatLng { latitude: number; longitude: number; }
interface SOSContact { id: string; name: string; phone: string; relationship: string; }
interface PlaceSuggestion { place_id: string; description: string; }

type RideStatus = 'idle' | 'destination' | 'previewing' | 'monitoring' | 'deviation' | 'sos';

// ─── Utility: Haversine distance in meters ────────────────────
function haversine(a: LatLng, b: LatLng): number {
    const R = 6371000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Utility: Min distance from point to polyline ─────────────
function minDistToRoute(point: LatLng, route: LatLng[]): number {
    if (route.length === 0) return Infinity;
    return Math.min(...route.map(p => haversine(point, p)));
}

// ─── Utility: Encode coords to shareable link ─────────────────
function buildLocationLink(coords: LatLng) {
    return `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
}

export default function SmartRideSafety({ navigation }: any) {
    // ── State ──────────────────────────────────────────────────
    const [status, setStatus] = useState<RideStatus>('idle');
    const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
    const [destination, setDestination] = useState<LatLng | null>(null);
    const [destinationName, setDestinationName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
    const [routeDistance, setRouteDistance] = useState('');
    const [routeDuration, setRouteDuration] = useState('');
    const [sosContacts, setSOSContacts] = useState<SOSContact[]>([]);
    const [showSOSManager, setShowSOSManager] = useState(false);
    const [safetyCountdown, setSafetyCountdown] = useState(SOS_RESPONSE_WINDOW);
    const [showSafetyModal, setShowSafetyModal] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [activeTab, setActiveTab] = useState<'ride' | 'contacts'>('ride');

    // ── SOS contact form state ─────────────────────────────────
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newRelation, setNewRelation] = useState('');

    // ── Refs ───────────────────────────────────────────────────
    const mapRef = useRef<MapView>(null);
    const locationSub = useRef<Location.LocationSubscription | null>(null);
    const monitorInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const sosAnim = useRef(new Animated.Value(0)).current;
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Pulse animation for monitoring indicator ───────────────
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // ── SOS flash animation ─────────────────────────────────────
    useEffect(() => {
        if (status === 'sos') {
            const flash = Animated.loop(
                Animated.sequence([
                    Animated.timing(sosAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(sosAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                ])
            );
            flash.start();
            return () => flash.stop();
        }
    }, [status]);

    // ── Load SOS contacts ──────────────────────────────────────
    useEffect(() => {
        AsyncStorage.getItem(SOS_CONTACTS_KEY).then(raw => {
            if (raw) setSOSContacts(JSON.parse(raw));
        });
    }, []);

    // ── Cleanup on unmount ─────────────────────────────────────
    useEffect(() => {
        return () => {
            locationSub.current?.remove();
            if (monitorInterval.current) clearInterval(monitorInterval.current);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            recording?.stopAndUnloadAsync().catch(() => { });
        };
    }, []);

    // ──────────────────────────────────────────────────────────
    //  LOCATION
    // ──────────────────────────────────────────────────────────
    const getCurrentLocation = async (): Promise<LatLng | null> => {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm !== 'granted') {
            Alert.alert('Permission Denied', 'Location permission is required for Ride Safety.');
            return null;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    };

    // ──────────────────────────────────────────────────────────
    //  PLACE SEARCH (Google Places Autocomplete)
    // ──────────────────────────────────────────────────────────
    const searchPlaces = (text: string) => {
        setSearchQuery(text);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!text.trim() || text.length < 3) { setSuggestions([]); return; }

        searchTimeout.current = setTimeout(async () => {
            try {
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}&language=en&types=geocode|establishment`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.predictions) setSuggestions(data.predictions);
            } catch { setSuggestions([]); }
        }, 400);
    };

    const selectPlace = async (place: PlaceSuggestion) => {
        setSuggestions([]);
        setSearchQuery(place.description);
        setDestinationName(place.description);

        try {
            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            const loc = data.result?.geometry?.location;
            if (loc) {
                setDestination({ latitude: loc.lat, longitude: loc.lng });
                startPreview({ latitude: loc.lat, longitude: loc.lng });
            }
        } catch { Alert.alert('Error', 'Could not fetch location details'); }
    };

    // ──────────────────────────────────────────────────────────
    //  ROUTE PREVIEW
    // ──────────────────────────────────────────────────────────
    const startPreview = async (dest: LatLng) => {
        const loc = await getCurrentLocation();
        if (!loc) return;
        setCurrentLocation(loc);
        setStatus('previewing');

        mapRef.current?.fitToCoordinates([loc, dest], {
            edgePadding: { top: 80, right: 60, bottom: 300, left: 60 },
            animated: true,
        });
    };

    // ──────────────────────────────────────────────────────────
    //  START RIDE MONITORING
    // ──────────────────────────────────────────────────────────
    const startRide = async () => {
        if (!destination || !currentLocation) return;
        if (sosContacts.length === 0) {
            Alert.alert(
                'No SOS Contacts',
                'Please add at least one emergency contact before starting a safe ride.',
                [{ text: 'Add Contact', onPress: () => setActiveTab('contacts') }, { text: 'Cancel' }]
            );
            return;
        }

        setStatus('monitoring');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Start live GPS tracking
        locationSub.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 30 },
            (loc) => {
                const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                setCurrentLocation(coords);
                checkDeviation(coords);
            }
        );
    };

    // ──────────────────────────────────────────────────────────
    //  ROUTE DEVIATION CHECK
    // ──────────────────────────────────────────────────────────
    const checkDeviation = useCallback((coords: LatLng) => {
        if (routeCoords.length === 0) return;
        const dist = minDistToRoute(coords, routeCoords);
        if (dist > DEVIATION_THRESHOLD_METERS) {
            triggerDeviationAlert();
        }
    }, [routeCoords]);

    const triggerDeviationAlert = () => {
        setStatus('deviation');
        Vibration.vibrate([500, 300, 500, 300, 500]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setSafetyCountdown(SOS_RESPONSE_WINDOW);
        setShowSafetyModal(true);

        // Start countdown
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        countdownInterval.current = setInterval(() => {
            setSafetyCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval.current!);
                    setShowSafetyModal(false);
                    triggerSOS(); // auto SOS if no response
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const confirmSafe = () => {
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        setShowSafetyModal(false);
        setStatus('monitoring');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    // ──────────────────────────────────────────────────────────
    //  SOS ESCALATION
    // ──────────────────────────────────────────────────────────
    const triggerSOS = async () => {
        setStatus('sos');
        Vibration.vibrate([200, 100, 200, 100, 200, 100, 1000]);
        setShowSafetyModal(false);

        const loc = currentLocation;
        const locationLink = loc ? buildLocationLink(loc) : 'Location unavailable';

        // 1. Start audio recording
        try {
            await Audio.requestPermissionsAsync();
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording: rec } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(rec);
            // Auto stop after 2 min
            setTimeout(() => rec.stopAndUnloadAsync().catch(() => { }), 120000);
        } catch { /* silent — recording is best-effort */ }

        // 2. Open emergency call
        Linking.openURL('tel:112').catch(() => { });

        // 3. Open SMS for each SOS contact
        const msg = `🚨 EMERGENCY ALERT!\n\nI may be in danger during a ride.\n\nLive location:\n${locationLink}\n\n— Sent via Fync Safety`;
        sosContacts.forEach(contact => {
            const smsUrl = Platform.OS === 'android'
                ? `sms:${contact.phone}?body=${encodeURIComponent(msg)}`
                : `sms:${contact.phone}&body=${encodeURIComponent(msg)}`;
            setTimeout(() => Linking.openURL(smsUrl).catch(() => { }), 500);
        });
    };

    const stopRide = () => {
        locationSub.current?.remove();
        if (monitorInterval.current) clearInterval(monitorInterval.current);
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        recording?.stopAndUnloadAsync().catch(() => { });
        setRecording(null);
        Vibration.cancel();
        setStatus('idle');
        setDestination(null);
        setDestinationName('');
        setSearchQuery('');
        setRouteCoords([]);
        setShowSafetyModal(false);
    };

    // ──────────────────────────────────────────────────────────
    //  SOS CONTACTS CRUD
    // ──────────────────────────────────────────────────────────
    const saveContact = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            Alert.alert('Required', 'Name and phone number are required.');
            return;
        }
        const contact: SOSContact = {
            id: Date.now().toString(),
            name: newName.trim(),
            phone: newPhone.trim(),
            relationship: newRelation.trim() || 'Contact',
        };
        const updated = [...sosContacts, contact];
        setSOSContacts(updated);
        await AsyncStorage.setItem(SOS_CONTACTS_KEY, JSON.stringify(updated));
        setNewName(''); setNewPhone(''); setNewRelation('');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const deleteContact = async (id: string) => {
        const updated = sosContacts.filter(c => c.id !== id);
        setSOSContacts(updated);
        await AsyncStorage.setItem(SOS_CONTACTS_KEY, JSON.stringify(updated));
    };

    // ──────────────────────────────────────────────────────────
    //  STATUS HELPERS
    // ──────────────────────────────────────────────────────────
    const statusColor = status === 'monitoring' ? '#22c55e'
        : status === 'deviation' ? '#f59e0b'
            : status === 'sos' ? '#ef4444'
                : '#ec4899';

    const statusLabel = status === 'monitoring' ? 'Monitoring Active 🛡️'
        : status === 'deviation' ? '⚠️ Route Deviation Detected'
            : status === 'sos' ? '🚨 SOS TRIGGERED'
                : 'Ride Safety';

    const isRideActive = ['monitoring', 'deviation', 'sos'].includes(status);

    // ──────────────────────────────────────────────────────────
    //  RENDER
    // ──────────────────────────────────────────────────────────
    return (
        <View className="flex-1 bg-black">
            <SafeAreaView className="flex-1" edges={['top']}>

                {/* ── Header ── */}
                <View className="flex-row items-center px-4 py-3 border-b border-zinc-800">
                    <TouchableOpacity
                        onPress={() => isRideActive ? Alert.alert('Ride Active', 'Please stop the ride before leaving.') : navigation.goBack()}
                        className="p-2 bg-zinc-900 rounded-full border border-zinc-700"
                    >
                        <Ionicons name="arrow-back" size={20} color="#ec4899" />
                    </TouchableOpacity>
                    <View className="ml-3 flex-1">
                        <Text className="text-white font-black text-base tracking-wider uppercase">
                            Fync <Text className="text-pink-500">Ride Safety</Text> 🛡️
                        </Text>
                        {isRideActive && (
                            <View className="flex-row items-center mt-0.5">
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}
                                    className="w-2 h-2 rounded-full mr-1.5"
                                    // @ts-ignore
                                    style={[{ transform: [{ scale: pulseAnim }] }, { width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor, marginRight: 6 }]}
                                />
                                <Text style={{ color: statusColor, fontSize: 11, fontWeight: '800' }}>
                                    {statusLabel}
                                </Text>
                            </View>
                        )}
                    </View>
                    {isRideActive && (
                        <TouchableOpacity
                            onPress={() => Alert.alert('Stop Ride', 'Stop monitoring this ride?', [
                                { text: 'Cancel' }, { text: 'Stop', style: 'destructive', onPress: stopRide }
                            ])}
                            className="px-3 py-1.5 bg-red-600 rounded-xl"
                        >
                            <Text className="text-white font-black text-xs">STOP</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Tab Bar (only when not riding) ── */}
                {!isRideActive && (
                    <View className="flex-row px-4 py-2 gap-2 border-b border-zinc-800">
                        {(['ride', 'contacts'] as const).map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5 border ${activeTab === tab ? 'bg-pink-600 border-pink-700' : 'bg-zinc-900 border-zinc-700'}`}
                            >
                                <Ionicons name={tab === 'ride' ? 'shield-checkmark' : 'people'} size={14} color={activeTab === tab ? '#fff' : '#9ca3af'} />
                                <Text className={`font-black text-xs uppercase ${activeTab === tab ? 'text-white' : 'text-zinc-400'}`}>
                                    {tab === 'ride' ? 'Safe Ride' : 'SOS Contacts'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* ══════════════════════════════════════════════════ */}
                {/*  TAB: RIDE                                         */}
                {/* ══════════════════════════════════════════════════ */}
                {(activeTab === 'ride' || isRideActive) && (
                    <View className="flex-1">

                        {/* ── Map View ── */}
                        {(status === 'previewing' || isRideActive) && currentLocation ? (
                            <View style={{ flex: 1 }}>
                                <MapView
                                    ref={mapRef}
                                    provider={PROVIDER_GOOGLE}
                                    style={{ flex: 1 }}
                                    initialRegion={{
                                        ...currentLocation,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    }}
                                    showsUserLocation
                                    showsMyLocationButton={false}
                                    customMapStyle={darkMapStyle}
                                >
                                    {/* Current Location Marker */}
                                    <Marker coordinate={currentLocation} title="You">
                                        <View className="items-center justify-center">
                                            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#3b82f6', borderWidth: 3, borderColor: '#fff' }} />
                                        </View>
                                    </Marker>

                                    {/* Destination Marker */}
                                    {destination && (
                                        <Marker coordinate={destination} title={destinationName}>
                                            <View className="items-center">
                                                <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>📍 DEST</Text>
                                                </View>
                                            </View>
                                        </Marker>
                                    )}

                                    {/* Route from Google Maps Directions */}
                                    {destination && (
                                        <MapViewDirections
                                            origin={currentLocation}
                                            destination={destination}
                                            apikey={GOOGLE_MAPS_API_KEY}
                                            strokeWidth={4}
                                            strokeColor="#ec4899"
                                            optimizeWaypoints
                                            onReady={(result) => {
                                                setRouteCoords(result.coordinates);
                                                setRouteDistance(`${result.distance.toFixed(1)} km`);
                                                setRouteDuration(`${Math.round(result.duration)} min`);
                                                mapRef.current?.fitToCoordinates(result.coordinates, {
                                                    edgePadding: { top: 80, right: 60, bottom: 280, left: 60 },
                                                    animated: true,
                                                });
                                            }}
                                        />
                                    )}
                                </MapView>

                                {/* ── Route Info + Start Button overlay ── */}
                                {status === 'previewing' && (
                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                                        <LinearGradient colors={['transparent', '#000']} style={{ paddingTop: 40, paddingHorizontal: 16, paddingBottom: 24 }}>
                                            <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700 mb-3">
                                                <View className="flex-row items-center mb-2">
                                                    <Ionicons name="location" size={16} color="#ec4899" />
                                                    <Text className="text-white font-bold ml-2 flex-1 text-sm" numberOfLines={2}>{destinationName}</Text>
                                                </View>
                                                <View className="flex-row gap-4">
                                                    <View className="flex-row items-center">
                                                        <Ionicons name="map" size={14} color="#9ca3af" />
                                                        <Text className="text-zinc-400 text-xs ml-1">{routeDistance}</Text>
                                                    </View>
                                                    <View className="flex-row items-center">
                                                        <Ionicons name="time" size={14} color="#9ca3af" />
                                                        <Text className="text-zinc-400 text-xs ml-1">{routeDuration}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <TouchableOpacity onPress={startRide} activeOpacity={0.85}>
                                                <LinearGradient colors={['#ec4899', '#be185d']} className="py-4 rounded-2xl items-center flex-row justify-center gap-2">
                                                    <Ionicons name="shield-checkmark" size={20} color="#fff" />
                                                    <Text className="text-white font-black text-base uppercase tracking-widest">Start Safe Ride</Text>
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </LinearGradient>
                                    </View>
                                )}

                                {/* ── Active Ride Status Bar ── */}
                                {isRideActive && (
                                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                                        <LinearGradient colors={['transparent', '#000']} style={{ paddingTop: 30, paddingHorizontal: 16, paddingBottom: 20 }}>
                                            <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700 flex-row items-center justify-between">
                                                <View>
                                                    <Text className="text-zinc-400 text-xs font-bold uppercase">Destination</Text>
                                                    <Text className="text-white font-bold text-sm mt-0.5" numberOfLines={1}>{destinationName}</Text>
                                                    <View className="flex-row gap-3 mt-1">
                                                        <Text className="text-zinc-500 text-xs">{routeDistance}</Text>
                                                        <Text className="text-zinc-500 text-xs">·</Text>
                                                        <Text className="text-zinc-500 text-xs">{routeDuration}</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => { triggerSOS(); }}
                                                    className="bg-red-600 px-4 py-3 rounded-xl items-center"
                                                >
                                                    <Ionicons name="warning" size={20} color="#fff" />
                                                    <Text className="text-white font-black text-xs mt-0.5">SOS</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </LinearGradient>
                                    </View>
                                )}
                            </View>

                        ) : (
                            /* ── Destination Entry Screen ── */
                            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                                <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">

                                    {/* Hero Card */}
                                    <LinearGradient colors={['#1e1b4b', '#312e81', '#000']} className="rounded-3xl p-6 mb-6 items-center">
                                        <View className="w-20 h-20 rounded-full bg-pink-600/20 items-center justify-center mb-4 border border-pink-500/30">
                                            <Ionicons name="shield-checkmark" size={40} color="#ec4899" />
                                        </View>
                                        <Text className="text-white font-black text-xl text-center">Smart Ride Safety</Text>
                                        <Text className="text-zinc-400 text-sm text-center mt-2 leading-5">
                                            Real-time route monitoring. If your driver deviates, we alert you instantly & notify your emergency contacts.
                                        </Text>
                                        <View className="flex-row gap-4 mt-4">
                                            {[
                                                { icon: 'map', label: 'Route Track' },
                                                { icon: 'warning', label: 'Deviation Alert' },
                                                { icon: 'call', label: 'Auto SOS' },
                                            ].map(item => (
                                                <View key={item.label} className="items-center">
                                                    <View className="w-10 h-10 rounded-full bg-pink-600/20 items-center justify-center border border-pink-500/20">
                                                        <Ionicons name={item.icon as any} size={16} color="#ec4899" />
                                                    </View>
                                                    <Text className="text-zinc-500 text-xs mt-1 text-center">{item.label}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </LinearGradient>

                                    {/* Search Input */}
                                    <Text className="text-white font-black text-sm uppercase tracking-widest mb-3">Enter Destination</Text>
                                    <View className="bg-zinc-900 rounded-2xl border border-zinc-700 flex-row items-center px-4 mb-2">
                                        <Ionicons name="search" size={18} color="#ec4899" />
                                        <TextInput
                                            value={searchQuery}
                                            onChangeText={searchPlaces}
                                            placeholder="Search destination..."
                                            placeholderTextColor="#6b7280"
                                            className="flex-1 text-white py-4 ml-3 text-sm"
                                        />
                                        {searchQuery.length > 0 && (
                                            <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); }}>
                                                <Ionicons name="close-circle" size={18} color="#6b7280" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Suggestions */}
                                    {suggestions.length > 0 && (
                                        <View className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden mb-4">
                                            {suggestions.map((s, i) => (
                                                <TouchableOpacity
                                                    key={s.place_id}
                                                    onPress={() => selectPlace(s)}
                                                    className={`px-4 py-3 flex-row items-center ${i < suggestions.length - 1 ? 'border-b border-zinc-800' : ''}`}
                                                >
                                                    <View className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center mr-3">
                                                        <Ionicons name="location-outline" size={14} color="#ec4899" />
                                                    </View>
                                                    <Text className="text-white text-sm flex-1" numberOfLines={2}>{s.description}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Info Cards */}
                                    <View className="gap-3 mb-6">
                                        {[
                                            { icon: 'navigate', color: '#3b82f6', title: 'Live Route Tracking', desc: 'Google Maps route compared against your real GPS path' },
                                            { icon: 'alert-circle', color: '#f59e0b', title: 'Deviation Detection', desc: 'Alert triggers if driver goes >400m off the route' },
                                            { icon: 'mic', color: '#8b5cf6', title: 'Audio Recording', desc: 'Ambient sound recorded automatically on SOS trigger' },
                                            { icon: 'call', color: '#ef4444', title: 'Auto Emergency Call', desc: 'Calls 112 and alerts all SOS contacts with your location' },
                                        ].map(item => (
                                            <View key={item.title} className="bg-zinc-900 rounded-2xl p-4 flex-row items-start border border-zinc-800">
                                                <View style={{ backgroundColor: `${item.color}20`, borderColor: `${item.color}40` }} className="w-10 h-10 rounded-xl items-center justify-center border mr-3 mt-0.5">
                                                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="text-white font-bold text-sm">{item.title}</Text>
                                                    <Text className="text-zinc-500 text-xs mt-0.5 leading-4">{item.desc}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>

                                    {sosContacts.length === 0 && (
                                        <TouchableOpacity onPress={() => setActiveTab('contacts')} className="bg-amber-900/30 rounded-2xl p-4 border border-amber-700/50 flex-row items-center mb-6">
                                            <Ionicons name="warning" size={20} color="#f59e0b" />
                                            <View className="ml-3 flex-1">
                                                <Text className="text-amber-400 font-bold text-sm">No SOS Contacts Added</Text>
                                                <Text className="text-amber-600 text-xs mt-0.5">Add emergency contacts to enable SOS alerts</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="#f59e0b" />
                                        </TouchableOpacity>
                                    )}
                                </ScrollView>
                            </KeyboardAvoidingView>
                        )}
                    </View>
                )}

                {/* ══════════════════════════════════════════════════ */}
                {/*  TAB: SOS CONTACTS                                 */}
                {/* ══════════════════════════════════════════════════ */}
                {activeTab === 'contacts' && !isRideActive && (
                    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">

                            <Text className="text-white font-black text-sm uppercase tracking-widest mb-4">Emergency Contacts</Text>

                            {/* Add Contact Form */}
                            <View className="bg-zinc-900 rounded-2xl p-4 border border-zinc-700 mb-4">
                                <Text className="text-pink-400 font-black text-xs uppercase tracking-widest mb-3">Add New Contact</Text>
                                <TextInput
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholder="Full Name *"
                                    placeholderTextColor="#6b7280"
                                    className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-2 text-sm border border-zinc-700"
                                />
                                <TextInput
                                    value={newPhone}
                                    onChangeText={setNewPhone}
                                    placeholder="Phone Number *"
                                    placeholderTextColor="#6b7280"
                                    keyboardType="phone-pad"
                                    className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-2 text-sm border border-zinc-700"
                                />
                                <TextInput
                                    value={newRelation}
                                    onChangeText={setNewRelation}
                                    placeholder="Relationship (e.g. Parent, Friend)"
                                    placeholderTextColor="#6b7280"
                                    className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-3 text-sm border border-zinc-700"
                                />
                                <TouchableOpacity onPress={saveContact} activeOpacity={0.85}>
                                    <LinearGradient colors={['#ec4899', '#be185d']} className="py-3 rounded-xl items-center flex-row justify-center gap-2">
                                        <Ionicons name="person-add" size={16} color="#fff" />
                                        <Text className="text-white font-black text-sm">Add Contact</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* Contact List */}
                            {sosContacts.length === 0 ? (
                                <View className="items-center py-12">
                                    <Ionicons name="people-outline" size={48} color="#374151" />
                                    <Text className="text-zinc-600 text-sm mt-3 text-center">No emergency contacts yet.{'\n'}Add people who should be alerted in an emergency.</Text>
                                </View>
                            ) : (
                                <View className="gap-2 mb-8">
                                    {sosContacts.map(contact => (
                                        <View key={contact.id} className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex-row items-center">
                                            <View className="w-12 h-12 rounded-full bg-pink-600/20 items-center justify-center border border-pink-500/30 mr-3">
                                                <Text className="text-pink-400 font-black text-base">{contact.name[0].toUpperCase()}</Text>
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white font-bold text-sm">{contact.name}</Text>
                                                <Text className="text-zinc-400 text-xs">{contact.phone}</Text>
                                                <View className="bg-zinc-800 px-2 py-0.5 rounded-full self-start mt-1">
                                                    <Text className="text-zinc-500 text-xs">{contact.relationship}</Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => Alert.alert('Remove', `Remove ${contact.name}?`, [
                                                    { text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => deleteContact(contact.id) }
                                                ])}
                                                className="p-2"
                                            >
                                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>

            {/* ══════════════════════════════════════════════════════ */}
            {/*  SAFETY CHECK MODAL (Deviation Alert)                 */}
            {/* ══════════════════════════════════════════════════════ */}
            <Modal visible={showSafetyModal} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <Animated.View style={{ backgroundColor: '#18181b', borderRadius: 24, padding: 28, width: '100%', borderWidth: 1, borderColor: '#f59e0b40' }}>
                        {/* Warning pulse */}
                        <View className="items-center mb-4">
                            <View className="w-20 h-20 rounded-full bg-amber-500/10 items-center justify-center border-2 border-amber-500/30">
                                <Ionicons name="warning" size={40} color="#f59e0b" />
                            </View>
                        </View>

                        <Text style={{ color: '#f59e0b', fontWeight: '900', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
                            Route Deviation Detected
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
                            Your vehicle appears to have left the recommended route. Are you safe?
                        </Text>

                        {/* Countdown */}
                        <View className="bg-zinc-800 rounded-2xl py-4 mb-5 items-center">
                            <Text style={{ color: '#ef4444', fontSize: 36, fontWeight: '900' }}>{safetyCountdown}</Text>
                            <Text style={{ color: '#6b7280', fontSize: 12 }}>seconds until auto-SOS</Text>
                        </View>

                        <TouchableOpacity
                            onPress={confirmSafe}
                            style={{ backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>✅  Yes, I'm Safe</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setShowSafetyModal(false); if (countdownInterval.current) clearInterval(countdownInterval.current); triggerSOS(); }}
                            style={{ backgroundColor: '#ef4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>🚨  Send SOS Now</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════ */}
            {/*  SOS ACTIVE SCREEN OVERLAY                           */}
            {/* ══════════════════════════════════════════════════════ */}
            {status === 'sos' && (
                <Animated.View
                    style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: `rgba(239,68,68,${sosAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] })})`,
                        pointerEvents: 'none'
                    }}
                />
            )}
        </View>
    );
}

// ─── Google Maps Dark Style ──────────────────────────────────
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];
