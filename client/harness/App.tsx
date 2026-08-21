/**
 * Visual harness — NOT part of the app.
 *
 * The app cannot boot on react-native-web: `react-native-webrtc` and
 * `react-native-webview` call `requireNativeComponent`, which RNW 0.21 removed,
 * and that throws before React mounts. Both are native-only by nature, and
 * shimming them would mean carrying web scaffolding for a platform this project
 * does not ship.
 *
 * So this renders the redesigned screens directly, with the navigation and auth
 * they expect stubbed out, purely to check that the Campus Press tokens, fonts,
 * spacing and components render as designed.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider } from '../context/auth.context';
import {
  useFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
} from '@expo-google-fonts/inter';
import '../global.css';

import LoginScreen from '../components/login-screen';
import SignUpScreen from '../components/sign-up-screen';
import ProfileSetup1 from '../components/profile-setup-1';
import * as Kit from '../components/ui/kit';

const Stack = createNativeStackNavigator();

const SCREENS: Array<[string, React.ComponentType<any>]> = [
  ['Login', LoginScreen],
  ['Signup', SignUpScreen],
  ['Profile Setup', ProfileSetup1],
];

function KitSheet() {
  const { Card, SectionRule, Sticker, StampNumber, Button, Chip, Tag, TagRow,
          Avatar, Tile, TileGrid, Display, H1, H2, Body, Sm, Meta, Label, Num,
          Strong, Divider, Empty, RoleSticker, C } = Kit as any;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.paper }} contentContainerStyle={{ padding: 20 }}>
      <Display>Campus Press</Display>
      <Label style={{ marginTop: 12 }}>Type scale</Label>
      <H1 style={{ marginTop: 8 }}>Heading one</H1>
      <H2 style={{ marginTop: 6 }}>Heading two</H2>
      <Body style={{ marginTop: 6 }}>Body copy is sentence case Inter at 15px, which is where content lives.</Body>
      <Sm style={{ marginTop: 6 }}>Small copy at 13px.</Sm>
      <Meta style={{ marginTop: 6 }}>Meta / timestamps</Meta>
      <Num style={{ marginTop: 6, fontSize: 34 }}>1,864</Num>

      <SectionRule label="Signature devices" count={6} />
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Sticker>Live now</Sticker>
        <Sticker tone="live">Urgent</Sticker>
        <Sticker tone="gold">Alumni</Sticker>
        <Sticker tone="rec" tilt="r">Verified</Sticker>
        <RoleSticker role="alumni" />
        <RoleSticker role="recruiter" />
      </View>

      <SectionRule label="Number stamp" />
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <StampNumber value={41} caption="min" />
        <StampNumber value="742" caption="score" />
        <StampNumber value="#12" caption="campus" />
      </View>

      <SectionRule label="Cards" />
      <Card stamp padded>
        <Label>Campus now</Label>
        <H1 style={{ marginTop: 8 }}>The one stamped card</H1>
        <Body style={{ marginTop: 8 }}>Exactly one per screen. Hierarchy from scarcity.</Body>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <Button title="Check in" variant="primary" small inCard style={{ flex: 1 }} />
          <Button title="Find 4th" small style={{ flex: 1 }} />
        </View>
      </Card>
      <Card padded style={{ marginTop: 12 }}>
        <Strong>A hairline card</Strong>
        <Meta style={{ marginTop: 4 }}>Everything that is not the hero</Meta>
      </Card>

      <SectionRule label="Buttons" />
      <View style={{ gap: 10 }}>
        <Button title="Primary" variant="primary" />
        <Button title="Solid" variant="solid" />
        <Button title="Quiet" variant="quiet" />
      </View>

      <SectionRule label="Chips and tags" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="All" active />
        <Chip label="Campus" />
        <Chip label="Career" icon="briefcase-outline" />
      </View>
      <TagRow style={{ marginTop: 10 }}>
        <Tag label="₹55k / month" icon="cash-outline" />
        <Tag label="Closes in 2 days" icon="time-outline" />
        <Tag label="7.0+ CGPA" icon="school-outline" />
      </TagRow>

      <SectionRule label="Avatars and roles" />
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Avatar initials="NO" role="student" />
        <Avatar initials="AK" role="alumni" />
        <Avatar initials="TP" role="recruiter" />
      </View>

      <SectionRule label="Tiles" count={4} />
      <TileGrid>
        <Tile label="Focus" icon="timer-outline" tint={C.study} />
        <Tile label="Placement" icon="trending-up-outline" tint={C.career} />
        <Tile label="Campus OLX" icon="cart-outline" tint={C.campus} />
        <Tile label="12 AM Club" icon="moon-outline" tint={C.fun} />
      </TileGrid>

      <SectionRule label="Empty state" />
      <Empty title="Nothing here yet" hint="This is what an empty list looks like." icon="telescope-outline" />
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

export default function Harness() {
  // Selected by URL hash so a headless capture can address a screen directly
  // instead of needing to synthesise a click.
  const hash = (globalThis as any).location?.hash?.replace('#', '') ?? '';
  const fromHash = SCREENS.findIndex(sc => sc[0].toLowerCase().replace(/\s+/g, '') === hash);
  const [i, setI] = useState(fromHash);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium, SpaceGrotesk_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#F5F2EC' }} />;

  const Current = i >= 0 ? SCREENS[i][1] : null;
  return (
    <SafeAreaProvider>
      {/* Real providers: the screens call useNavigation() and useAuth(), and a
          missing NavigationContainer throws before anything paints. */}
      <NavigationContainer>
      <AuthProvider>
      <View style={{ flex: 1, backgroundColor: '#F5F2EC' }}>
        <View style={{ flexDirection: 'row', gap: 6, padding: 8, backgroundColor: '#12100E', flexWrap: 'wrap' }}>
          {['Kit', ...SCREENS.map(s => s[0])].map((name, n) => (
            <Pressable key={name} onPress={() => setI(n - 1)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                       backgroundColor: (n - 1) === i ? '#F97316' : 'rgba(255,255,255,.12)' }}>
              <Text style={{ color: (n - 1) === i ? '#12100E' : '#F5F2EC', fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold' }}>{name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {Current ? (
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name={SCREENS[i][0]} component={Current} initialParams={{}} />
            </Stack.Navigator>
          ) : <KitSheet />}
        </View>
      </View>
      </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
