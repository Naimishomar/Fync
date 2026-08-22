import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';

const LANGUAGES = [
  { key: 'python',     label: 'Python', id: 71 },
  { key: 'javascript', label: 'JS',     id: 63 },
  { key: 'cpp',        label: 'C++',    id: 54 },
  { key: 'java',       label: 'Java',   id: 62 },
] as const;

type LangKey = typeof LANGUAGES[number]['key'];

const VERDICT_STYLE: Record<string, { bg: string; fg: string }> = {
  'Accepted':           { bg: '#DCFCE7', fg: '#15803D' },
  'Wrong Answer':       { bg: '#FEE2E2', fg: '#B91C1C' },
  'Compilation Error':  { bg: '#FEF3C7', fg: '#B45309' },
  'Runtime Error':      { bg: '#FEE2E2', fg: '#B91C1C' },
  'Time Limit Exceeded':{ bg: '#FEF3C7', fg: '#B45309' },
};

export default function SolveProblem() {
  const navigation = useNavigation<any>();
  const { problemId } = useRoute<any>().params;

  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<LangKey>('python');
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tab, setTab] = useState<'problem' | 'code'>('problem');

  // Remembers what the student wrote in each language, so switching to check
  // the C++ starter and back does not throw away their Python attempt.
  const drafts = useRef<Partial<Record<LangKey, string>>>({});

  useEffect(() => {
    axios.get(`/arena/problems/${problemId}`)
      .then((res) => {
        const p = res.data.problem ?? res.data;
        setProblem(p);
        setCode(p?.starterCode?.python ?? '');
      })
      .catch(() => Alert.alert('Could not load', 'This problem would not open.', [{ text: 'Okay' }]))
      .finally(() => setLoading(false));
  }, [problemId]);

  const switchLang = (next: LangKey) => {
    drafts.current[lang] = code;
    setLang(next);
    setCode(drafts.current[next] ?? problem?.starterCode?.[next] ?? '');
  };

  const submit = async () => {
    if (!code.trim()) {
      Alert.alert('Nothing to submit', 'Write some code first.', [{ text: 'Okay' }]);
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await axios.post('/arena/problems/submit', {
        problemId,
        code,
        language: lang,
        languageId: LANGUAGES.find((l) => l.key === lang)!.id,
      });
      setResult(res.data.submission);
      setTab('code');
    } catch (err: any) {
      Alert.alert('Submission failed', err?.response?.data?.message ?? 'Try again in a moment.', [{ text: 'Okay' }]);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
      </SafeAreaView>
    );
  }

  const verdict = result?.status ? (VERDICT_STYLE[result.status] ?? VERDICT_STYLE['Wrong Answer']) : null;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="px-5 pt-2 pb-3 border-b-2 border-ink">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            style={{ marginLeft: -11 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <View className="flex-1" />
          {/* Two panes rather than one scroll: on a phone the problem statement
              pushes the editor off-screen, and you need both while solving. */}
          <View className="flex-row bg-white border-2 border-ink rounded-xl overflow-hidden">
            {(['problem', 'code'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                className={`px-4 py-2 ${tab === t ? 'bg-brand-500' : 'bg-white'}`}
                style={{ minHeight: 40, justifyContent: 'center' }}
              >
                <Text className="font-display text-ink uppercase" style={{ fontSize: 11 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text className="font-display text-xl text-ink mt-2" numberOfLines={2}>{problem?.title}</Text>
      </View>

      {tab === 'problem' ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text className="font-sans text-ink leading-6" style={{ fontSize: 14 }}>
            {problem?.description}
          </Text>

          {!!problem?.constraints?.length && (
            <View className="mt-5">
              <Text className="font-display text-ink uppercase mb-2" style={{ fontSize: 12 }}>Constraints</Text>
              {problem.constraints.map((c: string, i: number) => (
                <Text key={i} className="font-sans text-ink-3" style={{ fontSize: 13 }}>· {c}</Text>
              ))}
            </View>
          )}

          {!!problem?.testCases?.length && (
            <View className="mt-5">
              <Text className="font-display text-ink uppercase mb-2" style={{ fontSize: 12 }}>Examples</Text>
              {problem.testCases.map((tc: any, i: number) => (
                <View key={i} className="bg-white border-2 border-ink rounded-card p-3 mb-2">
                  <Text className="font-display text-ink-3 uppercase" style={{ fontSize: 10 }}>Input</Text>
                  <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 12 }}>{tc.input}</Text>
                  <Text className="font-display text-ink-3 uppercase mt-2" style={{ fontSize: 10 }}>Expected</Text>
                  <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 12 }}>{tc.expectedOutput}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => switchLang(l.key)}
                  className={`px-4 py-2 rounded-xl border-2 border-ink mr-2 ${lang === l.key ? 'bg-brand-500' : 'bg-white'}`}
                  style={{ minHeight: 40, justifyContent: 'center' }}
                >
                  <Text className="font-display text-ink" style={{ fontSize: 12 }}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
            <TextInput
              value={code}
              onChangeText={setCode}
              multiline
              // Autocorrect and capitalisation actively fight code entry —
              // capitalising keywords and "correcting" identifiers.
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              placeholder="Write your solution"
              placeholderTextColor="#8B857E"
              style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 260, textAlignVertical: 'top' }}
              className="bg-ink text-white rounded-card p-3 border-2 border-ink"
            />

            {!!result && (
              <View className="mt-4 mb-8">
                <View className="flex-row items-center mb-2">
                  <View className="px-3 py-1 rounded-sm" style={{ backgroundColor: verdict!.bg }}>
                    <Text className="font-display uppercase" style={{ fontSize: 11, color: verdict!.fg }}>
                      {result.status}
                    </Text>
                  </View>
                  <Text className="font-display text-ink ml-3" style={{ fontSize: 13 }}>
                    {result.passedCount}/{result.totalCount} passed
                  </Text>
                  <View className="flex-1" />
                  <Text className="font-sans text-ink-3" style={{ fontSize: 11 }}>
                    {result.executionTime}ms
                  </Text>
                </View>

                {!!result.message && (
                  <View className="bg-white border-2 border-ink rounded-card p-3 mb-2">
                    <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {result.message}
                    </Text>
                  </View>
                )}

                {result.results?.map((r: any) => (
                  <View
                    key={r.case}
                    className="bg-white border-2 rounded-card p-3 mb-2"
                    style={{ borderColor: r.passed ? '#15803D' : '#B91C1C' }}
                  >
                    <View className="flex-row items-center">
                      <Ionicons
                        name={r.passed ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={r.passed ? '#15803D' : '#B91C1C'}
                      />
                      <Text className="font-display text-ink ml-2" style={{ fontSize: 12 }}>Case {r.case}</Text>
                    </View>
                    {!r.passed && (
                      <>
                        <Text className="font-display text-ink-3 uppercase mt-2" style={{ fontSize: 9 }}>Expected</Text>
                        <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.expected}</Text>
                        <Text className="font-display text-ink-3 uppercase mt-1" style={{ fontSize: 9 }}>Got</Text>
                        <Text className="text-ink" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.got || '(nothing)'}</Text>
                        {!!r.error && (
                          <Text className="text-danger mt-1" style={{ fontFamily: 'monospace', fontSize: 10 }}>{r.error}</Text>
                        )}
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View className="px-5 pb-4 pt-2 border-t-2 border-ink bg-paper">
            <TouchableOpacity
              onPress={submit}
              disabled={running}
              className="bg-brand-500 border-2 border-ink rounded-card items-center justify-center"
              style={{ height: 54, opacity: running ? 0.6 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Submit solution"
            >
              {running
                ? <ActivityIndicator color="#12100E" />
                : <Text className="font-display text-ink">SUBMIT</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
