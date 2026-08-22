/**
 * One place for the app-wide switches that were previously scattered or absent:
 * cached content, notification permission, the legal pages, and signing out.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import Constants from 'expo-constants';
import { useAuth } from '../context/auth.context';
import { Alert } from './ui/AlertModal';

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

  const sections: Array<{ title: string; rows: Row[] }> = [
    {
      title: 'Account',
      rows: [
        { icon: 'person-outline', label: 'Edit profile', onPress: () => navigation.navigate('EditProfile') },
        { icon: 'ribbon-outline', label: 'Profile builder', hint: 'Skills, projects, resume', onPress: () => navigation.navigate('FyncProfileBuilder') },
        { icon: 'diamond-outline', label: 'Subscription', hint: 'Fync Pro plan and billing', onPress: () => navigation.navigate('SubscriptionScreen') },
        { icon: 'link-outline', label: 'Your shares', hint: 'Links you shared from Fync Store', onPress: () => navigation.navigate('MySharesScreen') },
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
      ],
    },
  ];

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-gutter pt-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}
          >
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Settings</Text>
          <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>& More</Text>
          <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>
            Everything about your account
          </Text>
        </View>

        <ScrollView className="flex-1 px-gutter" showsVerticalScrollIndicator={false}>
          {sections.map((sec) => (
            <View key={sec.title}>
              <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink text-label font-display uppercase">{sec.title}</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
              </View>

              {sec.rows.map((row) => (
                <TouchableOpacity
                  key={row.label}
                  onPress={row.onPress}
                  className="flex-row items-center bg-card rounded-card p-4 border border-line mb-2"
                  accessibilityRole="button"
                  accessibilityLabel={row.label}
                >
                  <View className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center mr-3">
                    <Ionicons name={row.icon} size={18} color="#57534E" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-ink text-sm">{row.label}</Text>
                    {!!row.hint && <Text className="text-ink-3 text-label mt-0.5">{row.hint}</Text>}
                  </View>
                  {!!row.value && <Text className="text-ink-3 font-mono text-label mr-2">{row.value}</Text>}
                  <Ionicons name="chevron-forward" size={18} color="#C4BEB6" />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <TouchableOpacity
            onPress={confirmLogout}
            className="flex-row items-center justify-center bg-card rounded-card p-4 border-2 border-danger mt-8"
            accessibilityRole="button" accessibilityLabel="Sign out"
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
            <Text className="text-danger font-display uppercase text-label">Sign out</Text>
          </TouchableOpacity>

          <Text className="text-ink-4 text-label text-center mt-6 mb-12">
            Fync {Constants.expoConfig?.version ?? ''}{Platform.OS === 'ios' ? ' · iOS' : ' · Android'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
