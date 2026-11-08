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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import { useTabBarClearance, useTabBarAutoHide } from '../constants/layout';
import {
  CATEGORIES,
  visibleFeatures,
  searchFeatures,
  type Feature,
} from '../constants/features';
import { C } from '../constants/colors';
import { AppBar, Empty } from './ui/kit';
import FeaturedCarousel from './explore/FeaturedCarousel';

const ICON = 56;

// Module scope on purpose: declared inside the screen, every render would be a
// new component type and React would remount every item instead of updating it.

/** One feature: a neutral round tile with a line icon, its name under it. */
const Item = ({ feature, columns, onOpen }: { feature: Feature; columns: number; onOpen: (f: Feature) => void }) => (
  // The width sits on a plain View: NativeWind's Pressable drops a function
  // `style`, so the cell width never applied and items hugged their labels.
  <View style={{ width: `${100 / columns}%`, paddingHorizontal: 4 }}>
    <Pressable
      onPress={() => onOpen(feature)}
      className="items-center active:opacity-85"
      style={{ gap: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`${feature.label}. ${feature.hint}`}
    >
      <View className="items-center justify-center rounded-full bg-paper-2" style={{ width: ICON, height: ICON }}>
        <Ionicons name={feature.icon} size={26} color={C.ink} />
      </View>
      <Text className="font-sans text-ink text-center" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
        {feature.label}
      </Text>
    </Pressable>
  </View>
);

/** A titled card of features, a grid of round icons inside it. */
const Group = ({ title, items, columns, onOpen }: { title: string; items: Feature[]; columns: number; onOpen: (f: Feature) => void }) => (
  <View className="bg-card border border-line rounded-2xl p-4 mb-3">
    <Text className="font-semibold text-ink mb-4" style={{ fontSize: 16 }} accessibilityRole="header">
      {title}
    </Text>
    <View className="flex-row flex-wrap" style={{ rowGap: 20, marginHorizontal: -4 }}>
      {items.map((f) => (
        <Item key={f.id} feature={f} columns={columns} onOpen={onOpen} />
      ))}
    </View>
  </View>
);

const ExploreHub = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const bottomPad = useTabBarClearance();
  const autoHideTabBar = useTabBarAutoHide();

  const [query, setQuery] = useState('');

  const features = useMemo(() => visibleFeatures(user), [user]);
  const results = useMemo(() => searchFeatures(features, query), [features, query]);

  // Four across on a phone, five on a tablet.
  const columns = width >= 700 ? 5 : 4;

  const open = useCallback((feature: Feature) => {
    navigation.navigate(feature.route, feature.params);
  }, [navigation]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <AppBar title="Explore" />
      <View className="px-gutter pb-3">
        <View className="flex-row items-center bg-card px-4 border border-line rounded-full" style={{ minHeight: 48, gap: 8 }}>
          <Ionicons name="search-outline" size={20} color={C.ink} />
          <TextInput
            placeholder="Search features"
            placeholderTextColor={C.ink3}
            value={query}
            onChangeText={setQuery}
            className="flex-1 font-sans text-base text-ink"
            style={{ minWidth: 0, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search features"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close" size={20} color={C.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPad }}
        {...autoHideTabBar}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {query.length > 0 ? (
          results.length > 0 ? (
            <Group title="Results" items={results} columns={columns} onOpen={open} />
          ) : (
            <Empty icon="search-outline" title="No feature found" hint={`Nothing matches “${query}”. Try a shorter word.`} />
          )
        ) : (
          <>
            {/* The carousel brings its own 24pt top margin; trim it under the search pill and leave a gap before the cards. */}
            <View style={{ marginTop: -12, marginBottom: 12 }}>
              <FeaturedCarousel />
            </View>

            {CATEGORIES.map((cat) => {
              const items = features.filter((f) => f.category === cat.id);
              if (items.length === 0) return null;
              return <Group key={cat.id} title={cat.label} items={items} columns={columns} onOpen={open} />;
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default ExploreHub;
