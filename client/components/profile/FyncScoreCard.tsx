import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';

// ─── Constants ────────────────────────────────────────────────────────────────
const BADGE_CONFIG: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  Newcomer:  { emoji: '🌱', color: '#18181b', bg: '#f8fafc',    border: '#e2e8f0' },
  Explorer:  { emoji: '🗺️', color: '#18181b', bg: '#f8fafc',    border: '#e2e8f0' },
  Builder:   { emoji: '🔨', color: '#18181b', bg: '#f8fafc',    border: '#e2e8f0' },
  Innovator: { emoji: '💡', color: '#f97316', bg: '#fff7ed',    border: '#fed7aa' },
  Pioneer:   { emoji: '🚀', color: '#f97316', bg: '#fff7ed',    border: '#fed7aa' },
  Legend:    { emoji: '🌟', color: '#f97316', bg: '#fff7ed',    border: '#fed7aa' },
};

const CAT_COLORS: Record<string, string> = {
  hackathon:  '#18181b',
  coding:     '#f97316',
  github:     '#18181b',
  projects:   '#f97316',
  events:     '#18181b',
  internship: '#f97316',
  community:  '#18181b',
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
    <View className="mx-4 my-3 bg-white rounded-[28px] p-6 border border-slate-100 items-center justify-center h-28 shadow-sm shadow-black/5">
      <ActivityIndicator color="#f97316" />
    </View>
  );

  if (!score) return null;

  const badge = score.badge || 'Newcomer';
  const cfg = BADGE_CONFIG[badge] || BADGE_CONFIG.Newcomer;
  const pct = Math.min((score.totalScore / 1000) * 100, 100);
  const categories = score.breakdown ? Object.entries(score.breakdown) : [];

  return (
    <View className="mx-4 my-3 rounded-[28px] overflow-hidden border border-slate-100 bg-white shadow-sm shadow-black/5">
      <Pressable onPress={() => setExpanded(e => !e)} className="flex-row items-center p-6">
        <View
          className="w-16 h-16 rounded-[20px] items-center justify-center mr-4 shadow-sm"
          style={{ backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.border }}
        >
          <Text style={{ fontSize: 28 }}>{cfg.emoji}</Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-baseline gap-2 mb-1">
            <Text className="text-zinc-900 font-black text-2xl tracking-tighter">{score.totalScore}</Text>
            <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest">/ 1000 Pts</Text>
          </View>
          <Text className="font-black uppercase text-[10px] tracking-[2px]" style={{ color: cfg.color }}>Level: {badge}</Text>
          <View className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: cfg.color }}
            />
          </View>
        </View>

        <View className="items-end ml-4 gap-3">
          <View className="w-8 h-8 bg-slate-50 rounded-xl items-center justify-center border border-slate-100">
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#18181b" />
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View className="px-6 pb-8 border-t border-slate-50 pt-4">
          <Text className="text-slate-400 text-[9px] font-black uppercase tracking-[2px] mb-4">Score Breakdown</Text>
          <View className="gap-4">
            {categories.map(([cat, data]: [string, any]) => {
              const catPct = Math.min((data.score / data.maxScore) * 100, 100);
              const color = CAT_COLORS[cat] || '#94A3B8';
              return (
                <View key={cat}>
                  <View className="flex-row justify-between mb-1.5 items-center">
                    <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-tight">{cat}</Text>
                    <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">{data.score} <Text className="text-slate-300">/</Text> {data.maxScore}</Text>
                  </View>
                  <View className="h-1 bg-slate-50 rounded-full overflow-hidden">
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
