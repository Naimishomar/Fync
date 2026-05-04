import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Game Components
import BottleSpin from './BottleSpin';
import CoinToss from './CoinToss';
import ReactionMaster from './ReactionMaster';
import DesiCharades from './DesiCharades';

const PartyPoolHub = () => {
  const [activeGame, setActiveGame] = useState<'none' | 'bottle' | 'coin' | 'reaction' | 'charades'>('none');

  const renderGame = () => {
    switch (activeGame) {
      case 'bottle': return <BottleSpin />;
      case 'coin': return <CoinToss />;
      case 'reaction': return <ReactionMaster />;
      case 'charades': return <DesiCharades />;
      default: return null;
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      
      {/* Background Gradient */}
      <View className="absolute top-0 w-full h-[300px] opacity-[0.15]">
        <LinearGradient colors={['#f97316', 'transparent']} className="flex-1" />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-8 py-8 flex-row justify-between items-start">
          <View>
            <Text className="text-[28px] font-black text-[#1A1A1A] uppercase tracking-[-1.5px] leading-7">PARTY <Text className="text-[#f97316]">POOL</Text></Text>
            <Text className="text-[8px] color-[#94A3B8] font-black uppercase tracking-[2px] mt-1">Campus Social Hub</Text>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {activeGame === 'none' ? (
            <View className="gap-y-4">
              <TouchableOpacity 
                onPress={() => setActiveGame('bottle')} 
                className="h-[120px] rounded-[32px] overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FFF7ED', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-[20px] bg-[#FFEDD5] justify-center items-center mr-4">
                        <MaterialCommunityIcons name="bottle-wine" size={28} color="#f97316" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">BOTTLE SPIN</Text>
                        <Text className="text-[10px] text-[#64748B] leading-[14px] font-medium">Who's next? Truth or Dare protocol for groups up to 20.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FFEDD5] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#f97316" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('charades')} 
                className="h-[120px] rounded-[32px] overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FDF2F8', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-[20px] bg-[#FCE7F3] justify-center items-center mr-4">
                        <MaterialCommunityIcons name="microphone" size={28} color="#db2777" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">ANTAKSHARI</Text>
                        <Text className="text-[10px] text-[#64748B] leading-[14px] font-medium">Sing your way through Bollywood hits with 1000+ modern prompts.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FCE7F3] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#db2777" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('coin')} 
                className="h-[120px] rounded-[32px] overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#F8FAFC', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-[20px] bg-[#E2E8F0] justify-center items-center mr-4">
                        <MaterialCommunityIcons name="currency-usd" size={28} color="#475569" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">COIN TOSS</Text>
                        <Text className="text-[10px] text-[#64748B] leading-[14px] font-medium">Execute quick decisions with our probability engine.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#E2E8F0] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#475569" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('reaction')} 
                className="h-[120px] rounded-[32px] overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FDF2F8', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-[20px] bg-[#FCE7F3] justify-center items-center mr-4">
                        <Ionicons name="flash" size={28} color="#db2777" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">REACTION MASTER</Text>
                        <Text className="text-[10px] text-[#64748B] leading-[14px] font-medium">Test your reflexes! Looser will pay the next coffee.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FCE7F3] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#db2777" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Tip Box */}
              <View className="flex-row items-center justify-center mt-6 bg-white p-3 rounded-2xl border border-[#F1F5F9]">
                <Ionicons name="bulb-outline" size={16} color="#94A3B8" />
                <Text className="text-[8px] text-[#94A3B8] font-black ml-2 uppercase tracking-[0.5px]">PRO TIP: Best played in your college common room or canteen!</Text>
              </View>
            </View>
          ) : (
            <View className="items-center">
              <TouchableOpacity 
                onPress={() => setActiveGame('none')}
                className="flex-row items-center self-start mb-6 py-[10px] px-4 bg-white rounded-2xl border border-[#F1F5F9] shadow-sm"
              >
                <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
                <Text className="text-[10px] font-black text-[#1A1A1A] ml-1 tracking-[1px]">BACK TO HQ</Text>
              </TouchableOpacity>
              {renderGame()}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default PartyPoolHub;
