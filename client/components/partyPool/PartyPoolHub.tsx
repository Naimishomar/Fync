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
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

// Game Components
import BottleSpin from './BottleSpin';
import CoinToss from './CoinToss';
import DesiCharades from './DesiCharades';
import ChessHome from './ChessHome';
import TriviaSurvival from './TriviaSurvival';
import ReactionMaster from './ReactionMaster';

const PartyPoolHub = () => {
  const navigation = useNavigation<any>();
  const [activeGame, setActiveGame] = useState<'none' | 'bottle' | 'coin' | 'reaction' | 'charades' | 'chess' | 'trivia'>('none');

  const renderGame = () => {
    switch (activeGame) {
      case 'bottle': return <BottleSpin />;
      case 'coin': return <CoinToss />;
      case 'reaction': return <ReactionMaster />;
      case 'charades': return <DesiCharades />;
      case 'chess': return <ChessHome />;
      case 'trivia': return <TriviaSurvival onClose={() => setActiveGame('none')} />;
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
            <Text className="text-2xl font-black text-[#1A1A1A] uppercase tracking-[-1.5px] leading-7">PARTY <Text className="text-[#f97316]">POOL</Text></Text>
            <Text className="text-2xs color-[#94A3B8] font-black uppercase tracking-wide mt-1">Campus Social Hub</Text>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {activeGame === 'none' ? (
            <View className="gap-y-4">
              <TouchableOpacity 
                onPress={() => setActiveGame('trivia')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FEF2F2', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#FEE2E2] justify-center items-center mr-4">
                        <Ionicons name="skull" size={28} color="#ef4444" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">TRIVIA SURVIVAL</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Health drains quickly. Answer right to survive.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FEE2E2] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#ef4444" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('bottle')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FFF7ED', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#FFEDD5] justify-center items-center mr-4">
                        <MaterialCommunityIcons name="bottle-wine" size={28} color="#f97316" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">BOTTLE SPIN</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Who's next? Truth or Dare protocol for groups up to 20.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FFEDD5] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#f97316" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('chess')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#F8FAFC', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-slate-900 justify-center items-center mr-4">
                        <FontAwesome5 name="chess-knight" size={28} color="#fff" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">FYNC CHESS</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Challenge your friends or the AI to a rapid match.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-slate-100 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#1A1A1A" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('charades')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FDF2F8', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#FCE7F3] justify-center items-center mr-4">
                        <MaterialCommunityIcons name="microphone" size={28} color="#db2777" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">ANTAKSHARI</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Sing your way through Bollywood hits with 1000+ modern prompts.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FCE7F3] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#db2777" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('coin')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#F8FAFC', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#E2E8F0] justify-center items-center mr-4">
                        <MaterialCommunityIcons name="currency-usd" size={28} color="#475569" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">COIN TOSS</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Execute quick decisions with our probability engine.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#E2E8F0] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#475569" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('reaction')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#FDF2F8', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#FCE7F3] justify-center items-center mr-4">
                        <Ionicons name="flash" size={28} color="#db2777" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">REACTION MASTER</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Test your reflexes! Looser will pay the next coffee.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#FCE7F3] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#db2777" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => navigation.navigate('FlappyBird')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#F0FDF4', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#DCFCE7] justify-center items-center mr-4">
                        <Ionicons name="logo-twitter" size={28} color="#22c55e" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">FLAPPY BIRD</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Navigate the bird through obstacles to achieve high scores.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#DCFCE7] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#22c55e" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => navigation.navigate('DrawAndGuess')} 
                className="h-[120px] rounded-4xl overflow-hidden border border-[#F1F5F9] shadow-sm"
                activeOpacity={0.9}
              >
                <LinearGradient colors={['#EFF6FF', '#fff']} className="flex-1 flex-row items-center px-5">
                    <View className="w-[60px] h-[60px] rounded-2xl bg-[#DBEAFE] justify-center items-center mr-4">
                        <Ionicons name="color-palette" size={28} color="#3b82f6" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">DRAW & GUESS</Text>
                        <Text className="text-2xs text-[#64748B] leading-[14px] font-medium">Multiplayer Pictionary. Draw the word or guess the drawing.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-[#DBEAFE] justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#3b82f6" />
                    </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Tip Box */}
              <View className="flex-row items-center justify-center mt-6 bg-white p-3 rounded-2xl border border-[#F1F5F9]">
                <Ionicons name="bulb-outline" size={16} color="#94A3B8" />
                <Text className="text-2xs text-[#94A3B8] font-black ml-2 uppercase tracking-wide">PRO TIP: Best played in your college common room or canteen!</Text>
              </View>
            </View>
          ) : (
            <View className="items-center">
              <TouchableOpacity 
                onPress={() => setActiveGame('none')}
                className="flex-row items-center self-start mb-6 py-[10px] px-4 bg-white rounded-2xl border border-[#F1F5F9] shadow-sm"
              >
                <Ionicons name="chevron-back" size={20} color="#1A1A1A" />
                <Text className="text-2xs font-black text-[#1A1A1A] ml-1 tracking-wide">BACK TO HQ</Text>
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
