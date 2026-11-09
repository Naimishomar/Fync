import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StatusBar, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { checkClubStatus } from '../../utils/nightClub';
import { AppBar, Button } from '../ui/kit';
import * as Notifications from 'expo-notifications';
import Toast from 'react-native-toast-message';

/** One local reminder for the next opening; the fixed identifier replaces any earlier one. */
const remindAtOpen = async (secondsLeft: number) => {
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) {
    Toast.show({ type: 'error', text1: 'Notifications are off', text2: 'Turn them on in phone settings to get the reminder.' });
    return false;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: 'nightclub-open',
    content: { title: 'The 12 AM Club is open 🌙', body: 'Anonymous campus chat, live till 6 AM.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, secondsLeft), channelId: 'default' },
  });
  Toast.show({ type: 'success', text1: "We'll remind you at 12 AM" });
  return true;
};

// A fixed night palette: this screen is a night sky in both app themes.
const SKY = ['#1E1236', '#120B22', '#07060B'] as const;
const SKY_LIVE = ['#3B0F3A', '#1A0E33', '#07060B'] as const;
const INK = '#F3EFFA';
const MUTED = 'rgba(243,239,250,0.6)';
const GLASS = 'rgba(255,255,255,0.07)';
const GLASS_LINE = 'rgba(255,255,255,0.12)';
const MOON = '#FDE7B0';
const PINK = '#EC4899';

const pad = (n: number) => String(n).padStart(2, '0');

/** Deterministic star field (no Math.random: same sky every render). */
const useStars = (w: number, h: number) => useMemo(() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: 48 }, () => ({
    x: rnd() * w, y: rnd() * h * 0.62, r: rnd() < 0.15 ? 2 : 1, o: 0.25 + rnd() * 0.6,
  }));
}, [w, h]);

function Moon({ live }: { live: boolean }) {
  const reduce = useReducedMotion();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!reduce) glow.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, glow]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.35, transform: [{ scale: 1 + glow.value * 0.08 }] }));
  const tint = live ? PINK : MOON;
  return (
    <View style={{ width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: tint, opacity: 0.4 }, halo, { shadowColor: tint, shadowOpacity: 1, shadowRadius: 40 }]} />
      <View style={{ position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(7,6,11,0.55)' }} />
      <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE, alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="moon-waning-crescent" size={56} color={tint} />
      </View>
    </View>
  );
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ width: 84, height: 84, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE, alignItems: 'center', justifyContent: 'center' }}>
        <Text className="font-display" style={{ color: INK, fontSize: 38, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
      <Text style={{ color: MUTED, fontSize: 12, fontFamily: 'Inter_500Medium' }}>{label}</Text>
    </View>
  );
}

function Perk({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE }}>
      <Ionicons name={icon} size={14} color={MUTED} />
      <Text style={{ color: INK, fontSize: 12, fontFamily: 'Inter_500Medium' }}>{label}</Text>
    </View>
  );
}

export default function TwelveAMLockScreen() {
  const navigation = useNavigation<any>();
  const { width, height } = useWindowDimensions();
  const stars = useStars(width, height);
  const [status, setStatus] = useState(checkClubStatus);
  const [reminded, setReminded] = useState(false);
  useEffect(() => {
    Notifications.getAllScheduledNotificationsAsync()
      .then((list) => setReminded(list.some((n) => n.identifier === 'nightclub-open')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // IST, not the device clock: the server gates on IST.
    const id = setInterval(() => setStatus(checkClubStatus()), 1000);
    return () => clearInterval(id);
  }, []);

  const isOpen = status.isOpen;
  const left = Math.max(0, isOpen ? status.secondsUntilClose : status.secondsUntilOpen);
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60), s = left % 60;

  return (
    <View style={{ flex: 1, backgroundColor: SKY[2] }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={isOpen ? SKY_LIVE : SKY} locations={[0, 0.45, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {stars.map((st, i) => (
        <View key={i} style={{ position: 'absolute', left: st.x, top: st.y, width: st.r, height: st.r, borderRadius: 1, backgroundColor: '#fff', opacity: st.o }} />
      ))}

      <AppBar
        overlay
        title="12 AM Club"
        onBack={() => navigation.goBack()}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: isOpen ? 'rgba(34,197,94,0.15)' : GLASS, borderWidth: 1, borderColor: isOpen ? 'rgba(34,197,94,0.5)' : GLASS_LINE }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOpen ? '#22C55E' : MUTED }} />
            <Text style={{ color: INK, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{isOpen ? 'Live' : 'Offline'}</Text>
          </View>
        }
      />

      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <Moon live={isOpen} />

          <Text className="font-display" style={{ color: INK, fontSize: 34, lineHeight: 40, textAlign: 'center', marginTop: 20 }}>
            {isOpen ? 'No rules.\nNo history.' : 'Sleep tight.\nSee you at midnight.'}
          </Text>
          <Text style={{ color: MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10, maxWidth: 300 }}>
            {isOpen
              ? 'Anonymous campus chat, live till 6 AM. Everything disappears after.'
              : 'An anonymous chat for night owls on your campus. Opens every night at 12 AM.'}
          </Text>

          <Text style={{ color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 32, marginBottom: 12 }}>
            {isOpen ? 'CLOSES IN' : 'OPENS IN'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <TimeBox value={pad(h)} label="hours" />
            <Text className="font-display" style={{ color: MUTED, fontSize: 30, marginTop: 20 }}>:</Text>
            <TimeBox value={pad(m)} label="minutes" />
            <Text className="font-display" style={{ color: MUTED, fontSize: 30, marginTop: 20 }}>:</Text>
            <TimeBox value={pad(s)} label="seconds" />
          </View>
        </View>

        <View style={{ paddingBottom: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Perk icon="eye-off-outline" label="Anonymous" />
            <Perk icon="time-outline" label="12 AM – 6 AM" />
            <Perk icon="trash-outline" label="Auto-deletes" />
          </View>
          {isOpen ? (
            <Button title="Enter club" icon="arrow-forward" variant="primary" block onPress={() => navigation.navigate('TwelveAMClub')} />
          ) : reminded ? (
            <View style={{ height: 52, borderRadius: 26, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_LINE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              accessibilityRole="text" accessibilityLabel="Reminder set for 12 AM">
              <Ionicons name="notifications" size={16} color={MOON} />
              <Text style={{ color: INK, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Reminder set for 12:00 AM</Text>
            </View>
          ) : (
            <Button title="Remind me at 12 AM" icon="notifications-outline" variant="primary" block
              onPress={() => remindAtOpen(left).then((ok) => ok && setReminded(true)).catch(() => {})} />
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}
