import React, { memo, useCallback } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { formatCount } from '../../utils/format';

/** Light tap on press-in. Fire-and-forget: a device without haptics just does nothing. */
export const tick = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
/** Success buzz, for likes, level-ups, a finished action. */
export const buzz = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

// Animated Pressable, so the caller's style (flex, margins, position) stays on
// the pressable itself and keeps affecting layout.
const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable that dips to `scale` while held and springs back, with an optional
 * haptic tick. Runs on the UI thread (Reanimated), so it stays smooth even when
 * JS is busy. Style is static — NativeWind drops a function `style` on Pressable.
 */
export const PressScale = memo(function PressScale({
  children, style, scale = 0.97, haptic = true, onPressIn, onPressOut, disabled, ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scale?: number; haptic?: boolean; children?: React.ReactNode }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const pressIn = useCallback((e: any) => {
    s.value = withTiming(scale, { duration: 90 });
    if (haptic && !disabled) tick();
    onPressIn?.(e);
  }, [scale, haptic, disabled, onPressIn, s]);
  const pressOut = useCallback((e: any) => {
    s.value = withSpring(1, SPRING);
    onPressOut?.(e);
  }, [onPressOut, s]);
  return (
    <APressable {...rest} disabled={disabled} onPressIn={pressIn} onPressOut={pressOut} style={[style, anim]}>
      {children}
    </APressable>
  );
});

/**
 * Entrance for the first screenful of a list: fade up, staggered 50ms per row.
 * Rows past `max` (or recycled ones) get none, so scrolling never animates.
 *   <Animated.View entering={enterAt(index)}>…</Animated.View>
 */
export const enterAt = (index: number, max = 8) =>
  index < max ? FadeInDown.duration(320).delay(index * 50) : undefined;

/**
 * A count that rolls when it changes (odometer-style): the new value slides up
 * in, the old one slides out. Uses the shared K/M format.
 */
export const AnimatedCount = memo(function AnimatedCount({
  value, style, format = formatCount,
}: { value: number; style?: StyleProp<TextStyle>; format?: (n: number) => string }) {
  const text = format(value);
  return (
    <Animated.View style={{ overflow: 'hidden' }}>
      <Animated.Text key={text} entering={FadeInUp.duration(180)} exiting={FadeOutDown.duration(120)} style={style}>
        {text}
      </Animated.Text>
    </Animated.View>
  );
});

/**
 * Spring pop for a toggled icon (like, save, follow): 1 -> peak -> 1.
 * Pass a smaller peak (~1.06) for a whole pill button.
 * Fired from the tap handler (not on state change) so recycled rows never pop.
 * Reanimated's default ReduceMotion.System skips it when reduce motion is on.
 *   const [popStyle, pop] = usePop();  <Animated.View style={popStyle}><Icon/></Animated.View>
 */
export const usePop = (peak = 1.2) => {
  const s = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const pop = useCallback(() => {
    s.value = withSequence(withTiming(peak, { duration: 100 }), withSpring(1, SPRING));
  }, [s, peak]);
  return [style, pop] as const;
};
