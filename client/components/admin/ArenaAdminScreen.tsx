import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';

/**
 * Problem bank admin.
 *
 * Problems arrive as pasted JSON rather than through a form. A problem worth
 * setting has twenty to forty test cases, and no one is typing those into a
 * phone — they get authored in an editor and pasted here in one go.
 */
const TEMPLATE = `[
  {
    "title": "Sum of Two Numbers",
    "description": "Read two integers and print their sum.",
    "difficulty": "Easy",
    "category": "Math",
    "tags": ["math", "basics"],
    "timeLimit": 2000,
    "points": 100,
    "constraints": ["-10^9 <= a, b <= 10^9"],
    "starterCode": {
      "python": "a, b = map(int, input().split())\\n# your code",
      "javascript": "const [a,b] = readline().split(' ').map(Number);",
      "cpp": "#include <iostream>\\nint main(){ }",
      "java": "import java.util.*;\\npublic class Main{ public static void main(String[] a){ } }"
    },
    "testCases": [
      { "input": "2 3", "expectedOutput": "5" },
      { "input": "10 20", "expectedOutput": "30" },
      { "input": "-4 9", "expectedOutput": "5", "isHidden": true }
    ]
  }
]`;

export default function ArenaAdminScreen() {
  const navigation = useNavigation<any>();
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/arena/admin/problems');
      setProblems(res.data.problems ?? res.data ?? []);
    } catch {
      // The bank listing failing must not block importing more problems.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch (e: any) {
      // Parsed here rather than server-side so the message points at the
      // character that broke, which the server could not tell them.
      Alert.alert('Not valid JSON', e?.message ?? 'Check the brackets and commas.', [{ text: 'Okay' }]);
      return;
    }

    setBusy(true);
    setReport(null);
    try {
      const res = await axios.post('/arena/admin/problems/import', parsed);
      setReport(res.data);
      if (res.data.created?.length) {
        setJson('');
        load();
      }
    } catch (err: any) {
      const data = err?.response?.data;
      setReport(data ?? null);
      if (!data) Alert.alert('Import failed', 'Could not reach the server.', [{ text: 'Okay' }]);
    } finally {
      setBusy(false);
    }
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
        <Text className="font-display text-display text-ink uppercase" style={{ lineHeight: 35, letterSpacing: -1.2 }}>Problem</Text>
        <Text className="font-display text-display text-brand-600 uppercase" style={{ lineHeight: 35, letterSpacing: -1.2 }}>Bank</Text>
        <Text className="font-display text-ink-3 uppercase mt-2 mb-4" style={{ fontSize: 11, letterSpacing: 1.4 }}>
          {loading ? 'Loading' : `${problems.length} problems live`}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#F97316" />}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center mb-2">
          <Text className="font-display text-ink uppercase" style={{ fontSize: 13 }}>Paste problems</Text>
          <View className="flex-1" />
          <TouchableOpacity
            onPress={() => setJson(TEMPLATE)}
            className="px-3 py-2 rounded-xl border-2 border-ink bg-white"
            style={{ minHeight: 40, justifyContent: 'center' }}
          >
            <Text className="font-display text-ink" style={{ fontSize: 11 }}>USE TEMPLATE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => setJson(await Clipboard.getStringAsync())}
            className="px-3 py-2 rounded-xl border-2 border-ink bg-white ml-2"
            style={{ minHeight: 40, justifyContent: 'center' }}
          >
            <Text className="font-display text-ink" style={{ fontSize: 11 }}>PASTE</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={json}
          onChangeText={setJson}
          multiline
          placeholder="A problem object, or an array of them"
          placeholderTextColor="#8B857E"
          autoCapitalize="none"
          autoCorrect={false}
          // Monospace so the JSON is legible and a stray bracket is findable.
          style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 260, textAlignVertical: 'top' }}
          className="bg-white border-2 border-ink rounded-card p-3 text-ink"
        />

        <TouchableOpacity
          onPress={submit}
          disabled={busy || !json.trim()}
          className="bg-brand-500 border-2 border-ink rounded-card mt-4 items-center justify-center"
          style={{ height: 54, opacity: busy || !json.trim() ? 0.5 : 1 }}
          accessibilityRole="button"
          accessibilityLabel="Import problems"
        >
          {busy ? <ActivityIndicator color="#12100E" /> : <Text className="font-display text-ink">IMPORT</Text>}
        </TouchableOpacity>

        {!!report && (
          <View className="mt-5">
            {report.created?.length > 0 && (
              <View className="bg-white border-2 border-ink rounded-card p-4 mb-3">
                <Text className="font-display text-ink mb-2">Imported {report.created.length}</Text>
                {report.created.map((c: any) => (
                  <Text key={c.id} className="font-sans text-ink-3" style={{ fontSize: 12 }} numberOfLines={1}>
                    ✓ {c.title} — {c.cases} test cases
                  </Text>
                ))}
              </View>
            )}

            {report.errors?.length > 0 && (
              <View className="bg-white border-2 border-danger rounded-card p-4">
                <Text className="font-display text-danger mb-2">Rejected {report.errors.length}</Text>
                {report.errors.map((e: any) => (
                  <View key={e.index} className="mb-2">
                    <Text className="font-sans text-ink" style={{ fontSize: 12 }}>
                      #{e.index + 1} {e.title}
                    </Text>
                    {e.problems.map((p: string, i: number) => (
                      <Text key={i} className="font-sans text-ink-3 ml-3" style={{ fontSize: 11 }}>· {p}</Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {problems.length > 0 && (
          <View className="mt-6">
            <Text className="font-display text-ink uppercase mb-2" style={{ fontSize: 13 }}>In the bank</Text>
            {problems.slice(0, 40).map((p: any) => (
              <View key={p._id} className="bg-white border-2 border-ink rounded-card px-4 py-3 mb-2 flex-row items-center">
                <View className="flex-1">
                  <Text className="font-display text-ink" style={{ fontSize: 14 }} numberOfLines={1}>{p.title}</Text>
                  <Text className="font-sans text-ink-3" style={{ fontSize: 11 }}>
                    {p.difficulty} · {p.testCases?.length ?? 0} cases · {p.points ?? 100} pts
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
