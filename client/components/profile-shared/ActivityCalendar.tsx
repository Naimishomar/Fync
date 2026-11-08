/**
 * GitHub-style contribution grid: the last 16 weeks of posts + shorts, one
 * column per week (Sun..Sat top to bottom), newest at the right. Renders
 * nothing until /profile/activity answers, and nothing if it fails.
 */
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Card, Label } from '../ui/kit';
import { C } from '../../constants/colors';

type Day = { date: string; count: number };

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Keys are IST calendar dates; read them as plain dates, never via the device zone.
const parts = (key: string) => key.split('-').map(Number) as [number, number, number];
const weekday = (key: string) => { const [y, m, d] = parts(key); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const label = (key: string) => { const [, m, d] = parts(key); return `${d} ${MONTHS[m - 1]}`; };
const postsText = (n: number) => (n === 0 ? 'No uploads' : `${n} upload${n === 1 ? '' : 's'}`);

// Read at render: C is theme-aware. brand 200 is a deep amber in dark mode, so the ramp still climbs.
const levelColors = () => [C.paper2, C.brand[200], C.brand[300], C.brand[400], C.brand[500]];
const levelOf = (count: number, max: number) => (count <= 0 ? 0 : Math.max(1, Math.ceil((count * 4) / max)));

export const ActivityCalendar = memo(function ActivityCalendar({ userId, streak = 0, highest = 0, refreshKey }: {
  userId?: string; streak?: number; highest?: number; refreshKey?: unknown;
}) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [picked, setPicked] = useState<Day | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    axios.get(`/profile/activity/${userId}`)
      .then((res) => { if (live && Array.isArray(res.data?.days)) setDays(res.data.days); })
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
  const colors = levelColors();

  return (
    <Card style={{ marginTop: 12, width: '100%' }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-ink font-semibold text-base" accessibilityRole="header">Activity</Text>
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <Ionicons name="flame" size={14} color={C.brand[500]} />
          <Text className="text-ink-2 text-xs">
            {streak} day streak · Best {highest}
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
              <Text key={m.col} className="text-ink-3 text-[10px]" style={{ position: 'absolute', left: m.col * STEP }}>
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
        <Text className="text-ink-2 text-xs" accessibilityLiveRegion="polite">
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
