import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';

interface Problem {
  _id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category?: string;
  tags?: string[];
  points?: number;
}

const LEVELS = ['All', 'Easy', 'Medium', 'Hard'] as const;

// Difficulty is the one place colour carries meaning here, so it is paired with
// the word rather than replacing it.
const LEVEL_STYLE: Record<string, { bg: string; fg: string }> = {
  Easy:   { bg: '#DCFCE7', fg: '#15803D' },
  Medium: { bg: '#FFEDD5', fg: '#C2410C' },
  Hard:   { bg: '#FEE2E2', fg: '#B91C1C' },
};

export default function CodingArena() {
  const navigation = useNavigation<any>();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [contests, setContests] = useState<any[]>([]);
  const [level, setLevel] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Settled, not awaited together: no contests running is the normal state
      // and must not leave the problem list empty.
      const [p, c] = await Promise.allSettled([
        axios.get('/arena/problems'),
        axios.get('/arena/contests'),
      ]);
      if (p.status === 'fulfilled' && p.value.data.success) setProblems(p.value.data.problems ?? []);
      if (c.status === 'fulfilled') setContests(c.value.data.contests ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = level === 'All' ? problems : problems.filter((p) => p.difficulty === level);

  const renderProblem = ({ item }: { item: Problem }) => {
    const style = LEVEL_STYLE[item.difficulty] ?? LEVEL_STYLE.Easy;
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('SolveProblem', { problemId: item._id, title: item.title })}
        className="bg-white border-2 border-ink rounded-card p-4 mb-3"
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Solve ${item.title}, ${item.difficulty}`}
      >
        <View className="flex-row items-center mb-2">
          <View className="px-2 py-1 rounded-sm" style={{ backgroundColor: style.bg }}>
            <Text className="font-display uppercase" style={{ fontSize: 9, color: style.fg }}>
              {item.difficulty}
            </Text>
          </View>
          {!!item.category && (
            <Text className="font-sans text-ink-3 ml-2" style={{ fontSize: 11 }}>{item.category}</Text>
          )}
          <View className="flex-1" />
          <Text className="font-display text-ink-3" style={{ fontSize: 11 }}>{item.points ?? 100} pts</Text>
        </View>

        <Text className="font-display text-base text-ink" numberOfLines={2}>{item.title}</Text>

        {!!item.tags?.length && (
          <Text className="font-sans text-ink-3 mt-1" style={{ fontSize: 11 }} numberOfLines={1}>
            {item.tags.join(' · ')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="px-5 pt-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-11 h-11 items-center justify-center rounded-xl"
          style={{ marginLeft: -11 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#12100E" />
        </TouchableOpacity>

        <Text className="font-display text-display text-ink uppercase" style={{ lineHeight: 35, letterSpacing: -1.2 }}>Coding</Text>
        <Text className="font-display text-display text-brand-600 uppercase" style={{ lineHeight: 35, letterSpacing: -1.2 }}>Arena</Text>
        <Text className="font-display text-ink-3 uppercase mt-2 mb-4" style={{ fontSize: 11, letterSpacing: 1.4 }}>
          {loading ? 'Loading' : `${problems.length} problems`}
        </Text>
      </View>

      {!!contests.length && (
        <View className="mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {contests.map((c: any) => (
              <TouchableOpacity
                key={c._id}
                onPress={() => navigation.navigate('ContestDetail', { contestId: c._id })}
                className="bg-ink rounded-card p-4 mr-3 border-2 border-ink"
                style={{ width: 240 }}
                activeOpacity={0.9}
              >
                <View className="flex-row items-center mb-2">
                  <View className="bg-brand-500 px-2 py-1 rounded-sm">
                    <Text className="font-display text-ink uppercase" style={{ fontSize: 9 }}>Contest</Text>
                  </View>
                </View>
                <Text className="font-display text-white" style={{ fontSize: 15 }} numberOfLines={2}>{c.title}</Text>
                <Text className="font-sans text-night-3 mt-1" style={{ fontSize: 11 }}>
                  {c.startTime ? new Date(c.startTime).toLocaleString() : 'Scheduled'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {LEVELS.map((l) => (
            <TouchableOpacity
              key={l}
              onPress={() => setLevel(l)}
              className={`px-4 py-2 rounded-xl border-2 border-ink mr-2 ${level === l ? 'bg-brand-500' : 'bg-white'}`}
              style={{ minHeight: 40, justifyContent: 'center' }}
            >
              <Text className="font-display text-ink" style={{ fontSize: 12 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : (
        <FlatList
          data={shown}
          renderItem={renderProblem}
          keyExtractor={(p) => p._id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#F97316" />
          }
          ListEmptyComponent={
            <View className="items-center mt-20 px-8">
              <Ionicons name="code-slash-outline" size={56} color="#C4BEB6" />
              <Text className="font-display text-base text-ink mt-4 text-center">No problems yet</Text>
              <Text className="font-sans text-ink-3 mt-2 text-center" style={{ fontSize: 13 }}>
                {level === 'All'
                  ? 'An admin needs to import some into the Problem Bank.'
                  : `Nothing at ${level} level right now.`}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
