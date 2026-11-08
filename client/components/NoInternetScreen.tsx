import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { C } from '../constants/colors';

const NoInternetScreen = ({ onRetry }: { onRetry: () => void }) => {
  const handleRetry = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      onRetry();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper justify-center items-center">
      <View className="w-full items-center px-gutter" style={{ gap: 12, maxWidth: 400 }}>
        <View className="w-16 h-16 rounded-full bg-paper-2 items-center justify-center mb-2">
          <Ionicons name="cloud-offline-outline" size={28} color={C.ink} />
        </View>

        <Text className="font-display text-ink text-center" style={{ fontSize: 24, lineHeight: 29 }} accessibilityRole="header">
          You’re offline
        </Text>
        <Text className="font-sans text-ink-3 text-center mb-4" style={{ fontSize: 15, lineHeight: 22 }}>
          Check your connection and try again.
        </Text>

        <TouchableOpacity
          className="bg-brand-500 flex-row items-center justify-center w-full rounded-full px-5"
          style={{ minHeight: 48, gap: 8 }}
          activeOpacity={0.85}
          onPress={handleRetry}
          accessibilityRole="button"
        >
          <Ionicons name="refresh-outline" size={18} color={C.onBrand} />
          <Text className="font-semibold text-on-brand" style={{ fontSize: 15 }}>Try again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default NoInternetScreen;
