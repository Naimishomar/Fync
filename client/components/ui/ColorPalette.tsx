import React, { useState } from 'react';
import { View, Text, type GestureResponderEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, accentRoles, hueHex, mixHex } from '../../constants/colors';

const HUES = Array.from({ length: 13 }, (_, i) => hueHex(i * 30));
const H = 168;

/**
 * Pick any colour: hue left to right; white at the top, pure in the middle,
 * black at the bottom. Reports the raw #rrggbb; the app nudges it just enough
 * for text to stay readable (colors.ts), and the preview shows that result.
 * `onDragging` lets the parent stop scrolling while a finger is on the palette.
 */
export default function ColorPalette({ value, onChange, onDragging }: {
  value?: string | null;
  onChange: (hex: string) => void;
  onDragging?: (on: boolean) => void;
}) {
  const [w, setW] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const pick = (e: GestureResponderEvent) => {
    if (!w) return;
    const x = Math.max(0, Math.min(e.nativeEvent.locationX, w));
    const y = Math.max(0, Math.min(e.nativeEvent.locationY, H));
    setPos({ x, y });
    const hue = hueHex((x / w) * 360);
    const t = y / H;
    onChange(t < 0.5 ? mixHex(hue, '#ffffff', 1 - 2 * t) : mixHex(hue, '#000000', 2 * t - 1));
  };

  const roles = value && value.startsWith('#') ? accentRoles(value) : null;

  return (
    <View style={{ gap: 10 }}>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={{ height: H, borderRadius: 16, overflow: 'hidden' }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => { onDragging?.(true); pick(e); }}
        onResponderMove={pick}
        onResponderRelease={() => onDragging?.(false)}
        onResponderTerminate={() => onDragging?.(false)}
        accessibilityLabel="Colour palette. Drag to pick any colour."
      >
        <View pointerEvents="none" style={{ flex: 1 }}>
          <LinearGradient colors={HUES as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          <LinearGradient colors={['#ffffff', 'rgba(255,255,255,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: H / 2 }} />
          <LinearGradient colors={['rgba(0,0,0,0)', '#000000']} style={{ position: 'absolute', left: 0, right: 0, top: H / 2, height: H / 2 }} />
          {pos && (
            <View style={{
              position: 'absolute', left: pos.x - 12, top: pos.y - 12, width: 24, height: 24, borderRadius: 12,
              borderWidth: 3, borderColor: '#ffffff', backgroundColor: value || 'transparent', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }} />
          )}
        </View>
      </View>
      {roles && (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: roles.fill }} />
          <Text style={{ color: roles.text, fontSize: 13, fontWeight: '600' }}>This is how Fync will look</Text>
        </View>
      )}
      {!roles && <Text style={{ color: C.ink3, fontSize: 12 }}>Drag on the palette to make your own colour.</Text>}
    </View>
  );
}
