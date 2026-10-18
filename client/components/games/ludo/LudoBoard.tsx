import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, withRepeat, cancelAnimation, Easing,
} from 'react-native-reanimated';
import { absOf, HOME, HOME_COL, START, SAFE, type LudoState } from './ludoRules';

/**
 * Classic 15x15 Ludo board drawn with Views. Fixed vivid colours on a white board
 * read the same in light and dark themes. Red top-left, green top-right, yellow
 * bottom-right, blue bottom-left; tokens move clockwise.
 */

export const LUDO_COLORS = ['#E53935', '#43A047', '#FBC02D', '#1E88E5'];
export const LUDO_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const PALE = ['#FFCDD2', '#C8E6C9', '#FFF59D', '#BBDEFB'];

type Cell = [number, number]; // row, col
const seg = (r: number, c: number, dr: number, dc: number, n: number): Cell[] =>
  Array.from({ length: n }, (_, i) => [r + dr * i, c + dc * i] as Cell);

// Absolute track squares 0..51, starting at red's start square.
const TRACK_CELLS: Cell[] = [
  ...seg(6, 1, 0, 1, 5), ...seg(5, 6, -1, 0, 6), [0, 7],
  ...seg(0, 8, 1, 0, 6), ...seg(6, 9, 0, 1, 6), [7, 14],
  ...seg(8, 14, 0, -1, 6), ...seg(9, 8, 1, 0, 6), [14, 7],
  ...seg(14, 6, -1, 0, 6), ...seg(8, 5, 0, -1, 6), [7, 0], [6, 0],
];
const HOME_CELLS: Cell[][] = [seg(7, 1, 0, 1, 5), seg(1, 7, 1, 0, 5), seg(7, 13, 0, -1, 5), seg(13, 7, -1, 0, 5)];
const HOME_SPOT: Cell[] = [[7, 6.1], [6.1, 7], [7, 7.9], [7.9, 7]];
const BASE_ORIGIN: Cell[] = [[0, 0], [0, 9], [9, 9], [9, 0]];
const SLOTS: Cell[] = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]];

export const cellOf = (color: number, rel: number, token: number): Cell => {
  if (rel < 0) return [BASE_ORIGIN[color][0] + SLOTS[token][0], BASE_ORIGIN[color][1] + SLOTS[token][1]];
  if (rel >= HOME) return HOME_SPOT[color];
  if (rel >= HOME_COL) return HOME_CELLS[color][rel - HOME_COL];
  return TRACK_CELLS[absOf(color, rel)!];
};

const STEP_MS = 110;

const Token = ({
  color, rel, token, cell, dx, dy, scale, movable, onPress,
}: {
  color: number; rel: number; token: number; cell: number; dx: number; dy: number; scale: number;
  movable: boolean; onPress?: () => void;
}) => {
  const [r0, c0] = cellOf(color, rel, token);
  const x = useSharedValue(c0 * cell);
  const y = useSharedValue(r0 * cell);
  const pulse = useSharedValue(1);
  const prev = useRef(rel);

  useEffect(() => {
    const from = prev.current;
    prev.current = rel;
    if (from === rel) {
      // Board resized or restacked: snap.
      const [r, c] = cellOf(color, rel, token);
      x.value = c * cell;
      y.value = r * cell;
      return;
    }
    if (rel > from && from >= 0) {
      // Walk square by square.
      const path = Array.from({ length: rel - from }, (_, i) => cellOf(color, from + 1 + i, token));
      x.value = withSequence(...path.map(([, c]) => withTiming(c * cell, { duration: STEP_MS })));
      y.value = withSequence(...path.map(([r]) => withTiming(r * cell, { duration: STEP_MS })));
      return;
    }
    const [r, c] = cellOf(color, rel, token);
    // Captured: wait for the attacker to land, then slide home to base.
    const delay = rel < 0 ? 600 : 0;
    x.value = withDelay(delay, withTiming(c * cell, { duration: 320, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(delay, withTiming(r * cell, { duration: 320, easing: Easing.out(Easing.cubic) }));
  }, [rel, cell, color, token, x, y]);

  useEffect(() => {
    if (movable) pulse.value = withRepeat(withTiming(1.18, { duration: 380 }), -1, true);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 120 });
    }
  }, [movable, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value + dx }, { translateY: y.value + dy }, { scale: pulse.value * scale }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: cell, height: cell, zIndex: movable ? 3 : 2 }, style]}>
      <Pressable
        onPress={onPress}
        disabled={!movable}
        hitSlop={movable ? 6 : 0}
        accessibilityRole="button"
        accessibilityLabel={`${LUDO_NAMES[color]} token ${token + 1}`}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View
          style={{
            width: cell * 0.8, height: cell * 0.8, borderRadius: cell, backgroundColor: LUDO_COLORS[color],
            borderWidth: movable ? 3 : 2, borderColor: movable ? '#111' : '#fff',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 3,
          }}
        >
          <View style={{ width: cell * 0.28, height: cell * 0.28, borderRadius: cell, backgroundColor: 'rgba(255,255,255,0.85)' }} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const Square = ({ r, c, cell, bg, children }: { r: number; c: number; cell: number; bg: string; children?: React.ReactNode }) => (
  <View
    style={{
      position: 'absolute', left: c * cell, top: r * cell, width: cell, height: cell, backgroundColor: bg,
      borderWidth: 0.5, borderColor: '#9e9e9e', alignItems: 'center', justifyContent: 'center',
    }}
  >
    {children}
  </View>
);

// Static layer: only redraws when the size changes.
const BoardBg = React.memo(({ size }: { size: number }) => {
  const cell = size / 15;
  const startColor = (abs: number) => START.indexOf(abs);
  return (
    <>
      {BASE_ORIGIN.map(([r, c], i) => (
        <View key={`b${i}`} style={{ position: 'absolute', left: c * cell, top: r * cell, width: cell * 6, height: cell * 6, backgroundColor: LUDO_COLORS[i], padding: cell }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: cell * 0.6 }}>
            {SLOTS.map(([sr, sc], k) => (
              <View
                key={k}
                style={{
                  position: 'absolute', left: (sc - 1) * cell + cell * 0.1, top: (sr - 1) * cell + cell * 0.1,
                  width: cell * 0.8, height: cell * 0.8, borderRadius: cell, backgroundColor: PALE[i], borderWidth: 1.5, borderColor: LUDO_COLORS[i],
                }}
              />
            ))}
          </View>
        </View>
      ))}
      {TRACK_CELLS.map(([r, c], abs) => {
        const sc = startColor(abs);
        return (
          <Square key={`t${abs}`} r={r} c={c} cell={cell} bg={sc >= 0 ? LUDO_COLORS[sc] : '#fff'}>
            {SAFE.has(abs) && sc < 0 ? <Text style={{ color: '#9e9e9e', fontSize: cell * 0.62, lineHeight: cell * 0.8 }}>★</Text> : null}
          </Square>
        );
      })}
      {HOME_CELLS.map((cells, i) => cells.map(([r, c], k) => <Square key={`h${i}${k}`} r={r} c={c} cell={cell} bg={LUDO_COLORS[i]} />))}
      {/* Centre: four triangles out of one zero-size View's borders. */}
      <View
        style={{
          position: 'absolute', left: 6 * cell, top: 6 * cell, width: 0, height: 0,
          borderTopWidth: 1.5 * cell, borderBottomWidth: 1.5 * cell, borderLeftWidth: 1.5 * cell, borderRightWidth: 1.5 * cell,
          borderTopColor: LUDO_COLORS[1], borderRightColor: LUDO_COLORS[2], borderBottomColor: LUDO_COLORS[3], borderLeftColor: LUDO_COLORS[0],
        }}
      />
    </>
  );
});
BoardBg.displayName = 'BoardBg';

export default function LudoBoard({
  size, game, movableSeat, onMove,
}: {
  size: number; game: LudoState;
  /** Seat whose highlighted tokens are tappable (the local player on their move), else -1. */
  movableSeat: number;
  onMove: (token: number) => void;
}) {
  const cell = size / 15;

  // Stack tokens sharing a square: shrink and fan them out a little.
  const groups = new Map<string, { seat: number; t: number }[]>();
  game.players.forEach((p, seat) => p.tokens.forEach((rel, t) => {
    if (rel < 0) return;
    const [r, c] = cellOf(p.color, rel, t);
    const k = `${r},${c}`;
    groups.set(k, [...(groups.get(k) ?? []), { seat, t }]);
  }));
  const offset = (seat: number, t: number, rel: number, color: number) => {
    if (rel < 0) return { dx: 0, dy: 0, scale: 1 };
    const [r, c] = cellOf(color, rel, t);
    const g = groups.get(`${r},${c}`)!;
    if (g.length < 2) return { dx: 0, dy: 0, scale: 1 };
    const i = g.findIndex((x) => x.seat === seat && x.t === t);
    const spread = cell * 0.22;
    return { dx: ((i % 2) * 2 - 1) * spread, dy: (Math.floor(i / 2) * 2 - 1) * spread * (g.length > 2 ? 1 : 0), scale: 0.68 };
  };

  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff', borderRadius: 6, overflow: 'hidden', borderWidth: 2, borderColor: '#424242' }}>
      <BoardBg size={size} />
      {game.players.map((p, seat) => p.tokens.map((rel, t) => {
        const o = offset(seat, t, rel, p.color);
        const movable = seat === movableSeat && game.turn === seat && game.phase === 'move' && game.movable.includes(t);
        return (
          <Token
            key={`${seat}-${t}`}
            color={p.color}
            rel={rel}
            token={t}
            cell={cell}
            dx={o.dx}
            dy={o.dy}
            scale={o.scale}
            movable={movable}
            onPress={() => onMove(t)}
          />
        );
      }))}
    </View>
  );
}
