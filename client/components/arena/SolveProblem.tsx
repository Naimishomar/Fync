import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, BottomBar, Button, Card, Empty, H2, Label, ListRow, Tag } from '../ui/kit';

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
      <View className="px-5 pb-3 border-b border-line">
        <View className="flex-row items-center mt-1 mb-2" style={{ gap: 8 }}>
          <Tag label={problem?.difficulty ?? 'Easy'} tone={{ bg: level.bg, border: level.bg, fg: level.fg }} />
          {solved && (
            <Tag label="Solved" icon="checkmark-circle" tone={{ bg: C.success + '1F', border: C.success + '1F', fg: C.success }} />
          )}
          <View className="flex-1" />
          <Text className="font-medium text-ink-2 text-xs">{problem?.points ?? 100} pts</Text>
        </View>

        <H2 numberOfLines={3}>{problem?.title}</H2>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text className="font-sans text-ink text-sm leading-6">
          {problem?.description}
        </Text>

        {!!problem?.constraints?.length && (
          <View className="mt-5">
            <Label style={{ marginBottom: 8 }}>Constraints</Label>
            {problem.constraints.map((c: string, i: number) => (
              <Text key={i} className="font-sans text-ink-2 text-sm">· {c}</Text>
            ))}
          </View>
        )}

        {!!problem?.testCases?.length && (
          <View className="mt-5">
            <Label style={{ marginBottom: 8 }}>Examples</Label>
            {problem.testCases.map((tc: any, i: number) => (
              <Card key={i} padded style={{ marginBottom: 12 }}>
                <Label>Input</Label>
                <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 12 }}>{tc.input}</Text>
                <Label style={{ marginTop: 8 }}>Expected</Label>
                <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 12 }}>{tc.expectedOutput}</Text>
              </Card>
            ))}
          </View>
        )}

        {attempts.length > 0 && (
          <View className="mt-6">
            <Label style={{ marginBottom: 8 }}>Your attempts</Label>
            <Card style={{ paddingHorizontal: 16 }}>
              {attempts.map((a) => (
                <ListRow
                  key={a._id}
                  leading={
                    <Ionicons
                      name={a.status === 'Accepted' ? 'checkmark-circle' : 'close-circle'}
                      size={20}
                      color={verdictFg()[a.status] ?? C.ink3}
                    />
                  }
                  title={a.status}
                  subtitle={`${a.passedCount}/${a.totalCount} tests · ${a.language ?? 'code'}`}
                  meta={a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                />
              ))}
            </Card>
          </View>
        )}
      </ScrollView>

      {/* BottomBar pads by the device inset, so the button clears a
          three-button navigation bar as well as a gesture pill. */}
      <BottomBar>
        <Button
          variant="primary"
          style={{ flex: 1 }}
          icon="laptop-outline"
          title={solved ? 'Open in browser' : 'Solve in browser'}
          onPress={solveOnWeb}
          accessibilityLabel="Open this problem in your browser to solve it"
        />
      </BottomBar>
    </View>
  );
}
