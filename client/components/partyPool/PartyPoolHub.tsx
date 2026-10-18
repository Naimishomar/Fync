import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  BackHandler
} from 'react-native';
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
import { C } from '../../constants/colors';
import { isFeatureOn } from '../../constants/features';
import { AppBar } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

const PartyPoolHub = () => {
  const navigation = useNavigation<any>();
  const [activeGame, setActiveGame] = useState<'none' | 'bottle' | 'coin' | 'reaction' | 'charades' | 'chess' | 'trivia' | 'trend'>('none');
  const bottomInset = useBottomInset(24);

  // Android back inside a game returns to the hub instead of leaving Party Pool.
  useEffect(() => {
    if (activeGame === 'none') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveGame('none');
      return true;
    });
    return () => sub.remove();
  }, [activeGame]);

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
      <StatusBar barStyle={C.barStyle} />
      
      {/* Background Gradient */}
      <View className="absolute top-0 w-full h-[300px] opacity-[0.15]">
      </View>

      <View className="flex-1">
        <AppBar
          title="Party Pool"
          onBack={activeGame !== 'none' ? () => setActiveGame('none') : () => navigation.goBack()}
        />

        {activeGame !== 'none' ? (
          /* Tap-only games scroll so their bottom button is reachable on short
             phones; flexGrow keeps their grow/flex-1 roots filling the screen.
             Reaction (timed tap zone) and chess (drag board) stay unscrolled. */
          <View className="flex-1 px-5" style={{ paddingBottom: bottomInset }}>
            {activeGame === 'reaction' || activeGame === 'chess' ? (
              <View className="flex-1">{renderGame()}</View>
            ) : (
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {renderGame()}
              </ScrollView>
            )}
          </View>
        ) : (
        <ScrollView keyboardShouldPersistTaps="handled" 
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 24 }}
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
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-danger/10 justify-center items-center mr-4">
                        <Ionicons name="skull" size={28} color={C.danger} />
                    </View>
                    <View className="flex-1">
                        <Text className="font-semibold text-base text-ink mb-1">Trivia Survival</Text>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Health drains quickly. Answer right to survive.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-danger/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color={C.danger} />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('bottle')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-brand-100 justify-center items-center mr-4">
                        <MaterialCommunityIcons name="bottle-wine" size={28} color={C.brand[500]} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">BOTTLE SPIN</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Who's next? Truth or Dare protocol for groups up to 20.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-brand-100 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color={C.brand[500]} />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('chess')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-ink justify-center items-center mr-4">
                        <FontAwesome5 name="chess-knight" size={28} color={C.paper} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">FYNC CHESS</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Challenge your friends or the AI to a rapid match.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-paper-2 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color={C.ink} />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setActiveGame('charades')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-fam-fun/10 justify-center items-center mr-4">
                        <MaterialCommunityIcons name="microphone" size={28} color={C.fam.fun} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">ANTAKSHARI</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Sing your way through Bollywood hits with 1000+ modern prompts.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-fam-fun/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color={C.fam.fun} />
                    </View>
                </View>
              </TouchableOpacity>

              {isFeatureOn('coinToss') && (
                  <TouchableOpacity 
                    onPress={() => setActiveGame('coin')} 
                    className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                    activeOpacity={0.9}
                  >
                    <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper }}>
                        <View className="w-[60px] h-[60px] rounded-card bg-paper-2 justify-center items-center mr-4">
                            <MaterialCommunityIcons name="currency-usd" size={28} color={C.ink2} />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                              <Text className="text-sm font-display text-ink uppercase">COIN TOSS</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <Text className="text-label text-ink-3 leading-[14px] font-medium">Execute quick decisions with our probability engine.</Text>
                        </View>
                        <View className="w-8 h-8 rounded-xl bg-paper-2 justify-center items-center ml-2">
                            <Ionicons name="arrow-forward" size={16} color={C.ink2} />
                        </View>
                    </View>
                  </TouchableOpacity>
              )}

              <TouchableOpacity 
                onPress={() => setActiveGame('reaction')} 
                className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-fam-fun/10 justify-center items-center mr-4">
                        <Ionicons name="flash" size={28} color={C.fam.fun} />
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                          <Text className="text-sm font-display text-ink uppercase">REACTION MASTER</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Test your reflexes! Looser will pay the next coffee.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-fam-fun/10 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color={C.fam.fun} />
                    </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveGame('trend')}
                className="h-[120px] rounded-card overflow-hidden border-2 border-ink"
                activeOpacity={0.9}
              >
                <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                    <View className="w-[60px] h-[60px] rounded-card bg-brand-100 justify-center items-center mr-4">
                        <Ionicons name="trending-up" size={28} color={C.brand[500]} />
                    </View>
                    <View className="flex-1">
                        <Text className="font-semibold text-base text-ink mb-1">Trend Clash</Text>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Guess which one the internet liked more.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-brand-100 justify-center items-center ml-2">
                        <Ionicons name="arrow-forward" size={16} color={C.brand[600]} />
                    </View>
                </View>
              </TouchableOpacity>

              {isFeatureOn('flappyBird') && (
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('FlappyBird')} 
                    className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                    activeOpacity={0.9}
                  >
                    <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                        <View className="w-[60px] h-[60px] rounded-card bg-success/10 justify-center items-center mr-4">
                            <Ionicons name="logo-twitter" size={28} color={C.success} />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                              <Text className="text-sm font-display text-ink uppercase">FLAPPY BIRD</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <Text className="text-label text-ink-3 leading-[14px] font-medium">Navigate the bird through obstacles to achieve high scores.</Text>
                        </View>
                        <View className="w-8 h-8 rounded-xl bg-success/10 justify-center items-center ml-2">
                            <Ionicons name="arrow-forward" size={16} color={C.success} />
                        </View>
                    </View>
                  </TouchableOpacity>
              )}

              {isFeatureOn('drawGuess') && (
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('DrawAndGuess')} 
                    className="h-[120px] rounded-sheet overflow-hidden border border-paper-2 shadow-hair"
                    activeOpacity={0.9}
                  >
                    <View className="flex-1 flex-row items-center px-5" style={{ backgroundColor: C.paper2 }}>
                        <View className="w-[60px] h-[60px] rounded-card bg-fam-career/10 justify-center items-center mr-4">
                            <Ionicons name="color-palette" size={28} color={C.info} />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                              <Text className="text-sm font-display text-ink uppercase">DRAW & GUESS</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <Text className="text-label text-ink-3 leading-[14px] font-medium">Multiplayer Pictionary. Draw the word or guess the drawing.</Text>
                        </View>
                        <View className="w-8 h-8 rounded-xl bg-fam-career/10 justify-center items-center ml-2">
                            <Ionicons name="arrow-forward" size={16} color={C.info} />
                        </View>
                    </View>
                  </TouchableOpacity>
              )}

              {/* Tip Box */}
              <View className="flex-row items-center justify-center mt-6 bg-card p-3 rounded-card border border-line">
                <Ionicons name="bulb-outline" size={16} color={C.ink3} />
                <Text className="text-label text-ink-3 font-display ml-2 uppercase">PRO TIP: Best played in your college common room or canteen!</Text>
              </View>
            </View>
          </>
        </ScrollView>
        )}
      </View>
    </View>
  );
};

export default PartyPoolHub;
