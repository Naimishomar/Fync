import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../../constants/colors';
import { selectHaptic } from '../../../utils/haptics';
import { MAX_GUESSES, WORD_LEN, type Mark } from './wordRules';

export type Row = { word: string; marks: Mark[] };

const GREEN = '#5fa957';
const YELLOW = '#c9a93a';
const grey = () => (C.scheme === 'dark' ? '#3a3a3c' : '#787c7e');
export const markColor = (m: Mark) => (m === 2 ? GREEN : m === 1 ? YELLOW : grey());
const CLEAR = 'rgba(0,0,0,0)';

/** Tile size that fits 6 rows + keyboard in the space left after `reserve` px of other UI. */
export const useTileSize = (reserve: number) => {
  const { width, height } = useWindowDimensions();
  return Math.floor(Math.max(36, Math.min(62, (width - 40 - 4 * 6) / 5, (height - reserve - 200) / 6 - 6)));
};

const Tile = ({ letter, mark, i, size }: { letter: string; mark?: Mark; i: number; size: number }) => {
  // Rows that mount already scored (restored daily) skip the flip.
  const flip = useRef(new Animated.Value(mark != null ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const scored = mark != null;

  useEffect(() => {
    if (scored) Animated.timing(flip, { toValue: 1, duration: 480, delay: i * 230, useNativeDriver: false }).start();
  }, [scored, flip, i]);
  useEffect(() => {
    if (!letter || scored) return;
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.12, duration: 60, useNativeDriver: false }),
      Animated.timing(pop, { toValue: 1, duration: 90, useNativeDriver: false }),
    ]).start();
  }, [letter, scored, pop]);

  const after = scored ? markColor(mark!) : CLEAR;
  const half = { inputRange: [0, 0.5, 0.501, 1] };
  return (
    <Animated.View
      style={{
        width: size, height: size, margin: 3, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
        borderColor: flip.interpolate({ ...half, outputRange: [letter ? C.ink3 : C.line, letter ? C.ink3 : C.line, after, after] }),
        backgroundColor: flip.interpolate({ ...half, outputRange: [CLEAR, CLEAR, after, after] }),
        transform: [{ rotateX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '90deg', '0deg'] }) }, { scale: pop }],
      }}
    >
      <Animated.Text
        className="font-display"
        style={{ fontSize: size * 0.5, color: flip.interpolate({ ...half, outputRange: [C.ink, C.ink, '#FFFFFF', '#FFFFFF'] }) }}
      >
        {letter.toUpperCase()}
      </Animated.Text>
    </Animated.View>
  );
};

const GridRow = ({ word, marks, size, shake }: { word: string; marks?: Mark[]; size: number; shake?: number }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!shake) return;
    Animated.sequence([10, -10, 8, -8, 4, 0].map((v) => Animated.timing(x, { toValue: v, duration: 45, useNativeDriver: true }))).start();
  }, [shake, x]);
  return (
    <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
      {Array.from({ length: WORD_LEN }, (_, i) => (
        <Tile key={i} i={i} letter={word[i] ?? ''} mark={marks?.[i]} size={size} />
      ))}
    </Animated.View>
  );
};

/** Six rows: scored guesses, the one being typed (shakes on `shake` change), then blanks. */
export const Grid = ({ rows, current, shake, size }: { rows: Row[]; current: string; shake: number; size: number }) => (
  <View style={{ alignItems: 'center' }}>
    {Array.from({ length: MAX_GUESSES }, (_, r) =>
      r < rows.length ? (
        <GridRow key={r} word={rows[r].word} marks={rows[r].marks} size={size} />
      ) : r === rows.length ? (
        <GridRow key={r} word={current} size={size} shake={shake} />
      ) : (
        <GridRow key={r} word="" size={size} />
      ),
    )}
  </View>
);

/** Opponent's progress: colours only, never letters. */
export const MiniGrid = ({ rows, size = 12 }: { rows: Mark[][]; size?: number }) => (
  <View>
    {Array.from({ length: MAX_GUESSES }, (_, r) => (
      <View key={r} style={{ flexDirection: 'row' }}>
        {Array.from({ length: WORD_LEN }, (_, i) => {
          const m = rows[r]?.[i];
          return (
            <View
              key={i}
              style={{ width: size, height: size, margin: 1, borderRadius: 2, backgroundColor: m == null ? C.line : markColor(m) }}
            />
          );
        })}
      </View>
    ))}
  </View>
);

/** Best mark seen per letter, for the keyboard. */
export const letterStates = (rows: Row[]) => {
  const best: Record<string, Mark> = {};
  rows.forEach((r) => r.marks.forEach((m, i) => {
    const l = r.word[i];
    if (best[l] == null || m > best[l]) best[l] = m;
  }));
  return best;
};

const KEYS = ['qwertyuiop', 'asdfghjkl', '>zxcvbnm<'];

export const Keyboard = ({ states, onKey, disabled }: {
  states: Record<string, Mark>; onKey: (k: string) => void; disabled?: boolean;
}) => (
  <View style={{ paddingHorizontal: 4, paddingBottom: 8, opacity: disabled ? 0.6 : 1 }}>
    {KEYS.map((row) => (
      <View key={row} style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 7 }}>
        {row.split('').map((k) => {
          const wide = k === '>' || k === '<';
          const m = states[k];
          return (
            <Pressable
              key={k}
              disabled={disabled}
              onPress={() => {
                selectHaptic();
                onKey(k === '>' ? 'enter' : k === '<' ? 'del' : k);
              }}
              accessibilityRole="button"
              accessibilityLabel={k === '>' ? 'Enter' : k === '<' ? 'Delete' : k}
              style={({ pressed }) => ({
                flex: wide ? 1.5 : 1, maxWidth: wide ? 62 : 42, height: 54, marginHorizontal: 3, borderRadius: 6,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: m != null ? markColor(m) : C.paper2,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              {k === '<' ? (
                <Ionicons name="backspace-outline" size={22} color={C.ink} />
              ) : (
                <Text className="font-display" style={{ fontSize: wide ? 12 : 17, color: m != null ? '#FFFFFF' : C.ink }}>
                  {k === '>' ? 'ENTER' : k.toUpperCase()}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    ))}
  </View>
);
