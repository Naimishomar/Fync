import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';
import { C } from '../../constants/colors';
import { TYPE } from '../../constants/type';
import { AppBar, Button, Card, FormField, IconBtn, Empty, SearchField } from '../ui/kit';
import { Alert } from '../ui/AlertModal';
import Avatar from '../Avatar';
import { useTrackSearch } from '../music/MusicPicker';
import { trendingTracks, type Track } from '../../utils/audius';
import { useSyncedPlayer, expectedPosition, type LtState } from '../../utils/listenPlayer';

/**
 * Listen Together: start a session, share the code, everyone in it hears the
 * same song at the same time and anyone can control it. Server:
 * backend/controllers/listen.socket.js (+ utils/listenRules.js). Playback sync:
 * utils/listenPlayer.ts. This screen renders state and sends actions; it never
 * changes playback locally, so every phone shows exactly what the server says.
 */

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Ack = { ok: boolean; state?: LtState | null; error?: string };

export default function ListenTogether() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const [room, setRoom] = useState<LtState | null>(null);
  const [phase, setPhase] = useState<'connecting' | 'lobby' | 'room'>('connecting');
  const [code, setCode] = useState(String(route.params?.code || '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const { tracks, failed } = useTrackSearch(q);
  const trending = useRef<Track[]>([]);
  const recent = useRef<string[]>([]);
  const [, setTick] = useState(0);
  const roomRef = useRef<LtState | null>(null);
  roomRef.current = room;

  const me = useCallback(() => ({ name: user?.name, username: user?.username, avatar: user?.avatar }), [user]);

  /** Newer state only: events can arrive out of order around reconnects. */
  const accept = useCallback((s: LtState | null | undefined) => {
    if (!s) return;
    setRoom((prev) => (!prev || prev.id !== s.id || s.version >= prev.version ? s : prev));
    setPhase('room');
  }, []);

  const call = useCallback(async (event: string, payload: object = {}): Promise<Ack> => {
    if (!socket.connected) return { ok: false, error: 'Connecting… try again in a moment.' };
    try {
      return await socket.timeout(6000).emitWithAck(event, payload);
    } catch {
      return { ok: false, error: 'No response. Check your connection.' };
    }
  }, []);

  const send = useCallback(async (type: string, extra: object = {}) => {
    const r = roomRef.current;
    if (!r) return;
    const res = await call('lt:action', { roomId: r.id, type, ...extra });
    if (!res.ok && res.error) Toast.show({ type: 'error', text1: res.error });
  }, [call]);

  /**
   * Fill silence with a random trending song. Every phone may call this at the
   * same moment (song ended / empty room); the server takes only the first per
   * track (autonext names the track it replaces). `skip`: user tapped next.
   */
  const playRandom = useCallback(async (trackKey: string, skip = false) => {
    if (!trending.current.length) trending.current = await trendingTracks().catch(() => []);
    const cur = roomRef.current?.track?.id;
    const pool = trending.current.filter((t) => t.id !== cur && !recent.current.includes(t.id));
    const list = pool.length ? pool : trending.current.filter((t) => t.id !== cur);
    const t = list[Math.floor(Math.random() * list.length)];
    if (!t) return;
    send('autonext', { trackKey, skip, track: { id: t.id, title: t.title, artist: t.artist, artwork: t.artwork, duration: t.duration } });
  }, [send]);

  const { status, offset, retry } = useSyncedPlayer(room, (trackKey) => playRandom(trackKey));

  // Remember what played, so random picks don't repeat the last few.
  const playingId = room?.track?.id;
  useEffect(() => {
    if (playingId) recent.current = [playingId, ...recent.current.filter((x) => x !== playingId)].slice(0, 15);
  }, [playingId]);

  // Nothing playing (new session), or the last song ended while nobody was
  // around to pick: start something. Once per (room, track) per phone.
  const filled = useRef('');
  useEffect(() => {
    if (!room) return;
    const t = room.track;
    const over = t && !room.playing && room.position >= t.duration * 1000 - 1;
    const tag = `${room.id}:${t?.key ?? ''}`;
    if ((!t || over) && filled.current !== tag) {
      filled.current = tag;
      playRandom(t?.key ?? '');
    }
  }, [room, playRandom]);

  // Join from an invite link, else resume my session if I have one.
  const enterRef = useRef(false);
  const boot = useCallback(async () => {
    const inviteCode = String(route.params?.code || '').trim().toUpperCase();
    if (inviteCode && !enterRef.current) {
      enterRef.current = true;
      const res = await call('lt:join', { code: inviteCode, ...me() });
      if (res.ok) return accept(res.state);
      Toast.show({ type: 'error', text1: res.error || 'Could not join' });
    }
    const res = await call('lt:resume', {});
    if (res.ok && res.state) accept(res.state);
    else if (!roomRef.current) setPhase('lobby');
  }, [accept, call, me, route.params?.code]);

  useEffect(() => {
    const onState = (s: LtState) => accept(s);
    // Reconnect: rejoin the io room, or learn the session ended.
    const onConnect = async () => {
      if (!roomRef.current) return boot();
      const res = await call('lt:resume', {});
      if (res.ok && res.state) accept(res.state);
      else if (res.ok) { setRoom(null); setPhase('lobby'); Toast.show({ type: 'info', text1: 'That session ended' }); }
    };
    socket.on('lt:state', onState);
    socket.on('connect', onConnect);
    if (socket.connected) boot();
    return () => { socket.off('lt:state', onState); socket.off('connect', onConnect); };
  }, [accept, boot, call]);

  // Progress bar ticks locally from the server anchor; no network per tick.
  useEffect(() => {
    if (!room?.playing) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [room?.playing]);

  // Removed from the members list (left on another phone): back to the lobby.
  useEffect(() => {
    if (room && user?._id && !room.members.some((m) => m.userId === String(user._id))) {
      setRoom(null);
      setPhase('lobby');
    }
  }, [room, user?._id]);

  const create = async () => {
    setBusy(true);
    const res = await call('lt:create', me());
    setBusy(false);
    if (res.ok) accept(res.state);
    else Toast.show({ type: 'error', text1: res.error || 'Could not start' });
  };

  const join = async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(c)) return Toast.show({ type: 'error', text1: 'Codes are 6 letters and numbers' });
    setBusy(true);
    const res = await call('lt:join', { code: c, ...me() });
    setBusy(false);
    if (res.ok) accept(res.state);
    else Toast.show({ type: 'error', text1: res.error || 'Could not join' });
  };

  const leave = () => Alert.alert('Leave session?', 'Music stops for you. Others keep listening.', [
    { text: 'Stay', style: 'cancel' },
    {
      text: 'Leave', style: 'destructive', onPress: async () => {
        await call('lt:leave', {});
        setRoom(null);
        setPhase('lobby');
      },
    },
  ]);

  const invite = () => {
    if (!room) return;
    Share.share({
      message: `Listen with me on Fync 🎧\nOpen Fync → Explore → Fun → Listen Together and enter code ${room.code}\nfync://listen/${room.code}`,
    }).catch(() => {});
  };

  /** Tap a song: it plays now, for everyone. */
  const pick = (t: Track) => {
    send('play', { track: { id: t.id, title: t.title, artist: t.artist, artwork: t.artwork, duration: t.duration } });
  };

  // ── Lobby ────────────────────────────────────────────────────────────────
  if (phase !== 'room' || !room) {
    return (
      <View className="flex-1 bg-paper">
        <AppBar title="Listen Together" onBack={() => navigation.goBack()} />
        {phase === 'connecting' ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator color={C.accentText} /></View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
              <View className="w-16 h-16 rounded-full items-center justify-center bg-brand-50">
                <Ionicons name="headset" size={30} color={C.accentText} />
              </View>
              <Text className="text-ink text-center" style={[TYPE.subtitle, { marginTop: 14 }]}>Listen with friends, in sync</Text>
              <Text className="text-ink-3 text-center" style={[TYPE.sm, { marginTop: 6, paddingHorizontal: 12 }]}>
                Start a session and share the code. Everyone hears the same song at the same moment, and anyone can pick what&apos;s next.
              </Text>
              <Button title="Start a session" icon="play" variant="primary" block loading={busy} onPress={create} style={{ marginTop: 20 }} />
            </Card>
            <Card>
              <Text className="text-ink font-semibold mb-3">Have a code?</Text>
              <FormField label="Session code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="ABC123"
                autoCapitalize="characters" autoCorrect={false} maxLength={6} />
              <Button title="Join" block onPress={join} disabled={busy} style={{ marginTop: 12 }} />
            </Card>
            <Text className="text-ink-3 text-center" style={TYPE.caption}>Music from Audius</Text>
          </ScrollView>
        )}
      </View>
    );
  }

  // ── Room ─────────────────────────────────────────────────────────────────
  const t = room.track;
  const pos = expectedPosition(room, offset.current);
  const dur = (t?.duration || 0) * 1000;
  const nameOf = (uid?: string) => room.members.find((m) => m.userId === uid)?.name?.split(' ')[0];

  return (
    <View className="flex-1 bg-paper">
      <AppBar title="Listen Together" onBack={() => navigation.goBack()}
        right={<Button small variant="primary" icon="person-add-outline" title="Invite" onPress={invite} />} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 16 }}>
        {/* Code + members */}
        <Card>
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={async () => { await Clipboard.setStringAsync(room.code); Toast.show({ type: 'success', text1: 'Code copied' }); }}
              className="flex-row items-center active:opacity-85" style={{ gap: 6 }} accessibilityRole="button" accessibilityLabel={`Session code ${room.code}, copy`}
            >
              <Text className="text-ink-3" style={TYPE.sm}>Code</Text>
              <Text className="text-ink font-display" style={{ fontSize: 20, letterSpacing: 2 }}>{room.code}</Text>
              <Ionicons name="copy-outline" size={16} color={C.ink3} />
            </Pressable>
            <Text className="text-ink-3" style={TYPE.sm}>{room.online.length} listening</Text>
          </View>
          <View className="flex-row flex-wrap mt-3" style={{ gap: 10 }}>
            {room.members.map((m) => {
              const on = room.online.includes(m.userId);
              return (
                <View key={m.userId} className="items-center" style={{ width: 56, opacity: on ? 1 : 0.45 }}
                  accessibilityLabel={`${m.name || m.username}, ${on ? 'listening' : 'away'}`}>
                  <View>
                    <Avatar user={m as any} size={44} />
                    <View style={{ position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.card, backgroundColor: on ? C.success : C.ink3 }} />
                  </View>
                  <Text className="text-ink-2" style={[TYPE.caption, { marginTop: 4 }]} numberOfLines={1}>
                    {m.userId === String(user?._id) ? 'You' : m.name?.split(' ')[0] || m.username}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Now playing */}
        <Card style={{ alignItems: 'center' }}>
          {t ? (
            <>
              {t.artwork
                ? <Image source={{ uri: t.artwork }} style={{ width: 200, height: 200, borderRadius: 16 }} cachePolicy="memory-disk" />
                : <View style={{ width: 200, height: 200, borderRadius: 16, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="musical-notes" size={48} color={C.ink3} /></View>}
              <Text className="text-ink text-center" style={[TYPE.subtitle, { marginTop: 14 }]} numberOfLines={2}>{t.title}</Text>
              <Text className="text-ink-3 text-center" style={TYPE.sm} numberOfLines={1}>
                {t.artist}{nameOf(t.addedBy) ? ` · added by ${nameOf(t.addedBy)}` : ''}
              </Text>

              {/* Progress (from the server anchor); ±10s buttons below seek for everyone. */}
              <View style={{ alignSelf: 'stretch', marginTop: 16 }}
                accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: Math.round(dur / 1000), now: Math.round(pos / 1000) }}>
                <View className="h-1.5 bg-paper-2 rounded-full overflow-hidden">
                  <View className="h-full bg-brand-500 rounded-full" style={{ width: `${dur ? (pos / dur) * 100 : 0}%` }} />
                </View>
              </View>
              <View className="flex-row justify-between mt-1" style={{ alignSelf: 'stretch' }}>
                <Text className="text-ink-3" style={TYPE.caption}>{fmt(pos)}</Text>
                <Text className="text-ink-3" style={TYPE.caption}>{fmt(dur)}</Text>
              </View>

              <View className="flex-row items-center justify-center mt-3" style={{ gap: 24 }}>
                <IconBtn name="play-back" onPress={() => send('seek', { ms: pos - 10000 })} accessibilityLabel="Back 10 seconds" />
                <Pressable
                  onPress={() => send(room.playing ? 'pause' : 'play')}
                  className="w-16 h-16 rounded-full items-center justify-center bg-brand-500 active:opacity-85"
                  accessibilityRole="button" accessibilityLabel={room.playing ? 'Pause for everyone' : 'Play for everyone'}
                >
                  <Ionicons name={room.playing ? 'pause' : 'play'} size={28} color={C.onBrand} />
                </Pressable>
                <IconBtn name="play-forward" onPress={() => send('seek', { ms: pos + 10000 })} accessibilityLabel="Forward 10 seconds" />
                <IconBtn name="play-skip-forward" onPress={() => playRandom(t.key, true)} accessibilityLabel="Play a random song" />
              </View>

              {status === 'loading' || status === 'buffering' ? (
                <Text className="text-ink-3 mt-3" style={TYPE.caption}>{status === 'loading' ? 'Loading song…' : 'Buffering…'}</Text>
              ) : status === 'error' ? (
                <Pressable onPress={retry} className="mt-3 active:opacity-85" accessibilityRole="button">
                  <Text className="text-danger" style={TYPE.caption}>Couldn&apos;t load this song on your phone. Tap to retry.</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <View className="items-center py-10" style={{ gap: 10 }}>
              <ActivityIndicator color={C.accentText} />
              <Text className="text-ink-3" style={TYPE.sm}>Picking a song…</Text>
            </View>
          )}
        </Card>

        {/* Songs: tap one and it plays for everyone. */}
        <View>
          <Text className="text-ink font-semibold mb-2">{q.trim() ? 'Results' : 'Trending'}</Text>
          <SearchField value={q} onChangeText={setQ} placeholder="Search songs" containerStyle={{ marginBottom: 8 }} />
          {tracks === null ? (
            <ActivityIndicator color={C.accentText} style={{ marginVertical: 24 }} />
          ) : tracks.length ? (
            <Card style={{ paddingVertical: 4 }}>
              {tracks.map((s2, i) => {
                const on = room.track?.id === s2.id;
                return (
                  <Pressable key={s2.id} onPress={() => !on && pick(s2)} className="flex-row items-center py-2 active:opacity-85"
                    style={{ gap: 10, borderTopWidth: i ? 1 : 0, borderColor: C.line, minHeight: 56 }}
                    accessibilityRole="button" accessibilityLabel={on ? `${s2.title}, playing` : `Play ${s2.title} by ${s2.artist} for everyone`}
                    accessibilityState={{ selected: on }}>
                    {s2.artwork
                      ? <Image source={{ uri: s2.artwork }} style={{ width: 44, height: 44, borderRadius: 8 }} cachePolicy="memory-disk" />
                      : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: C.paper2 }} />}
                    <View className="flex-1 min-w-0">
                      <Text className="font-semibold text-sm" style={{ color: on ? C.accentText : C.ink }} numberOfLines={1}>{s2.title}</Text>
                      <Text className="text-ink-3 text-xs" numberOfLines={1}>{s2.artist}</Text>
                    </View>
                    <Ionicons name={on ? 'volume-high' : 'play-circle-outline'} size={22} color={on ? C.accentText : C.ink3} />
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <Empty icon="musical-notes-outline" title={failed ? 'Could not load songs' : 'No songs found'}
              hint={failed ? 'Check your connection and try again.' : 'Try another name.'} />
          )}
        </View>

        <Button title="Leave session" icon="exit-outline" onPress={leave} block />
        <Text className="text-ink-3 text-center" style={TYPE.caption}>Music from Audius</Text>
      </ScrollView>

    </View>
  );
}
