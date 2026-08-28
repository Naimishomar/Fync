import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { BottomTabBar, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { TAB_BAR_HEIGHT, useTabBarOffset, tabBarHidden } from '../../constants/layout';

/**
 * The floating tab bar, wrapped so it can slide away while a list scrolls down.
 *
 * The wrapper fills the screen rather than hugging the bar: the bar is
 * absolutely positioned, so it needs a full-size positioned ancestor or its
 * `bottom` offset would resolve against a zero-height box at the top of the
 * screen. `box-none` keeps that full-screen wrapper from eating touches meant
 * for the content underneath.
 *
 * Driven by the shared `tabBarHidden` value, so `useTabBarAutoHide` on any
 * screen moves whichever bar is on screen — student or recruiter.
 */
export default function SlidingTabBar(props: BottomTabBarProps) {
  const bottomOffset = useTabBarOffset();

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{
            translateY: tabBarHidden.interpolate({
              inputRange: [0, 1],
              // Generous: the recruiter bar sits 40px up rather than on the
              // safe-area inset, and the rim highlight has to clear the edge too.
              outputRange: [0, TAB_BAR_HEIGHT + bottomOffset + 80],
            }),
          }],
        },
      ]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}
