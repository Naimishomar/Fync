import React, { useEffect, useRef } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';

/**
 * Big white heart that pops over media after a double-tap like.
 * Bump `trigger` (any changing number > 0) to play it; 0 never plays,
 * so a recycled row that resets its counter stays quiet.
 */
export function HeartBurst({ trigger, size = 96 }: { trigger: number; size?: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    scale.value = 0.3;
    scale.value = withSequence(withSpring(1.1, { damping: 9, stiffness: 260 }), withTiming(1.25, { duration: 260 }));
    opacity.value = withSequence(withTiming(1, { duration: 90 }), withTiming(1, { duration: 300 }), withTiming(0, { duration: 210 }));
  }, [trigger]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Ionicons
        name="heart"
        size={size}
        color="#FFFFFF"
        style={{ textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 } }}
      />
    </Animated.View>
  );
}

/**
 * One handler that tells a single tap from a double tap.
 * The single tap waits `delay` ms to see if a second one follows.
 */
export function useDoubleTap(onSingle: () => void, onDouble: () => void, delay = 230) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ onSingle, onDouble });
  latest.current = { onSingle, onDouble };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      latest.current.onDouble();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      latest.current.onSingle();
    }, delay);
  };
}
