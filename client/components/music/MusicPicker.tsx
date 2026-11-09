import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trendingTracks, searchTracks, type Track } from '../../utils/audius';

/** Trending when `q` is empty, else search (debounced). Stale responses are dropped. */
export function useTrackSearch(q: string) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    const t = setTimeout(() => {
      (q.trim() ? searchTracks(q.trim()) : trendingTracks())
        .then((list) => { if (live) setTracks(list); })
        .catch(() => { if (live) { setTracks([]); setFailed(true); } });
    }, q.trim() ? 400 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  return { tracks, failed };
}

/** Full-screen Audius picker overlay (stories, Listen Together): trending first, then search. Tap a row to pick. */
export default function MusicPicker({ onPick, onClose }: { onPick: (t: Track) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const { tracks, failed } = useTrackSearch(q);

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(18,16,14,0.96)', paddingTop: insets.top + 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close music" className="active:opacity-85"
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search songs"
          placeholderTextColor="rgba(255,255,255,0.5)"
          autoCorrect={false}
          style={{ flex: 1, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff', paddingHorizontal: 16, fontSize: 15 }}
        />
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, paddingHorizontal: 20, marginTop: 12, marginBottom: 4 }}>
        {q.trim() ? 'Results' : 'Trending'} · music from Audius
      </Text>
      {tracks === null ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 32 }}>
              {failed ? 'Could not load music. Check your connection.' : 'No songs found'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onPick(item)} className="active:opacity-85" accessibilityRole="button"
              accessibilityLabel={`${item.title} by ${item.artist}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56 }}>
              {item.artwork
                ? <Image source={{ uri: item.artwork }} style={{ width: 44, height: 44, borderRadius: 8 }} cachePolicy="memory-disk" />
                : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="musical-notes" size={18} color="#fff" /></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }} numberOfLines={1}>{item.artist}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
