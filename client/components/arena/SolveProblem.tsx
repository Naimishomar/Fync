import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar, Empty } from '../ui/kit';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://fync-zeta.vercel.app';

// Functions, not constants: C is read at render so the tints follow the theme.
const levelStyle = (): Record<string, { bg: string; fg: string }> => ({
  Easy:   { bg: C.success + '1F', fg: C.success },
  Medium: { bg: C.brand[100], fg: C.brand[700] },
  Hard:   { bg: C.danger + '1A', fg: C.danger },
});

const verdictFg = (): Record<string, string> => ({
  'Accepted': C.success,
  'Wrong Answer': C.danger,
  'Runtime Error': C.danger,
  'Compilation Error': C.warning,
  'Time Limit Exceeded': C.warning,
});

/**
 * A problem, read-only, with your attempts on it.
 *
 * There is deliberately no editor here. Writing code on a phone keyboard is
 * slow and error-prone, and an app that invites students to do it turns
 * practice into something they do badly in short distracted bursts. Solving
 * happens in the browser; the app is where you read the problem and see how
 * you are doing.
 */
export default function SolveProblem() {
  const navigation = useNavigation<any>();
  const { problemId } = useRoute<any>().params ?? {};
  const bottomInset = useBottomInset();

  const [problem, setProblem] = useState<any>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, prog] = await Promise.allSettled([
        axios.get(`/arena/problems/${problemId}`),
        axios.get('/arena/progress'),
      ]);
      if (p.status === 'fulfilled') setProblem(p.value.data.problem ?? p.value.data);
      if (prog.status === 'fulfilled') {
        const recent = prog.value.data.progress?.recent ?? [];
        setAttempts(recent.filter((r: any) => String(r.problem?._id) === String(problemId)));
      }
    } catch {
      Alert.alert('Could not load', 'This problem would not open.', [{ text: 'Okay' }]);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  // Runs on mount too (first focus). Re-checked on return so a solve completed in the browser shows up without
  // the student having to work out that they need to pull to refresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const solveOnWeb = () => {
    const url = `${WEB_URL}/arena/problem/${problemId}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open', `Go to ${url} on your laptop.`, [{ text: 'Okay' }]),
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator size="large" color={C.brand[500]} />
      </View>
    );
  }

  if (!problem) {
    return (
      <View className="flex-1 bg-paper">
        <AppBar title="Problem" onBack={() => navigation.goBack()} />
        <Empty icon="cloud-offline-outline" title="Could not load" hint="This problem would not open." />
      </View>
    );
  }

  const levels = levelStyle();
  const level = levels[problem?.difficulty] ?? levels.Easy;
  const solved = attempts.some((a) => a.status === 'Accepted');

  return (
    <View className="flex-1 bg-paper">
      <AppBar title="Problem" onBack={() => navigation.goBack()} />
      <View className="px-5 pb-3 border-b-2 border-ink">
        <View className="flex-row items-center mt-1 mb-2">
          <View className="px-2 py-1 rounded-sm" style={{ backgroundColor: level.bg }}>
            <Text className="font-display uppercase" style={{ fontSize: 9, color: level.fg }}>
              {problem?.difficulty}
            </Text>
          </View>
          {solved && (
            <View className="flex-row items-center ml-2 px-2 py-1 rounded-sm" style={{ backgroundColor: C.success + '1F' }}>
              <Ionicons name="checkmark-circle" size={11} color={C.success} />
              <Text className="font-display uppercase ml-1" style={{ fontSize: 9, color: C.success }}>Solved</Text>
            </View>
          )}
          <View className="flex-1" />
          <Text className="font-display text-ink-2" style={{ fontSize: 11 }}>{problem?.points ?? 100} pts</Text>
        </View>

        <Text className="font-display text-xl text-ink" numberOfLines={3}>{problem?.title}</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="font-sans text-ink leading-6" style={{ fontSize: 14 }}>
          {problem?.description}
        </Text>

        {!!problem?.constraints?.length && (
          <View className="mt-5">
            <Text className="font-display text-ink uppercase mb-2" style={{ fontSize: 12 }}>Constraints</Text>
            {problem.constraints.map((c: string, i: number) => (
              <Text key={i} className="font-sans text-ink-2" style={{ fontSize: 13 }}>· {c}</Text>
            ))}
          </View>
        )}

        {!!problem?.testCases?.length && (
          <View className="mt-5">
            <Text className="font-display text-ink uppercase mb-2" style={{ fontSize: 12 }}>Examples</Text>
            {problem.testCases.map((tc: any, i: number) => (
              <View key={i} className="bg-card border-2 border-ink rounded-card p-3 mb-2">
                <Text className="font-display text-ink-2 uppercase" style={{ fontSize: 10 }}>Input</Text>
                <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 12 }}>{tc.input}</Text>
                <Text className="font-display text-ink-2 uppercase mt-2" style={{ fontSize: 10 }}>Expected</Text>
                <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 12 }}>{tc.expectedOutput}</Text>
              </View>
            ))}
          </View>
        )}

        {attempts.length > 0 && (
          <View className="mt-6">
            <Text className="font-display text-ink uppercase mb-2" style={{ fontSize: 12 }}>Your attempts</Text>
            {attempts.map((a) => (
              <View key={a._id} className="flex-row items-center bg-card border-2 border-ink rounded-card px-4 py-3 mb-2">
                <Ionicons
                  name={a.status === 'Accepted' ? 'checkmark-circle' : 'close-circle'}
                  size={16}
                  color={verdictFg()[a.status] ?? C.ink3}
                />
                <View className="ml-2 flex-1">
                  <Text className="font-display" style={{ fontSize: 13, color: verdictFg()[a.status] ?? C.ink }}>
                    {a.status}
                  </Text>
                  <Text className="font-sans text-ink-2" style={{ fontSize: 11 }}>
                    {a.passedCount}/{a.totalCount} tests · {a.language ?? 'code'}
                  </Text>
                </View>
                <Text className="font-sans text-ink-2" style={{ fontSize: 11 }}>
                  {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Padded by the device inset, so the button clears a three-button
          navigation bar as well as a gesture pill. */}
      <View className="px-5 pt-3 border-t-2 border-ink bg-paper" style={{ paddingBottom: bottomInset }}>
        <TouchableOpacity
          onPress={solveOnWeb}
          className="bg-brand-500 border-2 border-ink rounded-card items-center justify-center flex-row gap-2"
          style={{ height: 54 }}
          accessibilityRole="button"
          accessibilityLabel="Open this problem in your browser to solve it"
        >
          <Ionicons name="laptop-outline" size={18} color={C.onBrand} />
          <Text className="font-display text-on-brand uppercase">
            {solved ? 'Open in browser' : 'Solve in browser'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
