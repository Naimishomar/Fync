import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView, Keyboard, Platform, StyleSheet,
  type DimensionValue, type StyleProp, type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, themed } from '../../constants/colors';
import Animated, { SlideInDown } from 'react-native-reanimated';

/** Rises on a soft spring, barely any overshoot; the scrim fades in under it. */
const RISE = SlideInDown.springify().damping(22).stiffness(240).mass(0.8);

/**
 * Height to lift a bottom sheet by while the keyboard is up (0 when down).
 *
 * A KeyboardAvoidingView inside a Modal does nothing on Android edge-to-edge
 * (the modal window never resizes). Android also reports the keyboard height
 * with the nav bar subtracted, but the modal reaches under the nav bar, so the
 * inset is added back. iOS reports the full height. Same fix as CommentsSheet.
 */
export function useKeyboardLift(active = true) {
  const [height, setHeight] = useState(0);
  const navBar = useSafeAreaInsets().bottom;
  useEffect(() => {
    if (!active) { setHeight(0); return; }
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setHeight(e.endCoordinates.height + (ios ? 0 : navBar)));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [active, navBar]);
  return height;
}

/**
 * The one bottom sheet: scrim, handle, header (title/subtitle + round close),
 * body, optional footer pinned under a hairline. Lifts above the keyboard.
 *
 *   <Sheet visible={open} onClose={close} title="Filters" footer={<Button variant="primary" block title="Apply" />}>
 *     ...
 *   </Sheet>
 *
 * `scroll={false}` when the body is its own list (FlatList) — give the sheet a
 * `height` then, so the list has room to fill.
 */
export function Sheet({
  visible, onClose, title, subtitle, footer, children, height, scroll = true,
  contentStyle, closeLabel = 'Close', dismissable = true, header,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Pinned under a hairline; padded clear of the home indicator. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Fixed height ('78%'). Omitted, the sheet hugs its content up to 92%. */
  height?: DimensionValue;
  /** Wrap the body in a ScrollView (default). */
  scroll?: boolean;
  /** Padding for the body. Default 20 horizontal, 12 top, 16 bottom. */
  contentStyle?: StyleProp<ViewStyle>;
  closeLabel?: string;
  /** false: scrim and back button do nothing (a flow that must be finished). */
  dismissable?: boolean;
  /** Replaces the title row's text block (avatar + name, etc.). */
  header?: React.ReactNode;
}) {
  const inset = Math.max(useSafeAreaInsets().bottom, 16);
  const lift = useKeyboardLift(visible);
  const bottom = lift > 0 ? 12 : inset;
  const close = dismissable ? onClose : undefined;
  const fixed = height != null;

  const bodyPad = [s.body, !footer && { paddingBottom: bottom }, contentStyle];
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={close ?? (() => {})}>
      <View style={s.root}>
        <Pressable style={s.scrimTap} onPress={close} accessibilityLabel={closeLabel} />
        <Animated.View entering={RISE} style={[s.sheet, fixed && { height }, { marginBottom: lift }]}>
          <View style={s.handleWrap}><View style={s.handle} /></View>
          {title || header ? (
            <View style={s.header}>
              <View style={s.headerText}>
                {header ?? (
                  <>
                    <Text style={s.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
                    {subtitle ? <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
                  </>
                )}
              </View>
              {dismissable ? (
                <Pressable
                  onPress={onClose}
                  hitSlop={4}
                  className="active:opacity-85"
                  style={s.close}
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                >
                  <Ionicons name="close" size={20} color={C.ink2} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {scroll ? (
            <ScrollView
              style={fixed ? s.fill : s.shrink}
              contentContainerStyle={bodyPad}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[fixed ? s.fill : s.shrink, !footer && { paddingBottom: bottom }]}>{children}</View>
          )}

          {footer ? <View style={[s.footer, { paddingBottom: bottom }]}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = themed(() => ({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
  scrimTap: { flex: 1 },
  sheet: {
    maxHeight: '92%', flexShrink: 1, backgroundColor: C.card,
    borderTopLeftRadius: 26, borderTopRightRadius: 26, borderCurve: 'continuous',
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line, overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.line },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: C.ink },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, color: C.ink3, marginTop: 2 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  fill: { flex: 1 },
  shrink: { flexShrink: 1 },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, gap: 8, backgroundColor: C.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line,
  },
}));

export default Sheet;
