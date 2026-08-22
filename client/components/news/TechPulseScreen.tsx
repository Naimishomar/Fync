/**
 * The last 24 hours of the tech industry, ranked by how much it is being
 * discussed. Backed by /tech-news/trending, which reads the public Hacker News
 * index — no API key and no per-user cost.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Linking, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';

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
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
};

const open = (url: string) =>
  Linking.openURL(url).catch(() => Alert.alert('Could not open', 'That link would not open.'));

const StoryRow = ({ item, index, ranked, onRead }: { item: Story; index: number; ranked: boolean; onRead: (s: Story) => void }) => (
  <View style={{ position: 'relative', marginBottom: index === 0 ? 20 : 12 }}>
    {index === 0 && (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, backgroundColor: '#12100E', borderRadius: 20 }}
      />
    )}
    <TouchableOpacity
      onPress={() => onRead(item)}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.points} points on ${item.source}`}
      className={`bg-card rounded-card p-card-pad ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}
    >
      <View className="flex-row">
        <View className="items-center mr-4" style={{ width: 52 }}>
          {/* Only Hacker News carries a score; on the Google News feeds the stamp
              shows the position instead of a number that would always read 0. */}
          <View
            className="items-center justify-center"
            style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderStyle: 'dashed', borderColor: '#12100E', backgroundColor: '#FFEDD5' }}
          >
            <Text className="font-display text-ink" style={{ fontSize: ranked ? 15 : 17, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>
              {ranked ? item.points : index + 1}
            </Text>
            <Text className="font-display text-ink-3" style={{ fontSize: 8, letterSpacing: 0.8 }}>
              {ranked ? 'PTS' : 'RANK'}
            </Text>
          </View>
        </View>

        <View className="flex-1">
          <Text
            className="text-ink font-bold"
            style={{ fontSize: index === 0 ? 17 : 15, lineHeight: index === 0 ? 22 : 20 }}
            numberOfLines={3}
          >
            {item.title}
          </Text>
          <View className="flex-row items-center flex-wrap mt-2" style={{ gap: 8 }}>
            <View className="bg-paper-2 px-2.5 py-1 rounded-full">
              <Text className="text-ink-2 text-label font-display uppercase" numberOfLines={1}>{item.source}</Text>
            </View>
            <Text className="text-ink-3 text-sm">{ago(item.createdAt)}</Text>
          </View>
          {ranked && (
            <TouchableOpacity
              onPress={() => open(item.discussionUrl)}
              className="flex-row items-center mt-3"
              accessibilityRole="button"
              accessibilityLabel={`Read ${item.comments} comments`}
            >
              <Ionicons name="chatbubble-outline" size={14} color="#57534E" />
              <Text className="text-ink-2 text-label font-display uppercase ml-1.5">
                {item.comments} comments
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  </View>
);

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

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const res = await axios.get('/tech-news/trending', { params: { limit: 25, feed } });
      setStories(res.data.stories ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feed]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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

          <Text className="font-display text-ink uppercase text-display" style={{ letterSpacing: -1.2 }}>Tech</Text>
          <Text className="font-display text-accent-text uppercase text-display" style={{ letterSpacing: -1.2 }}>Pulse</Text>
          <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>
            {FEEDS.find((f) => f.id === feed)?.blurb}
          </Text>

          <View className="flex-row mt-5" style={{ gap: 8 }}>
            {FEEDS.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => { if (f.id !== feed) { setLoading(true); setFeed(f.id); } }}
                className={`flex-1 items-center justify-center rounded-md border-2 ${feed === f.id ? 'bg-brand-500 border-ink' : 'bg-card border-line'}`}
                style={{ minHeight: 44 }}
                accessibilityRole="button"
                accessibilityLabel={`${f.label} news`}
              >
                <Text className={`font-display uppercase text-label ${feed === f.id ? 'text-ink' : 'text-ink-2'}`}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
            <Text className="text-ink text-label font-display uppercase">
              {feed === 'placement' ? 'This week' : feed === 'india' ? 'Last 48 hours' : 'Last 24 hours'}
            </Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            <Text className="text-ink-3 font-mono text-label">{stories.length}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#F97316" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={stories}
            keyExtractor={(s) => s.id}
            renderItem={({ item, index }) => <StoryRow item={item} index={index} ranked={feed === 'global'} onRead={read} />}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); load(); }}
                tintColor="#F97316" colors={['#F97316']}
              />
            }
            ListEmptyComponent={
              <View className="items-center mt-16">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-4">
                  <Ionicons name={failed ? 'cloud-offline-outline' : 'newspaper-outline'} size={32} color="#57534E" />
                </View>
                <Text className="text-ink font-display uppercase text-h2 text-center">
                  {failed ? 'Could not load' : 'Nothing yet'}
                </Text>
                <Text className="text-ink-2 text-sm text-center mt-2 px-8">
                  {failed
                    ? 'The news source could not be reached. Pull down to try again.'
                    : 'No stories in the last 24 hours. Pull down to refresh.'}
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
