import React from 'react';
import { View, Text, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';

/** Login/sign-up header: soft brand glow, logo, title, one subline. `inset={false}` under an AppBar. */
export default function AuthHeader({ title, sub, inset = true }: { title: string; sub?: string; inset?: boolean }) {
  const { top } = useSafeAreaInsets();
  return (
    <View className="px-gutter mb-8" style={{ paddingTop: inset ? top + 48 : 16 }}>
      <LinearGradient colors={[C.brand[200], C.paper]} pointerEvents="none"
        style={{ position: 'absolute', top: -160, left: -80, width: 420, height: 420, borderRadius: 210, opacity: 0.7 }} />
      <Image
        source={require('../../assets/fync-logo.jpg')}
        style={{ width: 64, height: 64, borderRadius: 32 }}
        resizeMode="cover"
        accessibilityLabel="Fync"
      />
      <Text className="font-display text-ink mt-6" style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1 }} accessibilityRole="header">
        {title}
      </Text>
      {!!sub && <Text className="font-sans text-ink-2 mt-2" style={{ fontSize: 15, lineHeight: 22 }}>{sub}</Text>}
    </View>
  );
}
