import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StatusBar, useWindowDimensions } from 'react-native';
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
import { AppBar, GUTTER, Card, Empty, SearchField, Tile, TileGrid } from './ui/kit';
import FeaturedCarousel from './explore/FeaturedCarousel';

// Module scope on purpose: declared inside the screen, every render would be a
// new component type and React would remount every item instead of updating it.

/** A titled card of features, a grid of round icons inside it. */
const Group = ({ title, items, columns, onOpen }: { title: string; items: Feature[]; columns: number; onOpen: (f: Feature) => void }) => (
  <Card style={{ marginBottom: 12 }}>
    <Text className="font-semibold text-base text-accent-text mb-4" accessibilityRole="header">
      {title}
    </Text>
    <TileGrid>
      {items.map((f) => (
        <Tile key={f.id} label={f.label} hint={f.hint} icon={f.icon} columns={columns} onPress={() => onOpen(f)} />
      ))}
    </TileGrid>
  </Card>
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
        <SearchField
          placeholder="Search features"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: bottomPad }}
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
