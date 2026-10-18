import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, ActivityIndicator, Share } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../../context/axiosConfig';
import { useAuth } from '../../../context/auth.context';
import socket from '../../../utils/socket';
import { C } from '../../../constants/colors';
import { tapHaptic } from '../../../utils/haptics';
import { AppBar, Button, IconBtn, Screen } from '../../ui/kit';
import { Alert } from '../../ui/AlertModal';
import Avatar from '../../Avatar';
import { Grid, Keyboard, MiniGrid, letterStates, useTileSize, type Row } from './Board';
import {
  MAX_GUESSES, WORD_LEN, dailyAnswer, isAllowed, isSolved, istDay, randomAnswer, scoreGuess, type Mark,
} from './wordRules';

/**
 * Word Duel: Wordle three ways.
 *  - Daily: one word per IST day for everyone, one attempt, share grid, local streak.
 *  - Endless: solo run; the streak is the score (WordSolo leaderboard).
 *  - Duel: 1v1 race on the same word, best of 3. Server holds the word and scores
 *    every guess (backend/controllers/wordDuel.socket.js); we only see the
 *    opponent's colours. Match wins go to the WordDuel leaderboard.
 */

type Player = { userId: string; name?: string; username?: string; avatar?: string };
type Phase = 'lobby' | 'daily' | 'endless' | 'searching' | 'code' | 'duel';
type RoundEnd = { round: number; secret: string; winnerId: string | null; wins: Record<string, number> };

const BRAND = '#5fa957';
const REVEAL_MS = WORD_LEN * 230 + 500; // matches the tile flip stagger in Board
const ROUND_MS = 3 * 60 * 1000;
const DAY_ONE = istDay(Date.UTC(2026, 9, 1));
const dailyKey = (day: number) => `word:daily:${day}`;
const STREAK_KEY = 'word:dailyStreak';
const ENDLESS_KEY = 'word:endless';

const errorHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
const winHaptic = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
const nameOf = (p?: Player | null) => (p?.name || p?.username || 'Opponent').split(' ')[0];

const load = async <T,>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const save = (key: string, v: unknown) => AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});

type DailyStreak = { last: number; streak: number; best: number };
type Endless = { answer: string; rows: Row[]; streak: number; best: number };

/** The typed row: letters, delete, and a shake counter for rejected words. */
const useEntry = () => {
  const [current, setCurrent] = useState('');
  const [shake, setShake] = useState(0);
  const type = (k: string) => {
    if (k === 'del') setCurrent((c) => c.slice(0, -1));
    else if (k.length === 1) setCurrent((c) => (c.length < WORD_LEN ? c + k : c));
  };
  // Client-side check for instant feedback; the server re-checks duel guesses.
  const check = (msg?: string) => {
    const bad = msg ?? (current.length < WORD_LEN ? 'Not enough letters' : !isAllowed(current) ? 'Not in word list' : '');
    if (!bad) return true;
    setShake((s) => s + 1);
    errorHaptic();
    Toast.show({ type: 'info', text1: bad, visibilityTime: 1200 });
    return false;
  };
  return { current, setCurrent, shake, type, check };
};

const WordDuel = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const myId = String(user?._id ?? '');

  const [phase, setPhase] = useState<Phase>('lobby');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [stats, setStats] = useState<{ daily: DailyStreak | null; dailyDone: boolean; endless: Endless | null }>({
    daily: null, dailyDone: false, endless: null,
  });

  // Duel state
  const [opponent, setOpponent] = useState<Player | null>(null);
  const [round, setRound] = useState<{ roomId: string; round: number; startedAt: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [oppRows, setOppRows] = useState<Mark[][]>([]);
  const [pending, setPending] = useState(false);
  const [wins, setWins] = useState<Record<string, number>>({});
  const [roundEnd, setRoundEnd] = useState<RoundEnd | null>(null);
  const [over, setOver] = useState<{ winnerId: string | null } | null>(null);
  const [rematch, setRematch] = useState<{ sent: boolean; asked: boolean }>({ sent: false, asked: false });
  const entry = useEntry();

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const roundRef = useRef(round);
  roundRef.current = round;
  const roomRef = useRef('');

  const loadStats = useCallback(async () => {
    const day = istDay();
    const [daily, today, endless] = await Promise.all([
      load<DailyStreak>(STREAK_KEY), load<{ rows: Row[] }>(dailyKey(day)), load<Endless>(ENDLESS_KEY),
    ]);
    const done = !!today && (today.rows.length >= MAX_GUESSES || today.rows.some((r) => isSolved(r.marks)));
    setStats({ daily, dailyDone: done, endless });
  }, []);
  useEffect(() => {
    if (phase === 'lobby') loadStats();
  }, [phase, loadStats]);

  useEffect(() => () => {
    if (['searching', 'code', 'duel'].includes(phaseRef.current)) socket.emit('word_cancel', {});
  }, []);

  useEffect(() => {
    const mine = (d: { roomId: string; round?: number }) =>
      d.roomId === roomRef.current && (d.round == null || d.round === roundRef.current?.round);
    const evts: Array<[string, (...a: any[]) => void]> = [
      ['word_searching', () => setPhase('searching')],
      ['word_code', (d: { code: string }) => { setCode(d.code); setPhase('code'); }],
      ['word_matched', (d: { roomId: string; opponent?: Player }) => {
        tapHaptic();
        roomRef.current = d.roomId;
        if (d.opponent) setOpponent(d.opponent);
        setRound(null);
        setRoundEnd(null);
        setOver(null);
        setRematch({ sent: false, asked: false });
        setPhase('duel');
      }],
      ['word_round', (d: { roomId: string; round: number; wins: Record<string, number> }) => {
        if (d.roomId !== roomRef.current) return;
        setRound({ roomId: d.roomId, round: d.round, startedAt: Date.now() });
        setRows([]);
        setOppRows([]);
        setPending(false);
        entry.setCurrent('');
        setWins(d.wins);
        setRoundEnd(null);
      }],
      ['word_result', (d: { roomId: string; round: number; row: number; word: string; marks: Mark[] }) => {
        if (!mine(d)) return;
        setRows((r) => { const n = [...r]; n[d.row] = { word: d.word, marks: d.marks }; return n; });
        entry.setCurrent('');
        // Keep the keyboard locked until the flip finishes.
        setTimeout(() => setPending(false), REVEAL_MS);
      }],
      ['word_invalid', (d: { roomId: string; round: number }) => {
        if (!mine(d)) return;
        setPending(false);
        entry.check('Not in word list');
      }],
      ['word_opp', (d: { roomId: string; round: number; row: number; marks: Mark[] }) => {
        if (!mine(d)) return;
        setOppRows((r) => { const n = [...r]; n[d.row] = d.marks; return n; });
      }],
      ['word_round_end', (d: RoundEnd & { roomId: string }) => {
        if (!mine(d)) return;
        setTimeout(() => {
          setRoundEnd(d);
          setWins(d.wins);
          if (d.winnerId === myId) winHaptic();
          else if (d.winnerId) errorHaptic();
        }, REVEAL_MS);
      }],
      ['word_over', (d: { roomId: string; winnerId: string | null }) => {
        if (d.roomId !== roomRef.current) return;
        setOver(d);
        if (d.winnerId === myId) winHaptic();
      }],
      ['word_rematch_asked', (d: { roomId: string }) => {
        if (d.roomId === roomRef.current) setRematch((r) => ({ ...r, asked: true }));
      }],
      ['word_left', () => {
        if (phaseRef.current !== 'duel') return;
        Toast.show({ type: 'info', text1: 'Your opponent left the game' });
        roomRef.current = '';
        setPhase('lobby');
      }],
      ['word_error', (msg: string) => {
        Toast.show({ type: 'error', text1: typeof msg === 'string' ? msg : 'Something went wrong' });
        setPending(false);
        if (phaseRef.current !== 'duel') setPhase('lobby');
      }],
    ];
    evts.forEach(([e, fn]) => socket.on(e, fn));
    return () => evts.forEach(([e, fn]) => socket.off(e, fn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  const me = () => ({ name: user?.name, username: user?.username, avatar: user?.avatar });
  const ready = () => {
    if (socket.connected) return true;
    Toast.show({ type: 'error', text1: 'Connecting… try again in a moment' });
    return false;
  };
  const findRandom = () => { if (ready()) { setPhase('searching'); socket.emit('word_find', me()); } };
  const createCode = () => { if (ready()) socket.emit('word_create', me()); };
  const join = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 6) return Toast.show({ type: 'error', text1: 'Enter the 6-letter code' });
    if (ready()) socket.emit('word_join', { code: c, ...me() });
  };
  const cancel = () => {
    socket.emit('word_cancel', {});
    roomRef.current = '';
    setPhase('lobby');
  };

  const duelKey = (k: string) => {
    if (!round || pending || roundEnd || rows.length >= MAX_GUESSES || rows.some((r) => isSolved(r.marks))) return;
    if (k !== 'enter') return entry.type(k);
    if (!entry.check()) return;
    setPending(true);
    socket.emit('word_guess', { roomId: round.roomId, round: round.round, word: entry.current });
  };

  const safety = () => {
    if (!opponent) return;
    Alert.alert(opponent.name || 'This player', 'Something not right?', [
      {
        text: 'Report',
        onPress: () => {
          axios
            .post('/safety/report', { targetType: 'user', targetId: opponent.userId, reason: 'Word Duel match' })
            .then(() => Toast.show({ type: 'success', text1: 'Reported. Thanks for keeping Fync safe.' }))
            .catch(() => Toast.show({ type: 'error', text1: 'Could not report, try again' }));
        },
      },
      {
        text: 'Block and leave',
        style: 'destructive',
        onPress: () => {
          axios.post('/safety/block', { userId: opponent.userId }).catch(() => {});
          cancel();
          Toast.show({ type: 'success', text1: "Blocked. You won't be matched again." });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onBack = () => {
    if (phase === 'duel' && !over) {
      return Alert.alert('Leave the duel?', 'Your opponent will be told you left.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => { cancel(); navigation.goBack(); } },
      ]);
    }
    if (phase === 'daily' || phase === 'endless') return setPhase('lobby');
    if (phase !== 'lobby') cancel();
    navigation.goBack();
  };

  const title = phase === 'daily' ? 'Daily Word' : phase === 'endless' ? 'Endless' : 'Word Duel';

  return (
    <Screen>
      <AppBar
        title={title}
        onBack={onBack}
        right={phase === 'duel' && opponent ? <IconBtn name="flag-outline" onPress={safety} /> : undefined}
      />
      {phase === 'daily' || phase === 'endless' ? (
        <Solo daily={phase === 'daily'} />
      ) : phase === 'duel' ? (
        over ? (
          <Over
            won={over.winnerId === myId}
            draw={!over.winnerId}
            myWins={wins[myId] ?? 0}
            oppWins={opponent ? wins[opponent.userId] ?? 0 : 0}
            opponent={opponent}
            rematch={rematch}
            onRematch={() => {
              setRematch((r) => ({ ...r, sent: true }));
              socket.emit('word_rematch', { roomId: roomRef.current });
            }}
            onLeaderboard={() => navigation.navigate('GameLeaderboard', { gameName: 'WordDuel', title: 'Word Duel' })}
            onMenu={cancel}
          />
        ) : (
          <Duel
            myId={myId}
            opponent={opponent}
            round={round}
            rows={rows}
            oppRows={oppRows}
            wins={wins}
            roundEnd={roundEnd}
            entry={entry}
            pending={pending}
            onKey={duelKey}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {phase === 'searching' || phase === 'code' ? (
            <View className="rounded-2xl border border-line bg-card p-6 items-center">
              <Ionicons name="flash" size={44} color={BRAND} />
              {phase === 'searching' ? (
                <>
                  <ActivityIndicator color={C.brand[500]} style={{ marginTop: 16 }} />
                  <Text className="font-sans text-ink-2 mt-3 text-center">Finding an opponent…</Text>
                </>
              ) : (
                <>
                  <Text className="font-sans text-ink-2 mt-3 text-center">Send this code to a friend</Text>
                  <Text selectable className="font-display text-ink mt-2" style={{ fontSize: 34, letterSpacing: 6 }}>{code}</Text>
                  <Button
                    title="Share code"
                    icon="share-social-outline"
                    variant="primary"
                    style={{ marginTop: 14 }}
                    onPress={() => Share.share({ message: `Word Duel me on Fync ⚔️ Open Games → Word Duel and enter code ${code}` }).catch(() => {})}
                  />
                  <Text className="font-sans text-ink-3 text-xs mt-3">Waiting for them to join · code works for 10 min</Text>
                </>
              )}
              <Button title="Cancel" variant="ghost" small style={{ marginTop: 10 }} onPress={cancel} />
            </View>
          ) : (
            <Lobby
              stats={stats}
              joinCode={joinCode}
              setJoinCode={setJoinCode}
              onJoin={join}
              onDaily={() => setPhase('daily')}
              onEndless={() => setPhase('endless')}
              onRandom={findRandom}
              onInvite={createCode}
              onBoard={(gameName, t) => navigation.navigate('GameLeaderboard', { gameName, title: t })}
            />
          )}
        </ScrollView>
      )}
    </Screen>
  );
};

/* ------------------------------------------------------------------ lobby */

const ModeCard = ({ icon, tint, title, hint, children }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; title: string; hint: string; children: React.ReactNode;
}) => (
  <View className="rounded-2xl border border-line bg-card mb-3 overflow-hidden">
    <View className="flex-row items-center p-4" style={{ backgroundColor: `${tint}${C.scheme === 'dark' ? '26' : '14'}` }}>
      <View className="items-center justify-center rounded-xl" style={{ width: 48, height: 48, backgroundColor: tint }}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>
      <View className="flex-1 ml-3">
        <Text className="font-display text-ink" style={{ fontSize: 16 }}>{title}</Text>
        <Text className="font-sans text-ink-2 text-sm mt-0.5">{hint}</Text>
      </View>
    </View>
    <View className="flex-row p-3" style={{ gap: 10 }}>{children}</View>
  </View>
);

const Lobby = ({ stats, joinCode, setJoinCode, onJoin, onDaily, onEndless, onRandom, onInvite, onBoard }: {
  stats: { daily: DailyStreak | null; dailyDone: boolean; endless: Endless | null };
  joinCode: string; setJoinCode: (s: string) => void; onJoin: () => void;
  onDaily: () => void; onEndless: () => void; onRandom: () => void; onInvite: () => void;
  onBoard: (gameName: string, title: string) => void;
}) => {
  const day = istDay();
  const d = stats.daily;
  const dailyStreak = d && d.last >= day - 1 ? d.streak : 0;
  return (
    <>
      <View className="rounded-2xl overflow-hidden mb-6 p-5" style={{ backgroundColor: BRAND }}>
        <View className="flex-row mb-3" style={{ gap: 4 }}>
          {'WORDS'.split('').map((l, i) => (
            <View key={i} className="items-center justify-center rounded-md"
              style={{ width: 34, height: 34, backgroundColor: i === 1 || i === 3 ? '#c9a93a' : 'rgba(255,255,255,0.22)' }}>
              <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 17 }}>{l}</Text>
            </View>
          ))}
        </View>
        <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 26 }}>Guess the word in 6</Text>
        <Text className="font-sans mt-1.5" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
          Green = right spot, yellow = wrong spot. Race a friend to it, or keep your streak alive solo.
        </Text>
      </View>

      <ModeCard icon="flash" tint="#ef4444" title="1v1 Race" hint="Same word, live colours, best of 3. First to solve takes the round.">
        <Button title="Invite friend" icon="people-outline" small variant="primary" inCard style={{ flex: 1 }} onPress={onInvite} />
        <Button title="Random match" icon="shuffle" small style={{ flex: 1 }} onPress={onRandom} />
      </ModeCard>
      <View className="flex-row items-center mb-5" style={{ gap: 10 }}>
        <TextInput
          value={joinCode}
          onChangeText={(t) => setJoinCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
          placeholder="Have a code?"
          placeholderTextColor={C.ink4}
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={onJoin}
          className="flex-1 rounded-xl border border-line bg-card px-4 font-display text-ink"
          style={{ height: 48, fontSize: 16, letterSpacing: 3 }}
        />
        <Button title="Join" variant="solid" onPress={onJoin} disabled={joinCode.length !== 6} />
      </View>

      <ModeCard
        icon="calendar"
        tint={BRAND}
        title="Daily Word"
        hint={`Same word for everyone today.${dailyStreak ? ` 🔥 ${dailyStreak} day streak` : ''}`}
      >
        <Button title={stats.dailyDone ? 'See today’s result' : 'Play today'} icon="play" small variant="primary" inCard style={{ flex: 1 }} onPress={onDaily} />
      </ModeCard>
      <ModeCard
        icon="infinite"
        tint="#8b5cf6"
        title="Endless"
        hint={`Solve word after word. One miss ends the run.${stats.endless?.best ? ` Best: ${stats.endless.best}` : ''}`}
      >
        <Button title={stats.endless?.streak ? `Continue (${stats.endless.streak})` : 'Start run'} icon="play" small variant="primary" inCard style={{ flex: 1 }} onPress={onEndless} />
      </ModeCard>

      <View className="flex-row mt-2" style={{ gap: 10 }}>
        <Button title="Duel wins" icon="trophy-outline" small style={{ flex: 1 }} onPress={() => onBoard('WordDuel', 'Word Duel wins')} />
        <Button title="Best streaks" icon="podium-outline" small style={{ flex: 1 }} onPress={() => onBoard('WordSolo', 'Word Endless')} />
      </View>
      <Text className="font-sans text-ink-3 text-xs mt-4 text-center">
        Opponents only see your colours until the round ends. Tap the flag in a duel to report or block.
      </Text>
    </>
  );
};

/* ------------------------------------------------------------------- solo */

const Solo = ({ daily }: { daily: boolean }) => {
  const [day] = useState(istDay);
  const [answer, setAnswer] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [gameNo, setGameNo] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const entry = useEntry();
  const size = useTileSize(150);

  const won = rows.some((r) => isSolved(r.marks));
  const lost = !won && rows.length >= MAX_GUESSES;
  // Hold the result panel until the last row has flipped.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    (async () => {
      if (daily) {
        const [today, s] = await Promise.all([load<{ rows: Row[] }>(dailyKey(day)), load<DailyStreak>(STREAK_KEY)]);
        setAnswer(dailyAnswer());
        setRows(today?.rows ?? []);
        setStreak(s && s.last >= day - 1 ? s.streak : 0);
        setBest(s?.best ?? 0);
      } else {
        const e = await load<Endless>(ENDLESS_KEY);
        setAnswer(e?.answer || randomAnswer());
        setRows(e?.rows ?? []);
        setStreak(e?.streak ?? 0);
        setBest(e?.best ?? 0);
      }
      setShown(true);
      setLoaded(true);
    })();
  }, [daily, day]);

  const finish = async (next: Row[], solved: boolean) => {
    if (daily) {
      const s = (await load<DailyStreak>(STREAK_KEY)) ?? { last: -1, streak: 0, best: 0 };
      const streakNow = solved ? (s.last === day - 1 ? s.streak + 1 : s.last === day ? s.streak : 1) : 0;
      const b = Math.max(s.best, streakNow);
      save(STREAK_KEY, { last: solved ? day : -1, streak: streakNow, best: b });
      setStreak(streakNow);
      setBest(b);
      return;
    }
    const streakNow = solved ? streak + 1 : 0;
    const b = Math.max(best, streakNow);
    setStreak(streakNow);
    setBest(b);
    save(ENDLESS_KEY, { answer, rows: next, streak: streakNow, best: b });
    // Server keeps the max; every solve counts so a closed app never loses a best.
    if (solved) axios.post('/games/score', { gameName: 'WordSolo', score: Math.min(streakNow, 500) }).catch(() => {});
  };

  const onKey = (k: string) => {
    if (!loaded || busy || won || lost) return;
    if (k !== 'enter') return entry.type(k);
    if (!entry.check()) return;
    const marks = scoreGuess(entry.current, answer);
    const next = [...rows, { word: entry.current, marks }];
    const solved = isSolved(marks);
    setRows(next);
    entry.setCurrent('');
    setBusy(true);
    setShown(false);
    if (daily) save(dailyKey(day), { rows: next });
    else if (!solved && next.length < MAX_GUESSES) save(ENDLESS_KEY, { answer, rows: next, streak, best });
    if (solved || next.length >= MAX_GUESSES) finish(next, solved);
    setTimeout(() => {
      setBusy(false);
      setShown(true);
      if (solved) winHaptic();
      else if (next.length >= MAX_GUESSES) errorHaptic();
    }, REVEAL_MS);
  };

  const nextWord = () => {
    const a = randomAnswer();
    setAnswer(a);
    setRows([]);
    setGameNo((n) => n + 1);
    save(ENDLESS_KEY, { answer: a, rows: [], streak, best });
  };

  const share = () => {
    const grid = rows.map((r) => r.marks.map((m) => (m === 2 ? '🟩' : m === 1 ? '🟨' : '⬛')).join('')).join('\n');
    Share.share({ message: `Fync Daily Word #${day - DAY_ONE + 1} ${won ? rows.length : 'X'}/6 🔥${streak}\n\n${grid}` }).catch(() => {});
  };

  const done = (won || lost) && shown;
  return (
    <View className="flex-1">
      <View className="flex-row justify-center py-2" style={{ gap: 18 }}>
        <Text className="font-display text-ink-2">{daily ? 'Day streak' : 'Streak'} 🔥 {streak}</Text>
        <Text className="font-display text-ink-3">Best {best}</Text>
      </View>
      <View className="flex-1 justify-center">
        {loaded ? <Grid key={gameNo} rows={rows} current={entry.current} shake={entry.shake} size={size} /> : null}
      </View>
      {done ? (
        <View className="mx-5 mb-6 rounded-2xl border border-line bg-card p-5 items-center">
          <Text className="font-display text-ink" style={{ fontSize: 20 }}>
            {won ? ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][rows.length - 1] : 'So close'}
          </Text>
          <Text className="font-sans text-ink-2 mt-1">
            The word was <Text className="font-display text-ink">{answer.toUpperCase()}</Text>
          </Text>
          <View className="flex-row mt-4" style={{ gap: 10 }}>
            {daily ? (
              <Button title="Share" icon="share-social-outline" variant="primary" inCard onPress={share} />
            ) : (
              <Button title={won ? 'Next word' : 'New run'} icon="arrow-forward" variant="primary" inCard onPress={nextWord} />
            )}
          </View>
          {daily ? <Text className="font-sans text-ink-3 text-xs mt-3">New word at midnight IST</Text> : null}
        </View>
      ) : (
        <Keyboard states={letterStates(shown ? rows : rows.slice(0, -1))} onKey={onKey} disabled={busy} />
      )}
    </View>
  );
};

/* ------------------------------------------------------------------- duel */

const Countdown = ({ startedAt, stop }: { startedAt: number; stop: boolean }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (stop) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stop]);
  const left = Math.max(0, Math.ceil((startedAt + ROUND_MS - now) / 1000));
  return (
    <Text className="font-display" style={{ color: left <= 20 ? C.danger : C.ink3, fontVariant: ['tabular-nums'] }}>
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </Text>
  );
};

const Duel = ({ myId, opponent, round, rows, oppRows, wins, roundEnd, entry, pending, onKey }: {
  myId: string; opponent: Player | null; round: { round: number; startedAt: number } | null;
  rows: Row[]; oppRows: Mark[][]; wins: Record<string, number>; roundEnd: RoundEnd | null;
  entry: ReturnType<typeof useEntry>; pending: boolean; onKey: (k: string) => void;
}) => {
  const size = useTileSize(250);
  if (!round) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Avatar user={opponent} size={72} showBadge={false} />
        <Text className="font-display text-ink text-lg mt-4">vs {nameOf(opponent)} ⚔️</Text>
        <Text className="font-sans text-ink-2 mt-1">Best of 3 · get ready…</Text>
      </View>
    );
  }
  const solved = rows.some((r) => isSolved(r.marks));
  const outOfGuesses = !solved && rows.length >= MAX_GUESSES;
  const oppId = opponent?.userId ?? '';
  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-5 py-2">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <Avatar user={opponent} size={36} showBadge={false} />
          <View>
            <Text className="font-display text-ink" numberOfLines={1}>{nameOf(opponent)}</Text>
            <Text className="font-sans text-ink-3 text-xs">Round {round.round + 1} · best of 3</Text>
          </View>
          <MiniGrid rows={oppRows} size={9} />
        </View>
        <View className="items-end">
          <Text className="font-display text-ink" style={{ fontSize: 20 }}>{wins[myId] ?? 0} – {wins[oppId] ?? 0}</Text>
          <Countdown startedAt={round.startedAt} stop={!!roundEnd} />
        </View>
      </View>
      <View className="flex-1 justify-center">
        <Grid key={round.round} rows={rows} current={entry.current} shake={entry.shake} size={size} />
      </View>
      {roundEnd ? (
        <View className="mx-5 mb-6 rounded-2xl border border-line bg-card p-5 items-center">
          <Text className="font-display text-ink" style={{ fontSize: 20 }}>
            {roundEnd.winnerId === myId ? 'Round yours! 🎉' : roundEnd.winnerId ? `${nameOf(opponent)} takes it` : 'Draw round'}
          </Text>
          <Text className="font-sans text-ink-2 mt-1">
            The word was <Text className="font-display text-ink">{roundEnd.secret.toUpperCase()}</Text>
          </Text>
          <Text className="font-sans text-ink-3 text-xs mt-3">Next round coming up…</Text>
        </View>
      ) : solved || outOfGuesses ? (
        <View className="mx-5 mb-6 rounded-2xl border border-line bg-card p-5 items-center">
          <ActivityIndicator color={C.brand[500]} />
          <Text className="font-sans text-ink-2 mt-2">{solved ? 'Solved! Wrapping up…' : `Out of guesses — waiting for ${nameOf(opponent)}…`}</Text>
        </View>
      ) : (
        <Keyboard states={letterStates(pending ? rows.slice(0, -1) : rows)} onKey={onKey} disabled={pending} />
      )}
    </View>
  );
};

const Over = ({ won, draw, myWins, oppWins, opponent, rematch, onRematch, onLeaderboard, onMenu }: {
  won: boolean; draw: boolean; myWins: number; oppWins: number; opponent: Player | null;
  rematch: { sent: boolean; asked: boolean }; onRematch: () => void; onLeaderboard: () => void; onMenu: () => void;
}) => (
  <View className="flex-1 items-center justify-center p-8">
    <Text style={{ fontSize: 64 }}>{won ? '🏆' : draw ? '🤝' : '😤'}</Text>
    <Text className="font-display text-ink mt-3" style={{ fontSize: 28 }}>{won ? 'You win!' : draw ? 'It’s a draw' : `${nameOf(opponent)} wins`}</Text>
    <Text className="font-display text-ink-2 mt-1" style={{ fontSize: 18 }}>{myWins} – {oppWins}</Text>
    {rematch.asked && !rematch.sent ? (
      <Text className="font-sans text-ink-2 mt-4">{nameOf(opponent)} wants a rematch!</Text>
    ) : null}
    <Button
      title={rematch.sent ? `Waiting for ${nameOf(opponent)}…` : 'Rematch'}
      icon="refresh"
      variant="primary"
      disabled={rematch.sent}
      style={{ marginTop: 20 }}
      onPress={() => { tapHaptic(); onRematch(); }}
    />
    <View className="flex-row mt-3" style={{ gap: 10 }}>
      <Button title="Leaderboard" icon="trophy-outline" small onPress={onLeaderboard} />
      <Button title="Menu" icon="grid-outline" small onPress={onMenu} />
    </View>
  </View>
);

export default WordDuel;
