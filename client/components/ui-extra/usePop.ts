import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

/**
 * Small spring-ish pop (1 → 1.15 → 1, ~250ms) when `on` flips false → true.
 * Spread the returned style on an Animated.View around the icon/button.
 * No pop on mount, on flipping off, or with reduce-motion on.
 */
export function usePop(on: boolean) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  const prev = useRef(on);
  useEffect(() => {
    if (on && !prev.current && !reduce) {
      s.value = withSequence(withTiming(1.15, { duration: 100 }), withTiming(1, { duration: 150 }));
    }
    prev.current = on;
  }, [on, reduce, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

/** <Pop on={followed}>…</Pop>: usePop around any child, usable inside .map(). */
export function Pop({ on, style, children }: { on: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const pop = usePop(on);
  return React.createElement(Animated.View, { style: [style, pop] }, children);
}
