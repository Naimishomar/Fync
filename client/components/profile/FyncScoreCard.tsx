import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';

// ─── Constants ────────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  Newcomer:  { icon: 'leaf', color: '#12100E', bg: '#F5F2EC',    border: '#E3DDD3' },
  Explorer:  { icon: 'compass', color: '#12100E', bg: '#F5F2EC',    border: '#E3DDD3' },
  Builder:   { icon: 'hammer', color: '#12100E', bg: '#F5F2EC',    border: '#E3DDD3' },
  Innovator: { icon: 'bulb', color: '#F97316', bg: '#EDE8E0',    border: '#EDE8E0' },
  Pioneer:   { icon: 'rocket', color: '#F97316', bg: '#EDE8E0',    border: '#EDE8E0' },
  Legend:    { icon: 'star', color: '#F97316', bg: '#EDE8E0',    border: '#EDE8E0' },
};

const CAT_COLORS: Record<string, string> = {
  hackathon:  '#12100E',
  coding:     '#F97316',
  github:     '#12100E',
  projects:   '#F97316',
  events:     '#12100E',
  internship: '#F97316',
  community:  '#12100E',
};

interface ScoreBreakdown {
  hackathon:  { score: number; maxScore: number };
  coding:     { score: number; maxScore: number };
  github:     { score: number; maxScore: number };
  projects:   { score: number; maxScore: number };
  events:     { score: number; maxScore: number };
  internship: { score: number; maxScore: number };
  community:  { score: number; maxScore: number };
}

interface FyncScoreData {
  totalScore: number;
  badge: string;
  breakdown: ScoreBreakdown;
  lastCalculated?: string;
}

interface Props {
  userId: string;
  isOwner?: boolean;
  onRecalculate?: () => void;
}

export default function FyncScoreCard({ userId, isOwner = false, onRecalculate }: Props) {
  const [score, setScore] = useState<FyncScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchScore = async () => {
    try {
      const res = await axios.get(`/profile/score/${userId}`);
      if (res.data.success) setScore(res.data.score);
    } catch (e) {
      console.log('FyncScoreCard fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchScore(); }, [userId]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await axios.post('/profile/score/recalculate');
      if (res.data.success) {
        setScore(res.data.score);
        onRecalculate?.();
      }
    } catch (e) {
      console.log('Recalculate error', e);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) return (
    <View className="mx-4 my-3 bg-card rounded-card p-6 border border-line items-center justify-center h-28 shadow-hair">
      <ActivityIndicator color="#F97316" />
    </View>
  );

  if (!score) return null;

  const badge = score.badge || 'Newcomer';
  const cfg = BADGE_CONFIG[badge] || BADGE_CONFIG.Newcomer;
  const pct = Math.min((score.totalScore / 1000) * 100, 100);
  const categories = score.breakdown ? Object.entries(score.breakdown) : [];

  return (
    <View className="mx-4 my-3 rounded-card overflow-hidden border border-line bg-card shadow-hair">
      <Pressable onPress={() => setExpanded(e => !e)} className="flex-row items-center p-6">
        <View
          className="w-16 h-16 rounded-card items-center justify-center mr-4 shadow-hair"
          style={{ backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border }}
        >
          <Ionicons name={cfg.icon} size={26} color={cfg.color} />
        </View>

        <View className="flex-1">
          <View className="flex-row items-baseline gap-2 mb-1">
            <Text className="text-ink font-display text-2xl">{score.totalScore}</Text>
            <Text className="text-ink-3 font-display uppercase text-label">/ 1000 Pts</Text>
          </View>
          <Text className="font-display uppercase text-label" style={{ color: cfg.color }}>Level: {badge}</Text>
          <View className="mt-2.5 h-1.5 bg-paper-2 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: cfg.color }}
            />
          </View>
        </View>

        <View className="items-end ml-4 gap-3">
          <View className="w-8 h-8 bg-paper-2 rounded-xl items-center justify-center border border-line">
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#12100E" />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-6 pb-8 border-t border-line pt-4">
          <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
            <Text className="text-ink-3 text-label font-display uppercase">Score Breakdown</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>
          <View className="gap-4">
            {categories.map(([cat, data]: [string, any]) => {
              const catPct = Math.min((data.score / data.maxScore) * 100, 100);
              const color = CAT_COLORS[cat] || '#8B857E';
              return (
                <View key={cat}>
                  <View className="flex-row justify-between mb-1.5 items-center">
                    <Text className="text-ink text-label font-display uppercase">{cat}</Text>
                    <Text className="text-ink-3 font-semibold text-label uppercase">{data.score} <Text className="text-ink-4">/</Text> {data.maxScore}</Text>
                  </View>
                  <View className="h-1 bg-paper-2 rounded-full overflow-hidden">
                    <View className="h-full rounded-full" style={{ width: `${catPct}%`, backgroundColor: color }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
