import { useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The tab bar floats above the content rather than reserving space in the layout,
// so anything scrollable underneath has to leave room for it by hand. Every screen
// used to guess that number independently — 150 here, 100 there, 40 and 20 on two
// screens where content simply disappeared under the bar. These are the single
// source of truth: the bar itself is built from them, and screens ask for the
// clearance instead of inventing one.

/** Visual height of the floating pill. */
export const TAB_BAR_HEIGHT = 64;

/** Gap between the bottom of the pill and the top of the device's safe area. */
export const TAB_BAR_GAP = 12;

/** Breathing room between the last item of a list and the pill. */
const CONTENT_BREATHING_ROOM = 16;

/**
 * Distance from the bottom of the screen to the bottom of the tab bar, including
 * the home indicator / gesture bar. Use for the bar's own `bottom` offset.
 */
export const useTabBarOffset = () => {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_GAP;
};

/**
 * What a scrollable screen inside the tab navigator should use as its
 * `contentContainerStyle.paddingBottom` so its last row clears the floating bar
 * on every device.
 */
export const useTabBarClearance = () => {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + CONTENT_BREATHING_ROOM;
};

/**
 * For content pinned to the bottom of a screen that has NO tab bar (chat inputs,
 * modal action bars). Keeps a minimum so devices reporting a zero inset still get
 * a comfortable margin instead of sitting flush against the edge.
 */
export const useBottomInset = (minimum = 16) => {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, minimum);
};

// ── Auto-hiding tab bar ─────────────────────────────────────────────────────
//
// One shared value, because there is one tab bar. A context would only pass
// this same object down a tree that never has two of them.

/** 0 = the pill is in place, 1 = it has slid off the bottom edge. */
export const tabBarHidden = new Animated.Value(0);

let hiddenNow = false;

const slide = (to: 0 | 1) => {
  // Transform only, so this runs on the native thread and keeps up with a
  // fling. Duration is short enough that the bar is back before a thumb that
  // reversed direction has finished the gesture.
  Animated.timing(tabBarHidden, {
    toValue: to,
    duration: to ? 180 : 140,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  }).start();
};

export const showTabBar = () => {
  if (!hiddenNow) return;
  hiddenNow = false;
  slide(0);
};

export const hideTabBar = () => {
  if (hiddenNow) return;
  hiddenNow = true;
  slide(1);
};

/** Ignore the jitter of a finger resting on the screen. */
const SCROLL_NOISE = 6;

/**
 * How far you have to keep scrolling down before the bar gives up its place.
 *
 * Asymmetric on purpose: hiding is a deliberate "I am reading, get out of the
 * way", so it takes a real swipe rather than the first few pixels. Showing
 * stays instant — reaching for the tabs should never need a measured gesture.
 */
const HIDE_AFTER = 120;

/**
 * Spread onto any scrollable inside the tab navigator:
 *
 *   <FlashList {...useTabBarAutoHide()} ... />
 *
 * Scrolling down hides the bar, scrolling up brings it straight back, and it
 * is always visible at the top of the list. Leaving the screen restores it, so
 * a screen can never hand the bar off hidden.
 */
export const useTabBarAutoHide = () => {
  const lastY = useRef(0);
  /** Downward pixels since the last time the bar was shown. */
  const downSince = useRef(0);

  useEffect(() => () => showTabBar(), []);

  // Tab screens stay mounted when you switch away from them, so unmount alone
  // would let a screen left mid-scroll hand the next tab a hidden bar.
  useFocusEffect(
    useCallback(() => {
      lastY.current = 0;
      downSince.current = 0;
      showTabBar();
    }, []),
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const delta = y - lastY.current;

    if (y <= 0) {
      downSince.current = 0;
      showTabBar();
    } else if (delta > SCROLL_NOISE && y > TAB_BAR_HEIGHT) {
      downSince.current += delta;
      if (downSince.current >= HIDE_AFTER) hideTabBar();
    } else if (delta < -SCROLL_NOISE) {
      downSince.current = 0;
      showTabBar();
    }

    if (Math.abs(delta) > SCROLL_NOISE) lastY.current = y;
  }, []);

  return { onScroll, scrollEventThrottle: 16 };
};
