import React, { useRef, useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, Platform, BackHandler, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView as RNWebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const WebView = RNWebView as any;

export default function CampusTravel({ navigation }: any) {
    const [selectedStore, setSelectedStore] = useState<'rapido' | 'uber' | 'ola'>('rapido');
    const [loadedStores, setLoadedStores] = useState({ rapido: true, uber: false, ola: false });
    const [backStates, setBackStates] = useState({ rapido: false, uber: false, ola: false });

    const rapidoRef = useRef<any>(null);
    const uberRef = useRef<any>(null);
    const olaRef = useRef<any>(null);

    const refs = {
        rapido: rapidoRef,
        uber: uberRef,
        ola: olaRef,
    };

    const storeUrls = {
        rapido: 'https://www.rapido.bike/',
        uber: 'https://m.uber.com/',
        ola: 'https://book.olacabs.com/'
    };

    // 🔥 This script forces Google Login to use the same window and prevents "Manual Entry" redirects
    const googleDirectLoginFix = `
      (function() {
        window.open = function(url) {
          window.location.href = url;
          return null;
        };
        // Pretend to be a non-webview environment to bypass manual login walls
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      })();
      true;
    `;

    const handleTabPress = (store: 'rapido' | 'uber' | 'ola') => {
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

    const renderWebView = (store: 'rapido' | 'uber' | 'ola') => {
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
                    thirdPartyCookiesEnabled={true} // 🔥 Required for Google Identity
                    persistSessionCookies={true}

                    // 🔥 On Android, setting this to TRUE often helps Google account picker appear
                    setSupportMultipleWindows={true}

                    injectedJavaScript={googleDirectLoginFix}
                    allowsBackForwardNavigationGestures={true}

                    // 🔥 HIGH-END USER AGENT: Forces the site to treat you like a full mobile browser
                    userAgent={Platform.OS === 'android'
                        ? "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
                        : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"}

                    onNavigationStateChange={(navState: any) => {
                        setBackStates(prev => ({ ...prev, [store]: navState.canGoBack }));
                    }}

                    onShouldStartLoadWithRequest={(request: any) => {
                        const { url } = request;

                        // Always allow Google login internally
                        if (url.includes('accounts.google.com')) {
                            return true;
                        }

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
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="flex-row items-center px-4 py-4 border-b border-gray-100 z-10 bg-white">
                    <TouchableOpacity
                        onPress={() => backStates[selectedStore] ? refs[selectedStore].current.goBack() : navigation.goBack()}
                        className="p-2 bg-gray-50 rounded-full border border-gray-100"
                    >
                        <Ionicons name="arrow-back" size={20} color="#ec4899" />
                    </TouchableOpacity>
                    <View className="ml-4">
                        <Text className="text-black font-black text-lg tracking-widest uppercase">
                            Fync <Text className="text-pink-500">Travel</Text> 🚕
                        </Text>
                    </View>
                </View>

                <View className="flex-row px-4 py-3 gap-2 bg-white border-b border-gray-50">
                    {(['rapido', 'uber', 'ola'] as const).map((store) => (
                        <TouchableOpacity
                            key={store}
                            onPress={() => handleTabPress(store)}
                            activeOpacity={0.7}
                            className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${selectedStore === store ? 'bg-pink-500 border-pink-600' : 'bg-gray-50 border-gray-100'
                                }`}
                        >
                            <Ionicons
                                name={store === 'uber' ? 'car-sport' : store === 'ola' ? 'car' : 'bicycle'}
                                size={16}
                                color={selectedStore === store ? "white" : "black"}
                            />
                            <Text className={`font-black ml-1.5 uppercase text-[10px] ${selectedStore === store ? 'text-white' : 'text-black'}`}>
                                {store}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="flex-1 overflow-hidden">
                    {renderWebView('rapido')}
                    {renderWebView('uber')}
                    {renderWebView('ola')}
                </View>
            </SafeAreaView>
        </View>
    );
}