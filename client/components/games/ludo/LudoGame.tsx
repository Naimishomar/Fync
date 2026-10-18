import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, Share, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, cancelAnimation, Easing,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import LudoBoard, { LUDO_COLORS, LUDO_NAMES } from './LudoBoard';
import { newGame, roll, move, botPick, type LudoState, type Capture } from './ludoRules';

/**
 * Ludo. Vs Computer runs fully on the phone (ludoRules.ts). Online games (1v1,
 * 4-player, friends room by code) run on the server
 * (backend/controllers/ludo.socket.js), which rolls every die; this screen
 * renders its events and sends "roll" / "move token".
 */

type Player = { userId?: string | null; name?: string; username?: string; avatar?: string; bot?: boolean; left?: boolean };
type Phase = 'lobby' | 'searching' | 'room' | 'playing';
type Lobby = { code: string; hostId: string; members: Player[] };
type RoomMode = 'offline' | 'random2' | 'random4' | 'friends';

const BRAND = '#E53935';
const firstName = (p?: Player | null) => (p?.name || p?.username || 'Player').split(' ')[0];
const captureHaptic = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

const LudoGame = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const myId = String(user?._id ?? '');
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 24, 440);

  const [phase, setPhase] = useState<Phase>('lobby');
  const [mode, setMode] = useState<RoomMode>('offline');
  const [searchSize, setSearchSize] = useState(2);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [game, setGame] = useState<LudoState | null>(null);
  const [mySeat, setMySeat] = useState(0);
  const [lastRoll, setLastRoll] = useState<{ seat: number; value: number; key: number; note?: string } | null>(null);
  const [votes, setVotes] = useState<string[]>([]);
  const [turnMs, setTurnMs] = useState(15000);
  const busy = useRef(false); // one tap per server round trip

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const online = mode !== 'offline';

  // Leaving the screen frees the seat (a bot takes it), the lobby or the queue.
  useEffect(() => () => {
    if (modeRef.current !== 'offline' && phaseRef.current !== 'lobby') socket.emit('ludo_leave', {});
  }, []);

  const rolled = (seat: number, value: number, note?: string) =>
    setLastRoll((r) => ({ seat, value, key: (r?.key ?? 0) + 1, note }));
  const onCaptures = (captured: Capture[]) => {
    if (captured.length) captureHaptic();
  };

  useEffect(() => {
    const onSearching = (d: { size: number }) => {
      setSearchSize(d.size);
      setPhase('searching');
    };
    const onLobby = (d: Lobby) => {
      setLobby(d);
      setMode('friends');
      setPhase('room');
    };
    const onLobbyClosed = () => {
      if (phaseRef.current !== 'room') return;
      Toast.show({ type: 'info', text1: 'The host closed the room' });
      setPhase('lobby');
    };
    const onStart = (d: { roomId: string; mode: RoomMode; players: Player[]; game: LudoState; turnMs: number }) => {
      tapHaptic();
      busy.current = false;
      setRoomId(d.roomId);
      setMode(d.mode);
      setPlayers(d.players);
      setMySeat(Math.max(0, d.players.findIndex((p) => p.userId === myId)));
      setGame(d.game);
      setTurnMs(d.turnMs || 15000);
      setLastRoll(null);
      setVotes([]);
      setPhase('playing');
    };
    const onRolled = (d: { game: LudoState; seat: number; dice: number; forfeit: boolean; passed: boolean }) => {
      busy.current = false;
      rolled(d.seat, d.dice, d.forfeit ? 'Three 6s in a row — turn lost' : d.passed ? 'No move' : undefined);
      setGame(d.game);
    };
    const onMoved = (d: { game: LudoState; captured: Capture[] }) => {
      busy.current = false;
      onCaptures(d.captured);
      setGame(d.game);
    };
    const onPlayers = (d: { players: Player[] }) => setPlayers(d.players);
    const onOver = (d: { players: Player[]; winner: number }) => {
      setPlayers(d.players);
      setGame((g) => (g ? { ...g, phase: 'over', winner: d.winner } : g));
    };
    const onVotes = (d: { votes: string[] }) => setVotes(d.votes);
    const onError = (msg: string) => {
      busy.current = false;
      Toast.show({ type: 'error', text1: typeof msg === 'string' ? msg : 'Something went wrong' });
      if (phaseRef.current === 'searching') setPhase('lobby');
    };
    const evts: [string, (...a: any[]) => void][] = [
      ['ludo_searching', onSearching], ['ludo_lobby', onLobby], ['ludo_lobby_closed', onLobbyClosed],
      ['ludo_start', onStart], ['ludo_rolled', onRolled], ['ludo_moved', onMoved],
      ['ludo_bot', onPlayers], ['ludo_left', onPlayers], ['ludo_over', onOver],
      ['ludo_rematch_vote', onVotes], ['ludo_error', onError],
    ];
    evts.forEach(([e, fn]) => socket.on(e, fn));
    // Detach only this screen's listeners: the socket is shared app-wide.
    return () => evts.forEach(([e, fn]) => socket.off(e, fn));
  }, [myId]);

  /* ---------------------------------------------------------- offline engine */
  const localRoll = (g: LudoState) => {
    const r = roll(g, 1 + Math.floor(Math.random() * 6));
    rolled(g.turn, r.dice, r.forfeit ? 'Three 6s in a row — turn lost' : r.passed ? 'No move' : undefined);
    setGame(r.game);
  };
  const localMove = (g: LudoState, t: number) => {
    const r = move(g, t);
    onCaptures(r.captured);
    setGame(r.game);
  };

  // Bots play their turns; a single possible move plays itself (Ludo King style).
  useEffect(() => {
    if (mode !== 'offline' || phase !== 'playing' || !game || game.phase === 'over') return;
    const bot = game.turn !== mySeat;
    const forced = game.phase === 'move' && game.movable.length === 1;
    if (!bot && !forced) return;
    const t = setTimeout(() => {
      if (game.phase === 'roll') localRoll(game);
      else localMove(game, bot ? botPick(game) : game.movable[0]);
    }, game.phase === 'roll' ? 900 : 700);
    return () => clearTimeout(t);
    // localRoll/localMove only call setters; the effect re-runs on every new game state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, mode, phase, mySeat]);

  /* ----------------------------------------------------------------- actions */
  const profile = () => ({ name: user?.name, username: user?.username, avatar: user?.avatar });
  const ready = () => {
    if (!socket.connected) {
      Toast.show({ type: 'error', text1: 'Connecting… try again in a moment' });
      return false;
    }
    return true;
  };

  const playComputer = (bots: 1 | 3) => {
    const g = newGame(bots + 1);
    setMode('offline');
    setPlayers([
      { userId: myId, name: user?.name || 'You', avatar: user?.avatar },
      ...Array.from({ length: bots }, (_, i) => ({ name: bots === 1 ? 'Computer' : `Bot ${i + 1}`, bot: true })),
    ]);
    setMySeat(0);
    setGame(g);
    setLastRoll(null);
    setPhase('playing');
  };
  const findRandom = (size: 2 | 4) => {
    if (!ready()) return;
    setSearchSize(size);
    setMode(size === 2 ? 'random2' : 'random4');
    setPhase('searching');
    socket.emit('ludo_find', { size, ...profile() });
  };
  const createRoom = () => {
    if (!ready()) return;
    socket.emit('ludo_create', profile());
  };
  const join = () => {
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 6) {
      Toast.show({ type: 'error', text1: 'Enter the 6-letter code' });
      return;
    }
    if (!ready()) return;
    socket.emit('ludo_join', { code: c, ...profile() });
  };
  const leaveOnline = () => {
    socket.emit('ludo_leave', {});
    setPhase('lobby');
  };

  const myTurn = !!game && game.turn === mySeat && game.phase !== 'over' && !(online && players[mySeat]?.bot);
  const onRoll = () => {
    if (!game || !myTurn || game.phase !== 'roll') return;
    selectHaptic();
    if (!online) return localRoll(game);
    if (busy.current) return;
    busy.current = true;
    socket.emit('ludo_roll', { roomId });
  };
  const onMove = (t: number) => {
    if (!game || !myTurn || game.phase !== 'move') return;
    selectHaptic();
    if (!online) return localMove(game, t);
    if (busy.current) return;
    busy.current = true;
    socket.emit('ludo_move', { roomId, token: t });
  };
  const rematch = () => {
    if (!online) return playComputer((players.length - 1) as 1 | 3);
    socket.emit('ludo_rematch', { roomId });
    setVotes((v) => (v.includes(myId) ? v : [...v, myId]));
  };

  const safety = () => {
    const others = players.filter((p) => p.userId && p.userId !== myId);
    if (!others.length) return;
    const act = (p: Player) => Alert.alert(firstName(p), 'Something not right?', [
      {
        text: 'Report',
        onPress: () => {
          axios
            .post('/safety/report', { targetType: 'user', targetId: p.userId, reason: 'Ludo match' })
            .then(() => Toast.show({ type: 'success', text1: 'Reported. Thanks for keeping Fync safe.' }))
            .catch(() => Toast.show({ type: 'error', text1: 'Could not report, try again' }));
        },
      },
      {
        text: 'Block and leave',
        style: 'destructive',
        onPress: () => {
          axios.post('/safety/block', { userId: p.userId }).catch(() => {});
          leaveOnline();
          Toast.show({ type: 'success', text1: "Blocked. You won't be matched again." });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
    if (others.length === 1) return act(others[0]);
    Alert.alert('Report a player', undefined, [
      ...others.map((p) => ({ text: firstName(p), onPress: () => act(p) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const back = () => {
    if (phase === 'playing' && game?.phase !== 'over') {
      return Alert.alert('Leave game?', online ? 'A bot will take your seat.' : 'This game will be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => (online ? leaveOnline() : setPhase('lobby')) },
      ]);
    }
    if (phase === 'playing' || phase === 'searching' || phase === 'room') return online ? leaveOnline() : setPhase('lobby');
    navigation.goBack();
  };

  const random = mode === 'random2' || mode === 'random4';

  return (
    <Screen>
      <AppBar
        title="Ludo"
        onBack={back}
        right={
          phase === 'playing' && random ? <IconBtn name="flag-outline" onPress={safety} />
            : phase === 'lobby' ? <IconBtn name="trophy-outline" onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'Ludo', title: 'Ludo' })} />
              : undefined
        }
      />
      {phase === 'playing' && game ? (
        <Playing
          game={game}
          players={players}
          mySeat={mySeat}
          myId={myId}
          online={online}
          myTurn={myTurn}
          lastRoll={lastRoll}
          boardSize={boardSize}
          turnMs={turnMs}
          votes={votes}
          onRoll={onRoll}
          onMove={onMove}
          onResume={() => socket.emit('ludo_resume', { roomId })}
          onRematch={rematch}
          onExit={() => (online ? leaveOnline() : setPhase('lobby'))}
          onBoard={() => navigation.navigate('GameLeaderboard', { gameName: 'Ludo', title: 'Ludo' })}
        />
      ) : phase === 'searching' ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text style={{ fontSize: 56 }}>🎲</Text>
          <ActivityIndicator color={C.brand[500]} style={{ marginTop: 16 }} />
          <Text className="font-display text-ink text-lg mt-3 text-center">
            {searchSize === 2 ? 'Finding an opponent…' : 'Finding players…'}
          </Text>
          {searchSize === 4 ? (
            <Text className="font-sans text-ink-2 mt-2 text-center">Starts with 4, or with bots in the empty seats once 2 are waiting 20s.</Text>
          ) : null}
          <Button title="Cancel" variant="ghost" style={{ marginTop: 16 }} onPress={leaveOnline} />
        </View>
      ) : phase === 'room' && lobby ? (
        <RoomLobby lobby={lobby} myId={myId} onStart={() => socket.emit('ludo_start_room', {})} onLeave={leaveOnline} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View className="rounded-2xl overflow-hidden mb-6" style={{ backgroundColor: BRAND }}>
            <View className="p-5 flex-row items-center">
              <View className="flex-1 pr-3">
                <Text className="font-display" style={{ color: '#FFFFFF', fontSize: 24, lineHeight: 28 }}>Ludo</Text>
                <Text className="font-sans mt-1.5" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                  Roll a 6 to get out, knock friends back to base, bring all four home first.
                </Text>
              </View>
              <View className="flex-row flex-wrap" style={{ width: 64, gap: 4 }}>
                {LUDO_COLORS.map((c) => <View key={c} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 3, borderColor: '#fff' }} />)}
              </View>
            </View>
          </View>

          <Section title="Play online" />
          <View className="flex-row mb-6" style={{ gap: 10 }}>
            <Button title="1 vs 1" icon="flash" variant="primary" style={{ flex: 1 }} onPress={() => findRandom(2)} />
            <Button title="4 players" icon="people" style={{ flex: 1 }} onPress={() => findRandom(4)} />
          </View>

          <Section title="Play with friends" />
          <View className="rounded-2xl border border-line bg-card p-4 mb-6">
            <Button title="Create a room" icon="add-circle-outline" variant="primary" inCard onPress={createRoom} />
            <View className="flex-row items-center mt-3" style={{ gap: 10 }}>
              <TextInput
                value={joinCode}
                onChangeText={(t) => setJoinCode(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
                placeholder="ROOM CODE"
                placeholderTextColor={C.ink4}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={join}
                className="flex-1 rounded-xl border border-line bg-paper px-4 font-display text-ink"
                style={{ height: 48, fontSize: 18, letterSpacing: 4 }}
              />
              <Button title="Join" variant="solid" onPress={join} disabled={joinCode.length !== 6} />
            </View>
          </View>

          <Section title="Vs computer · offline" />
          <View className="flex-row mb-6" style={{ gap: 10 }}>
            <Button title="1 bot" icon="hardware-chip-outline" style={{ flex: 1 }} onPress={() => playComputer(1)} />
            <Button title="3 bots" icon="hardware-chip-outline" style={{ flex: 1 }} onPress={() => playComputer(3)} />
          </View>

          <Text className="font-sans text-ink-3 text-xs text-center">
            Online wins count on the Ludo leaderboard. Random players only see your name and photo; tap the flag in a game to report or block.
          </Text>
        </ScrollView>
      )}
    </Screen>
  );
};

const Section = ({ title }: { title: string }) => (
  <Text className="font-display text-label text-ink-2 uppercase mb-2" style={{ letterSpacing: 1.2 }}>{title}</Text>
);

const RoomLobby = ({ lobby, myId, onStart, onLeave }: { lobby: Lobby; myId: string; onStart: () => void; onLeave: () => void }) => {
  const host = lobby.hostId === myId;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View className="rounded-2xl border border-line bg-card p-6 items-center mb-4">
        <Text className="font-sans text-ink-2 text-center">Room code</Text>
        <Text selectable className="font-display text-ink mt-1" style={{ fontSize: 34, letterSpacing: 6 }}>{lobby.code}</Text>
        <Button
          title="Share code"
          icon="share-social-outline"
          variant="primary"
          style={{ marginTop: 12 }}
          onPress={() => Share.share({ message: `Ludo on Fync 🎲 Open Games → Ludo and join room ${lobby.code}` }).catch(() => {})}
        />
      </View>
      <Text className="font-display text-label text-ink-2 uppercase mb-2" style={{ letterSpacing: 1.2 }}>
        Players {lobby.members.length}/4
      </Text>
      {lobby.members.map((m, i) => (
        <View key={m.userId || i} className="flex-row items-center rounded-xl border border-line bg-card p-3 mb-2">
          <Avatar user={m} size={36} showBadge={false} />
          <Text className="font-display text-ink ml-3 flex-1" numberOfLines={1}>{m.name || m.username || 'Player'}</Text>
          {m.userId === lobby.hostId ? <Text className="font-sans text-ink-3 text-xs">Host</Text> : null}
        </View>
      ))}
      {host ? (
        <Button
          title={lobby.members.length < 2 ? 'Waiting for friends…' : `Start game (${lobby.members.length} players)`}
          icon="play"
          variant="primary"
          block
          disabled={lobby.members.length < 2}
          style={{ marginTop: 12 }}
          onPress={onStart}
        />
      ) : (
        <Text className="font-sans text-ink-2 text-center mt-4">Waiting for the host to start…</Text>
      )}
      <Button title="Leave room" variant="ghost" style={{ marginTop: 10 }} onPress={onLeave} />
    </ScrollView>
  );
};

/* --------------------------------------------------------------------- dice */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

const Dice = ({ value, rollKey, color, active, onPress }: { value: number | null; rollKey: number; color: string; active: boolean; onPress: () => void }) => {
  const [face, setFace] = useState(value ?? 6);
  const valueRef = useRef(value);
  valueRef.current = value;
  const rot = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!rollKey) return;
    rot.value = 0;
    rot.value = withTiming(720, { duration: 480, easing: Easing.out(Easing.cubic) });
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      if (n >= 7) {
        clearInterval(iv);
        setFace(valueRef.current ?? 6);
      } else setFace(1 + Math.floor(Math.random() * 6));
    }, 65);
    return () => clearInterval(iv);
  }, [rollKey, rot]);

  useEffect(() => {
    if (active) pulse.value = withRepeat(withTiming(1.12, { duration: 420 }), -1, true);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 120 });
    }
  }, [active, pulse]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }, { scale: pulse.value }] }));
  const S = 64;
  return (
    <Pressable onPress={onPress} disabled={!active} accessibilityRole="button" accessibilityLabel={active ? 'Roll the dice' : `Dice shows ${face}`} hitSlop={10}>
      <Animated.View
        style={[{
          width: S, height: S, borderRadius: 14, backgroundColor: '#fff', borderWidth: 4, borderColor: color,
          padding: 8, flexDirection: 'row', flexWrap: 'wrap',
          shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
        }, style]}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <View key={i} style={{ width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' }}>
            {PIPS[face]?.includes(i) ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: face === 1 ? color : '#212121' }} /> : null}
          </View>
        ))}
      </Animated.View>
    </Pressable>
  );
};

/* ------------------------------------------------------------------ playing */
const TurnBar = ({ game, color, ms, show }: { game: LudoState; color: string; ms: number; show: boolean }) => {
  const p = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(p);
    p.value = 1;
    if (show) p.value = withTiming(0, { duration: ms, easing: Easing.linear });
  }, [game, ms, show, p]);
  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View className="h-1.5 rounded-full bg-line overflow-hidden" style={{ opacity: show ? 1 : 0, marginTop: 10 }}>
      <Animated.View style={[{ height: '100%', backgroundColor: color }, style]} />
    </View>
  );
};

const PlayerChip = ({ p, seat, color, active, me, align }: { p?: Player; seat: number; color: number; active: boolean; me: boolean; align: 'left' | 'right' }) => {
  if (!p) return <View style={{ flex: 1 }} />;
  return (
    <View
      className="flex-row items-center rounded-xl bg-card"
      style={{
        flex: 1, padding: 6, gap: 8, borderWidth: 2, borderColor: active ? LUDO_COLORS[color] : 'transparent',
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
      }}
      accessibilityLabel={`Seat ${seat + 1}`}
    >
      <View style={{ borderRadius: 20, borderWidth: 3, borderColor: LUDO_COLORS[color] }}>
        {p.userId && !p.left ? (
          <Avatar user={p} size={32} showBadge={false} />
        ) : (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: LUDO_COLORS[color], alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="hardware-chip-outline" size={18} color="#fff" />
          </View>
        )}
      </View>
      <View style={{ flexShrink: 1, alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <Text className="font-display text-ink" numberOfLines={1} style={{ fontSize: 13 }}>{me ? 'You' : firstName(p)}</Text>
        <Text className="font-sans text-ink-3" style={{ fontSize: 11 }}>
          {p.left ? 'Left · bot' : p.bot && p.userId ? 'Autoplay' : LUDO_NAMES[color]}
        </Text>
      </View>
    </View>
  );
};

const Playing = ({
  game, players, mySeat, myId, online, myTurn, lastRoll, boardSize, turnMs, votes,
  onRoll, onMove, onResume, onRematch, onExit, onBoard,
}: {
  game: LudoState; players: Player[]; mySeat: number; myId: string; online: boolean; myTurn: boolean;
  lastRoll: { seat: number; value: number; key: number; note?: string } | null; boardSize: number; turnMs: number; votes: string[];
  onRoll: () => void; onMove: (t: number) => void; onResume: () => void; onRematch: () => void; onExit: () => void; onBoard: () => void;
}) => {
  // Seats by colour so each chip sits next to its base corner.
  const byColor = (c: number) => {
    const seat = game.players.findIndex((p) => p.color === c);
    return seat < 0 ? null : { seat, p: players[seat] };
  };
  const chip = (c: number, align: 'left' | 'right') => {
    const x = byColor(c);
    return x
      ? <PlayerChip p={x.p} seat={x.seat} color={c} active={game.turn === x.seat && game.phase !== 'over'} me={x.seat === mySeat} align={align} />
      : <View style={{ flex: 1 }} />;
  };

  const turnPlayer = players[game.turn];
  const turnColor = LUDO_COLORS[game.players[game.turn].color];
  const myColor = game.players[mySeat].color;
  const rollable = myTurn && game.phase === 'roll';
  const diceColor = rollable ? LUDO_COLORS[myColor] : lastRoll ? LUDO_COLORS[game.players[lastRoll.seat].color] : turnColor;
  const meBot = online && !!players[mySeat]?.bot && !players[mySeat]?.left;

  const status = game.phase === 'over'
    ? ''
    : lastRoll?.note && lastRoll.seat !== game.turn
      ? `${lastRoll.seat === mySeat ? 'You' : firstName(players[lastRoll.seat])}: ${lastRoll.note}`
      : myTurn
        ? game.phase === 'roll' ? 'Your turn — tap the dice' : 'Tap a glowing token'
        : `${firstName(turnPlayer)} is ${game.phase === 'roll' ? 'rolling' : 'moving'}…`;

  const winner = game.winner != null ? players[game.winner] : null;
  const humans = players.filter((p) => p.userId && !p.left).length;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 40, alignItems: 'center' }}>
      <View className="flex-row" style={{ width: boardSize, gap: 8, marginBottom: 8 }}>
        {chip(0, 'left')}
        {chip(1, 'right')}
      </View>
      <View>
        <LudoBoard size={boardSize} game={game} movableSeat={myTurn ? mySeat : -1} onMove={onMove} />
        {game.phase === 'over' ? (
          <View
            style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24, borderRadius: 6 }}
          >
            <View className="bg-card rounded-2xl p-6 items-center" style={{ width: '100%' }}>
              <Text style={{ fontSize: 52 }}>{game.winner === mySeat ? '🏆' : '🎲'}</Text>
              <Text className="font-display text-ink mt-2 text-center" style={{ fontSize: 24 }}>
                {game.winner === mySeat ? 'You win!' : `${firstName(winner)} wins`}
              </Text>
              <Text className="font-sans text-ink-2 mt-1 text-center">
                {game.winner === mySeat
                  ? online ? 'All four home. +1 on the Ludo leaderboard.' : 'All four home. Try 3 bots next?'
                  : 'So close. One more?'}
              </Text>
              <Button
                title={online && votes.includes(myId) ? `Waiting for others (${votes.length}/${humans})` : 'Rematch'}
                icon="refresh"
                variant="primary"
                inCard
                block
                disabled={online && votes.includes(myId)}
                style={{ marginTop: 18, alignSelf: 'stretch' }}
                onPress={onRematch}
              />
              <View className="flex-row mt-3" style={{ gap: 10 }}>
                <Button title="Leaderboard" icon="trophy-outline" small onPress={onBoard} />
                <Button title="Exit" small variant="ghost" onPress={onExit} />
              </View>
            </View>
          </View>
        ) : null}
      </View>
      <View className="flex-row" style={{ width: boardSize, gap: 8, marginTop: 8 }}>
        {chip(3, 'left')}
        {chip(2, 'right')}
      </View>

      {game.phase !== 'over' ? (
        <View style={{ width: boardSize, marginTop: 16, alignItems: 'center' }}>
          <Dice value={lastRoll?.value ?? null} rollKey={lastRoll?.key ?? 0} color={diceColor} active={rollable} onPress={onRoll} />
          <Text className="font-display text-ink mt-3 text-center" style={{ fontSize: 15 }}>{status}</Text>
          {online ? (
            <View style={{ alignSelf: 'stretch' }}>
              <TurnBar game={game} color={turnColor} ms={turnMs} show={!turnPlayer?.bot} />
            </View>
          ) : null}
          {meBot ? (
            <Button title="Autoplay is on — take control" icon="hand-left-outline" variant="primary" style={{ marginTop: 14 }} onPress={onResume} />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
};

export default LudoGame;
