/**
 * The last 24 hours of the tech industry, ranked by how much it is being
 * discussed. Backed by /tech-news/trending, which reads the public Hacker News
 * index — no API key and no per-user cost.
 */
import React, { memo, useCallback, useRef, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Linking, StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';
import { AppBar, Empty, Label, Num, SectionHeader, SegmentedTabs, Tag } from '../ui/kit';
import { C } from '../../constants/colors';

import FyncRefreshControl from '../ui/FyncRefreshControl';
type Feed = 'global' | 'india' | 'placement';

const FEEDS: Array<{ id: Feed; label: string; blurb: string }> = [
  { id: 'global', label: 'Global', blurb: 'What the industry is arguing about today' },
  { id: 'india', label: 'India', blurb: 'Indian tech, startups and funding' },
  { id: 'placement', label: 'Placements', blurb: 'Fresher hiring and campus news' },
];

type Story = {
  id: string; title: string; url: string; source: string;
  points: number; comments: number; author: string;
  createdAt: string; discussionUrl: string;
};

/** "4h ago" — the whole point of the screen is that everything here is recent. */
const ago = (iso: string) => {
  if (!iso || isNaN(new Date(iso).getTime())) return '';
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
};

const open = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert('Could not open', 'That link would not open.'));

const StoryRow = memo(({ item, index, ranked, onRead }: { item: Story; index: number; ranked: boolean; onRead: (s: Story) => void }) => (
  <Pressable
    onPress={() => onRead(item)}
    accessibilityRole="button"
    accessibilityLabel={`${item.title}. ${item.points} points on ${item.source}`}
    className="bg-card rounded-2xl p-4 mb-3 border border-line active:opacity-85"
  >
    <View className="flex-row">
      {/* Only Hacker News carries a score; on the Google News feeds the disc
          shows the position instead of a number that would always read 0. */}
      <View
        className="items-center justify-center mr-4"
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.brand[100] }}
      >
        <Num style={{ fontSize: ranked ? 15 : 17 }}>{ranked ? item.points : index + 1}</Num>
        <Text className="font-medium text-ink-3" style={{ fontSize: 10 }}>{ranked ? 'pts' : 'rank'}</Text>
      </View>

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          className="text-ink font-semibold"
          style={{ fontSize: index === 0 ? 17 : 15, lineHeight: index === 0 ? 22 : 20 }}
          numberOfLines={3}
        >
          {item.title}
        </Text>
        <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 8 }}>
          <Tag label={item.source} />
          <Text className="text-ink-3 text-sm">{ago(item.createdAt)}</Text>
        </View>
        {ranked && (
          <Pressable
            onPress={() => open(item.discussionUrl)}
            hitSlop={12}
            className="flex-row items-center mt-3 self-start active:opacity-85"
            accessibilityRole="button"
            accessibilityLabel={`Read ${item.comments} comments`}
          >
            <Ionicons name="chatbubble-outline" size={14} color={C.ink2} />
            <Text className="text-ink-2 text-xs font-medium ml-1.5">
              {item.comments} comments
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  </Pressable>
));

export default function TechPulseScreen() {
  const navigation = useNavigation<any>();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [feed, setFeed] = useState<Feed>('global');

  const read = useCallback(
    (s: Story) => navigation.navigate('ArticleScreen', { url: s.url, title: s.title, source: s.source }),
    [navigation],
  );

  // A feed switch while the previous feed is still loading must not let the
  // slower, older response land last.
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      setFailed(false);
      const res = await axios.get('/tech-news/trending', { params: { limit: 25, feed } });
      if (id === requestId.current) setStories(res.data.stories ?? []);
    } catch {
      if (id === requestId.current) setFailed(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [feed]);

  const ranked = feed === 'global';
  const renderStory = useCallback(
    ({ item, index }: { item: Story; index: number }) => <StoryRow item={item} index={index} ranked={ranked} onRead={read} />,
    [ranked, read],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      <View className="flex-1">
        <AppBar title="Tech Pulse" onBack={() => navigation.goBack()} />
        <View className="px-gutter">
          <Label>{FEEDS.find((f) => f.id === feed)?.blurb}</Label>

          <SegmentedTabs
            style={{ marginTop: 16 }}
            items={FEEDS.map((f) => f.id)}
            value={feed}
            onChange={(id) => { if (id !== feed) { setLoading(true); setFeed(id); } }}
            labels={Object.fromEntries(FEEDS.map((f) => [f.id, f.label]))}
          />

          <SectionHeader
            title={feed === 'placement' ? 'This week' : feed === 'india' ? 'Last 48 hours' : 'Last 24 hours'}
            count={stories.length}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={C.brand[500]} style={{ marginTop: 40 }} />
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            data={stories}
            keyExtractor={(s) => s.id}
            renderItem={renderStory}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <FyncRefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor={C.brand[500]} colors={[C.brand[500]]}
              />
            }
            ListEmptyComponent={
              <View className="mt-12">
                <Empty
                  icon={failed ? 'cloud-offline-outline' : 'newspaper-outline'}
                  title={failed ? 'Could not load' : 'Nothing yet'}
                  hint={failed
                    ? 'The news source could not be reached. Pull down to try again.'
                    : 'No stories in the last 24 hours. Pull down to refresh.'}
                />
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
