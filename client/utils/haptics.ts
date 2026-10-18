import * as Haptics from 'expo-haptics';

/** Light tick for likes, follows, sends. Never throws (no motor, web, etc.). */
export const tapHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Softer selection tick for toggles. */
export const selectHaptic = () => {
  Haptics.selectionAsync().catch(() => {});
};
