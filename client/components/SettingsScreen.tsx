/**
 * One place for the app-wide switches that were previously scattered or absent:
 * cached content, notification permission, the legal pages, and signing out.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import Constants from 'expo-constants';
import { useAuth } from '../context/auth.context';
import { Alert } from './ui/AlertModal';
import { AppBar, Button, Card, Divider, ListRow, SectionHeader } from './ui/kit';
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';
import axios from '../context/axiosConfig';
import { loadThemePref, setThemePref, type ThemePref } from '../utils/theme';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
};

const prettyBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [themePref, setThemePrefState] = useState<ThemePref>('system');
  useEffect(() => { loadThemePref().then(setThemePrefState); }, []);
  const THEME_LABEL: Record<ThemePref, string> = { system: 'System', light: 'Light', dark: 'Dark' };
  const pickTheme = () =>
    Alert.alert('Appearance', 'Choose how Fync looks.', [
      ...(['system', 'light', 'dark'] as ThemePref[]).map((p) => ({
        text: THEME_LABEL[p] + (p === themePref ? '  ✓' : ''),
        onPress: () => { setThemePrefState(p); setThemePref(p); },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  /**
   * Only the screen caches are measured and cleared. Wiping all of AsyncStorage
   * would take the auth tokens with it and sign the user out by accident.
   */
  const CACHE_PREFIX = 'fync_cache_';

  const measure = useCallback(async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
      if (!keys.length) { setCacheSize(0); return; }
      const entries = await AsyncStorage.multiGet(keys);
      setCacheSize(entries.reduce((n, [, v]) => n + (v?.length ?? 0), 0));
    } catch { setCacheSize(null); }
  }, []);

  useEffect(() => { measure(); }, [measure]);

  const clearCache = () =>
    Alert.alert(
      'Clear cached content',
      'Screens will reload from the network next time you open them. Nothing you have posted is affected, and you stay signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
              if (keys.length) await AsyncStorage.multiRemove(keys);

              // Downloaded images and files are where the real disk space goes;
              // clearing only the screen JSON reclaims almost nothing.
              let freed = 0;
              if (FileSystem.cacheDirectory) {
                const entries = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
                for (const entry of entries) {
                  const path = `${FileSystem.cacheDirectory}${entry}`;
                  try {
                    const info = await FileSystem.getInfoAsync(path);
                    if (info.exists && !info.isDirectory) freed += info.size || 0;
                    await FileSystem.deleteAsync(path, { idempotent: true });
                  } catch { /* a file in use is not worth failing the whole clear */ }
                }
              }
              await ExpoImage.clearDiskCache();
              await ExpoImage.clearMemoryCache();

              setCacheSize(0);
              Alert.alert('Cleared', `Reclaimed ${(freed / 1048576).toFixed(1)} MB across ${keys.length} cached screen${keys.length === 1 ? '' : 's'} and downloaded media.`);
            } catch {
              Alert.alert('Could not clear', 'Please try again.');
            }
          },
        },
      ],
    );

  const confirmLogout = () =>
    Alert.alert('Sign out', `Sign out of ${user?.username ? `@${user.username}` : 'your account'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ]);

  // Two confirmations: this is permanent and the server deletes everything at once.
  const confirmDeleteAccount = () =>
    Alert.alert(
      'Delete account?',
      'Your profile, posts, shorts, comments and notes are permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', `@${user?.username ?? ''} will be gone for good.`, [
              { text: 'Keep account', style: 'cancel' },
              {
                text: 'Delete forever',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await axios.delete('/user/me', { data: { confirm: 'DELETE' } });
                    await logout();
                  } catch {
                    Alert.alert('Could not delete', 'Check your connection and try again, or write to us from Contact us.');
                  }
                },
              },
            ]),
        },
      ],
    );

  const sections: Array<{ title: string; rows: Row[] }> = [
    {
      title: 'Account',
      rows: [
        { icon: 'person-outline', label: 'Edit profile', onPress: () => navigation.navigate('EditProfile') },
        { icon: 'contrast-outline', label: 'Appearance', hint: 'System, light or dark', value: THEME_LABEL[themePref], onPress: pickTheme },
        { icon: 'ribbon-outline', label: 'Profile builder', hint: 'Skills, projects, resume', onPress: () => navigation.navigate('FyncProfileBuilder') },
        ...(isFeatureOn('fyncProPaid') ? [{ icon: 'diamond-outline', label: 'Subscription', hint: 'Fync Pro plan and billing', onPress: () => navigation.navigate('SubscriptionScreen') } as Row] : []),
        ...(isFeatureOn('myShares') ? [{ icon: 'link-outline', label: 'Your shares', hint: 'Links you shared from Fync Store', onPress: () => navigation.navigate('MySharesScreen') } as Row] : []),
        { icon: 'ban-outline', label: 'Blocked users', onPress: () => navigation.navigate('BlockedUsersScreen') },
      ],
    },
    {
      title: 'App',
      rows: [
        {
          icon: 'notifications-outline',
          label: 'Notification settings',
          hint: 'Opens your device settings',
          onPress: () => Linking.openSettings().catch(() => Alert.alert('Could not open', 'Open Settings from your home screen.')),
        },
        {
          icon: 'trash-bin-outline',
          label: 'Clear cached content',
          hint: 'Images and screens. You stay signed in',
          value: cacheSize === null ? '' : prettyBytes(cacheSize),
          onPress: clearCache,
        },
      ],
    },
    {
      title: 'About',
      rows: [
        { icon: 'people-outline', label: 'Meet the team', onPress: () => navigation.navigate('MeetOurTeam') },
        { icon: 'headset-outline', label: 'Contact us', onPress: () => navigation.navigate('ContactUs') },
        { icon: 'document-text-outline', label: 'Terms & conditions', onPress: () => navigation.navigate('TermsAndCondition') },
        {
          icon: 'shield-checkmark-outline',
          label: 'Privacy policy',
          onPress: () => Linking.openURL(`${process.env.EXPO_PUBLIC_BACKEND_URL}/privacy`).catch(() => {}),
        },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      <AppBar title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-gutter" showsVerticalScrollIndicator={false}>
        {sections.map((sec) => (
          <View key={sec.title}>
            <SectionHeader title={sec.title} />
            <Card style={{ paddingHorizontal: 16 }}>
              {sec.rows.map((row, i) => (
                <React.Fragment key={row.label}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon={row.icon}
                    title={row.label}
                    subtitle={row.hint}
                    meta={row.value || undefined}
                    onPress={row.onPress}
                    chevron
                  />
                </React.Fragment>
              ))}
            </Card>
          </View>
        ))}

        <View style={{ marginTop: 32, gap: 12 }}>
          <Button title="Sign out" icon="log-out-outline" variant="secondary" block onPress={confirmLogout} />
          <Pressable
            onPress={confirmDeleteAccount}
            className="items-center justify-center active:opacity-70"
            style={{ minHeight: 44 }}
            accessibilityRole="button" accessibilityLabel="Delete account"
          >
            <Text className="text-danger text-sm font-semibold">Delete account</Text>
          </Pressable>
        </View>

        <Text className="text-ink-3 text-label text-center mt-6 mb-12">
          Fync {Constants.expoConfig?.version ?? ''}{Platform.OS === 'ios' ? ' · iOS' : ' · Android'}
        </Text>
      </ScrollView>
    </View>
  );
}
