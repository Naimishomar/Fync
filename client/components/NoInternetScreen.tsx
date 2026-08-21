import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';

const NoInternetScreen = ({ onRetry }: { onRetry: () => void }) => {
  const handleRetry = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      onRetry();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper justify-center items-center">
      <View className="w-[85%] items-center p-5">
        <View className="mb-10 justify-center items-center">
          <Ionicons name="cloud-offline-outline" size={80} color="#F97316" />
          <View className="absolute w-[120px] h-[120px] rounded-sheet bg-brand-500/10 -z-10" />
        </View>
        
        <Text className="text-2xl font-display text-ink mb-3 text-center">
          No Connection
        </Text>
        <Text className="text-base text-ink-3 text-center leading-6 mb-10">
          Your device is currently offline. Please check your internet settings and try again.
        </Text>

        <TouchableOpacity 
          className="bg-brand-500 flex-row items-center justify-center py-4 px-gutter w-full border-2 border-ink rounded-md"
          activeOpacity={0.8}
          onPress={handleRetry}
        >
          <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Try Again</Text>
          <Ionicons name="refresh-outline" size={20} color="#12100E" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default NoInternetScreen;
