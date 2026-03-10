import React, { useRef, useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet, BackHandler, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView as RNWebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const WebView = RNWebView as any;

export default function LateNightFood({ navigation }: any) {
    const [selectedStore, setSelectedStore] = useState<'blinkit' | 'zepto' | 'swiggy'>('blinkit');
    const [loadedStores, setLoadedStores] = useState({ blinkit: true, zepto: false, swiggy: false });
    const [backStates, setBackStates] = useState({ blinkit: false, zepto: false, swiggy: false });
    const [isLoading, setIsLoading] = useState({ blinkit: true, zepto: true, swiggy: true });

    const blinkitRef = useRef<any>(null);
    const zeptoRef = useRef<any>(null);
    const swiggyRef = useRef<any>(null);

    const refs = {
        blinkit: blinkitRef,
        zepto: zeptoRef,
        swiggy: swiggyRef,
    };

    const storeUrls = {
        blinkit: 'https://blinkit.com/',
        zepto: 'https://www.zeptonow.com/',
        swiggy: 'https://www.swiggy.com/'
    };

    const handleTabPress = (store: 'blinkit' | 'zepto' | 'swiggy') => {
        setLoadedStores(prev => ({ ...prev, [store]: true }));
        setSelectedStore(store);
    };

    useEffect(() => {
        const backAction = () => {
            if (backStates[selectedStore] && refs[selectedStore].current) {
                refs[selectedStore].current.goBack();
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [selectedStore, backStates]);

    const renderWebView = (store: 'blinkit' | 'zepto' | 'swiggy') => {
        if (!loadedStores[store]) return null;

        return (
            <View
                key={store}
                pointerEvents={selectedStore === store ? 'auto' : 'none'}
                style={[
                    StyleSheet.absoluteFill,
                    { opacity: selectedStore === store ? 1 : 0, zIndex: selectedStore === store ? 1 : -1 }
                ]}
            >
                <WebView
                    ref={refs[store]}
                    source={{ uri: storeUrls[store] }}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    geolocationEnabled={true}
                    sharedCookiesEnabled={true}
                    thirdPartyCookiesEnabled={true}
                    onLoadStart={() => setIsLoading(prev => ({ ...prev, [store]: true }))}
                    onLoadEnd={() => setIsLoading(prev => ({ ...prev, [store]: false }))}

                    userAgent={Platform.OS === 'android'
                        ? "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
                        : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"}

                    onNavigationStateChange={(navState: any) => {
                        setBackStates(prev => ({ ...prev, [store]: navState.canGoBack }));
                    }}
                    onShouldStartLoadWithRequest={(request: any) => {
                        const { url } = request;
                        if (url.startsWith('http') || url.startsWith('about:blank') || url.startsWith('data:')) {
                            return true;
                        }
                        Linking.canOpenURL(url).then((supported) => {
                            if (supported) Linking.openURL(url);
                        });
                        return false;
                    }}
                    style={{ flex: 1 }}
                />

                {isLoading[store] && selectedStore === store && (
                    <View className="absolute w-full h-full items-center justify-center bg-white">
                        <ActivityIndicator size="large" color="#ec4899" />
                        <Text className="text-gray-400 text-xs mt-2 font-bold uppercase tracking-widest">
                            Loading {store}...
                        </Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header Area */}
                <View className="flex-row items-center px-4 py-2 border-b border-gray-100 z-10 bg-white">
                    <TouchableOpacity
                        onPress={() => backStates[selectedStore] ? refs[selectedStore].current.goBack() : navigation.goBack()}
                        className="p-2 bg-gray-50 rounded-full border border-gray-100"
                    >
                        <Ionicons name="arrow-back" size={20} color="#ec4899" />
                    </TouchableOpacity>
                    <View className="ml-4">
                        <Text className="text-black font-black text-lg tracking-widest italic">
                            FYNC <Text className="text-pink-500">CRAVINGS</Text> 🍕
                        </Text>
                        <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest mt-0.5">
                            Browsing {selectedStore === 'blinkit' ? 'Blinkit' : selectedStore === 'zepto' ? 'Zepto' : 'Swiggy'}
                        </Text>
                    </View>
                </View>

                {/* Store Selection Buttons */}
                <View className="flex-row px-4 py-1 gap-3 border-b border-gray-50 bg-white shadow-sm z-10">
                    {(['blinkit', 'zepto', 'swiggy'] as const).map((store) => (
                        <TouchableOpacity
                            key={store}
                            onPress={() => handleTabPress(store)}
                            activeOpacity={0.7}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${selectedStore === store ? 'bg-pink-400 border-pink-400' : 'bg-gray-50 border-gray-100'
                                }`}
                        >
                            <Ionicons
                                name={store === 'blinkit' ? 'flash' : store === 'zepto' ? 'cart' : 'pizza-outline'}
                                size={16}
                                color={selectedStore === store ? 'white' : 'black'}
                            />
                            <Text className={`font-black ml-2 uppercase text-[10px] ${selectedStore === store ? 'text-white' : 'text-black'}`}>
                                {store}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* WebViews Wrapper - Overlapping absolutely */}
                <View className="flex-1 relative overflow-hidden bg-white">
                    {renderWebView('blinkit')}
                    {renderWebView('zepto')}
                    {renderWebView('swiggy')}
                </View>

            </SafeAreaView>
        </View>
    );
}