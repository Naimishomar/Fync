import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Animated, Share, Easing } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { C } from '../../constants/colors';
import { artUrl } from '../../constants/features';
import { tapHaptic, selectHaptic } from '../../utils/haptics';
import { AppBar, Button, IconBtn, Screen } from '../ui/kit';
import { Alert } from '../ui/AlertModal';
import Avatar from '../Avatar';

/**
 * Couples Corner: two-player tap games. Pair up with your partner by code, or
 * get a random match. Rounds, picks and scoring all run on the server
 * (backend/controllers/duo.socket.js); this screen only renders its events.
 */

type GameId = 'thisOrThat' | 'wouldYouRather' | 'knowMe' | 'neverHaveI';
type Player = { userId: string; name?: string; username?: string; avatar?: string };
type Round = { roomId: string; round: number; total: number; options: [string, string]; subject: string | null };
type Reveal = { round: number; picks: Record<string, number>; match: boolean; score: number };

const GAMES: Array<{ id: GameId; title: string; hint: string; art: string; tint: string }> = [
  { id: 'thisOrThat', title: 'This or That', hint: 'Pick one. See how often you match.', art: 'assets/Two hearts/3D/two_hearts_3d.png', tint: '#db2777' },
  { id: 'wouldYouRather', title: 'Would You Rather', hint: 'Tough choices, honest answers.', art: 'assets/Thinking face/3D/thinking_face_3d.png', tint: '#8b5cf6' },
  { id: 'knowMe', title: 'How Well Do You Know Me', hint: 'Take turns: one answers, one guesses.', art: 'assets/Heart with ribbon/3D/heart_with_ribbon_3d.png', tint: '#f43f5e' },
  { id: 'neverHaveI', title: 'Never Have I Ever', hint: 'Confess with a tap. No typing.', art: 'assets/See-no-evil monkey/3D/see-no-evil_monkey_3d.png', tint: '#f59e0b' },
];
const gameOf = (id?: string) => GAMES.find((g) => g.id === id) ?? GAMES[0];
const ROUND_MS = 20000;

type Phase = 'lobby' | 'searching' | 'code' | 'playing' | 'over';

const CouplesCorner = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const myId = String(user?._id ?? '');

  const [phase, setPhase] = useState<Phase>('lobby');
  const [game, setGame] = useState<GameId>('thisOrThat');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [codeLeft, setCodeLeft] = useState(0);
  const [partner, setPartner] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [myPick, setMyPick] = useState<number | null>(null);
  const [partnerPicked, setPartnerPicked] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [final, setFinal] = useState<{ score: number; total: number } | null>(null);
  const timer = useRef(new Animated.Value(1)).current;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Leaving the screen mid-search or mid-game frees the partner and the queue.
  useEffect(() => () => {
    if (phaseRef.current !== 'lobby' && phaseRef.current !== 'over') socket.emit('duo_cancel', {});
  }, []);

  useEffect(() => {
    const onSearching = () => setPhase('searching');
    const onCode = (d: { code: string; expiresIn?: number }) => {
      setCode(d.code);
      setCodeLeft(d.expiresIn ?? 600);
      setPhase('code');
    };
    const onMatched = (d: { game: GameId; players: Player[]; opponent: Player }) => {
      tapHaptic();
      setGame(d.game);
      setPlayers(d.players);
      setPartner(d.opponent);
      setRound(null);
      setReveal(null);
      setFinal(null);
      setPhase('playing');
    };
    const onRound = (d: Round) => {
      setRound(d);
      setMyPick(null);
      setPartnerPicked(false);
      setReveal(null);
      // Local clock for the bar: the server's endsAt can be off by the phone's clock skew.
      timer.setValue(1);
      Animated.timing(timer, { toValue: 0, duration: ROUND_MS, easing: Easing.linear, useNativeDriver: false }).start();
    };
    const onPartnerPicked = () => setPartnerPicked(true);
    const onReveal = (d: Reveal) => {
      timer.stopAnimation();
      if (d.match) tapHaptic();
      setReveal(d);
    };
    const onOver = (d: { score: number; total: number }) => {
      setFinal(d);
      setPhase('over');
    };
    const onLeft = () => {
      if (phaseRef.current !== 'playing') return;
      Toast.show({ type: 'info', text1: 'Your partner left the game' });
      setPhase('lobby');
    };
    const onError = (msg: string) => {
      Toast.show({ type: 'error', text1: typeof msg === 'string' ? msg : 'Something went wrong' });
      if (phaseRef.current !== 'playing') setPhase('lobby');
    };
    const evts: Array<[string, (...a: any[]) => void]> = [
      ['duo_searching', onSearching], ['duo_code', onCode], ['duo_matched', onMatched],
      ['duo_round', onRound], ['duo_partner_picked', onPartnerPicked], ['duo_reveal', onReveal],
      ['duo_over', onOver], ['duo_left', onLeft], ['duo_error', onError],
    ];
    evts.forEach(([e, fn]) => socket.on(e, fn));
    // Detach only this screen's listeners: the socket is shared app-wide.
    return () => evts.forEach(([e, fn]) => socket.off(e, fn));
  }, [timer]);

  // Invite codes die after 10 min server-side; count down and drop back to the lobby with it.
  useEffect(() => {
    if (phase !== 'code') return;
    const t = setInterval(() => {
      setCodeLeft((s) => {
        if (s > 1) return s - 1;
        clearInterval(t);
        socket.emit('duo_cancel', {});
        setPhase('lobby');
        Toast.show({ type: 'info', text1: 'Invite code expired', text2: 'Create a new one when your partner is ready.' });
        return 0;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const me = () => ({ name: user?.name, username: user?.username, avatar: user?.avatar });
  const ready = () => {
    if (!socket.connected) {
      Toast.show({ type: 'error', text1: 'Connecting… try again in a moment' });
      return false;
    }
    return true;
  };

  const findRandom = (g: GameId) => {
    if (!ready()) return;
    setGame(g);
    setPhase('searching');
    socket.emit('duo_find', { game: g, ...me() });
  };
  const createCode = (g: GameId) => {
    if (!ready()) return;
    setGame(g);
    socket.emit('duo_create', { game: g, ...me() });
  };
  const join = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 6) {
      Toast.show({ type: 'error', text1: 'Enter the 6-letter code' });
      return;
    }
    if (!ready()) return;
    socket.emit('duo_join', { code: c, ...me() });
  };
  const cancel = () => {
    socket.emit('duo_cancel', {});
    setPhase('lobby');
  };
  const pick = (choice: number) => {
    if (!round || myPick != null || reveal) return;
    selectHaptic();
    setMyPick(choice);
    socket.emit('duo_pick', { roomId: round.roomId, round: round.round, choice });
  };

  const safety = () => {
    if (!partner) return;
    Alert.alert(partner.name || 'This player', 'Something not right?', [
      {
        text: 'Report',
        onPress: () => {
          axios
            .post('/safety/report', { targetType: 'user', targetId: partner.userId, reason: 'Couples Corner match' })
            .then(() => Toast.show({ type: 'success', text1: 'Reported. Thanks for keeping Fync safe.' }))
            .catch(() => Toast.show({ type: 'error', text1: 'Could not report, try again' }));
        },
      },
      {
        text: 'Block and leave',
        style: 'destructive',
        onPress: () => {
          axios.post('/safety/block', { userId: partner.userId }).catch(() => {});
          cancel();
          Toast.show({ type: 'success', text1: "Blocked. You won't be matched again." });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const g = gameOf(game);

  return (
    <Screen>
      <AppBar
        title={phase === 'playing' ? g.title : 'Couples Corner'}
        onBack={() => (phase === 'playing' ? Alert.alert('Leave game?', 'Your partner will be told you left.', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => { cancel(); navigation.goBack(); } },
        ]) : navigation.goBack())}
        right={phase === 'playing' && partner ? <IconBtn name="flag-outline" onPress={safety} /> : undefined}
      />

      {phase === 'playing' ? (
        <Playing
          g={g}
          myId={myId}
          players={players}
          partner={partner}
          round={round}
          myPick={myPick}
          partnerPicked={partnerPicked}
          reveal={reveal}
          timer={timer}
          onPick={pick}
        />
      ) : phase === 'over' && final ? (
        <Over g={g} partner={partner} final={final} onAgain={() => setPhase('lobby')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {phase === 'searching' || phase === 'code' ? (
            <View className="rounded-2xl border border-line bg-card p-6 items-center mb-6">
              <Image source={{ uri: artUrl(g.art) }} style={{ width: 72, height: 72 }} contentFit="contain" />
              <Text className="font-display text-ink text-lg mt-3 text-center">{g.title}</Text>
              {phase === 'searching' ? (
                <>
                  <ActivityIndicator color={C.brand[500]} style={{ marginTop: 16 }} />
                  <Text className="font-sans text-ink-2 mt-3 text-center">Finding someone to play with…</Text>
                </>
              ) : (
                <>
                  <Text className="font-sans text-ink-2 mt-3 text-center">Send this code to your partner</Text>
                  <Text selectable className="font-display text-ink mt-2" style={{ fontSize: 34, letterSpacing: 6 }}>{code}</Text>
                  <Button
                    title="Share code"
                    icon="share-social-outline"
                    variant="primary"
                    style={{ marginTop: 14 }}
                    onPress={() => Share.share({ message: `Play "${g.title}" with me on Fync 💕 Open Couples Corner and enter code ${code}` }).catch(() => {})}
                  />
                  <Text className="font-sans text-ink-3 text-xs mt-3">
                    Waiting for them to join · expires in {Math.floor(codeLeft / 60)}:{String(codeLeft % 60).padStart(2, '0')}
                  </Text>
                </>
              )}
              <Button title="Cancel" variant="ghost" small style={{ marginTop: 10 }} onPress={cancel} />
            </View>
          ) : (
            <>
              <View className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: '#db2777' }}>
                <View className="p-5 flex-row items-center">
                  <View className="flex-1 pr-3">
                    <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 26 }}>Play together 💕</Text>
                    <Text className="font-sans mt-1.5" style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>
                      Invite your partner with a code, or get matched with someone new.
                    </Text>
                  </View>
                  <Image source={{ uri: artUrl('assets/Two hearts/3D/two_hearts_3d.png') }} style={{ width: 76, height: 76 }} contentFit="contain" />
                </View>
              </View>

              <View className="flex-row mb-6" style={{ gap: 10 }}>
                {[
                  { title: 'Couple Space', sub: 'Streak, daily question, notes', art: 'assets/Heart with ribbon/3D/heart_with_ribbon_3d.png', route: 'CoupleSpace' },
                  { title: 'Gift Shop', sub: 'Custom albums, mugs & more', art: 'assets/Wrapped gift/3D/wrapped_gift_3d.png', route: 'GiftShop' },
                ].map((x) => (
                  <Pressable
                    key={x.route}
                    onPress={() => navigation.navigate(x.route)}
                    accessibilityRole="button"
                    className="flex-1 rounded-2xl border border-line bg-card p-4 active:opacity-80"
                  >
                    <Image source={{ uri: artUrl(x.art) }} style={{ width: 44, height: 44 }} contentFit="contain" cachePolicy="disk" />
                    <Text className="font-display text-ink mt-2" style={{ fontSize: 15 }}>{x.title}</Text>
                    <Text className="font-sans text-ink-3 text-xs mt-0.5" numberOfLines={2}>{x.sub}</Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={() => navigation.navigate('CoupleLeaderboard')}
                accessibilityRole="button"
                className="flex-row items-center rounded-2xl border border-line bg-card px-4 py-3 mb-6 active:opacity-80"
              >
                <Text style={{ fontSize: 22 }}>🏆</Text>
                <Text className="font-display text-ink flex-1 ml-3">Top couples leaderboard</Text>
                <Text className="font-sans text-ink-3">›</Text>
              </Pressable>

              <Text className="font-display text-label text-ink-2 uppercase mb-2" style={{ letterSpacing: 1.2 }}>Have a code?</Text>
              <View className="flex-row items-center mb-6" style={{ gap: 10 }}>
                <TextInput
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
                  placeholder="ABC123"
                  placeholderTextColor={C.ink4}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onSubmitEditing={join}
                  className="flex-1 rounded-xl border border-line bg-card px-4 font-display text-ink"
                  style={{ height: 48, fontSize: 18, letterSpacing: 4 }}
                />
                <Button title="Join" variant="solid" onPress={join} disabled={joinCode.length !== 6} />
              </View>

              <Text className="font-display text-label text-ink-2 uppercase mb-2" style={{ letterSpacing: 1.2 }}>Games</Text>
              {GAMES.map((x) => (
                <View key={x.id} className="rounded-2xl border border-line bg-card mb-3 overflow-hidden">
                  <View className="flex-row items-center p-4" style={{ backgroundColor: `${x.tint}${C.scheme === 'dark' ? '26' : '12'}` }}>
                    <Image source={{ uri: artUrl(x.art) }} style={{ width: 52, height: 52 }} contentFit="contain" cachePolicy="disk" />
                    <View className="flex-1 ml-3">
                      <Text className="font-display text-ink" style={{ fontSize: 16 }}>{x.title}</Text>
                      <Text className="font-sans text-ink-2 text-sm mt-0.5">{x.hint}</Text>
                    </View>
                  </View>
                  <View className="flex-row p-3" style={{ gap: 10 }}>
                    <Button title="Invite partner" icon="heart-outline" small variant="primary" inCard style={{ flex: 1 }} onPress={() => createCode(x.id)} />
                    <Button title="Random match" icon="shuffle" small style={{ flex: 1 }} onPress={() => findRandom(x.id)} />
                  </View>
                </View>
              ))}
              <Text className="font-sans text-ink-3 text-xs mt-2 text-center">
                Random matches only see your name and photo. Tap the flag in a game to report or block.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
};

const nameOf = (p?: Player | null) => (p?.name || p?.username || 'Partner').split(' ')[0];

const Playing = ({
  g, myId, players, partner, round, myPick, partnerPicked, reveal, timer, onPick,
}: {
  g: (typeof GAMES)[number]; myId: string; players: Player[]; partner: Player | null; round: Round | null;
  myPick: number | null; partnerPicked: boolean; reveal: Reveal | null; timer: Animated.Value; onPick: (c: number) => void;
}) => {
  if (!round) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Avatar user={partner} size={72} showBadge={false} />
        <Text className="font-display text-ink text-lg mt-4">Matched with {nameOf(partner)} 💕</Text>
        <Text className="font-sans text-ink-2 mt-1">Get ready…</Text>
      </View>
    );
  }

  const subject = round.subject ? players.find((p) => p.userId === round.subject) : null;
  const iAmSubject = round.subject === myId;
  const isNever = g.id === 'neverHaveI';
  const prompt = isNever
    ? round.options[1]
    : g.id === 'knowMe'
      ? iAmSubject ? 'Which one are you?' : `What would ${nameOf(subject)} pick?`
      : g.id === 'wouldYouRather' ? 'Would you rather…' : 'Pick one';
  const labels = isNever ? ['I have 🙋', 'Never 🙅'] : round.options;
  const theirPick = reveal && partner ? reveal.picks[partner.userId] : undefined;

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Avatar user={partner} size={32} showBadge={false} />
          <Text className="font-display text-ink" numberOfLines={1}>{nameOf(partner)}</Text>
        </View>
        <Text className="font-display text-ink-2">
          {round.round + 1}/{round.total} · ❤️ {reveal?.score ?? '…'}
        </Text>
      </View>

      <View className="h-1.5 rounded-full bg-line overflow-hidden mb-6">
        <Animated.View
          style={{ height: '100%', backgroundColor: g.tint, width: timer.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
        />
      </View>

      <Text className="font-display text-ink text-center mb-6" style={{ fontSize: isNever ? 20 : 22, lineHeight: 28 }}>{prompt}</Text>

      {[0, 1].map((i) => {
        const mine = myPick === i;
        const theirs = theirPick === i;
        return (
          <Pressable
            key={i}
            onPress={() => onPick(i)}
            disabled={myPick != null || !!reveal}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            className="rounded-2xl border-2 mb-3 px-5 justify-center"
            style={{
              minHeight: 92,
              borderColor: mine ? g.tint : C.line,
              backgroundColor: mine ? `${g.tint}${C.scheme === 'dark' ? '33' : '18'}` : C.card,
            }}
          >
            <Text className="font-display text-ink text-center" style={{ fontSize: 18 }}>{labels[i]}</Text>
            {reveal ? (
              <View className="flex-row justify-center mt-2" style={{ gap: 6 }}>
                {mine ? <Text className="font-sans text-xs text-ink-2">You</Text> : null}
                {theirs ? <Text className="font-sans text-xs text-ink-2">{nameOf(partner)}</Text> : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      <Text className="font-sans text-ink-2 text-center mt-3">
        {reveal
          ? reveal.match ? 'It’s a match! ❤️' : theirPick == null ? `${nameOf(partner)} ran out of time ⏳` : 'Different picks 😅'
          : myPick == null
            ? partnerPicked ? `${nameOf(partner)} has picked — your turn` : 'Tap your answer'
            : partnerPicked ? 'Revealing…' : `Waiting for ${nameOf(partner)}…`}
      </Text>
    </ScrollView>
  );
};

const Over = ({ g, partner, final, onAgain }: {
  g: (typeof GAMES)[number]; partner: Player | null; final: { score: number; total: number }; onAgain: () => void;
}) => {
  const pct = final.total ? Math.round((final.score / final.total) * 100) : 0;
  const line = pct >= 80 ? 'Basically the same person 😍' : pct >= 50 ? 'Pretty in sync 💕' : pct >= 30 ? 'Opposites attract? 😄' : 'Lots to learn about each other 😅';
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Image source={{ uri: artUrl(g.art) }} style={{ width: 96, height: 96 }} contentFit="contain" />
      <Text className="font-display text-ink mt-4" style={{ fontSize: 44 }}>{pct}%</Text>
      <Text className="font-sans text-ink-2 mt-1">match with {nameOf(partner)} · {final.score}/{final.total}</Text>
      <Text className="font-display text-ink text-lg mt-4 text-center">{line}</Text>
      <Button title="Play another game" variant="primary" icon="heart" style={{ marginTop: 24 }} onPress={onAgain} />
    </View>
  );
};

export default CouplesCorner;
