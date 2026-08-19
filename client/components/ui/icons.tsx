import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * The handful of icons the app used from `lucide-react-native`, redrawn from
 * fonts that are already in the binary.
 *
 * Lucide has no per-icon entry point -- its package exports are barrels -- and
 * Metro does not tree-shake, so importing three icons pulled all 1714 of them
 * into the bundle. Measured cost: 1.8 MB of Hermes bytecode for 21 icons.
 *
 * Lucide is a fork of Feather, so most of these are the same drawing under the
 * same name; the few Feather lacks come from Ionicons, which is already the
 * app's primary icon set. Both fonts ship regardless, so these cost nothing.
 *
 * The component signature matches lucide's, so call sites are unchanged.
 */

type IconProps = {
  size?: number;
  color?: string;
  /** Accepted for signature parity with lucide; icon fonts have a fixed weight. */
  strokeWidth?: number;
  style?: any;
};

const feather = (name: React.ComponentProps<typeof Feather>['name']) => {
  const Component = ({ size = 24, color = '#000', style }: IconProps) => (
    <Feather name={name} size={size} color={color} style={style} />
  );
  Component.displayName = `Feather(${name})`;
  return Component;
};

const ionicon = (name: React.ComponentProps<typeof Ionicons>['name']) => {
  const Component = ({ size = 24, color = '#000', style }: IconProps) => (
    <Ionicons name={name} size={size} color={color} style={style} />
  );
  Component.displayName = `Ionicons(${name})`;
  return Component;
};

// Direct Feather equivalents (same glyph, same name upstream).
export const AlertTriangle = feather('alert-triangle');
export const Briefcase = feather('briefcase');
export const Camera = feather('camera');
export const CameraOff = feather('camera-off');
export const Code = feather('code');
export const MessageCircle = feather('message-circle');
export const Mic = feather('mic');
export const MicOff = feather('mic-off');
export const Phone = feather('phone');
export const PhoneCall = feather('phone-call');
export const PhoneOff = feather('phone-off');
export const RefreshCcw = feather('refresh-ccw');
export const RefreshCw = feather('refresh-cw');
export const Users = feather('users');
export const Video = feather('video');
export const Wrench = feather('tool');

// Not in Feather; taken from Ionicons.
export const Crown = ionicon('medal-outline');
export const Megaphone = ionicon('megaphone-outline');
export const Rocket = ionicon('rocket-outline');
export const Sparkles = ionicon('sparkles-outline');
export const Trophy = ionicon('trophy-outline');
