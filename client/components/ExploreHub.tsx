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
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { readRecentFeatureIds, recordFeatureUse } from '../utils/recentFeatures';
import { useAuth } from '../context/auth.context';
import { useTabBarClearance } from '../constants/layout';
import {
  CATEGORIES,
  artUrl,
  visibleFeatures,
  searchFeatures,
  type Feature,
} from '../constants/features';

// A category reads as one colour instead of forty. `feature.tint` stays in
// constants/features.ts as a fallback for anything not yet categorised.
const FAMILY: Record<string, string> = {
  study: '#7C3AED', career: '#2563EB', events: '#EA580C',
  social: '#0891B2', campus: '#57534E', fun: '#DB2777', account: '#57534E',
};


// Declared at module scope on purpose: inside the component these are a new
// function type on every render, so React unmounts and remounts every tile
// rather than updating it — which is what made opening a feature feel slow.
const Tile = ({ feature, columns, onOpen }: { feature: Feature; columns: number; onOpen: (f: Feature) => void }) => (
  <Pressable
    onPress={() => onOpen(feature)}
    style={{ width: `${100 / columns}%`, paddingHorizontal: 6 }}
    className="items-center pb-[18px] active:opacity-60"
    accessibilityRole="button"
    accessibilityLabel={`${feature.label}. ${feature.hint}`}
  >
    <View className="w-full h-[62px] items-center justify-center border-[1.5px] border-line bg-card mb-[7px] rounded-md">
      {/* 3D artwork when the feature has it; the Ionicon stays as the fallback
          so a new feature is never a blank tile before art is chosen for it. */}
      {artUrl(feature.art) ? (
        <ExpoImage
          source={{ uri: artUrl(feature.art) }}
          style={{ width: 38, height: 38 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={120}
        />
      ) : (
        <Ionicons name={feature.icon} size={24} color={FAMILY[feature.category] ?? feature.tint} />
      )}
    </View>
    <Text
      className="font-display text-ink text-label text-center leading-tight"
      numberOfLines={2}
    >
      {feature.label}
    </Text>
  </Pressable>
);

const Row = ({ feature, onOpen }: { feature: Feature; onOpen: (f: Feature) => void }) => (
  <Pressable
    onPress={() => onOpen(feature)}
    className="flex-row items-center bg-card rounded-card p-card-pad mb-3 border border-line active:opacity-70"
    accessibilityRole="button"
    accessibilityLabel={`${feature.label}. ${feature.hint}`}
  >
    <View
      className="w-11 h-11 rounded-xl items-center justify-center mr-3"
      style={{ backgroundColor: `${FAMILY[feature.category] ?? feature.tint}1A` }}
    >
      {artUrl(feature.art) ? (
        <ExpoImage source={{ uri: artUrl(feature.art) }} style={{ width: 26, height: 26 }} contentFit="contain" cachePolicy="disk" />
      ) : (
        <Ionicons name={feature.icon} size={20} color={FAMILY[feature.category] ?? feature.tint} />
      )}
    </View>
    <View className="flex-1 min-w-0">
      <Text className="font-semibold text-base text-ink" numberOfLines={1}>{feature.label}</Text>
      <Text className="font-sans text-sm text-ink-3 mt-0.5" numberOfLines={1}>{feature.hint}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#C4BEB6" />
  </Pressable>
);

// Eyebrow, 2px hard rule to the edge, tabular count on the right.
const Rule = ({ label, count }: { label: string; count?: number }) => (
  <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
    <Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>{label}</Text>
    <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
    {count != null ? (
      <Text className="font-display text-label text-ink-3">{count}</Text>
    ) : null}
  </View>
);

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
      readRecentFeatureIds().then(setRecentIds).catch(() => setRecentIds([]));
    }, [])
  );

  const open = useCallback((feature: Feature) => {
    // Navigate first. Persisting recents re-renders the whole grid, and doing
    // that before the transition made every tap wait for it.
    navigation.navigate(feature.route, feature.params);
    recordFeatureUse(feature.id).then(setRecentIds).catch(() => {});
  }, [navigation]);

  // Recents are stored as ids, so a feature that is removed from the registry —
  // or that this user can no longer see — drops out instead of rendering a tile
  // that navigates nowhere.
  const recents = useMemo(
    () => recentIds.map((id) => features.find((f) => f.id === id)).filter(Boolean) as Feature[],
    [recentIds, features]
  );

  // The box fills its grid column so the row lines up with the section rule above
  // it. A fixed-width box centred in a wider column sits ~17px inside the gutter
  // and never does.

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-gutter pt-4">
          <Text className="font-display text-ink uppercase text-display" style={{ letterSpacing: -1.2 }}>
            Explore
          </Text>
          <Text className="font-display text-accent-text uppercase text-display" style={{ letterSpacing: -1.2 }}>
            Fync
          </Text>
          <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>
            Everything the app can do
          </Text>

          <View className="flex-row items-center bg-card px-4 border-2 border-ink mt-5 rounded-md" style={{ minHeight: 50 }}>
            <Ionicons name="search" size={20} color="#8B857E" />
            <TextInput
              placeholder="Search features..."
              placeholderTextColor="#8B857E"
              value={query}
              onChangeText={setQuery}
              className="flex-1 font-sans text-base text-ink px-3"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={18} color="#C4BEB6" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {query.length > 0 ? (
            results.length > 0 ? (
              <>
                <Rule label="Results" count={results.length} />
                {results.map((f) => (
                  <Row key={f.id} feature={f} onOpen={open} />
                ))}
              </>
            ) : (
              <View className="items-center mt-10 py-7 px-5 rounded-card border border-dashed border-line">
                <Ionicons name="telescope-outline" size={28} color="#C4BEB6" />
                <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>
                  Nothing matches “{query}”
                </Text>
                <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
                  Try a shorter word.
                </Text>
              </View>
            )
          ) : (
            <>
              {recents.length > 0 && (
                <>
                  <Rule label="Jump back in" />
                  <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                    {recents.map((f) => (
                      <Tile key={f.id} feature={f} columns={columns} onOpen={open} />
                    ))}
                  </View>
                </>
              )}

              {CATEGORIES.map((cat) => {
                const items = features.filter((f) => f.category === cat.id);
                if (items.length === 0) return null;
                return (
                  <View key={cat.id}>
                    <Rule label={cat.label} count={items.length} />
                    <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
                      {items.map((f) => (
                        <Tile key={f.id} feature={f} columns={columns} onOpen={open} />
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
