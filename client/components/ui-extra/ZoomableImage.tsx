import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const SPRING = { damping: 20, stiffness: 220 };

/**
 * Instagram-style pinch: two fingers scale the photo around the pinch point
 * and drag it; letting go springs it back. Only two-pointer gestures are
 * claimed, so one-finger taps, feed scroll and carousel swipes pass through.
 *
 * Lifts itself with zIndex while zoomed. That only beats its siblings: the
 * parent media box should carry a zIndex too to draw over caption/actions.
 * ponytail: no portal, so a horizontal ScrollView parent clips the zoom and
 * the next feed cell can draw over it; add a root overlay host if that matters.
 */
export default function ZoomableImage({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const fx = useSharedValue(0); // pinch focal offset from the view centre
  const fy = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withSpring(1, SPRING);
    tx.value = withSpring(0, SPRING);
    ty.value = withSpring(0, SPRING);
  };

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      fx.value = e.focalX - w.value / 2;
      fy.value = e.focalY - h.value / 2;
    })
    .onUpdate((e) => { scale.value = Math.min(Math.max(e.scale, 1), 4); })
    .onFinalize(reset);

  const pan = Gesture.Pan()
    .minPointers(2)
    .averageTouches(true)
    .onUpdate((e) => { tx.value = e.translationX; ty.value = e.translationY; })
    .onFinalize(reset);

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animStyle = useAnimatedStyle(() => ({
    zIndex: scale.value > 1.01 ? 50 : 0,
    transform: [
      // Keep the pinch point under the fingers while scaling about the centre.
      { translateX: tx.value + fx.value * (1 - scale.value) },
      { translateY: ty.value + fy.value * (1 - scale.value) },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[style, animStyle]}
        onLayout={(e) => { w.value = e.nativeEvent.layout.width; h.value = e.nativeEvent.layout.height; }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
