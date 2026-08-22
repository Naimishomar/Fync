import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Avatar from './Avatar';

interface Suggestion {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  college?: string;
  major?: string;
  mutuals: number;
  sameCollege: number;
}

/**
 * A row of people to follow, injected into the feed every so often.
 *
 * Fetched once per mount rather than per appearance: the feed injects several
 * of these as the student scrolls, and refetching for each would hit the same
 * endpoint repeatedly for a list that barely changes. The offset means each
 * card shows different people.
 */
export default function FollowSuggestions({ offset = 0 }: { offset?: number }) {
  const navigation = useNavigation<any>();
  const [people, setPeople] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    axios.get('/user/suggestions', { params: { limit: 12 } })
      .then((res) => { if (alive && res.data.success) setPeople(res.data.suggestions); })
      .catch(() => { /* the feed is the point; a failed row just renders nothing */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const follow = async (id: string) => {
    setBusy(id);
    // Optimistic: the button is the whole interaction, and waiting on a round
    // trip to acknowledge a tap makes the row feel broken.
    setFollowed((f) => ({ ...f, [id]: true }));
    try {
      await axios.post(`/user/follow/${id}`);
    } catch {
      setFollowed((f) => ({ ...f, [id]: false }));
    } finally {
      setBusy(null);
    }
  };

  // Rotate through the list so a second card is not the first card again.
  const shown = people.length ? [...people.slice(offset % people.length), ...people.slice(0, offset % people.length)].slice(0, 8) : [];

  if (loading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }
  if (!shown.length) return null;

  return (
    <View className="bg-white border-y-2 border-ink py-4 mb-3">
      <View className="flex-row items-center px-5 mb-3">
        <Text className="font-display text-ink uppercase" style={{ fontSize: 13, letterSpacing: 0.4 }}>
          People you may know
        </Text>
        <View className="flex-1" />
        <View className="h-[2px] flex-1 bg-ink ml-3" style={{ maxWidth: 60 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {shown.map((p) => (
          <View
            key={p._id}
            className="bg-paper border-2 border-ink rounded-card p-3 mr-3 items-center"
            style={{ width: 148 }}
          >
            <TouchableOpacity
              onPress={() => navigation.navigate('PublicProfile', { user: p })}
              accessibilityRole="button"
              accessibilityLabel={`View ${p.name}'s profile`}
            >
              <Avatar user={p as any} size={56} />
            </TouchableOpacity>

            <Text className="font-display text-ink mt-2 text-center" style={{ fontSize: 13 }} numberOfLines={1}>
              {p.name}
            </Text>
            <Text className="font-sans text-ink-3 text-center" style={{ fontSize: 11 }} numberOfLines={1}>
              @{p.username}
            </Text>

            {/* Why this person is being suggested. A suggestion with no reason
                attached reads as random, which is what makes people ignore it. */}
            <Text className="font-sans text-ink-3 text-center mt-1" style={{ fontSize: 10 }} numberOfLines={1}>
              {p.mutuals > 0
                ? `${p.mutuals} mutual${p.mutuals > 1 ? 's' : ''}`
                : p.sameCollege
                  ? 'Same college'
                  : ' '}
            </Text>

            <TouchableOpacity
              onPress={() => follow(p._id)}
              disabled={followed[p._id] || busy === p._id}
              className={`w-full mt-3 rounded-xl border-2 border-ink items-center justify-center ${followed[p._id] ? 'bg-paper' : 'bg-brand-500'}`}
              style={{ height: 36 }}
              accessibilityRole="button"
              accessibilityLabel={followed[p._id] ? `Following ${p.name}` : `Follow ${p.name}`}
            >
              <Text className="font-display text-ink" style={{ fontSize: 12 }}>
                {followed[p._id] ? 'FOLLOWING' : 'FOLLOW'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
