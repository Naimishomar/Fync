import React, { memo, useEffect } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming, cancelAnimation,
} from 'react-native-reanimated';
import { C } from '../../constants/colors';
import { PressScale } from '../ui/motion';

/** Fire icon that breathes gently while a streak is alive; static otherwise or under reduce-motion. */
export const Flame = memo(function Flame({ active, size = 16, color = C.brand[500] }: { active: boolean; size?: number; color?: string }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!active || reduce) { cancelAnimation(s); s.value = 1; return; }
    s.value = withRepeat(withSequence(withTiming(1.15, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    return () => cancelAnimation(s);
  }, [active, reduce, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={style}>
      <MaterialCommunityIcons name="fire" size={size} color={color} />
    </Animated.View>
  );
});

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

// Shown when there is nothing unread; one per day so the card is stable.
const TIPS = [
  { text: 'Hackathons are open. Find one this week.', cta: 'Browse', route: 'HackathonList' },
  { text: 'Notes and PYQs from your seniors.', cta: 'Open notes', route: 'NotesExchange' },
  { text: 'Contests, gigs, study groups and more.', cta: 'Explore', route: 'Explore' },
];

export const GreetingCard = memo(function GreetingCard({
  name, streak, unread,
}: { name?: string; streak: number; unread: number }) {
  const navigation = useNavigation<any>();
  const first = (name || '').trim().split(/\s+/)[0];
  const tip = TIPS[Math.floor(Date.now() / 864e5) % TIPS.length];
  const nudge = unread > 0
    ? { text: `You have ${unread} new ${unread === 1 ? 'notification' : 'notifications'}.`, cta: 'See them', route: 'Notification' }
    : tip;

  return (
    <View className="px-gutter pt-3 pb-2">
      <LinearGradient
        colors={[C.brand[500], C.brand[300]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: 20 }}
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-xl flex-1 mr-3" style={{ color: C.onBrand }} numberOfLines={1} accessibilityRole="header">
            {greeting()}{first ? `, ${first}` : ''}
          </Text>
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: 'rgba(255,255,255,0.35)' }}
            accessibilityLabel={`${streak} day streak`}
          >
            <Flame active={streak > 0} color={C.onBrand} />
            <Text className="font-semibold text-xs ml-0.5" style={{ color: C.onBrand }}>{streak}</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between mt-3">
          <Text className="text-sm flex-1 mr-3" style={{ color: C.onBrand }} numberOfLines={2}>{nudge.text}</Text>
          <PressScale
            onPress={() => navigation.navigate(nudge.route)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={nudge.cta}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.onBrand, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 }}
          >
            <Text className="font-semibold text-xs" style={{ color: '#FFFFFF' }}>{nudge.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </PressScale>
        </View>
      </LinearGradient>
    </View>
  );
});

export default GreetingCard;
