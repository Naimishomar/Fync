/**
 * Fync UI kit — the soft style (bg-card, 1px hairlines, radius 16, pill
 * buttons, sentence-case Inter labels; Space Grotesk only for titles and
 * numerals). Screens are assembled from these rather than raw <View>s.
 *
 * Baked in so no screen has to remember them:
 *   - 20px gutter; an edge icon button overhangs by 11px so the GLYPH meets
 *     the gutter rather than its 44px touch box.
 *   - 44px minimum touch target (hitSlop where the visual is smaller).
 *   - No stamps, no 2px ink borders, no uppercase labels. `stamp` props are
 *     accepted for old callers and render the soft card.
 *   - Role colour is never the only signal: `Avatar` rings, and callers pair it
 *     with a <RoleSticker> carrying the word.
 */
import React, { memo, useCallback, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
  type ViewProps, type TextProps,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '../../constants/layout';
import { C as P, themed } from '../../constants/colors';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { tick } from './motion';
import { artUrl } from '../../constants/features';

/* ------------------------------------------------------------ press feel */
// Same feel as motion.tsx's PressScale, but the style stays on the Pressable
// itself: PressScale puts it on an inner view, which would strand callers'
// flex/margin/absolute styles (Button style={{ flex: 1 }}, etc.) off-layout.
// Haptic fires on the press, not press-in, so starting a scroll on a row is silent.
const APressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { damping: 18, stiffness: 320, mass: 0.6 };
function Press({
  scale = 0.97, haptic = true, onPress, style, ...rest
}: React.ComponentProps<typeof Pressable> & { scale?: number; haptic?: boolean; style?: any }) {
  const v = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  const press = useCallback((e: any) => { if (haptic) tick(); onPress?.(e); }, [haptic, onPress]);
  return (
    <APressable
      {...rest}
      onPress={onPress ? press : undefined}
      onPressIn={() => { v.value = withTiming(scale, { duration: 90 }); }}
      onPressOut={() => { v.value = withSpring(1, PRESS_SPRING); }}
      style={[style, anim]}
    />
  );
}

/* ------------------------------------------------------------------ tokens */
// The kit's short names for the live palette in constants/colors.ts. Every
// read goes through to the current theme (see the Proxy there).
type KitC = {
  ink: string; ink2: string; ink3: string; ink4: string;
  paper: string; paper2: string; card: string; line: string;
  brand: string; brandText: string; brand100: string; brand200: string; brand50: string;
  student: string; alumni: string; alumniLit: string; recruiter: string;
  study: string; career: string; events: string; social: string; campus: string; fun: string;
  success: string; warning: string; danger: string;
  night: string; night2: string; nightInk: string; night3: string; violet: string;
};
const kitKey: Record<keyof KitC, () => string> = {
  ink: () => P.ink, ink2: () => P.ink2, ink3: () => P.ink3, ink4: () => P.ink4,
  paper: () => P.paper, paper2: () => P.paper2, card: () => P.card, line: () => P.line,
  brand: () => P.brand[500], brandText: () => P.accentText,
  brand100: () => P.paper2, brand200: () => P.paper2, brand50: () => P.paper2,
  student: () => P.student, alumni: () => P.alumni, alumniLit: () => P.alumniLit, recruiter: () => P.recruiter,
  study: () => P.fam.study, career: () => P.fam.career, events: () => P.fam.events,
  social: () => P.fam.social, campus: () => P.fam.campus, fun: () => P.fam.fun,
  success: () => P.success, warning: () => P.warning, danger: () => P.danger,
  night: () => P.night, night2: () => P.night2, nightInk: () => P.nightInk, night3: () => P.night3,
  violet: () => '#7C3AED',
};
export const C: KitC = new Proxy({} as KitC, {
  get: (_t, k) => kitKey[k as keyof KitC]?.(),
});

export const GUTTER = 20;

/** Kept for compatibility; the stamp is gone, nothing is offset any more. */
export const STAMP_OFFSET = 0;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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
/** Small sentence-case semibold eyebrow (13px, ink-3). No uppercase, no tracking. */
export const Label = ({ style, ...p }: TP) => <Text {...p} style={[s.label, style]} />;
/** Tabular numerals in the display face. Streaks, scores, ranks, money, timers. */
export const Num = ({ style, ...p }: TP) => <Text {...p} style={[s.num, style]} />;
/** Semibold Inter — the standard row title. */
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
/** Height of the bar itself, below the status-bar inset. */
export const APPBAR_HEIGHT = 56;

/**
 * The one screen header: owns the status-bar inset (screens must NOT add their
 * own top SafeArea/padding), a fixed 56px row and a single-line title.
 * `inset={false}` only where the bar already sits below the status bar.
 */
/** True when `node` is nothing but IconBtns (fragments flattened). */
const onlyIconBtns = (node: React.ReactNode): boolean => {
  let ok = true;
  const walk = (n: React.ReactNode) => React.Children.forEach(n, (c) => {
    if (!React.isValidElement(c)) return;
    if (c.type === React.Fragment) walk((c.props as any).children);
    else if (c.type !== IconBtn) ok = false;
  });
  walk(node);
  return ok;
};

export function AppBar({
  title, onBack, right, night, overlay, children, inset = true,
}: {
  title?: string; onBack?: () => void;
  right?: React.ReactNode; night?: boolean;
  /** Floating over a photo/poster: light glyphs on dark discs. Pass `overlay`
   *  to the `right` IconBtns too. */
  overlay?: boolean;
  /** Replaces the title when it needs more than text (chat: avatar + presence). */
  children?: React.ReactNode;
  inset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const fg = night || overlay ? C.nightInk : C.ink;
  const bg = overlay ? 'transparent' : night ? C.night : C.paper;
  return (
    // box-none: floated over a banner, the empty stretch between the buttons must
    // not swallow the drag that scrolls the list underneath.
    <View style={{ paddingTop: inset ? insets.top : 0, backgroundColor: bg }} pointerEvents="box-none">
      <View style={s.appbar} pointerEvents="box-none">
        {onBack ? (
          // -11px so the chevron's own edge lands on the 20px gutter, not the box's;
          // -8px on the right pulls the title in, since the 44pt box already leaves
          // ~11px of air after the glyph and the row gap added 12 more.
          <IconBtn name="chevron-back" onPress={onBack} overlay={overlay} color={fg} accessibilityLabel="Go back" style={overlay ? { marginRight: -4 } : { marginLeft: -11, marginRight: -8 }} />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          {children ?? (title ? <H2 style={{ color: fg }} numberOfLines={1} accessibilityRole="header">{title}</H2> : null)}
        </View>
        {right ? (
          // The -11 offset lines an icon glyph up with the gutter; a Button (pill)
          // has its own edge and must sit on the gutter, or it runs off screen.
          <View style={[s.appbarActions, !onlyIconBtns(right) && { marginRight: 0 }]}>{right}</View>
        ) : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- icon button */
/** "notifications-outline" -> "notifications". A fallback only: pass a real label. */
const labelFromIcon = (n: string) => n.replace(/-(outline|sharp)$/, '').replace(/-/g, ' ');

/** 44x44 round icon button. `boxed` gives it a paper-2 disc. */
export function IconBtn({
  name, onPress, color, size = 22, boxed, overlay, badge, style, accessibilityLabel, disabled,
}: {
  name: IconName;
  onPress?: () => void; color?: string; size?: number; boxed?: boolean; overlay?: boolean;
  badge?: number | string; style?: any;
  accessibilityLabel?: string; disabled?: boolean;
}) {
  return (
    <Press
      scale={0.9}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? labelFromIcon(String(name))}
      accessibilityState={disabled ? { disabled } : undefined}
      hitSlop={4}
      // Static style: NativeWind's Pressable wrapper can drop a style *function*.
      style={[s.iconbtn, boxed && s.iconbtnBoxed, overlay && s.iconbtnOverlay, disabled && s.disabled, style]}
    >
      <Ionicons name={name} size={size} color={color ?? (overlay ? C.nightInk : C.ink)} />
      {badge != null && badge !== 0 ? <Badge value={badge} /> : null}
    </Press>
  );
}

export const Badge = ({ value, tone = C.danger }: { value: number | string; tone?: string }) => (
  <View style={[s.badge, { backgroundColor: tone }]}>
    <Text style={[s.badgeText, tone === P.brand[500] && { color: P.onBrand }]} maxFontSizeMultiplier={1.2}>{typeof value === 'number' && value > 9 ? '9+' : value}</Text>
  </View>
);

/* --------------------------------------------------------------- icon tile */
/** Round paper-2 disc with an ink line icon. Feature grids, list rows, empty states. */
export const IconTile = memo(function IconTile({
  icon, size = 40, iconSize, color, bg, style,
}: { icon: IconName; size?: number; iconSize?: number; color?: string; bg?: string; style?: any }) {
  return (
    <View style={[s.iconTile, { width: size, height: size, borderRadius: size / 2 }, bg ? { backgroundColor: bg } : null, style]}>
      <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.47)} color={color ?? C.ink} />
    </View>
  );
});

/* -------------------------------------------------------------------- card */
/** Soft card: bg-card, 1px line, radius 16. `stamp` is accepted and ignored. */
const hasPadding = (style: any) => {
  const flat = StyleSheet.flatten(style) || {};
  return Object.keys(flat).some((k) => k.startsWith('padding'));
};

export function Card({
  stamp: _stamp, padded, style, children, ...p
}: ViewProps & { stamp?: boolean; padded?: boolean }) {
  // Padded by default unless the caller sets its own padding (list cards pass
  // paddingHorizontal for their rows) or opts out with padded={false}. Without
  // this, content in a plain <Card> sat flush against the border.
  const pad = padded ?? !hasPadding(style);
  return (
    <View {...p} style={[s.card, pad && s.cardPad, style]}>
      {children}
    </View>
  );
}

/**
 * The hero card. Same soft card as `Card` (the old offset stamp is gone);
 * `radius` still applies, `tone` is accepted and ignored.
 */
export function StampCard({
  children, style, radius = 16,
}: { children: React.ReactNode; style?: any; radius?: number; tone?: string }) {
  return (
    <View style={[s.card, { borderRadius: radius }, style]}>
      {children}
    </View>
  );
}

/* ---------------------------------------------------------- section header */
/**
 * Section title row: semibold 16 title, optional action or count on the right.
 *   <SectionHeader title="Upcoming" action="See all" onAction={openAll} />
 */
export function SectionHeader({
  title, action, onAction, right, count, style,
}: {
  title: string; action?: string; onAction?: () => void;
  right?: React.ReactNode; count?: string | number; style?: any;
}) {
  return (
    <View style={[s.rule, style]}>
      <Text style={s.sectionTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
      {right ?? (action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} className="active:opacity-85" accessibilityRole="button">
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      ) : count != null ? <Text style={s.ruleCount}>{String(count)}</Text> : null)}
    </View>
  );
}

/** Old name for SectionHeader (label -> title). */
export function SectionRule({
  label, count, right, style,
}: { label: string; count?: string | number; right?: React.ReactNode; style?: any }) {
  return <SectionHeader title={label} count={count} right={right} style={style} />;
}

/* ----------------------------------------------------------------- sticker */
type Tone = 'brand' | 'alt' | 'live' | 'gold' | 'rec' | 'ok' | 'warn';
// A function, not a module-level object: a frozen object kept the light values
// in dark mode.
const stickerBg = (t: Tone) => ({
  brand: C.paper2, alt: C.card, live: C.danger, gold: C.alumniLit,
  rec: C.paper2, ok: C.paper2, warn: C.paper2,
})[t];
/** Gold is the same bright yellow in both themes, so it always takes dark ink. */
const stickerFg = (tone: Tone) => (tone === 'live' ? C.paper : tone === 'gold' ? P.onBrand : C.ink);
/** Small status pill. Status and identity only — never navigation.
 *  `tilt` / `flat` are accepted and ignored. */
export function Sticker({
  children, tone = 'brand', icon,
}: {
  children: React.ReactNode; tone?: Tone; tilt?: 'l' | 'r'; flat?: boolean;
  icon?: IconName;
}) {
  const fg = stickerFg(tone);
  return (
    <View style={[s.sticker, { backgroundColor: stickerBg(tone) }, tone === 'alt' && s.stickerAlt]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[s.stickerText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/* ------------------------------------------------------------ role sticker */
/** The text half of the role signal (`Avatar` draws the ring). Students get none. */
export function RoleSticker({ role, size = 'sm' }: { role?: string; size?: 'sm' | 'md' }) {
  if (role !== 'alumni' && role !== 'recruiter' && role !== 'admin') return null;
  const tone: Tone = role === 'alumni' ? 'gold' : role === 'recruiter' ? 'rec' : 'live';
  const label = role === 'alumni' ? 'Alumni' : role === 'recruiter' ? 'Recruiter' : 'Admin';
  if (size === 'md') return <Sticker tone={tone}>{label}</Sticker>;
  return (
    <View style={[s.sticker, s.stickerSm, { backgroundColor: stickerBg(tone) }]}>
      <Text style={[s.stickerText, { color: stickerFg(tone) }]}>{label}</Text>
    </View>
  );
}

/* -------------------------------------------------------------- number stamp */
/** Round numeral badge for streaks / score / rank / countdowns. */
export function StampNumber({
  value, caption, tone = C.paper2, size = 66,
}: { value: string | number; caption?: string; tone?: string; size?: number }) {
  return (
    <View style={[s.stampnum, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone }]}>
      <Num style={{ fontSize: size * 0.32, lineHeight: size * 0.36 }}>{String(value)}</Num>
      {caption ? (
        <Text numberOfLines={1} style={[s.stampnumCaption, { maxWidth: size - 10 }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ button */
/**
 * Pill button, 48px (small 36px with hitSlop to 44).
 *   primary            brand fill, on-brand text
 *   secondary / quiet  card + 1px line (default)
 *   tertiary / ghost   paper-2 fill
 *   solid              ink fill, paper text
 *   danger             danger fill, white text
 */
type BtnVariant = 'primary' | 'solid' | 'quiet' | 'ghost' | 'secondary' | 'tertiary' | 'danger';
const SMALL_SLOP = { top: 4, bottom: 4, left: 0, right: 0 };
export function Button({
  title, onPress, variant = 'quiet', icon, small, block, disabled, style, loading, accessibilityLabel,
}: {
  title: string; onPress?: () => void; variant?: BtnVariant;
  icon?: IconName;
  small?: boolean; block?: boolean; disabled?: boolean; style?: any;
  /** No longer does anything (there is no stamp); kept for old callers. */
  inCard?: boolean;
  /** Spinner over the (hidden) label, so the button keeps its width. Disables presses. */
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const v = variant === 'secondary' ? 'quiet' : variant === 'tertiary' ? 'ghost' : variant;
  const fg =
    v === 'primary' ? P.onBrand :
    v === 'solid' ? C.paper :
    v === 'danger' ? C.paper :
    C.ink;
  const off = disabled || loading;
  return (
    <Press
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      hitSlop={small ? SMALL_SLOP : undefined}
      style={[s.btn, small && s.btnSm, s[`btn_${v}`], block && s.btnBlock, disabled && s.disabled, style]}
    >
      <View style={[s.btnInner, loading && s.hidden]}>
        {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
        <Text style={[s.btnText, small && s.btnTextSm, { color: fg }]} numberOfLines={1}>{title}</Text>
      </View>
      {loading ? <ActivityIndicator size="small" color={fg} style={s.btnSpinner} /> : null}
    </Press>
  );
}

/* -------------------------------------------------------------------- chip */
/** Interactive filter pill, 36px visual / 44px touch. Selected = ink fill. */
export const Chip = memo(function Chip({
  label, active, icon, onPress, style, accessibilityLabel,
}: {
  label?: string; active?: boolean; onPress?: () => void; style?: any;
  icon?: IconName; accessibilityLabel?: string;
}) {
  const fg = active ? P.onBrand : C.ink2;
  return (
    <Press
      scale={0.95}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active }}
      hitSlop={SMALL_SLOP}
      style={[s.chip, active && s.chipOn, style]}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      {label ? <Text style={[s.chipText, { color: fg }]} numberOfLines={1}>{label}</Text> : null}
    </Press>
  );
});

/** Read-only metadata pill, 28px. Not a tap target. Wrap in <TagRow>. */
export function Tag({
  label, icon, tone, style,
}: {
  label: string; tone?: { bg?: string; border?: string; fg?: string }; style?: any;
  icon?: IconName;
}) {
  const fg = tone?.fg ?? C.ink2;
  return (
    <View style={[s.tag, tone?.bg && { backgroundColor: tone.bg }, tone?.border && { borderColor: tone.border }, style]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={[s.tagText, { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export const TagRow = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]} />
);

/** Horizontal chip scroller, bleeds to the screen edge. */
export const ChipRow = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <ScrollView keyboardShouldPersistTaps="handled"
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={s.chipRow}
    style={[{ flexGrow: 0 }, style]}
  >
    {children}
  </ScrollView>
);

/**
 * Single-select filter row built from Chips. Use for "All / Open / Closed".
 *   <FilterChips items={['All', 'Open']} value={f} onChange={setF} />
 */
export function FilterChips<T extends string>({
  items, value, onChange, labels, style,
}: { items: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>>; style?: any }) {
  return (
    <ChipRow style={style}>
      {items.map((it) => (
        <Chip key={it} label={labels?.[it] ?? it} active={it === value} onPress={() => onChange(it)} />
      ))}
    </ChipRow>
  );
}

/* ------------------------------------------------------------------ avatar */
export type Role = 'student' | 'alumni' | 'recruiter' | undefined;
// Read per render so the ring follows the theme (alumni/recruiter differ in dark).
const ringOf = (r: string) => ({ student: C.student, alumni: C.alumni, recruiter: C.recruiter } as Record<string, string>)[r];

export function Avatar({
  initials, uri, size = 44, role, square, style,
}: {
  initials?: string; uri?: string; size?: number; role?: Role; square?: boolean; style?: any;
}) {
  const ring = role ? ringOf(role) : undefined;
  return (
    <View
      style={[
        s.av,
        { width: size, height: size, borderRadius: square ? 12 : size / 2 },
        ring && { borderWidth: 2, borderColor: ring },
        style,
      ]}
    >
      {uri ? (
        <ExpoImageLike uri={uri} size={size} />
      ) : (
        <Text style={[s.avText, { fontSize: size * 0.36 }]}>{initials?.slice(0, 2).toUpperCase()}</Text>
      )}
    </View>
  );
}

// Kept local so the kit does not force expo-image on callers that pass initials.
function ExpoImageLike({ uri, size }: { uri: string; size: number }) {
  const { Image } = require('expo-image');
  return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="memory-disk" />;
}

/* -------------------------------------------------------------------- rows */
export const Row = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]} />
);
export const Grow = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flex: 1, minWidth: 0 }, style]} />
);
export const Divider = ({ style }: { style?: any }) => (
  <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: C.line }, style]} />
);

/**
 * Leading (avatar / icon tile) + title + subtitle + trailing (chevron by default
 * when tappable). Memoized: pass stable props from list renderItem.
 *   <ListRow icon="settings-outline" title="Settings" subtitle="Privacy, alerts" onPress={open} />
 *   <ListRow leading={<Avatar user={u} size={44} />} title={u.name} right={<Button small title="Follow" />} />
 */
export const ListRow = memo(function ListRow({
  title, subtitle, meta, leading, icon, right, chevron, onPress, onLongPress, style, titleLines = 1, subtitleLines = 1,
  accessibilityLabel, disabled,
}: {
  title: string;
  subtitle?: string;
  /** Tiny trailing text above `right` (time, count). */
  meta?: string;
  leading?: React.ReactNode;
  /** Shorthand for `leading={<IconTile icon=... />}`. */
  icon?: IconName;
  right?: React.ReactNode;
  /** Default: shown when tappable and there is no `right`. */
  chevron?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  titleLines?: number;
  subtitleLines?: number;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const showChevron = chevron ?? (!!onPress && !right);
  const body = (
    <>
      {leading ?? (icon ? <IconTile icon={icon} /> : null)}
      <View style={s.listText}>
        <Text style={s.strong} numberOfLines={titleLines}>{title}</Text>
        {subtitle ? <Text style={s.meta} numberOfLines={subtitleLines}>{subtitle}</Text> : null}
      </View>
      {meta || right ? (
        <View style={s.listRight}>
          {meta ? <Text style={s.listMeta}>{meta}</Text> : null}
          {right}
        </View>
      ) : null}
      {showChevron ? <Ionicons name="chevron-forward" size={18} color={C.ink3} /> : null}
    </>
  );
  if (!onPress && !onLongPress) return <View style={[s.listRow, style]}>{body}</View>;
  return (
    <Press
      scale={0.98}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={[s.listRow, disabled && s.disabled, style]}
    >
      {body}
    </Press>
  );
});

/* -------------------------------------------------------------------- tabs */
/** Underline tabs: semibold labels, 2px brand underline on the selected one. */
export function Tabs({
  items, value, onChange, fill, style,
}: { items: string[]; value: string; onChange: (v: string) => void; fill?: boolean; style?: any }) {
  return (
    <View style={[s.tabs, fill && { gap: 0 }, style]} accessibilityRole="tablist">
      {items.map((t) => {
        const on = t === value;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className="active:opacity-85"
            style={[s.tab, fill && { flex: 1, alignItems: 'center' }]}
          >
            <Text style={[s.tabText, on && s.tabTextOn]}>{t}</Text>
            {on ? <View style={s.tabUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Segmented control: a paper-2 track with the selected segment on a card pill.
 * For 2-4 short options that switch a view in place.
 *   <SegmentedTabs items={['Posts', 'Shorts']} value={tab} onChange={setTab} />
 */
export function SegmentedTabs<T extends string>({
  items, value, onChange, labels, style,
}: { items: readonly T[]; value: T; onChange: (v: T) => void; labels?: Partial<Record<T, string>>; style?: any }) {
  return (
    <View style={[s.seg, style]} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it === value;
        return (
          <Pressable
            key={it}
            onPress={() => onChange(it)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className="active:opacity-85"
            style={[s.segItem, on && s.segItemOn]}
          >
            <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{labels?.[it] ?? it}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------- tiles */
/**
 * Feature grid item: round paper-2 icon over a 12px label. Lives in a
 * <TileGrid>; `columns` sets the cell width (default 4).
 */
export const Tile = memo(function Tile({
  label, icon, tint, onPress, columns = 4, hint,
}: {
  label: string; icon: IconName;
  tint?: string; onPress?: () => void; columns?: number;
  /** Read by screen readers after the label. */
  hint?: string;
}) {
  return (
    // Width on a plain View: NativeWind's Pressable can drop style functions.
    <View style={{ width: `${100 / columns}%`, paddingHorizontal: 4 }}>
      <Press
        scale={0.94}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={hint ? `${label}. ${hint}` : label}
        style={s.tile}
      >
        <IconTile icon={icon} size={56} iconSize={26} color={tint} />
        <Text numberOfLines={2} style={s.tileLabel}>{label}</Text>
      </Press>
    </View>
  );
});
export const TileGrid = ({ style, ...p }: ViewProps) => (
  <View {...p} style={[{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 20, marginHorizontal: -4 }, style]} />
);

/* --------------------------------------------------------------- bottom bar */
/** Docked action bar for pushed screens, padded clear of the home indicator. */
export function BottomBar({ children, style }: { children: React.ReactNode; style?: any }) {
  const inset = useBottomInset(16);
  return (
    <View style={[s.bottombar, { paddingBottom: inset }, style]}>{children}</View>
  );
}

/* ------------------------------------------------------------ empty states */
const F = (name: string) => `assets/${name}/3D/${name.toLowerCase().replace(/ /g, '_')}_3d.png`;
/** Ionicons name stem -> Fluent 3D emoji. Unmapped icons get sparkles. */
const EMPTY_ART: Record<string, string> = {
  chatbubble: F('Speech balloon'), chatbubbles: F('Speech balloon'), chatbox: F('Speech balloon'),
  search: F('Magnifying glass tilted left'), notifications: F('Bell'), 'notifications-off': F('Bell with slash'),
  people: F('Busts in silhouette'), person: F('Busts in silhouette'), briefcase: F('Briefcase'),
  calendar: F('Spiral calendar'), 'cloud-offline': F('Cloud'), cloud: F('Cloud'), gift: F('Wrapped gift'),
  school: F('Graduation cap'), rocket: F('Rocket'), document: F('Page facing up'), 'document-text': F('Page facing up'),
  compass: F('Compass'), trophy: F('Trophy'), ribbon: F('Trophy'), time: F('Alarm clock'), ticket: F('Admission tickets'),
  'lock-closed': F('Locked'), flame: F('Fire'), heart: F('Red heart'), images: F('Framed picture'), image: F('Framed picture'),
  videocam: F('Video camera'), film: F('Video camera'), 'mail-open': F('Envelope'), mail: F('Envelope'),
  'bag-handle': F('Shopping bags'), basket: F('Shopping bags'), storefront: F('Shopping bags'), cube: F('Package'),
  clipboard: F('Clipboard'), mic: F('Studio microphone'),
  ban: F('Prohibited'), layers: F('Card index dividers'), leaf: F('Herb'), 'code-slash': F('Laptop'),
  business: F('Office building'), radio: F('Radio'), pricetags: F('Label'), pricetag: F('Label'), podium: F('Sports medal'),
};
const SPARKLES = F('Sparkles');

/**
 * 3D emoji (from the icon, or `art`: a Fluent path / URL), semibold title,
 * ink-3 hint, optional action (a <Button>). `art={false}`: the round icon only.
 * The round icon is also the fallback while offline / if the image fails.
 */
export function Empty({
  title, hint, icon, action, art,
}: {
  title: string; hint?: string; action?: React.ReactNode;
  icon?: IconName;
  art?: string | false;
}) {
  const [failed, setFailed] = useState(false);
  const src = art === false || failed ? undefined
    : artUrl(art || (icon ? EMPTY_ART[String(icon).replace(/-(outline|sharp)$/, '')] ?? SPARKLES : undefined));
  return (
    <Animated.View style={s.empty} entering={FadeInDown.duration(320).springify().damping(18)}>
      {src ? (
        <Image
          source={{ uri: src }}
          style={{ width: 88, height: 88, marginBottom: 4 }}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
          onError={() => setFailed(true)}
          accessible={false}
        />
      ) : icon ? <IconTile icon={icon} size={56} iconSize={24} color={C.ink3} style={{ marginBottom: 4 }} /> : null}
      <Text style={s.emptyTitle} accessibilityRole="header">{title}</Text>
      {hint ? <Text style={s.emptyHint}>{hint}</Text> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </Animated.View>
  );
}

/* ------------------------------------------------------- shared re-exports */
export { Sheet, useKeyboardLift } from './Sheet';
export { SearchField, FormField } from './Field';

/* ------------------------------------------------------------------ styles */
const s = themed(() => ({
  display: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, lineHeight: 38, letterSpacing: -1, color: C.ink },
  h1: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 24, lineHeight: 29, letterSpacing: -0.5, color: C.ink },
  h2: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 19, lineHeight: 24, letterSpacing: -0.3, color: C.ink },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, color: C.ink2 },
  sm: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: C.ink2 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: C.ink3 },
  strong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: C.ink },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: C.ink3 },
  num: { fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.5, color: C.ink, fontVariant: ['tabular-nums'] },

  disabled: { opacity: 0.5 },
  hidden: { opacity: 0 },

  appbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, height: APPBAR_HEIGHT },
  appbarActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: -11 },

  iconbtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  iconbtnBoxed: { backgroundColor: C.paper2 },
  iconbtnOverlay: { backgroundColor: 'rgba(18,16,14,0.45)', marginHorizontal: 4 },

  badge: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, borderWidth: 2, borderColor: C.paper, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 13, color: C.paper },

  iconTile: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper2 },

  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16,
    borderCurve: 'continuous', overflow: 'hidden',
  },
  cardPad: { padding: 16 },

  rule: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 24, marginBottom: 12 },
  sectionTitle: { flex: 1, minWidth: 0, fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: C.ink },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: P.accentText },
  ruleCount: { fontFamily: 'Inter_500Medium', fontSize: 13, color: C.ink3, fontVariant: ['tabular-nums'] },

  sticker: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  stickerAlt: { borderWidth: 1, borderColor: C.line },
  stickerSm: { paddingHorizontal: 8, paddingVertical: 2 },
  stickerText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 14 },

  stampnum: { alignItems: 'center', justifyContent: 'center' },
  stampnumCaption: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 13, color: C.ink3 },

  btn: {
    minHeight: 48, paddingHorizontal: GUTTER, borderRadius: 999, borderWidth: 1, borderColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  btnSm: { minHeight: 36, paddingHorizontal: 14 },
  btnBlock: { alignSelf: 'stretch' },
  btn_primary: { backgroundColor: C.brand, borderColor: C.brand },
  btn_solid: { backgroundColor: C.ink, borderColor: C.ink },
  btn_quiet: { backgroundColor: C.card, borderColor: C.line },
  btn_ghost: { backgroundColor: C.paper2, borderColor: C.paper2 },
  btn_danger: { backgroundColor: C.danger, borderColor: C.danger },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20 },
  btnTextSm: { fontSize: 13, lineHeight: 18 },
  btnSpinner: { position: 'absolute' },

  chip: {
    minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.line,
    backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  chipOn: { backgroundColor: C.brand, borderColor: C.brand },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18 },
  chipRow: { paddingHorizontal: GUTTER, gap: 8 },

  tag: {
    minHeight: 28, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: 'transparent',
    backgroundColor: C.paper2, flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  tagText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },

  av: { backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avText: { fontFamily: 'Inter_600SemiBold', color: C.ink2 },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  listText: { flex: 1, minWidth: 0, gap: 2 },
  listRight: { alignItems: 'flex-end', gap: 4 },
  listMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: C.ink3 },

  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: GUTTER, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  tab: { minHeight: 44, justifyContent: 'center', paddingTop: 10, paddingBottom: 12 },
  tabText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: C.ink3 },
  tabTextOn: { color: C.ink },
  tabUnderline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, borderRadius: 1, backgroundColor: C.brand },

  seg: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 999, backgroundColor: C.paper2 },
  segItem: { flex: 1, minWidth: 0, minHeight: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segItemOn: { backgroundColor: C.brand },
  segText: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, color: C.ink3 },
  segTextOn: { fontFamily: 'Inter_600SemiBold', color: P.onBrand },

  tile: { alignItems: 'center', gap: 8 },
  tileLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, textAlign: 'center', color: C.ink },

  bottombar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: GUTTER, paddingTop: 12,
    backgroundColor: C.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: C.ink, textAlign: 'center' },
  emptyHint: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: C.ink3, textAlign: 'center' },
}));

export const kitStyles = s;
