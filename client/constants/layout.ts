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
