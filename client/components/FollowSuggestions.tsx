import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Avatar from './Avatar';
import { C } from '../constants/colors';
import { Button } from './ui/kit';
import { Pop } from './ui-extra/usePop';

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
// Module cache: the feed recycles these rows, and every remount refetched and
// flashed a spinner, resizing the row under the user's scroll.
let cachedPeople: Suggestion[] | null = null;

export default function FollowSuggestions({ offset = 0 }: { offset?: number }) {
  const navigation = useNavigation<any>();
  const [people, setPeople] = useState<Suggestion[]>(cachedPeople ?? []);
  const [loading, setLoading] = useState(!cachedPeople);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (cachedPeople) return;
    let alive = true;
    axios.get('/user/suggestions', { params: { limit: 12 } })
      .then((res) => { if (res.data.success) cachedPeople = res.data.suggestions ?? []; if (alive && cachedPeople) setPeople(cachedPeople); })
      .catch(() => { /* the feed is the point; a failed row just renders nothing */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const follow = async (id: string) => {
    setBusy(id);
    // Haptic: kit Button already ticks on press.
    // Optimistic: the button is the whole interaction, and waiting on a round
    // trip to acknowledge a tap makes the row feel broken.
    setFollowed((f) => ({ ...f, [id]: true }));
    try {
      await axios.post(`/user/follow/${id}`);
      // Next mount shouldn't offer someone already followed.
      if (cachedPeople) cachedPeople = cachedPeople.filter((x) => x._id !== id);
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
        <ActivityIndicator color={C.brand[500]} />
      </View>
    );
  }
  if (!shown.length) return null;

  return (
    <View className="py-4 mb-3 border-y border-line">
      <Text className="font-semibold text-ink text-base px-gutter mb-3" accessibilityRole="header">
        People you may know
      </Text>

      <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {shown.map((p) => (
          <View
            key={p._id}
            className="bg-card border border-line rounded-2xl p-3 items-center"
            style={{ width: 148 }}
          >
            <Pressable
              onPress={() => navigation.navigate('PublicProfile', { user: p })}
              className="items-center self-stretch active:opacity-85"
              accessibilityRole="button"
              accessibilityLabel={`View ${p.name}'s profile`}
            >
              <Avatar user={p as any} size={56} />
              <Text className="font-semibold text-ink text-sm mt-2 text-center" numberOfLines={1}>
                {p.name}
              </Text>
              <Text className="font-sans text-ink-3 text-xs text-center" numberOfLines={1}>
                @{p.username}
              </Text>

              {/* Why this person is being suggested. A suggestion with no reason
                  attached reads as random, which is what makes people ignore it. */}
              <Text className="font-sans text-ink-3 text-xs text-center mt-0.5" numberOfLines={1}>
                {p.mutuals > 0
                  ? `${p.mutuals} mutual${p.mutuals > 1 ? 's' : ''}`
                  : p.sameCollege
                    ? 'Same college'
                    : ' '}
              </Text>
            </Pressable>

            <Pop on={!!followed[p._id]} style={{ marginTop: 12, alignSelf: 'stretch' }}>
              <Button
                small
                block
                variant={followed[p._id] ? 'secondary' : 'primary'}
                title={followed[p._id] ? 'Following' : 'Follow'}
                onPress={() => follow(p._id)}
                disabled={followed[p._id] || busy === p._id}
                accessibilityLabel={followed[p._id] ? `Following ${p.name}` : `Follow ${p.name}`}
              />
            </Pop>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
