import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { buzz } from '../ui/motion';
import { C } from '../../constants/colors';
import { levelRank } from './ScoreRing';

/** One burst from the top centre over the parent; never takes touches. */
export function Confetti({ onDone, count = 120 }: { onDone?: () => void; count?: number }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ConfettiCannon
        count={count}
        origin={{ x: width / 2, y: -20 }}
        fadeOut
        onAnimationEnd={onDone}
        colors={[C.brand[500], C.brand[300], '#F5B700', C.success, '#7C3AED']}
      />
    </View>
  );
}

/**
 * Celebrates once when `level` is above the last one this device saw for the
 * user: haptic + toast, and confetti unless reduce-motion is on. The first
 * sighting just records the level, so existing users aren't greeted with a burst.
 * Render it at a screen's root so the confetti isn't clipped by a list.
 */
export function LevelUpCelebration({ userId, level }: { userId?: string | null; level?: string | null }) {
  const [fire, setFire] = useState(false);
  useEffect(() => {
    if (!userId || levelRank(level) < 0) return;
    let alive = true;
    const key = `fync:lastLevel:${userId}`;
    (async () => {
      const prev = await AsyncStorage.getItem(key).catch(() => null);
      if (!alive || prev === level) return;
      await AsyncStorage.setItem(key, level!).catch(() => {});
      if (prev == null || levelRank(level) <= levelRank(prev)) return;
      buzz();
      Toast.show({ type: 'success', text1: `You reached ${level}!` });
      const reduce = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (alive && !reduce) setFire(true);
    })();
    return () => { alive = false; };
  }, [userId, level]);
  return fire ? <Confetti onDone={() => setFire(false)} /> : null;
}

export default Confetti;
