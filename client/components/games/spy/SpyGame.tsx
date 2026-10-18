import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Animated, Share, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../../context/axiosConfig';
import { useAuth } from '../../../context/auth.context';
import socket from '../../../utils/socket';
import { C } from '../../../constants/colors';
import { tapHaptic, selectHaptic } from '../../../utils/haptics';
import { AppBar, Button, IconBtn, Screen } from '../../ui/kit';
import { Alert } from '../../ui/AlertModal';
import Avatar from '../../Avatar';

/**
 * Who's the Spy: 4-8 players. Everyone gets a secret word; the spy's is a
 * little different. One-word clues, then a vote. All rules and timers run on
 * the server (backend/controllers/spy.socket.js); this screen renders `spy_room`.
 */

type Player = { userId: string; name?: string; username?: string; avatar?: string; alive: boolean };
type Clue = { round: number; userId: string; text: string | null };
type Result = { votes: Record<string, string>; out: string | null; wasSpy: boolean; guess: { text: string | null; correct: boolean } | null };
type Over = { winner: 'spies' | 'civilians' | null; civWord: string; spyWord: string; spies: string[]; reason: string };
type Room = {
  roomId: string; code: string | null; isPublic: boolean; host: string; players: Player[];
  status: 'lobby' | 'playing' | 'over'; phase: 'clue' | 'vote' | 'guess' | 'reveal' | null; round: number;
  turn: string | null; endsIn: number | null; clues: Clue[]; voted: string[]; result: Result | null;
  guesser: string | null; over: Over | null;
};

const SPY = '#e11d48';
const CIV = '#16a34a';
const VIOLET = '#7c3aed';
const first = (p?: Partial<Player> | null) => (p?.name || p?.username || 'Player').split(' ')[0];

const SpyGame = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const myId = String(user?._id ?? '');

  const [room, setRoom] = useState<Room | null>(null);
  const [word, setWord] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const roomRef = useRef(room);
  roomRef.current = room;

  // Leaving the screen leaves the lobby/game so the others aren't stuck waiting.
  useEffect(() => () => {
    if (roomRef.current) socket.emit('spy_leave', {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onRoom = (d: Room) => {
      const prev = roomRef.current;
      setSearching(false);
      setDeadline(d.endsIn != null ? Date.now() + d.endsIn : null);
      if (d.turn === myId && prev?.turn !== myId) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (d.result && !prev?.result) tapHaptic();
      if (d.over && !prev?.over) {
        const iWon = d.over.winner && (d.over.winner === 'spies') === d.over.spies.includes(myId);
        Haptics.notificationAsync(iWon ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      if (d.status === 'playing' && prev?.status !== 'playing') setWord(null);
      setRoom(d);
    };
    const onWord = (d: { word: string }) => setWord(d.word);
    const onError = (msg: string) => {
      setSearching(false);
      Toast.show({ type: 'error', text1: typeof msg === 'string' ? msg : 'Something went wrong' });
    };
    const evts: Array<[string, (...a: any[]) => void]> = [['spy_room', onRoom], ['spy_word', onWord], ['spy_error', onError]];
    evts.forEach(([e, fn]) => socket.on(e, fn));
    // Detach only this screen's listeners: the socket is shared app-wide.
    return () => evts.forEach(([e, fn]) => socket.off(e, fn));
  }, [myId]);

  const me = () => ({ name: user?.name, username: user?.username, avatar: user?.avatar });
  const ready = () => {
    if (socket.connected) return true;
    Toast.show({ type: 'error', text1: 'Connecting… try again in a moment' });
    return false;
  };
  const create = () => ready() && socket.emit('spy_create', me());
  const find = () => {
    if (!ready()) return;
    setSearching(true);
    socket.emit('spy_find', me());
  };
  const join = () => {
    if (joinCode.length !== 6) return Toast.show({ type: 'error', text1: 'Enter the 6-letter code' });
    if (ready()) socket.emit('spy_join', { code: joinCode, ...me() });
  };
  const leave = () => {
    socket.emit('spy_leave', {});
    setRoom(null);
    setWord(null);
  };

  const playerSheet = (p: Player) => {
    if (p.userId === myId) return;
    Alert.alert(first(p), 'Something not right?', [
      {
        text: 'Report',
        onPress: () => {
          axios
            .post('/safety/report', { targetType: 'user', targetId: p.userId, reason: "Who's the Spy player" })
            .then(() => Toast.show({ type: 'success', text1: 'Reported. Thanks for keeping Fync safe.' }))
            .catch(() => Toast.show({ type: 'error', text1: 'Could not report, try again' }));
        },
      },
      {
        text: 'Block and leave',
        style: 'destructive',
        onPress: () => {
          axios.post('/safety/block', { userId: p.userId }).catch(() => {});
          leave();
          Toast.show({ type: 'success', text1: "Blocked. You won't be in a lobby with them again." });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const secsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const playing = room?.status === 'playing';

  return (
    <Screen>
      <AppBar
        title="Who's the Spy"
        onBack={() => (playing ? Alert.alert('Leave game?', 'You will be removed from this round.', [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => { leave(); navigation.goBack(); } },
        ]) : navigation.goBack())}
        right={<IconBtn name="trophy-outline" onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'Spy', title: "Who's the Spy" })} />}
      />
      {!room ? (
        <Home searching={searching} joinCode={joinCode} setJoinCode={setJoinCode} onCreate={create} onFind={find} onJoin={join}
          onCancel={() => { setSearching(false); socket.emit('spy_leave', {}); }} />
      ) : playing ? (
        <Game room={room} myId={myId} word={word} secsLeft={secsLeft} onPlayer={playerSheet} />
      ) : (
        <Lobby room={room} myId={myId} secsLeft={secsLeft} onPlayer={playerSheet} onLeave={leave}
          onStart={() => socket.emit('spy_start', { roomId: room.roomId })} />
      )}
    </Screen>
  );
};

/* ------------------------------------------------------------------ home */
const Home = ({ searching, joinCode, setJoinCode, onCreate, onFind, onJoin, onCancel }: {
  searching: boolean; joinCode: string; setJoinCode: (s: string) => void;
  onCreate: () => void; onFind: () => void; onJoin: () => void; onCancel: () => void;
}) => (
  <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
    <LinearGradient colors={['#4c1d95', VIOLET, SPY]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 22, marginBottom: 24 }}>
      <Text style={{ fontSize: 44 }}>🕵️</Text>
      <Text className="font-display" style={{ color: '#fff', fontSize: 26, marginTop: 6 }}>Who's the Spy?</Text>
      <Text className="font-sans" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6, lineHeight: 20 }}>
        Everyone gets a secret word. One of you has a different one. Drop one-word clues, vote out the spy before they blend in. 4-8 players.
      </Text>
    </LinearGradient>

    <Button title={searching ? 'Finding a lobby…' : 'Play with randoms'} icon="shuffle" variant="primary" block onPress={onFind} disabled={searching} />
    {searching ? <Button title="Cancel" variant="ghost" small style={{ marginTop: 6, alignSelf: 'center' }} onPress={onCancel} /> : null}
    <Button title="Create lobby for friends" icon="people-outline" block style={{ marginTop: 12 }} onPress={onCreate} />

    <Text className="font-display text-ink-2 uppercase mt-8 mb-2" style={{ letterSpacing: 1.2, fontSize: 12 }}>Have a code?</Text>
    <View className="flex-row items-center" style={{ gap: 10 }}>
      <TextInput
        value={joinCode}
        onChangeText={(t) => setJoinCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
        placeholder="ABC123"
        placeholderTextColor={C.ink4}
        autoCapitalize="characters"
        autoCorrect={false}
        onSubmitEditing={onJoin}
        className="flex-1 rounded-xl border border-line bg-card px-4 font-display text-ink"
        style={{ height: 48, fontSize: 18, letterSpacing: 4 }}
      />
      <Button title="Join" variant="solid" onPress={onJoin} disabled={joinCode.length !== 6} />
    </View>
    <Text className="font-sans text-ink-3 text-xs mt-6 text-center">
      Clues are one word, letters only. Tap any player to report or block.
    </Text>
  </ScrollView>
);

/* ----------------------------------------------------------------- lobby */
const Lobby = ({ room, myId, secsLeft, onPlayer, onStart, onLeave }: {
  room: Room; myId: string; secsLeft: number | null; onPlayer: (p: Player) => void; onStart: () => void; onLeave: () => void;
}) => {
  const isHost = room.host === myId;
  const n = room.players.length;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      {room.over ? <OverCard room={room} myId={myId} /> : null}

      {room.code ? (
        <View className="rounded-2xl border border-line bg-card p-5 items-center mb-5">
          <Text className="font-sans text-ink-2">Lobby code</Text>
          <Text selectable className="font-display text-ink mt-1" style={{ fontSize: 34, letterSpacing: 6 }}>{room.code}</Text>
          <Button title="Invite friends" icon="share-social-outline" small style={{ marginTop: 10 }}
            onPress={() => Share.share({ message: `Who's the Spy? 🕵️ Join my lobby on Fync with code ${room.code}` }).catch(() => {})} />
        </View>
      ) : (
        <View className="rounded-2xl border border-line bg-card p-5 items-center mb-5">
          <Text className="font-display text-ink" style={{ fontSize: 18 }}>
            {room.over ? 'Same squad, next round?' : n >= 4 && secsLeft != null ? `Starting in ${secsLeft}s` : 'Waiting for players…'}
          </Text>
          <Text className="font-sans text-ink-2 mt-1 text-center">Starts at 6 players, or 25s after 4 join.</Text>
        </View>
      )}

      <Text className="font-display text-ink-2 uppercase mb-3" style={{ letterSpacing: 1.2, fontSize: 12 }}>Players · {n}/8</Text>
      <View className="flex-row flex-wrap" style={{ gap: 12 }}>
        {room.players.map((p) => (
          <Pressable key={p.userId} onPress={() => onPlayer(p)} className="items-center" style={{ width: 72 }} accessibilityRole="button" accessibilityLabel={first(p)}>
            <Avatar user={p} size={56} showBadge={false} />
            <Text className="font-sans text-ink text-xs mt-1" numberOfLines={1}>{p.userId === myId ? 'You' : first(p)}</Text>
            {p.userId === room.host ? <Text style={{ fontSize: 10, color: VIOLET }} className="font-display">HOST</Text> : null}
          </Pressable>
        ))}
        {Array.from({ length: Math.max(0, 4 - n) }).map((_, i) => (
          <View key={`e${i}`} className="items-center" style={{ width: 72 }}>
            <View className="border border-line items-center justify-center" style={{ width: 56, height: 56, borderRadius: 28, borderStyle: 'dashed' }}>
              <Text className="text-ink-3">?</Text>
            </View>
          </View>
        ))}
      </View>

      {isHost ? (
        <Button title={room.over ? 'Rematch' : n < 4 ? `Need ${4 - n} more` : 'Start game'} icon="play" variant="primary" block
          style={{ marginTop: 28 }} disabled={n < 4} onPress={onStart} />
      ) : (
        <Text className="font-sans text-ink-2 text-center mt-8">
          {room.isPublic && !room.over ? 'Hang tight, filling the lobby…' : `Waiting for ${first(room.players.find((p) => p.userId === room.host))} to start`}
        </Text>
      )}
      <Button title="Leave lobby" variant="ghost" small style={{ marginTop: 10, alignSelf: 'center' }} onPress={onLeave} />
    </ScrollView>
  );
};

const OverCard = ({ room, myId }: { room: Room; myId: string }) => {
  const o = room.over!;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [pop]);
  const iWon = !!o.winner && (o.winner === 'spies') === o.spies.includes(myId);
  const spies = room.players.filter((p) => o.spies.includes(p.userId));
  const headline = !o.winner ? 'Game ended' : o.winner === 'spies' ? 'Spies win! 🕵️' : 'Civilians win! 🎉';
  const sub = o.reason === 'guess' ? 'The spy guessed the word and stole it!'
    : o.reason === 'left' ? 'Someone left. Not counted on the leaderboard.'
    : o.reason === 'players' ? 'Too few players left.'
    : o.winner === 'spies' ? 'The spies blended in.' : 'Every spy was caught.';
  return (
    <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }], opacity: pop, marginBottom: 20 }}>
      <LinearGradient colors={o.winner === 'spies' ? ['#881337', SPY] : o.winner ? ['#14532d', CIV] : ['#3f3f46', '#71717a']}
        style={{ borderRadius: 20, padding: 20, alignItems: 'center' }}>
        <Text className="font-display" style={{ color: '#fff', fontSize: 28 }}>{headline}</Text>
        {o.winner ? <Text className="font-display" style={{ color: '#fff', marginTop: 4 }}>{iWon ? 'You won 🏆' : 'You lost'}</Text> : null}
        <Text className="font-sans" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6, textAlign: 'center' }}>{sub}</Text>
        <View className="flex-row mt-4" style={{ gap: 10 }}>
          <WordPill label="Civilians" word={o.civWord} />
          <WordPill label={spies.length > 1 ? 'Spies' : 'Spy'} word={o.spyWord} />
        </View>
        {spies.length ? (
          <View className="flex-row mt-4 items-center" style={{ gap: 8 }}>
            {spies.map((p) => <Avatar key={p.userId} user={p} size={32} showBadge={false} />)}
            <Text className="font-sans" style={{ color: '#fff' }}>{spies.map((p) => (p.userId === myId ? 'You' : first(p))).join(' & ')} {spies.length > 1 ? 'were spies' : 'was the spy'}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
};

const WordPill = ({ label, word }: { label: string; word: string }) => (
  <View style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }} className="font-sans">{label}</Text>
    <Text style={{ color: '#fff', fontSize: 16 }} className="font-display">{word}</Text>
  </View>
);

/* ------------------------------------------------------------------ game */
const Game = ({ room, myId, word, secsLeft, onPlayer }: {
  room: Room; myId: string; word: string | null; secsLeft: number | null; onPlayer: (p: Player) => void;
}) => {
  const [peek, setPeek] = useState(false);
  const [text, setText] = useState('');
  const [myVote, setMyVote] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const byId = (id?: string | null) => room.players.find((p) => p.userId === id);
  const meP = byId(myId);
  const alive = meP?.alive !== false;
  const myTurn = room.phase === 'clue' && room.turn === myId;

  useEffect(() => { if (room.phase === 'vote') setMyVote(null); }, [room.phase, room.round]);
  useEffect(() => { if (myTurn) setText(''); }, [myTurn]);

  const sendClue = () => {
    const t = text.trim();
    if (!/^[A-Za-z]{1,20}$/.test(t)) return Toast.show({ type: 'error', text1: 'One word, letters only' });
    selectHaptic();
    socket.emit('spy_clue', { roomId: room.roomId, text: t });
  };
  const vote = (id: string) => {
    if (myVote || !alive || id === myId) return;
    selectHaptic();
    setMyVote(id);
    socket.emit('spy_vote', { roomId: room.roomId, target: id });
  };
  const guess = () => {
    if (!text.trim()) return;
    socket.emit('spy_guess', { roomId: room.roomId, text: text.trim() });
    setText('');
  };

  const status = room.phase === 'clue'
    ? myTurn ? 'Your turn: give a one-word clue' : `${first(byId(room.turn))} is thinking…`
    : room.phase === 'vote' ? (alive ? (myVote ? 'Vote locked. Waiting for others…' : 'Who is the spy? Tap to vote') : 'Voting… you are out')
    : room.phase === 'guess' ? (room.guesser === myId ? 'Last chance: guess the civilians’ word!' : `${first(byId(room.guesser))} is guessing the word…`)
    : 'Next round coming up…';

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => room.phase === 'clue' && scroll.current?.scrollToEnd({ animated: true })}>
      <Pressable onPress={() => { tapHaptic(); setPeek((v) => !v); }} accessibilityRole="button" accessibilityLabel="Tap to peek at your secret word">
        <LinearGradient colors={['#312e81', VIOLET]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 18, alignItems: 'center' }}>
          <Text className="font-sans" style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
            ROUND {room.round} · {alive ? 'YOUR SECRET WORD' : 'YOU ARE OUT'}
          </Text>
          <Text className="font-display" style={{ color: '#fff', fontSize: 30, marginTop: 6, letterSpacing: peek ? 0 : 4 }}>
            {peek ? word ?? '…' : '• • • •'}
          </Text>
          <Text className="font-sans" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 }}>{peek ? 'Tap to hide' : 'Tap to peek (cover your screen 👀)'}</Text>
        </LinearGradient>
      </Pressable>

      <View className="flex-row items-center justify-between mt-5 mb-2">
        <Text className="font-display text-ink flex-1" style={{ fontSize: 16 }}>{status}</Text>
        {secsLeft != null && room.phase !== 'reveal' ? (
          <Text className="font-display" style={{ fontSize: 18, color: secsLeft <= 5 ? SPY : C.ink }}>{secsLeft}s</Text>
        ) : null}
      </View>

      {room.result && (room.phase === 'guess' || room.phase === 'reveal') ? <Reveal room={room} myId={myId} /> : null}

      {myTurn ? (
        <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^a-zA-Z]/g, '').slice(0, 20))}
            placeholder="One word clue"
            placeholderTextColor={C.ink4}
            autoFocus
            autoCorrect={false}
            onSubmitEditing={sendClue}
            className="flex-1 rounded-xl border-2 bg-card px-4 font-display text-ink"
            style={{ height: 50, fontSize: 18, borderColor: VIOLET }}
          />
          <Button title="Send" variant="primary" onPress={sendClue} disabled={!text} />
        </View>
      ) : null}

      {room.phase === 'guess' && room.guesser === myId ? (
        <View className="flex-row items-center mb-4" style={{ gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, 30))}
            placeholder="Their word was…"
            placeholderTextColor={C.ink4}
            autoFocus
            autoCorrect={false}
            onSubmitEditing={guess}
            className="flex-1 rounded-xl border-2 bg-card px-4 font-display text-ink"
            style={{ height: 50, fontSize: 18, borderColor: SPY }}
          />
          <Button title="Guess" variant="primary" onPress={guess} disabled={!text.trim()} />
        </View>
      ) : null}

      {room.phase === 'vote' ? (
        <View className="flex-row flex-wrap mb-4" style={{ gap: 10 }}>
          {room.players.map((p) => {
            const mine = myVote === p.userId;
            const canVote = alive && !myVote && p.alive && p.userId !== myId;
            return (
              <Pressable key={p.userId} onPress={() => vote(p.userId)} onLongPress={() => onPlayer(p)} disabled={!canVote && !mine}
                accessibilityRole="button" accessibilityLabel={`Vote ${first(p)}`}
                className="items-center rounded-2xl border-2 bg-card py-3"
                style={{ width: '30%', flexGrow: 1, borderColor: mine ? SPY : C.line, opacity: p.alive ? 1 : 0.35 }}>
                <Avatar user={p} size={48} showBadge={false} />
                <Text className="font-sans text-ink text-xs mt-1" numberOfLines={1}>{p.userId === myId ? 'You' : first(p)}</Text>
                <Text className="text-xs mt-0.5" style={{ color: room.voted.includes(p.userId) ? CIV : C.ink3 }}>
                  {!p.alive ? 'out' : room.voted.includes(p.userId) ? 'voted ✓' : '…'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text className="font-display text-ink-2 uppercase mt-2 mb-2" style={{ letterSpacing: 1.2, fontSize: 12 }}>Clues</Text>
      {room.clues.length === 0 ? <Text className="font-sans text-ink-3">No clues yet.</Text> : null}
      {room.clues.map((c, i) => {
        const p = byId(c.userId);
        const newRound = i === 0 || room.clues[i - 1].round !== c.round;
        return (
          <View key={i}>
            {newRound ? <Text className="font-sans text-ink-3 text-xs mt-2 mb-1">Round {c.round}</Text> : null}
            <Pressable onPress={() => p && onPlayer(p)} className="flex-row items-center rounded-xl bg-card border border-line px-3 py-2 mb-2" style={{ gap: 10 }}>
              <Avatar user={p ?? { username: '?' }} size={28} showBadge={false} />
              <Text className="font-sans text-ink-2 flex-1" numberOfLines={1}>{c.userId === myId ? 'You' : first(p)}</Text>
              <Text className="font-display" style={{ fontSize: 16, color: c.text ? C.ink : C.ink3 }}>{c.text ?? 'skipped ⏳'}</Text>
            </Pressable>
          </View>
        );
      })}

      <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
        {room.players.map((p) => (
          <Pressable key={p.userId} onPress={() => onPlayer(p)} style={{ opacity: p.alive ? 1 : 0.35 }}>
            <View style={{ borderWidth: 2, borderRadius: 20, borderColor: room.turn === p.userId ? VIOLET : 'transparent' }}>
              <Avatar user={p} size={32} showBadge={false} />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
};

const Reveal = ({ room, myId }: { room: Room; myId: string }) => {
  const r = room.result!;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(2)), useNativeDriver: true }).start();
  }, [anim, r.out, room.round]);
  const out = room.players.find((p) => p.userId === r.out);
  const counts: Record<string, number> = {};
  Object.values(r.votes).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  const color = !r.out ? '#71717a' : r.wasSpy ? SPY : CIV;
  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], marginBottom: 16 }}>
      <View style={{ borderRadius: 20, padding: 18, alignItems: 'center', backgroundColor: color }}>
        {r.out ? (
          <>
            <Avatar user={out ?? { username: '?' }} size={64} showBadge={false} />
            <Text className="font-display" style={{ color: '#fff', fontSize: 22, marginTop: 8, textAlign: 'center' }}>
              {r.out === myId ? 'You were' : `${first(out)} was`} {r.wasSpy ? 'THE SPY! 🕵️' : 'innocent 😇'}
            </Text>
          </>
        ) : (
          <Text className="font-display" style={{ color: '#fff', fontSize: 20 }}>Tie vote. Nobody is out 🤝</Text>
        )}
        {r.guess ? (
          <Text className="font-sans" style={{ color: '#fff', marginTop: 6 }}>
            Guess: {r.guess.text ?? '(no guess)'} {r.guess.correct ? '✅' : '❌'}
          </Text>
        ) : null}
        <Text className="font-sans" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          {Object.entries(counts).map(([id, c]) => `${id === myId ? 'You' : first(room.players.find((p) => p.userId === id))} ${c}`).join(' · ') || 'No votes'}
        </Text>
      </View>
    </Animated.View>
  );
};

export default SpyGame;
