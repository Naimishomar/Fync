import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

// ─── Types ────────────────────────────────────────────────────────────────────
interface JudgingCriteria {
  name: string;
  weightage: string;
  description?: string;
}

interface PendingSubmission {
  _id: string;
  ProjectName: string;
  tagline?: string;
  team?: { _id: string; name: string };
  status: string;
}

interface CriteriaScore {
  name: string;
  weightage: number;
  score: number;
}

// ─── Criteria Slider ──────────────────────────────────────────────────────────
const ScoreSlider = ({
  criterion,
  value,
  onChange,
}: {
  criterion: JudgingCriteria;
  value: number;
  onChange: (v: number) => void;
}) => {
  const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-zinc-800 font-black text-sm">{criterion.name}</Text>
          {criterion.description && (
            <Text className="text-slate-400 text-xs mt-0.5">{criterion.description}</Text>
          )}
        </View>
        <View className="bg-indigo-600 rounded-xl px-3 py-1.5 min-w-[44px] items-center">
          <Text className="text-white font-black text-base">{value}</Text>
        </View>
      </View>

      {/* Weight badge */}
      <View className="flex-row items-center mb-3">
        <View className="bg-amber-100 rounded-lg px-2.5 py-1">
          <Text className="text-amber-700 font-black text-[10px] uppercase tracking-widest">
            Weight: {criterion.weightage}%
          </Text>
        </View>
      </View>

      {/* Score buttons 0-10 */}
      <View className="flex-row flex-wrap gap-1.5">
        {SCORES.map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => onChange(s)}
            className={`w-9 h-9 rounded-xl items-center justify-center border ${value === s
                ? 'bg-indigo-600 border-indigo-600'
                : s <= 3
                  ? 'bg-red-50 border-red-100'
                  : s <= 6
                    ? 'bg-amber-50 border-amber-100'
                    : 'bg-green-50 border-green-100'
              }`}
          >
            <Text
              className={`font-black text-xs ${value === s
                  ? 'text-white'
                  : s <= 3
                    ? 'text-red-500'
                    : s <= 6
                      ? 'text-amber-600'
                      : 'text-green-600'
                }`}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Visual progress */}
      <View className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
        <LinearGradient
          colors={value <= 3 ? ['#f87171', '#ef4444'] : value <= 6 ? ['#fbbf24', '#f59e0b'] : ['#34d399', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          className="h-full rounded-full"
          style={{ width: `${value * 10}%` }}
        />
      </View>
    </View>
  );
};

// ─── Pending Submission Card ───────────────────────────────────────────────────
const PendingCard = ({
  sub,
  onScore,
}: {
  sub: PendingSubmission;
  onScore: (sub: PendingSubmission) => void;
}) => (
  <View
    className="bg-white rounded-2xl p-4 mb-3 border border-slate-100"
    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
  >
    <View className="flex-row items-start justify-between mb-2">
      <View className="flex-1 mr-3">
        <Text className="text-zinc-900 font-black  text-base leading-5">{sub.ProjectName}</Text>
        {sub.tagline && <Text className="text-slate-500 text-xs mt-0.5" numberOfLines={1}>{sub.tagline}</Text>}
      </View>
      <View className="bg-amber-100 rounded-xl px-2.5 py-1">
        <Text className="text-amber-700 font-black text-[10px] uppercase">Pending</Text>
      </View>
    </View>

    {sub.team && (
      <View className="flex-row items-center mb-3">
        <Ionicons name="people-outline" size={12} color="#94a3b8" />
        <Text className="text-slate-400 text-xs font-semibold ml-1">{sub.team.name}</Text>
      </View>
    )}

    <TouchableOpacity onPress={() => onScore(sub)} activeOpacity={0.88}>
      <LinearGradient
        colors={['#6366f1', '#8b5cf6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="rounded-xl"
      >
        <View className="py-3 flex-row items-center justify-center">
          <Ionicons name="star" size={14} color="white" />
          <Text className="text-white font-black uppercase tracking-widest text-xs ml-2">Score This</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonJudgePanel = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId, judgingCriteria = [] } = route.params ?? {};

  const [pending, setPending] = useState<PendingSubmission[]>([]);
  const [scoredSubmissions, setScoredSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'scored'>('pending');

  // Scoring modal state
  const [scoringModal, setScoringModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<PendingSubmission | null>(null);
  const [criteriaScores, setCriteriaScores] = useState<CriteriaScore[]>([]);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedCriteria: JudgingCriteria[] = judgingCriteria;

  useEffect(() => {
    if (activeTab === 'pending') loadPending();
    else loadScored();
  }, [activeTab]);

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/scores/judge/pending/${hackathonId}`);
      setPending(res.data.pending ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load pending submissions' });
    } finally {
      setLoading(false);
    }
  };

  const loadScored = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/scores/judge/scored/${hackathonId}`);
      setScoredSubmissions(res.data.scored ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load scored submissions' });
    } finally {
      setLoading(false);
    }
  };

  const openScoring = (sub: any) => {
    setSelectedSub(sub);

    if (activeTab === 'scored' && sub.scores) {
      // Pre-fill with existing scores
      setCriteriaScores(
        parsedCriteria.map(c => {
          const match = sub.scores.find((s: any) => s.name === c.name);
          return {
            name: c.name,
            weightage: Number(c.weightage) || 0,
            score: match ? match.score : 0,
          };
        })
      );
      setFeedback(sub.feedback || '');
    } else {
      // Initialize criteria scores to 0
      setCriteriaScores(
        parsedCriteria.map(c => ({
          name: c.name,
          weightage: Number(c.weightage) || 0,
          score: 0,
        }))
      );
      setFeedback('');
    }
    setScoringModal(true);
  };

  const computeTotalScore = (): number => {
    const totalWeight = criteriaScores.reduce((s, c) => s + c.weightage, 0);
    if (totalWeight === 0) return 0;
    const weighted = criteriaScores.reduce((s, c) => s + (c.score * c.weightage) / totalWeight, 0);
    return parseFloat(weighted.toFixed(2));
  };

  const submitScore = async () => {
    if (!selectedSub) return;
    const total = computeTotalScore();

    Alert.alert(
      'Confirm Score',
      `Submit a score of ${total}/10 for "${selectedSub.ProjectName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await axios.post('/scores', {
                submission: selectedSub._id,
                criteria: criteriaScores,
                feedback,
              });
              Toast.show({ type: 'success', text1: `Scored ${selectedSub.ProjectName} — ${total}/10 ✅` });
              setScoringModal(false);
              loadPending(); // Refresh pending list
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Scoring failed',
                text2: err?.response?.data?.message ?? 'Something went wrong',
              });
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#4338ca']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="pb-6 pt-2"
      >
        <SafeAreaView>
          <View className="flex-row items-center px-5 pt-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center mr-3"
            >
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xl font-black  tracking-tight">Judge Panel</Text>
              <Text className="text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                Review & Score Submissions
              </Text>
            </View>
            <TouchableOpacity onPress={loadPending} className="w-10 h-10 rounded-2xl bg-white/10 items-center justify-center">
              <Ionicons name="refresh" size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View className="flex-row px-5 mt-5 gap-3">
            <TouchableOpacity
              onPress={() => setActiveTab('pending')}
              className={`flex-1 rounded-2xl px-4 py-3 border ${activeTab === 'pending' ? 'bg-white border-white' : 'bg-white/10 border-white/10'}`}
            >
              <Text className={`text-center font-black uppercase tracking-widest text-[10px] ${activeTab === 'pending' ? 'text-indigo-900' : 'text-white/60'}`}>
                To Score ({pending.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('scored')}
              className={`flex-1 rounded-2xl px-4 py-3 border ${activeTab === 'scored' ? 'bg-white border-white' : 'bg-white/10 border-white/10'}`}
            >
              <Text className={`text-center font-black uppercase tracking-widest text-[10px] ${activeTab === 'scored' ? 'text-indigo-900' : 'text-white/60'}`}>
                Scored ({scoredSubmissions.length})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : activeTab === 'pending' ? (
        pending.length === 0 ? (
          <View className="flex-1 items-center justify-center px-10">
            <LinearGradient colors={['#d1fae5', '#a7f3d0']} className="w-24 h-24 rounded-[32px] items-center justify-center mb-5">
              <Ionicons name="checkmark-circle" size={44} color="#10b981" />
            </LinearGradient>
            <Text className="text-zinc-900 font-black  text-xl tracking-tight text-center uppercase mb-2">
              All Scored!
            </Text>
            <Text className="text-slate-400 text-center font-semibold text-xs uppercase tracking-widest">
              You have scored all submissions for this hackathon.
            </Text>
          </View>
        ) : (
          <FlatList
            data={pending}
            keyExtractor={item => item._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => <PendingCard sub={item} onScore={openScoring} />}
          />
        )
      ) : (
        <FlatList
          data={scoredSubmissions}
          keyExtractor={item => item._id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 opacity-80">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-zinc-900 font-bold flex-1 mr-2">{item.submission?.ProjectName || 'Unknown Project'}</Text>
                <View className="bg-indigo-50 px-2 py-1 rounded-lg">
                  <Text className="text-indigo-600 font-black text-xs">{item.totalScore}/10</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => openScoring(item)}>
                <Text className="text-indigo-500 font-black text-[10px] uppercase tracking-widest text-right">Edit Score →</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center mt-20">
              <Ionicons name="star-outline" size={48} color="#cbd5e1" />
              <Text className="text-slate-400 font-black  mt-4">No scored items yet</Text>
            </View>
          )}
        />
      )}

      {/* Scoring Modal */}
      <Modal visible={scoringModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-[#F8FAFC]">
          <SafeAreaView className="flex-1">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 bg-white">
              <View className="flex-1 mr-4">
                <Text className="text-zinc-900 font-black  text-lg" numberOfLines={1}>
                  {selectedSub?.ProjectName}
                </Text>
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Score Submission</Text>
              </View>
              <TouchableOpacity onPress={() => setScoringModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-5 pt-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Total score preview */}
              <LinearGradient
                colors={['#ede9fe', '#ddd6fe']}
                className="rounded-2xl px-5 py-4 mb-6 flex-row items-center justify-between"
              >
                <View>
                  <Text className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">Weighted Total</Text>
                  <Text className="text-indigo-900 font-black text-3xl">{computeTotalScore()}<Text className="text-indigo-400 text-lg">/10</Text></Text>
                </View>
                <Ionicons name="star" size={32} color="#6366f1" />
              </LinearGradient>

              {/* Per-criteria scoring */}
              {parsedCriteria.length > 0 ? (
                parsedCriteria.map((criterion, i) => (
                  <ScoreSlider
                    key={i}
                    criterion={criterion}
                    value={criteriaScores[i]?.score ?? 0}
                    onChange={(v) =>
                      setCriteriaScores(prev =>
                        prev.map((c, idx) => idx === i ? { ...c, score: v } : c)
                      )
                    }
                  />
                ))
              ) : (
                // Fallback: no criteria defined — single overall score
                <ScoreSlider
                  criterion={{ name: 'Overall Score', weightage: '100' }}
                  value={criteriaScores[0]?.score ?? 0}
                  onChange={(v) => setCriteriaScores([{ name: 'Overall Score', weightage: 100, score: v }])}
                />
              )}

              {/* Feedback */}
              <View className="mb-6">
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                  Feedback <Text className="text-slate-300">(optional)</Text>
                </Text>
                <TextInput
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="What did you think? Constructive feedback helps teams grow..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="bg-white rounded-2xl px-4 py-3.5 text-zinc-900 font-semibold border border-slate-200 h-28"
                />
              </View>

              <View className="h-20" />
            </ScrollView>

            {/* Submit */}
            <View className="px-5 pb-8 pt-4 bg-white border-t border-slate-100">
              <TouchableOpacity onPress={submitScore} disabled={submitting} activeOpacity={0.88}>
                <LinearGradient colors={['#6366f1', '#8b5cf6']} className="rounded-2xl">
                  <View className="py-4 flex-row items-center justify-center">
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="star" size={16} color="white" />
                        <Text className="text-white font-black  text-sm uppercase tracking-widest ml-2">
                          Submit Score — {computeTotalScore()}/10
                        </Text>
                      </>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

export default HackathonJudgePanel;
