import React, { useEffect, useState, useCallback } from 'react';
import {View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, TextInput, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Alert } from '../ui/AlertModal';

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
          <Text className="text-ink font-semibold text-sm">{criterion.name}</Text>
          {criterion.description && (
            <Text className="text-ink-3 text-xs mt-0.5">{criterion.description}</Text>
          )}
        </View>
        <View className="bg-ink rounded-xl px-3 py-1.5 min-w-[44px] items-center">
          <Text className="text-white font-semibold text-base">{value}</Text>
        </View>
      </View>

      {/* Weight badge */}
      <View className="flex-row items-center mb-3">
        <View className="bg-warning/15 rounded-lg px-2.5 py-1">
          <Text className="font-display text-label text-warning uppercase">
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
            className={`w-9 h-9 rounded-xl items-center justify-center border ${value === s ? 'bg-ink border-ink' : s <= 3 ? 'bg-danger/10 border-danger/15' : s <= 6 ? 'bg-warning/10 border-warning/15' : 'bg-success/10 border-success/15' }`}
          >
            <Text
              className={`font-semibold text-xs ${value === s ? 'text-white' : s <= 3 ? 'text-danger' : s <= 6 ? 'text-warning' : 'text-success' }`}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Visual progress */}
      <View className="mt-3 h-2 bg-paper-2 rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{
            width: `${value * 10}%`,
            backgroundColor: value <= 3 ? '#DC2626' : value <= 6 ? '#B45309' : '#047857',
          }}
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
    className="bg-card rounded-card p-4 mb-3 border border-line"
    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
  >
    <View className="flex-row items-start justify-between mb-2">
      <View className="flex-1 mr-3">
        <Text className="text-ink font-semibold text-base leading-5">{sub.ProjectName}</Text>
        {sub.tagline && <Text className="text-ink-3 text-xs mt-0.5" numberOfLines={1}>{sub.tagline}</Text>}
      </View>
      <View className="bg-warning/15 rounded-xl px-2.5 py-1">
        <Text className="font-display text-label text-warning uppercase">Pending</Text>
      </View>
    </View>

    {sub.team && (
      <View className="flex-row items-center mb-3">
        <Ionicons name="people-outline" size={12} color="#8B857E" />
        <Text className="text-ink-3 text-xs font-semibold ml-1">{sub.team.name}</Text>
      </View>
    )}

    <TouchableOpacity onPress={() => onScore(sub)} activeOpacity={0.88}>
      <View
        className="rounded-xl"
       style={{ backgroundColor: '#F97316' }}>
        <View className="py-3 flex-row items-center justify-center">
          <Ionicons name="star" size={14} color="#12100E" />
          <Text className="text-ink font-semibold text-xs ml-2">Score This</Text>
        </View>
      </View>
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
              Toast.show({ type: 'success', text1: `Scored ${selectedSub.ProjectName} — ${total}/10` });
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
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View
        className="pb-6 pt-2"
       style={{ backgroundColor: '#12100E' }}>
        <SafeAreaView>
          <View className="flex-row items-center px-5 pt-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="w-11 h-11 items-center justify-center rounded-xl"
            
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
              <Ionicons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xl font-display">Judge Panel</Text>
              <Text className="text-ink-4 text-label font-semibold">
                Review & Score Submissions
              </Text>
            </View>
            <TouchableOpacity onPress={loadPending} className="w-10 h-10 rounded-card bg-card/10 items-center justify-center" hitSlop={2}>
              <Ionicons name="refresh" size={18} color="white" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View className="flex-row px-5 mt-5 gap-3">
            <TouchableOpacity
              onPress={() => setActiveTab('pending')}
              className={`flex-1 rounded-card px-4 py-3 border ${activeTab === 'pending' ? 'bg-card border-white' : 'bg-card/10 border-white/10'}`}
            >
              <Text className={`text-center font-semibold text-label ${activeTab === 'pending' ? 'text-ink' : 'text-white/60'}`}>
                To Score ({pending.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('scored')}
              className={`flex-1 rounded-card px-4 py-3 border ${activeTab === 'scored' ? 'bg-card border-white' : 'bg-card/10 border-white/10'}`}
            >
              <Text className={`text-center font-semibold text-label ${activeTab === 'scored' ? 'text-ink' : 'text-white/60'}`}>
                Scored ({scoredSubmissions.length})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : activeTab === 'pending' ? (
        pending.length === 0 ? (
          <View className="flex-1 items-center justify-center px-gutter">
            <View className="w-24 h-24 rounded-sheet items-center justify-center mb-5" style={{ backgroundColor: '#EDE8E0' }}>
              <Ionicons name="checkmark-circle" size={44} color="#047857" />
            </View>
            <Text className="text-ink font-display text-xl text-center mb-2">
              All Scored!
            </Text>
            <Text className="text-ink-3 text-center font-semibold text-xs">
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
            <View className="bg-card rounded-card p-4 mb-3 border border-line opacity-80">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-ink font-semibold flex-1 mr-2">{item.submission?.ProjectName || 'Unknown Project'}</Text>
                <View className="bg-brand-50 px-2 py-1 rounded-lg">
                  <Text className="text-brand-600 font-semibold text-xs">{item.totalScore}/10</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => openScoring(item)}>
                <Text className="text-brand-600 font-semibold text-label text-right">Edit Score →</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center mt-20">
              <Ionicons name="star-outline" size={48} color="#C4BEB6" />
              <Text className="text-ink-3 font-semibold mt-4">No scored items yet</Text>
            </View>
          )}
        />
      )}

      {/* Scoring Modal */}
      <Modal visible={scoringModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-paper">
          <SafeAreaView className="flex-1">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-line bg-card">
              <View className="flex-1 mr-4">
                <Text className="text-ink font-display text-lg" numberOfLines={1}>
                  {selectedSub?.ProjectName}
                </Text>
                <Text className="text-ink-3 text-label font-semibold">Score Submission</Text>
              </View>
              <TouchableOpacity onPress={() => setScoringModal(false)}>
                <Ionicons name="close" size={24} color="#8B857E" />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-5 pt-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Total score preview */}
              <View
                className="rounded-card px-5 py-4 mb-6 flex-row items-center justify-between"
               style={{ backgroundColor: '#EDE8E0' }}>
                <View>
                  <Text className="text-brand-600 text-label font-semibold">Weighted Total</Text>
                  <Text className="text-ink font-display text-3xl">{computeTotalScore()}<Text className="text-ink-3 text-lg">/10</Text></Text>
                </View>
                <Ionicons name="star" size={32} color="#F97316" />
              </View>

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
                <Text className="text-ink-3 text-label font-semibold mb-2">
                  Feedback <Text className="text-ink-4">(optional)</Text>
                </Text>
                <TextInput
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="What did you think? Constructive feedback helps teams grow..."
                  placeholderTextColor="#8B857E"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  className="bg-card px-4 py-3.5 text-ink font-semibold border-[1.5px] border-ink h-28 rounded-md"
                />
              </View>

              <View className="h-20" />
            </ScrollView>

            {/* Submit */}
            <View className="px-5 pb-8 pt-4 bg-card border-t border-line">
              <TouchableOpacity onPress={submitScore} disabled={submitting} activeOpacity={0.88}>
                <View className="rounded-card" style={{ backgroundColor: '#F97316' }}>
                  <View className="py-4 flex-row items-center justify-center">
                    {submitting ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <Ionicons name="star" size={16} color="white" />
                        <Text className="text-white font-semibold text-sm ml-2">
                          Submit Score — {computeTotalScore()}/10
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

export default HackathonJudgePanel;
