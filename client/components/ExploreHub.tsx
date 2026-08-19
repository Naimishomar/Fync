import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth.context';
import { useTabBarClearance } from '../constants/layout';
import {
  CATEGORIES,
  visibleFeatures,
  searchFeatures,
  type Feature,
} from '../constants/features';

const RECENTS_KEY = 'exploreRecents';
const MAX_RECENTS = 8;

const ExploreHub = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const bottomPad = useTabBarClearance();

  const [query, setQuery] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const features = useMemo(() => visibleFeatures(user), [user]);
  const results = useMemo(() => searchFeatures(features, query), [features, query]);

  // Four across on a phone, more on a tablet, without hard-coding a tile width
  // that overflows on small screens.
  const columns = width >= 700 ? 6 : 4;

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(RECENTS_KEY)
        .then((raw) => setRecentIds(raw ? JSON.parse(raw) : []))
        .catch(() => setRecentIds([]));
    }, [])
  );

  const open = (feature: Feature) => {
    const next = [feature.id, ...recentIds.filter((id) => id !== feature.id)].slice(0, MAX_RECENTS);
    setRecentIds(next);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
    navigation.navigate(feature.route, feature.params);
  };

  // Recents are stored as ids, so a feature that is removed from the registry —
  // or that this user can no longer see — drops out instead of rendering a tile
  // that navigates nowhere.
  const recents = useMemo(
    () => recentIds.map((id) => features.find((f) => f.id === id)).filter(Boolean) as Feature[],
    [recentIds, features]
  );

  const Tile = ({ feature }: { feature: Feature }) => (
    <Pressable
      onPress={() => open(feature)}
      style={{ width: `${100 / columns}%` }}
      className="items-center mb-5 px-1 active:opacity-60"
      accessibilityRole="button"
      accessibilityLabel={`${feature.label}. ${feature.hint}`}
    >
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center border border-slate-100 bg-white shadow-sm mb-2"
        style={{ shadowColor: feature.tint, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
      >
        <Ionicons name={feature.icon} size={24} color={feature.tint} />
      </View>
      <Text
        className="text-slate-700 text-2xs font-black uppercase tracking-tight text-center leading-tight"
        numberOfLines={2}
      >
        {feature.label}
      </Text>
    </Pressable>
  );

  const Row = ({ feature }: { feature: Feature }) => (
    <Pressable
      onPress={() => open(feature)}
      className="flex-row items-center bg-white rounded-2xl p-4 mb-2 border border-slate-100 shadow-sm active:opacity-70"
      accessibilityRole="button"
    >
      <View
        className="w-11 h-11 rounded-2xl items-center justify-center mr-4"
        style={{ backgroundColor: `${feature.tint}1A` }}
      >
        <Ionicons name={feature.icon} size={20} color={feature.tint} />
      </View>
      <View className="flex-1">
        <Text className="text-slate-900 font-black uppercase text-xs tracking-tight">{feature.label}</Text>
        <Text className="text-slate-500 text-2xs font-bold tracking-wide mt-0.5">{feature.hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </Pressable>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-8 pt-2">
          <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">
            Explore <Text className="text-orange-500">Fync</Text>
          </Text>
          <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">
            Everything the app can do
          </Text>

          <View className="flex-row items-center bg-white px-5 py-1 rounded-2xl border border-slate-100 shadow-xl shadow-black/5 mt-5 mb-2">
            <Ionicons name="search" size={20} color="#94A3B8" />
            <TextInput
              placeholder="Search features..."
              placeholderTextColor="#CBD5E1"
              value={query}
              onChangeText={setQuery}
              className="flex-1 text-slate-900 font-bold text-sm tracking-tight p-3"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {query.length > 0 ? (
            results.length > 0 ? (
              <>
                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-3 ml-1">
                  {results.length} match{results.length === 1 ? '' : 'es'}
                </Text>
                {results.map((f) => (
                  <Row key={f.id} feature={f} />
                ))}
              </>
            ) : (
              <View className="items-center justify-center mt-16 px-10">
                <View className="w-20 h-20 bg-white rounded-3xl items-center justify-center mb-6 border border-slate-100 shadow-sm">
                  <Ionicons name="telescope-outline" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-slate-500 font-black uppercase text-xs tracking-wide text-center">
                  Nothing matches "{query}"
                </Text>
                <Text className="text-slate-300 text-2xs font-bold uppercase mt-2 text-center">
                  Try a shorter word.
                </Text>
              </View>
            )
          ) : (
            <>
              {recents.length > 0 && (
                <View className="mb-4">
                  <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-4 ml-1">
                    Jump back in
                  </Text>
                  <View className="flex-row flex-wrap">
                    {recents.map((f) => (
                      <Tile key={f.id} feature={f} />
                    ))}
                  </View>
                </View>
              )}

              {CATEGORIES.map((cat) => {
                const items = features.filter((f) => f.category === cat.id);
                if (items.length === 0) return null;
                return (
                  <View key={cat.id} className="mb-4">
                    <View className="flex-row items-center mb-4 ml-1">
                      <Ionicons name={cat.icon} size={13} color="#94A3B8" />
                      <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide ml-2">
                        {cat.label}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap">
                      {items.map((f) => (
                        <Tile key={f.id} feature={f} />
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default ExploreHub;
