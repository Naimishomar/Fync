/**
 * Campus Press UI kit.
 *
 * Every one of these has a named equivalent in `mockups/css/ui.css`, and a screen
 * is expected to be assembled from them rather than from raw <View>s. That is the
 * whole point: the mockups only stay true if there is one implementation of a
 * card, a section header and a sticker, not sixty.
 *
 * Non-negotiables baked in here so no screen has to remember them:
 *   - 20px gutter, and an edge icon button overhangs by 11px so the GLYPH meets
 *     the gutter rather than its 44px touch box.
 *   - 44x44 minimum tap target on everything interactive. `Tag` is the read-only
 *     variant at 28px, where the floor does not apply.
 *   - One `stamp` card per screen. Buttons inside a card never carry the stamp.
 *   - Uppercase is a label treatment only; body copy is sentence case at 15px.
 *   - Role colour is never the only signal: `Avatar` rings, and callers pair it
 *     with a <Sticker> carrying the word.
 */
import React from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
  type ViewProps, type TextProps, type PressableProps,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '../../constants/layout';

/* ------------------------------------------------------------------ tokens */
// Mirrors tailwind.config.js for the handful of places that need a raw value
// (shadows, SVG-ish props, Ionicons colour). Keep the two in step.
export const C = {
  ink: '#12100E', ink2: '#57534E', ink3: '#8B857E', ink4: '#C4BEB6',
  paper: '#F5F2EC', paper2: '#EDE8E0', card: '#FFFFFF', line: '#E3DDD3',
  brand: '#F97316', brandText: '#EA580C', brand100: '#EDE8E0', brand200: '#EDE8E0', brand50: '#EDE8E0',
  student: '#F97316', alumni: '#B45309', alumniLit: '#F5B700', recruiter: '#4F46E5',
  study: '#7C3AED', career: '#2563EB', events: '#EA580C', social: '#0891B2', campus: '#57534E', fun: '#DB2777',
  success: '#047857', warning: '#B45309', danger: '#DC2626',
  night: '#0D0B12', night2: '#171320', nightInk: '#EDE8E0', night3: '#8B8397', violet: '#7C3AED',
} as const;

export const GUTTER = 20;

/** The one stamp per screen. Android has no offset-shadow primitive, so it is
 *  drawn as a second layer by <Card stamp> rather than faked with elevation. */
export const STAMP_OFFSET = 4;

/* -------------------------------------------------------------- typography */
type TP = TextProps & { children?: React.ReactNode };

export const Display = ({ style, ...p }: TP) => (
  <Text {...p} style={[s.display, style]} />
);
export const H1 = ({ style, ...p }: TP) => <Text {...p} style={[s.h1, style]} />;
export const H2 = ({ style, ...p }: TP) => <Text {...p} style={[s.h2, style]} />;
export const Body = ({ style, ...p }: TP) => <Text {...p} style={[s.body, style]} />;
export const Sm = ({ style, ...p }: TP) => <Text {...p} style={[s.sm, style]} />;
export const Meta = ({ style, ...p }: TP) => <Text {...p} style={[s.meta, style]} />;
/** Uppercase, tracked, 11px. Labels only — never body copy. */
export const Label = ({ style, ...p }: TP) => <Text {...p} style={[s.label, style]} />;
/** Tabular numerals in the display face. Streaks, scores, ranks, money, timers. */
export const Num = ({ style, ...p }: TP) => <Text {...p} style={[s.num, style]} />;
/** Bold Inter — the standard row title. */
export const Strong = ({ style, ...p }: TP) => <Text {...p} style={[s.strong, style]} />;

/* ------------------------------------------------------------------ screen */
export const Screen = ({ style, night, ...p }: ViewProps & { night?: boolean }) => (
  <View {...p} style={[{ flex: 1, backgroundColor: night ? C.night : C.paper }, style]} />
);

/** Horizontal gutter. Every screen uses this and nothing else. */
export const Pad = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ paddingHorizontal: GUTTER }, style]} />
);

/* ------------------------------------------------------------------ appbar */
export function AppBar({
  title, subtitle, onBack, right, night,
}: {
  title?: string; subtitle?: string; onBack?: () => void;
  right?: React.ReactNode; night?: boolean;
}) {
  const fg = night ? C.nightInk : C.ink;
  return (
    <View style={s.appbar}>
      {onBack ? (
        // -11px so the chevron's own edge lands on the 20px gutter, not the box's.
        <IconBtn name="chevron-back" onPress={onBack} color={fg} style={{ marginLeft: -11 }} />
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        {title ? <H2 style={{ color: fg }} numberOfLines={1}>{title}</H2> : null}
        {subtitle ? (
          <Meta numberOfLines={1} style={night ? { color: C.night3 } : undefined}>{subtitle}</Meta>
        ) : null}
      </View>
      {right ? <View style={s.appbarActions}>{right}</View> : null}
    </View>
  );
}

/* -------------------------------------------------------------- icon button */
export function IconBtn({
  name, onPress, color = C.ink, size = 22, boxed, badge, style,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void; color?: string; size?: number; boxed?: boolean;
  badge?: number | string; style?: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [
        s.iconbtn, boxed && s.iconbtnBoxed, pressed && { opacity: 0.6 }, style,
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
      {badge != null && badge !== 0 ? <Badge value={badge} /> : null}
    </Pressable>
  );
}

export const Badge = ({ value, tone = C.danger }: { value: number | string; tone?: string }) => (
  <View style={[s.badge, { backgroundColor: tone }]}>
    <Text style={s.badgeText}>{typeof value === 'number' && value > 9 ? '9+' : value}</Text>
  </View>
);

/* -------------------------------------------------------------------- card */
export function Card({
  stamp, padded, style, children, ...p
}: ViewProps & { stamp?: boolean; padded?: boolean }) {
  const body = (
    <View
      {...p}
      style={[
        s.card,
        stamp && s.cardStamp,
        padded && { padding: 16 },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!stamp) return body;
  // The offset stamp is drawn, not shadowed: RN cannot express a hard 4px offset
  // with zero blur on Android, and elevation would round the corners differently
  // on each platform.
  return (
    <View style={{ position: 'relative' }}>
      <View pointerEvents="none" style={s.stampLayer} />
      {body}
    </View>
  );
}

/* ------------------------------------------------------------- stamp card */
/**
 * The one stamped card per screen — the thing the screen exists for.
 *
 * A drop-in wrapper rather than a prop on `Card`, because most screens already
 * style their hero with classNames and only need the offset layer added behind
 * it. The stamp is PAINTED, not shadowed: RN cannot express a hard 4px offset
 * with zero blur on Android, and `elevation` rounds the corners differently on
 * each platform.
 *
 * Exactly one per screen. Two stamps and the device stops meaning anything —
 * hierarchy here comes from scarcity, not from more shadow.
 */
export function StampCard({
  children, style, radius = 20, tone = C.ink,
}: { children: React.ReactNode; style?: any; radius?: number; tone?: string }) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: STAMP_OFFSET, top: STAMP_OFFSET,
          right: -STAMP_OFFSET, bottom: -STAMP_OFFSET,
          backgroundColor: tone, borderRadius: radius,
        }}
      />
      <View style={{ backgroundColor: C.card, borderWidth: 2, borderColor: C.ink, borderRadius: radius, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------- section header */
/** Eyebrow, 2px hard rule to the edge, tabular count on the right. Replaces every
 *  ad-hoc "Section title / See all" row in the app. */
export function SectionRule({
  label, count, right, style,
}: { label: string; count?: string | number; right?: React.ReactNode; style?: any }) {
  return (
    <View style={[s.rule, style]}>
      <Label style={{ color: C.ink }}>{label}</Label>
      <View style={s.ruleLine} />
      {right ?? (count != null ? <Num style={s.ruleCount}>{String(count)}</Num> : null)}
    </View>
  );
}

/* ----------------------------------------------------------------- sticker */
type Tone = 'brand' | 'alt' | 'live' | 'gold' | 'rec' | 'ok' | 'warn';
const STICKER_BG: Record<Tone, string> = {
  brand: C.brand200, alt: '#FFFFFF', live: C.danger, gold: C.alumniLit,
  rec: '#EDE8E0', ok: '#EDE8E0', warn: '#EDE8E0',
};
/** Status and identity only — never navigation. Rotation is decorative and must
 *  not clip text or shrink the tap area, so it is applied to the wrapper. */
export function Sticker({
  children, tone = 'brand', tilt, flat, icon,
}: {
  children: React.ReactNode; tone?: Tone; tilt?: 'l' | 'r'; flat?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const fg = tone === 'live' ? '#FFFFFF' : C.ink;
  return (
    <View
      style={[
        s.sticker,
        { backgroundColor: STICKER_BG[tone] },
        flat && { shadowOpacity: 0, elevation: 0, borderWidth: 1.5 },
        !flat && { transform: [{ rotate: tilt === 'r' ? '1.8deg' : '-1.6deg' }] },
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={fg} style={{ marginRight: 4 }} /> : null}
      <Text style={[s.stickerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ role sticker */
/** The text half of the role signal. `Avatar` draws the ring; this carries the
 *  word. Colour is never the only signal, so wherever a role changes what the
 *  content MEANS — an alumnus giving advice, a recruiter posting a role — the
 *  ring is paired with one of these.
 *
 *  Students are the default audience and get no sticker: labelling every row
 *  "Student" is noise, and the ring already distinguishes the exceptions. */
export function RoleSticker({ role, size = 'sm' }: { role?: string; size?: 'sm' | 'md' }) {
  if (role !== 'alumni' && role !== 'recruiter' && role !== 'admin') return null;
  const tone: Tone = role === 'alumni' ? 'gold' : role === 'recruiter' ? 'rec' : 'live';
  const label = role === 'alumni' ? 'Alumni' : role === 'recruiter' ? 'Recruiter' : 'Admin';
  if (size === 'md') return <Sticker tone={tone}>{label}</Sticker>;
  return (
    <View style={[s.sticker, { backgroundColor: STICKER_BG[tone], paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1.5, shadowOpacity: 0, elevation: 0 }]}>
      <Text style={[s.stickerText, { fontSize: 8, color: tone === 'live' ? '#fff' : C.ink }]}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------- number stamp */
/** Dashed circular stamp for streaks / score / rank / countdowns. The caption is
 *  capped so long words cannot spill past the ring. */
export function StampNumber({
  value, caption, tone = C.brand100, size = 66,
}: { value: string | number; caption?: string; tone?: string; size?: number }) {
  return (
    <View style={[s.stampnum, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone }]}>
      <Num style={{ fontSize: size * 0.32, lineHeight: size * 0.34 }}>{String(value)}</Num>
      {caption ? (
        <Text numberOfLines={1} style={s.stampnumCaption}>{caption}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ button */
type BtnVariant = 'primary' | 'solid' | 'quiet' | 'ghost';
export function Button({
  title, onPress, variant = 'quiet', icon, small, block, disabled, style, inCard,
}: {
  title: string; onPress?: () => void; variant?: BtnVariant;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  small?: boolean; block?: boolean; disabled?: boolean; style?: any;
  /** Set on buttons that sit inside a Card, so the stamp stays unique per screen. */
  inCard?: boolean;
}) {
  const fg =
    variant === 'primary' ? C.ink :
    variant === 'solid' ? C.paper :
    C.ink;
  const bg =
    variant === 'primary' ? C.brand :
    variant === 'solid' ? C.ink :
    variant === 'quiet' ? C.card : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && s.btnSm,
        { backgroundColor: bg },
        variant === 'quiet' && { borderColor: C.line },
        variant === 'ghost' && { borderColor: 'transparent' },
        variant === 'primary' && !inCard && s.btnStamp,
        block && { alignSelf: 'stretch' },
        disabled && { opacity: 0.45 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 15 : 17} color={fg} style={{ marginRight: 7 }} /> : null}
      <Text style={[s.btnText, small && { fontSize: 12 }, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- chip */
/** Interactive filter / action. Meets the 44px floor. */
export function Chip({
  label, active, icon, onPress, style,
}: {
  label?: string; active?: boolean; onPress?: () => void; style?: any;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const fg = active ? C.paper : C.ink2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        s.chip, active && { backgroundColor: C.ink, borderColor: C.ink },
        pressed && { opacity: 0.7 }, style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={fg} style={label ? { marginRight: 6 } : undefined} /> : null}
      {label ? <Text style={[s.chipText, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** Read-only metadata. 28px — not a tap target, so the 44px floor does not apply.
 *  Wrap these in a <TagRow>, never in a horizontal scroller inside a card. */
export function Tag({
  label, icon, tone, style,
}: {
  label: string; tone?: { bg?: string; border?: string; fg?: string }; style?: any;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const fg = tone?.fg ?? C.ink2;
  return (
    <View style={[s.tag, tone?.bg && { backgroundColor: tone.bg }, tone?.border && { borderColor: tone.border }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} style={{ marginRight: 5 }} /> : null}
      <Text style={[s.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export const TagRow = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]} />
);

/** Horizontal filter scroller. Bleeds to the screen edge so the last chip reads
 *  as scrollable rather than as clipped by a bug. */
export const ChipRow = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 8 }}
    style={[{ flexGrow: 0 }, style]}
  >
    {children}
  </ScrollView>
);

/* ------------------------------------------------------------------ avatar */
export type Role = 'student' | 'alumni' | 'recruiter' | undefined;
const RING: Record<string, string> = { student: C.student, alumni: C.alumni, recruiter: C.recruiter };

export function Avatar({
  initials, uri, size = 44, role, square, style,
}: {
  initials?: string; uri?: string; size?: number; role?: Role; square?: boolean; style?: any;
}) {
  const ring = role ? RING[role] : undefined;
  return (
    <View
      style={[
        {
          width: size, height: size,
          borderRadius: square ? 12 : size / 2,
          backgroundColor: C.paper2,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        },
        ring && { borderWidth: 2, borderColor: ring },
        style,
      ]}
    >
      {uri ? (
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        <ExpoImageLike uri={uri} size={size} />
      ) : (
        <Text style={[s.avText, { fontSize: size * 0.34 }]}>{initials?.slice(0, 2).toUpperCase()}</Text>
      )}
    </View>
  );
}

// Kept local so the kit does not force expo-image on callers that pass initials.
function ExpoImageLike({ uri, size }: { uri: string; size: number }) {
  const { Image } = require('expo-image');
  return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="disk" />;
}

/* -------------------------------------------------------------------- rows */
export const Row = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]} />
);
export const Grow = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flex: 1, minWidth: 0 }, style]} />
);
export const Divider = ({ style }: { style?: any }) => (
  <View style={[{ height: 1, backgroundColor: C.line }, style]} />
);

/* -------------------------------------------------------------------- tabs */
/** Segmented tabs with the 3px brand underline. */
export function Tabs({
  items, value, onChange, fill,
}: { items: string[]; value: string; onChange: (v: string) => void; fill?: boolean }) {
  return (
    <View style={[s.tabs, fill && { gap: 0 }]}>
      {items.map((t) => {
        const on = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.tab, fill && { flex: 1, alignItems: 'center' }]}
          >
            <Text style={[s.tabText, on && { color: C.ink }]}>{t}</Text>
            {on ? <View style={s.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- tiles */
/** 4-up feature grid. The box fills its column so the row lines up with the
 *  section rule above it — a fixed box centred in a wider column never does. */
export function Tile({
  label, icon, tint = C.ink2, onPress,
}: {
  label: string; icon: React.ComponentProps<typeof Ionicons>['name'];
  tint?: string; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.tile}>
      {({ pressed }) => (
        <>
          <View style={[s.tileBox, pressed && { backgroundColor: C.paper2 }]}>
            <Ionicons name={icon} size={24} color={tint} />
          </View>
          <Text numberOfLines={2} style={s.tileLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
export const TileGrid = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }, style]} />
);

/* --------------------------------------------------------------- bottom bar */
/** Docked action bar for pushed screens. Pads clear of the home indicator so a
 *  composer is never flush against the glass. */
export function BottomBar({ children, style }: { children: React.ReactNode; style?: any }) {
  const inset = useBottomInset(10);
  return (
    <View style={[s.bottombar, { paddingBottom: inset + 10 }, style]}>{children}</View>
  );
}

/* ------------------------------------------------------------ empty states */
export function Empty({
  title, hint, icon, action,
}: {
  title: string; hint?: string; action?: React.ReactNode;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={s.empty}>
      {icon ? <Ionicons name={icon} size={28} color={C.ink4} style={{ marginBottom: 12 }} /> : null}
      <Label>{title}</Label>
      {hint ? <Meta style={{ marginTop: 8, textAlign: 'center' }}>{hint}</Meta> : null}
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */
const s = StyleSheet.create({
  display: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, lineHeight: 35, letterSpacing: -1.2, color: C.ink, textTransform: 'uppercase' },
  h1: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, lineHeight: 27, letterSpacing: -0.6, color: C.ink },
  h2: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 19, lineHeight: 23, letterSpacing: -0.4, color: C.ink },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: C.ink2 },
  sm: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: C.ink2 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: C.ink3 },
  strong: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 19, color: C.ink },
  label: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase', color: C.ink3 },
  num: { fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5, color: C.ink, fontVariant: ['tabular-nums'] },

  appbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12 },
  appbarActions: { flexDirection: 'row', alignItems: 'center', marginRight: -11 },

  iconbtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  iconbtnBoxed: { borderWidth: 1, borderColor: C.line, backgroundColor: C.card },

  badge: {
    position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, borderWidth: 2, borderColor: C.paper, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 9, color: '#fff' },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#12100E', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 1 },
    }),
  },
  cardStamp: { borderWidth: 2, borderColor: C.ink, shadowOpacity: 0, elevation: 0 },
  stampLayer: {
    position: 'absolute', left: STAMP_OFFSET, top: STAMP_OFFSET, right: -STAMP_OFFSET, bottom: -STAMP_OFFSET,
    backgroundColor: C.ink, borderRadius: 20,
  },

  rule: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 12 },
  ruleLine: { flex: 1, height: 2, backgroundColor: C.ink, opacity: 0.82 },
  ruleCount: { fontSize: 11, color: C.ink3, letterSpacing: 0 },

  sticker: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4,
    borderWidth: 2, borderColor: C.ink,
    ...Platform.select({
      ios: { shadowColor: C.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 2, height: 2 } },
      android: { elevation: 0 },
    }),
  },
  stickerText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },

  stampnum: { borderWidth: 2, borderColor: C.ink, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  stampnumCaption: {
    fontFamily: 'SpaceGrotesk_700Bold', fontSize: 8, letterSpacing: 0.5,
    textTransform: 'uppercase', color: C.ink2, marginTop: 2, maxWidth: 56,
  },

  btn: {
    minHeight: 48, paddingHorizontal: GUTTER, borderRadius: 12, borderWidth: 2, borderColor: C.ink,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  btnSm: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1.5 },
  btnStamp: Platform.select({
    ios: { shadowColor: C.ink, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 } },
    android: {},
  }) as any,
  btnText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, letterSpacing: 0.3, textTransform: 'uppercase' },

  chip: {
    minHeight: 44, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.card, flexDirection: 'row', alignItems: 'center',
  },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  tag: {
    minHeight: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.card, flexDirection: 'row', alignItems: 'center',
  },
  tagText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  avText: { fontFamily: 'SpaceGrotesk_700Bold', color: C.ink2 },

  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: GUTTER, borderBottomWidth: 1, borderBottomColor: C.line },
  tab: { paddingTop: 10, paddingBottom: 12 },
  tabText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, letterSpacing: -0.2, color: C.ink3 },
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, borderRadius: 2, backgroundColor: C.brand },

  tile: { width: '25%', paddingHorizontal: 6, paddingBottom: 18, alignItems: 'center', gap: 7 },
  tileBox: {
    width: '100%', height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.line,
  },
  tileLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, lineHeight: 12, letterSpacing: -0.1, textAlign: 'center', color: C.ink },

  bottombar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: GUTTER, paddingTop: 12,
    backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line,
  },

  empty: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: 20,
  },
});

export const kitStyles = s;
