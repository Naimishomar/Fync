import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Meta, Button, Card, Divider, ListRow, SectionHeader } from '../ui/kit';

import FyncRefreshControl from '../ui/FyncRefreshControl';
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
      const list = res.data?.problems ?? res.data;
      setProblems(Array.isArray(list) ? list : []);
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
    <View className="flex-1 bg-paper">
      <AppBar title="Problem Bank" onBack={() => navigation.goBack()} />
      <View className="px-5">
        <Meta className="mb-4">{loading ? 'Loading' : `${problems.length} problems live`}</Meta>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        refreshControl={<FyncRefreshControl refreshing={false} onRefresh={load} tintColor={C.brand[500]} />}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
          <Text className="font-semibold text-ink flex-1" style={{ fontSize: 16 }} accessibilityRole="header">Paste problems</Text>
          <Button title="Use template" small onPress={() => setJson(TEMPLATE)} />
          <Button title="Paste" small icon="clipboard-outline" onPress={async () => setJson(await Clipboard.getStringAsync())} />
        </View>

        <TextInput
          value={json}
          onChangeText={setJson}
          multiline
          placeholder="A problem object, or an array of them"
          placeholderTextColor={C.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Problems JSON"
          // Monospace so the JSON is legible and a stray bracket is findable.
          style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 260, textAlignVertical: 'top' }}
          className="bg-card border border-line rounded-2xl p-3 text-ink"
        />

        <Button
          title="Import"
          variant="primary"
          block
          loading={busy}
          disabled={!json.trim()}
          onPress={submit}
          accessibilityLabel="Import problems"
          style={{ marginTop: 16 }}
        />

        {!!report && (
          <View className="mt-5">
            {report.created?.length > 0 && (
              <Card padded style={{ marginBottom: 12 }}>
                <Text className="font-semibold text-ink mb-2">Imported {report.created.length}</Text>
                {report.created.map((c: any) => (
                  <Text key={c.id} className="font-sans text-ink-3" style={{ fontSize: 12 }} numberOfLines={1}>
                    ✓ {c.title} — {c.cases} test cases
                  </Text>
                ))}
              </Card>
            )}

            {report.errors?.length > 0 && (
              <Card padded style={{ borderColor: C.danger }}>
                <Text className="font-semibold text-danger mb-2">Rejected {report.errors.length}</Text>
                {report.errors.map((e: any) => (
                  <View key={e.index} className="mb-2">
                    <Text className="font-sans text-ink" style={{ fontSize: 12 }}>
                      #{e.index + 1} {e.title}
                    </Text>
                    {e.problems?.map((p: string, i: number) => (
                      <Text key={i} className="font-sans text-ink-3 ml-3" style={{ fontSize: 12 }}>· {p}</Text>
                    ))}
                  </View>
                ))}
              </Card>
            )}
          </View>
        )}

        {problems.length > 0 && (
          <>
            <SectionHeader title="In the bank" count={problems.length} />
            <Card style={{ paddingHorizontal: 16 }}>
              {problems.slice(0, 40).map((p: any, i: number) => (
                <React.Fragment key={p._id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={p.title}
                    subtitle={`${p.difficulty} · ${p.testCases?.length ?? 0} cases · ${p.points ?? 100} pts`}
                  />
                </React.Fragment>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
