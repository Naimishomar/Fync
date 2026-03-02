import React, { useRef, useState } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView as RNWebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

const WebView = RNWebView as any; 

export default function LateNightFood({ navigation }: any) {
    const webViewRef = useRef(null);
    const [selectedStore, setSelectedStore] = useState<'blinkit' | 'zepto' | 'swiggy'>('blinkit');
    const [isLoading, setIsLoading] = useState(true);

    const storeUrls = {
        blinkit: 'https://blinkit.com/',
        zepto: 'https://www.zeptonow.com/',
        swiggy: 'https://www.swiggy.com/'
    };

    return (
        <View className="flex-1 bg-white">
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header Area */}
                <View className="flex-row items-center px-4 py-2 border-b border-white/10 z-10">
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        className="p-2 bg-white/5 rounded-full border border-white/10"
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
                <View className="flex-row px-4 py-1 gap-3">
                    <TouchableOpacity 
                        onPress={() => setSelectedStore('blinkit')}
                        activeOpacity={0.7}
                        className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${
                            selectedStore === 'blinkit' ? 'bg-pink-400 border-pink-400' : 'bg-white border-white/10'
                        }`}
                    >
                        <Ionicons name="flash" size={16} color="black" />
                        <Text className="text-black font-black ml-2 uppercase text-xs">Blinkit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setSelectedStore('zepto')}
                        activeOpacity={0.7}
                        className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${
                            selectedStore === 'zepto' ? 'bg-pink-400 border-pink-400' : 'bg-white border-white/10'
                        }`}
                    >
                        <Ionicons name="cart" size={16} color="black" />
                        <Text className="text-black font-black ml-2 uppercase text-xs">Zepto</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setSelectedStore('swiggy')}
                        activeOpacity={0.7}
                        className={`flex-1 flex-row items-center justify-center py-3 rounded-2xl border ${
                            selectedStore === 'swiggy' ? 'bg-pink-400 border-pink-400' : 'bg-white border-white/10'
                        }`}
                    >
                        <Ionicons name="pizza-outline" size={16} color="black" />
                        <Text className="text-black font-black ml-2 uppercase text-xs">Swiggy</Text>
                    </TouchableOpacity>
                </View>

                {/* WebView - Original Light Theme */}
                <View className="flex-1 bg-white"> 
                    <WebView 
                        key={selectedStore}
                        ref={webViewRef}
                        source={{ uri: storeUrls[selectedStore] }} 
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        onLoadStart={() => setIsLoading(true)}
                        onLoadEnd={() => setIsLoading(false)}
                        showsVerticalScrollIndicator={false}
                    />
                    
                    {/* Simple Loader for white background */}
                    {isLoading && (
                        <View className="absolute w-full h-full items-center justify-center bg-white">
                            <ActivityIndicator size="large" color="#ec4899" />
                            <Text className="text-gray-400 text-xs mt-2 font-bold uppercase tracking-widest">
                                Loading Store...
                            </Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}