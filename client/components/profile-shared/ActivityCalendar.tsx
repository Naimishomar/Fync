/**
 * GitHub-style contribution grid for the last 16 weeks. With any coding
 * profile linked, the server sends combined LeetCode/GFG/Codeforces/CodeChef
 * submissions and their streak; otherwise posts + shorts and the post streak.
 * One column per week, one
 * column per week (Sun..Sat top to bottom), newest at the right. Renders
 * nothing until /profile/activity answers, and nothing if it fails.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Card, Label } from '../ui/kit';
import { C } from '../../constants/colors';
import { profileAccent } from '../../constants/profileAccents';

type Day = { date: string; count: number };

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Keys are IST calendar dates; read them as plain dates, never via the device zone.
const parts = (key: string) => key.split('-').map(Number) as [number, number, number];
const weekday = (key: string) => { const [y, m, d] = parts(key); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const label = (key: string) => { const [, m, d] = parts(key); return `${d} ${MONTHS[m - 1]}`; };
const countText = (n: number, noun: string) => (n === 0 ? `No ${noun}s` : `${n} ${noun}${n === 1 ? '' : 's'}`);

// Read at render: C is theme-aware. Alpha steps of the accent climb on light and dark paper alike.
const levelColors = (fill: string) => [C.paper2, `${fill}40`, `${fill}73`, `${fill}A6`, fill];
const levelOf = (count: number, max: number) => (count <= 0 ? 0 : Math.max(1, Math.ceil((count * 4) / max)));

export const ActivityCalendar = memo(function ActivityCalendar({ userId, streak = 0, highest = 0, refreshKey, accent }: {
  userId?: string; streak?: number; highest?: number; refreshKey?: unknown;
  /** user.accentColor key; orange when absent. */
  accent?: string;
}) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [coding, setCoding] = useState<{ streak: number; best: number } | null>(null);
  const [picked, setPicked] = useState<Day | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    axios.get(`/profile/activity/${userId}`)
      .then((res) => {
        if (!live || !Array.isArray(res.data?.days)) return;
        setDays(res.data.days);
        setCoding(res.data.source === 'coding' ? { streak: res.data.streak ?? 0, best: res.data.best ?? 0 } : null);
      })
      .catch(() => {}); // Endpoint missing or down: stay hidden.
    return () => { live = false; };
  }, [userId, refreshKey]);

  const grid = useMemo(() => {
    if (!days?.length) return null;
    // Pad the first week so every day sits on its weekday row.
    const cells: (Day | null)[] = [...Array(weekday(days[0].date)).fill(null), ...days];
    const weeks: (Day | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const months: { col: number; text: string }[] = [];
    let prev = -1;
    weeks.forEach((w, col) => {
      const first = w.find(Boolean);
      const m = first ? parts(first.date)[1] : prev;
      if (m !== prev && col < weeks.length - 1) months.push({ col, text: MONTHS[m - 1] });
      prev = m;
    });
    const max = Math.max(1, ...days.map((d) => d.count));
    const total = days.reduce((a, d) => a + d.count, 0);
    return { weeks, months, max, total };
  }, [days]);

  if (!grid) return null;
  const noun = coding ? 'submission' : 'upload';
  const postsText = (n: number) => countText(n, noun);
  const shownStreak = coding ? coding.streak : streak;
  const shownBest = coding ? coding.best : highest;
  const fill = profileAccent(accent).fill;
  const colors = levelColors(fill);

  return (
    <Card style={{ marginTop: 12, width: '100%' }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-ink font-semibold text-base" accessibilityRole="header">{coding ? 'Coding activity' : 'Activity'}</Text>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Ionicons name="flame" size={14} color={fill} />
          <Text className="text-ink-2 text-xs" numberOfLines={1}>
            {shownStreak} day streak · Best {shownBest}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        style={{ marginTop: 12 }}
        accessibilityLabel={`${postsText(grid.total)} in the last 16 weeks`}
      >
        <View>
          <View style={{ height: 16, width: grid.weeks.length * STEP }}>
            {grid.months.map((m) => (
              <Text key={m.col} className="text-ink-3" style={{ position: 'absolute', left: m.col * STEP, fontSize: 11, lineHeight: 14 }}>
                {m.text}
              </Text>
            ))}
          </View>
          <View className="flex-row" style={{ gap: GAP }}>
            {grid.weeks.map((week, col) => (
              <View key={col} style={{ gap: GAP }}>
                {week.map((day, row) => day ? (
                  <Pressable
                    key={day.date}
                    onPress={() => setPicked((p) => (p?.date === day.date ? null : day))}
                    accessibilityRole="button"
                    accessibilityLabel={`${postsText(day.count)}, ${label(day.date)}`}
                    accessibilityState={{ selected: picked?.date === day.date }}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      backgroundColor: colors[levelOf(day.count, grid.max)],
                      borderWidth: picked?.date === day.date ? 1.5 : 0,
                      borderColor: C.ink,
                    }}
                  />
                ) : <View key={`pad${row}`} style={{ width: CELL, height: CELL }} />)}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View className="flex-row items-center justify-between mt-3">
        <Text className="text-ink-2 text-xs" accessibilityLiveRegion="polite" numberOfLines={1} style={{ flexShrink: 1, marginRight: 8 }}>
          {picked ? `${postsText(picked.count)} · ${label(picked.date)}` : `${postsText(grid.total)} in 16 weeks`}
        </Text>
        <View className="flex-row items-center" style={{ gap: 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Label style={{ marginRight: 2 }}>Less</Label>
          {colors.map((c, i) => <View key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />)}
          <Label style={{ marginLeft: 2 }}>More</Label>
        </View>
      </View>
    </Card>
  );
});
