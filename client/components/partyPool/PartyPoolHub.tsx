import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { AppBar, ListRow } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

type ActiveGame = 'none' | 'bottle' | 'coin' | 'reaction' | 'charades' | 'chess' | 'trivia' | 'trend';
type Game = {
  key: string; title: string; hint: string; flag?: string; route?: string;
  // A function so the colour is read at render time and follows the theme.
  glyph: () => React.ReactNode;
};

const GAMES: Game[] = [
  { key: 'plans', route: 'SundayPlans', title: 'Sunday Plans', hint: 'Host or join a free Sunday hangout in your college.', glyph: () => <Ionicons name="calendar-outline" size={24} color={C.brand[500]} /> },
  { key: 'ludo', flag: 'ludo', route: 'LudoGame', title: 'Ludo', hint: 'Online, with friends or against the computer.', glyph: () => <Ionicons name="dice-outline" size={24} color={C.success} /> },
  { key: 'spy', flag: 'spy', route: 'SpyGame', title: "Who's the Spy", hint: 'Find the spy among you. 4 to 8 players.', glyph: () => <Ionicons name="eye-outline" size={24} color={C.fam.study} /> },
  { key: 'wordDuel', flag: 'wordDuel', route: 'WordDuel', title: 'Word Duel', hint: 'Daily word, endless mode or a 1v1 race.', glyph: () => <Ionicons name="text-outline" size={24} color={C.info} /> },
  { key: 'trivia', title: 'Trivia Survival', hint: 'Health drains quickly. Answer right to survive.', glyph: () => <Ionicons name="skull-outline" size={24} color={C.danger} /> },
  { key: 'bottle', title: 'Bottle Spin', hint: "Who's next? Truth or dare for groups up to 20.", glyph: () => <MaterialCommunityIcons name="bottle-wine-outline" size={24} color={C.brand[500]} /> },
  { key: 'chess', title: 'Fync Chess', hint: 'Challenge your friends or the AI to a rapid match.', glyph: () => <FontAwesome5 name="chess-knight" size={22} color={C.ink} /> },
  { key: 'charades', title: 'Antakshari', hint: 'Sing your way through Bollywood hits with 1000+ modern prompts.', glyph: () => <MaterialCommunityIcons name="microphone-outline" size={24} color={C.fam.fun} /> },
  { key: 'coin', flag: 'coinToss', title: 'Coin Toss', hint: 'Settle quick decisions with a fair flip.', glyph: () => <MaterialCommunityIcons name="circle-multiple-outline" size={24} color={C.ink2} /> },
  { key: 'reaction', title: 'Reaction Master', hint: 'Test your reflexes! Loser pays for the next coffee.', glyph: () => <Ionicons name="flash-outline" size={24} color={C.fam.fun} /> },
  { key: 'trend', title: 'Trend Clash', hint: 'Guess which one the internet liked more.', glyph: () => <Ionicons name="trending-up" size={24} color={C.brand[500]} /> },
  { key: 'flappy', flag: 'flappyBird', route: 'FlappyBird', title: 'Flappy Bird', hint: 'Navigate the bird through obstacles to achieve high scores.', glyph: () => <Ionicons name="logo-twitter" size={24} color={C.success} /> },
  { key: 'draw', flag: 'drawGuess', route: 'DrawAndGuess', title: 'Draw & Guess', hint: 'Multiplayer Pictionary. Draw the word or guess the drawing.', glyph: () => <Ionicons name="color-palette-outline" size={24} color={C.info} /> },
];

const ROW = { paddingHorizontal: 16, paddingVertical: 12 };
const GameCard = React.memo(function GameCard({ game, onOpen }: { game: Game; onOpen: (g: Game) => void }) {
  return (
    <View className="bg-card border border-line rounded-2xl mb-3 overflow-hidden">
      <ListRow
        leading={<View className="w-14 h-14 rounded-full bg-paper-2 items-center justify-center">{game.glyph()}</View>}
        title={game.title}
        subtitle={game.hint}
        subtitleLines={2}
        onPress={() => onOpen(game)}
        style={ROW}
      />
    </View>
  );
});

const PartyPoolHub = () => {
  const navigation = useNavigation<any>();
  const [activeGame, setActiveGame] = useState<ActiveGame>('none');
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

  const open = React.useCallback((g: Game) => {
    if (g.route) navigation.navigate(g.route);
    else setActiveGame(g.key as ActiveGame);
  }, [navigation]);

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
          {GAMES.filter((g) => !g.flag || isFeatureOn(g.flag)).map((g) => (
            <GameCard key={g.key} game={g} onOpen={open} />
          ))}
          <View className="flex-row items-center mt-3 bg-paper-2 p-4 rounded-2xl" style={{ gap: 8 }}>
            <Ionicons name="bulb-outline" size={16} color={C.ink3} />
            <Text className="flex-1 text-sm text-ink-2">Pro tip: best played in your college common room or canteen!</Text>
          </View>
        </ScrollView>
        )}
      </View>
    </View>
  );
};

export default PartyPoolHub;
