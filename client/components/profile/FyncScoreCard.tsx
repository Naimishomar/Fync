import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';

// ─── Constants ────────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  Newcomer:  { emoji: '🌱', color: '#6B7280', bg: '#F3F4F6',    border: '#D1D5DB' },
  Explorer:  { emoji: '🗺️', color: '#2563EB', bg: '#EFF6FF',    border: '#BFDBFE' },
  Builder:   { emoji: '🔨', color: '#7C3AED', bg: '#F5F3FF',    border: '#DDD6FE' },
  Innovator: { emoji: '💡', color: '#D97706', bg: '#FFFBEB',    border: '#FDE68A' },
  Pioneer:   { emoji: '🚀', color: '#059669', bg: '#ECFDF5',    border: '#A7F3D0' },
  Legend:    { emoji: '🌟', color: '#DC2626', bg: '#FEF2F2',    border: '#FECACA' },
};

const CAT_COLORS: Record<string, string> = {
  hackathon:  '#6366F1',
  coding:     '#0EA5E9',
  github:     '#1F2937',
  projects:   '#10B981',
  events:     '#F59E0B',
  internship: '#8B5CF6',
  community:  '#EC4899',
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
    <View className="mx-4 my-3 bg-gray-50 rounded-2xl p-4 border border-gray-100 items-center justify-center h-24">
      <ActivityIndicator color="#6366F1" />
    </View>
  );

  if (!score) return null;

  const badge = score.badge || 'Newcomer';
  const cfg = BADGE_CONFIG[badge] || BADGE_CONFIG.Newcomer;
  const pct = Math.min((score.totalScore / 1000) * 100, 100);
  const categories = score.breakdown ? Object.entries(score.breakdown) : [];

  return (
    <View className="mx-4 my-3 rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
      {/* Header Row */}
      <Pressable onPress={() => setExpanded(e => !e)} className="flex-row items-center p-4">
        {/* Badge bubble */}
        <View
          className="w-14 h-14 rounded-2xl items-center justify-center mr-3"
          style={{ backgroundColor: cfg.bg, borderWidth: 1.5, borderColor: cfg.border }}
        >
          <Text style={{ fontSize: 26 }}>{cfg.emoji}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-gray-900 font-bold text-lg">{score.totalScore}</Text>
            <Text className="text-gray-400 text-sm">/ 1000</Text>
          </View>
          <Text className="font-semibold text-sm" style={{ color: cfg.color }}>{badge}</Text>
          {/* Progress bar */}
          <View className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: cfg.color }}
            />
          </View>
        </View>

        <View className="items-end ml-2">
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#9CA3AF" />
          {isOwner && (
            <Pressable
              onPress={handleRecalculate}
              disabled={recalculating}
              className="mt-1 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100"
            >
              {recalculating
                ? <ActivityIndicator size="small" color="#6366F1" />
                : <Text className="text-indigo-600 text-[10px] font-bold">SYNC</Text>}
            </Pressable>
          )}
        </View>
      </Pressable>

      {/* Breakdown */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-gray-50">
          <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mt-3 mb-2">Score Breakdown</Text>
          <View className="gap-2">
            {categories.map(([cat, data]: [string, any]) => {
              const catPct = Math.min((data.score / data.maxScore) * 100, 100);
              const color = CAT_COLORS[cat] || '#6B7280';
              return (
                <View key={cat}>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-gray-700 text-xs font-semibold capitalize">{cat}</Text>
                    <Text className="text-gray-400 text-xs">{data.score}/{data.maxScore}</Text>
                  </View>
                  <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
