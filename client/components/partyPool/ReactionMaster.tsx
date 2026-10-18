import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { tapHaptic } from '../../utils/haptics';

/**
 * Five taps, averaged. The tap zone is one Pressable timed on onPressIn (the
 * finger landing), not onPress (the finger lifting) — release added ~100 ms and
 * the old nested touchables could swallow the tap entirely.
 */

const ROUNDS = 5;
const BEST_KEY = 'reaction:best';
type Phase = 'idle' | 'waiting' | 'go' | 'early' | 'tapped' | 'done';

const rank = (ms: number) =>
  ms < 200 ? { label: 'Godlike', emoji: '⚡' } :
  ms < 250 ? { label: 'Elite', emoji: '🔥' } :
  ms < 300 ? { label: 'Fast', emoji: '🚀' } :
  ms < 360 ? { label: 'Decent', emoji: '👍' } : { label: 'Warming up', emoji: '🐢' };

const ReactionMaster = () => {
  const navigation = useNavigation<any>();
  const [phase, setPhase] = useState<Phase>('idle');
  const [times, setTimes] = useState<number[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const goAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY).then((v) => v && setBest(Number(v))).catch(() => {});
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const arm = () => {
    setPhase('waiting');
    timer.current = setTimeout(() => {
      goAt.current = performance.now();
      setPhase('go');
    }, 1500 + Math.random() * 2500);
  };

  const start = () => {
    setTimes([]);
    arm();
  };

  const finish = (all: number[]) => {
    const avg = Math.round(all.reduce((a, b) => a + b, 0) / all.length);
    setPhase('done');
    if (best == null || avg < best) {
      setBest(avg);
      AsyncStorage.setItem(BEST_KEY, String(avg)).catch(() => {});
      // Board ranks higher-is-better; 100 ms floor keeps it inside the server cap.
      axios.post('/games/score', { gameName: 'Reaction', score: Math.max(0, 1000 - Math.max(100, avg)) }).catch(() => {});
    }
  };

  const onZone = () => {
    if (phase === 'waiting') {
      if (timer.current) clearTimeout(timer.current);
      setPhase('early');
      return;
    }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - goAt.current);
      tapHaptic();
      const next = [...times, ms];
      setTimes(next);
      if (next.length >= ROUNDS) finish(next);
      else setPhase('tapped');
      return;
    }
    if (phase === 'tapped' || phase === 'early') arm();
    else start();
  };

  const last = times[times.length - 1];
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const zone =
    phase === 'go' ? { bg: '#16a34a', title: 'TAP!', sub: '' } :
    phase === 'waiting' ? { bg: '#dc2626', title: 'Wait for green…', sub: `Tap ${times.length + 1} of ${ROUNDS}` } :
    phase === 'early' ? { bg: '#f59e0b', title: 'Too early!', sub: 'Tap to try this one again' } :
    phase === 'tapped' ? { bg: '#2563eb', title: `${last} ms`, sub: `${rank(last).emoji} ${rank(last).label} · tap for next` } :
    phase === 'done' && avg != null ? { bg: '#7c3aed', title: `${avg} ms`, sub: `${rank(avg).emoji} ${rank(avg).label} average · tap to play again` } :
    { bg: '#db2777', title: 'Tap to start', sub: `${ROUNDS} taps · we average them` };

  return (
    <View style={{ flex: 1, paddingTop: 8 }}>
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="font-display text-ink text-xl">Reaction Master</Text>
          <Text className="font-sans text-ink-3 text-xs mt-0.5">Best average: {best != null ? `${best} ms` : '—'}</Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('GameLeaderboard', { gameName: 'Reaction', title: 'Fastest Reflexes' })}
          className="flex-row items-center rounded-full border border-line px-3 py-2"
          accessibilityRole="button"
        >
          <Ionicons name="trophy-outline" size={16} color={C.ink} />
          <Text className="font-sans text-ink text-xs ml-1.5">Leaderboard</Text>
        </Pressable>
      </View>

      <Pressable
        onPressIn={onZone}
        accessibilityRole="button"
        accessibilityLabel={zone.title}
        style={{ flex: 1, minHeight: 320, borderRadius: 24, backgroundColor: zone.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <Text className="font-display text-center" style={{ color: '#FFFFFF', fontSize: phase === 'go' ? 64 : 40 }}>{zone.title}</Text>
        {zone.sub ? <Text className="font-sans text-center mt-3" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>{zone.sub}</Text> : null}
      </Pressable>

      <View className="flex-row justify-center mt-4" style={{ gap: 8 }}>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <View key={i} className="rounded-full border border-line px-2.5 py-1" style={{ minWidth: 52, alignItems: 'center' }}>
            <Text className="font-sans text-xs text-ink-2">{times[i] != null ? `${times[i]}` : '·'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default ReactionMaster;
