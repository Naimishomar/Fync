import React, { memo, useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';

/** Fync levels, lowest first. Same names and icons as the badge on the score card. */
export const LEVELS = ['Newcomer', 'Explorer', 'Builder', 'Innovator', 'Pioneer', 'Legend'] as const;
export const LEVEL_ICON: Record<string, any> = {
  Newcomer: 'leaf', Explorer: 'compass', Builder: 'hammer', Innovator: 'bulb', Pioneer: 'rocket', Legend: 'star',
};
export const levelRank = (l?: string | null) => (l ? (LEVELS as readonly string[]).indexOf(l) : -1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Progress ring (score / 1000) around `children`, filling from 0 on mount;
 * reduce-motion draws it full straight away. `level` adds a pill over its foot.
 */
export const ScoreRing = memo(function ScoreRing({
  score, size = 128, stroke = 5, level, color, children,
}: { score: number; size?: number; stroke?: number; level?: string; color?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const target = Math.min(1, Math.max(0, (Number(score) || 0) / 1000));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(reduce ? target : 0);

  useEffect(() => {
    p.value = reduce ? target : withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [target, reduce, p]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} stroke={color ?? C.brand[500]} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} animatedProps={animatedProps}
        />
      </Svg>
      {children}
      {!!level && (
        <View
          className="absolute flex-row items-center bg-brand-500 rounded-full px-2.5 py-0.5 border-2 border-card"
          style={[{ bottom: -10, gap: 4 }, color ? { backgroundColor: color } : null]}
          accessibilityLabel={`Fync score ${score} of 1000, level ${level}`}
        >
          <Ionicons name={LEVEL_ICON[level] || 'leaf'} size={11} color={C.onBrand} />
          <Text className="font-semibold text-on-brand" style={{ fontSize: 11 }}>{level}</Text>
        </View>
      )}
    </View>
  );
});

export default ScoreRing;
