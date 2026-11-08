import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { Card, IconTile, Num } from '../ui/kit';

// ─── Constants ────────────────────────────────────────────────────────────────
// color: text/icon (AA on card); bar: the progress fill.
const BADGE_CONFIG = (): Record<string, { icon: any; color: string; bar: string }> => ({
  Newcomer:  { icon: 'leaf-outline',    color: C.ink,        bar: C.ink },
  Explorer:  { icon: 'compass-outline', color: C.ink,        bar: C.ink },
  Builder:   { icon: 'hammer-outline',  color: C.ink,        bar: C.ink },
  Innovator: { icon: 'bulb-outline',    color: C.accentText, bar: C.brand[500] },
  Pioneer:   { icon: 'rocket-outline',  color: C.accentText, bar: C.brand[500] },
  Legend:    { icon: 'star-outline',    color: C.accentText, bar: C.brand[500] },
});

const CAT_COLORS = (): Record<string, string> => ({
  hackathon:  C.ink,
  coding:     C.brand[500],
  github:     C.ink,
  projects:   C.brand[500],
  events:     C.ink,
  internship: C.brand[500],
  community:  C.ink,
});

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
    <Card style={{ marginHorizontal: 16, marginVertical: 12, height: 112, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.brand[500]} />
    </Card>
  );

  if (!score) return null;

  const badge = score.badge || 'Newcomer';
  const cfg = BADGE_CONFIG()[badge] || BADGE_CONFIG().Newcomer;
  const pct = Math.min((score.totalScore / 1000) * 100, 100);
  const categories = score.breakdown ? Object.entries(score.breakdown) : [];

  return (
    <Card style={{ marginHorizontal: 16, marginVertical: 12, padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityLabel={`Fync score ${score.totalScore} of 1000, level ${badge}`}
        accessibilityState={{ expanded }}
        className="flex-row items-center p-4 active:opacity-70"
        style={{ gap: 12 }}
      >
        <IconTile icon={cfg.icon} size={56} iconSize={26} color={cfg.color} />

        <View className="flex-1" style={{ minWidth: 0 }}>
          <View className="flex-row items-baseline" style={{ gap: 6 }}>
            <Num style={{ fontSize: 24, lineHeight: 28 }}>{String(score.totalScore)}</Num>
            <Text className="text-ink-3 font-sans text-sm">/ 1000 pts</Text>
          </View>
          <Text className="font-semibold text-sm mt-0.5" style={{ color: cfg.color }}>{badge}</Text>
          <View className="mt-2 h-1.5 bg-paper-2 rounded-full overflow-hidden">
            <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cfg.bar }} />
          </View>
        </View>

        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={C.ink3} />
      </Pressable>

      {expanded ? (
        <View className="px-4 pb-4 pt-4 border-t border-line">
          <Text className="text-ink-2 text-sm font-semibold mb-3">Score breakdown</Text>
          <View style={{ gap: 12 }}>
            {categories.map(([cat, data]: [string, any]) => {
              const catPct = data.maxScore > 0 ? Math.min((data.score / data.maxScore) * 100, 100) : 0;
              const color = CAT_COLORS()[cat] || C.ink3;
              return (
                <View key={cat}>
                  <View className="flex-row justify-between mb-1.5 items-center">
                    <Text className="text-ink text-sm font-semibold">{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                    <Text className="text-ink-3 font-sans text-xs">{data.score} / {data.maxScore}</Text>
                  </View>
                  <View className="h-1 bg-paper-2 rounded-full overflow-hidden">
                    <View className="h-full rounded-full" style={{ width: `${catPct}%`, backgroundColor: color }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </Card>
  );
}
