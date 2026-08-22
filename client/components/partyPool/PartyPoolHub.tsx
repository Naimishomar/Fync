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
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useNavigation } from '@react-navigation/native';

// Game Components
import BottleSpin from './BottleSpin';
import CoinToss from './CoinToss';
import DesiCharades from './DesiCharades';
import ChessHome from './ChessHome';
import TriviaSurvival from './TriviaSurvival';
import ReactionMaster from './ReactionMaster';
import TrendClash from './TrendClash';

const PartyPoolHub = () => {
  const navigation = useNavigation<any>();
  const [activeGame, setActiveGame] = useState<'none' | 'bottle' | 'coin' | 'reaction' | 'charades' | 'chess' | 'trivia' | 'trend'>('none');

  const renderGame = () => {
    switch (activeGame) {
      case 'bottle': return <BottleSpin />;
      case 'coin': return <CoinToss />;
      case 'reaction': return <ReactionMaster />;
      case 'charades': return <DesiCharades />;
      case 'chess': return <ChessHome />;
      case 'trivia': return <TriviaSurvival onClose={() => setActiveGame('none')} />;
      case 'trend': return <TrendClash onClose={() => setActiveGame('none')} />;
      default: return null;
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />
      
      {/* Background Gradient */}
      <View className="absolute top-0 w-full h-[300px] opacity-[0.15]">
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-gutter py-8 flex-row justify-between items-start">
          <View>
            <Text className="text-2xl font-display text-ink uppercase leading-7">PARTY <Text className="text-brand-500">POOL</Text></Text>
            <Text className="text-label color-[#8B857E] font-display uppercase mt-1">Campus Social Hub</Text>
          </View>
        </View>

        {activeGame !== 'none' ? (
          /* A running game gets the whole screen: no ScrollView above it to
             collapse a flex-1 root to nothing or to swallow its taps. */
          <View className="flex-1 px-5 pb-6">
            <TouchableOpacity
              onPress={() => setActiveGame('none')}
              className="flex-row items-center self-start mb-4 py-[10px] px-4 bg-card rounded-card border-2 border-ink"
              accessibilityRole="button"
              accessibilityLabel="Back to Party Pool"
            >
              <Ionicons name="chevron-back" size={20} color="#12100E" />
              <Text className="text-label font-display text-ink ml-1">BACK TO HQ</Text>
            </TouchableOpacity>
            <View className="flex-1">{renderGame()}</View>
          </View>
        ) : (
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <>
            <View className="gap-y-4">
              <TouchableOpacity 
                onPress={() => setActiveGame('trivia')} 
                className="h-[120px] rounded-card overflow-hidden border-2 border-ink"
                style={{ shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 }}
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-danger/10 justify-center items-center mr-4">
                        <Ionicons name="skull" size={28} color="#DC2626" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-semibold text-base text-ink mb-1">Trivia Survival</Text>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Health drains quickly. Answer right to survive.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-danger/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#DC2626" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('bottle')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-brand-100 justify-center items-center mr-4">
                        <MaterialCommunityIcons name="bottle-wine" size={28} color="#F97316" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">BOTTLE SPIN</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Who's next? Truth or Dare protocol for groups up to 20.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-brand-100 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#F97316" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('chess')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#F5F2EC' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-ink justify-center items-center mr-4">
                        <FontAwesome5 name="chess-knight" size={28} color="#fff" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">FYNC CHESS</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Challenge your friends or the AI to a rapid match.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-paper-2 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#12100E" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('charades')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-fam-fun/10 justify-center items-center mr-4">
                        <MaterialCommunityIcons name="microphone" size={28} color="#DB2777" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">ANTAKSHARI</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Sing your way through Bollywood hits with 1000+ modern prompts.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-fam-fun/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#DB2777" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('coin')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#F5F2EC' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-paper-2 justify-center items-center mr-4">
                        <MaterialCommunityIcons name="currency-usd" size={28} color="#57534E" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">COIN TOSS</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Execute quick decisions with our probability engine.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-paper-2 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#57534E" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('reaction')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-fam-fun/10 justify-center items-center mr-4">
                        <Ionicons name="flash" size={28} color="#DB2777" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">REACTION MASTER</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Test your reflexes! Looser will pay the next coffee.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-fam-fun/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#DB2777" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveGame('trend')}
                className="h-[120px] rounded-card overflow-hidden border-2 border-ink"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-brand-100 justify-center items-center mr-4">
                        <Ionicons name="trending-up" size={28} color="#F97316" />
                    </View>
                    <View className="flex-1">
                        <Text className="font-semibold text-base text-ink mb-1">Trend Clash</Text>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Guess which one the internet liked more.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-brand-100 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#EA580C" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => navigation.navigate('FlappyBird')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-success/10 justify-center items-center mr-4">
                        <Ionicons name="logo-twitter" size={28} color="#047857" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">FLAPPY BIRD</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Navigate the bird through obstacles to achieve high scores.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-success/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#047857" />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => navigation.navigate('DrawAndGuess')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: '#EDE8E0' }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-fam-career/10 justify-center items-center mr-4">
                        <Ionicons name="color-palette" size={28} color="#2563EB" />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">DRAW & GUESS</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Multiplayer Pictionary. Draw the word or guess the drawing.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-fam-career/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color="#2563EB" />
                    </View>
                </View>
              </TouchableOpacity>

              {/* Tip Box */}
              <View className="flex-row items-center justify-center mt-6 bg-card p-3 rounded-card border border-line">
                <Ionicons name="bulb-outline" size={16} color="#8B857E" />
                <Text className="text-label text-ink-3 font-display ml-2 uppercase">PRO TIP: Best played in your college common room or canteen!</Text>
              </View>
            </View>
          </>
        </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
};

export default PartyPoolHub;
