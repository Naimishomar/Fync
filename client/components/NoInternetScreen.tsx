import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';

const NoInternetScreen = ({ onRetry }: { onRetry: () => void }) => {
  const handleRetry = async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      onRetry();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white justify-center items-center">
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
      </View>
      <View className="w-[85%] items-center p-5">
        <View className="mb-10 justify-center items-center">
          <Ionicons name="cloud-offline-outline" size={80} color="#f97316" />
          <View className="absolute w-[120px] h-[120px] rounded-5xl bg-orange-500/10 -z-10" />
        </View>
        
        <Text className="text-2xl font-black text-slate-800 mb-3 text-center">
          No Connection
        </Text>
        <Text className="text-base text-slate-500 text-center leading-6 mb-10">
          Your device is currently offline. Please check your internet settings and try again.
        </Text>

        <TouchableOpacity 
          className="bg-[#f97316] flex-row items-center justify-center py-4 px-8 rounded-2xl w-full shadow-orange-500 shadow-md elevation-10"
          activeOpacity={0.8}
          onPress={handleRetry}
        >
          <Text className="color-white text-lg font-bold">Try Again</Text>
          <Ionicons name="refresh-outline" size={20} color="white" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default NoInternetScreen;
