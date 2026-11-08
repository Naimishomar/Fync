import React, { useEffect } from 'react';
import { Image, Platform, RefreshControl, View, type RefreshControlProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { C } from '../../constants/colors';

const LOGO = require('../../assets/Fync.png');
const SIZE = 44;

/** The spinning Fync logo that drops in from the top while a list refreshes. */
function LogoSpinner({ refreshing, top }: { refreshing: boolean; top: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(-SIZE - 20);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      y.value = withSpring(top, { damping: 16, stiffness: 220 });
      if (!reduce) spin.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      y.value = withTiming(-SIZE - 20, { duration: 200 });
      cancelAnimation(spin);
      spin.value = 0;
    }
  }, [refreshing, reduce, top, y, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { rotate: `${spin.value}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden={!refreshing}
      accessibilityLabel={refreshing ? 'Refreshing' : undefined}
      style={[{
        position: 'absolute', top: 0, alignSelf: 'center',
        width: SIZE, height: SIZE, borderRadius: SIZE / 2,
        backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
      }, style]}
    >
      <Image source={LOGO} style={{ width: SIZE - 14, height: SIZE - 14, borderRadius: (SIZE - 14) / 2 }} />
    </Animated.View>
  );
}

/**
 * Drop-in for RefreshControl that shows a spinning Fync logo instead of the
 * platform spinner.
 *
 * Android: ScrollView clones the refreshControl element around the native
 * scroll view (passing `style` and the scroll view as `children`), so this
 * wraps the real RefreshControl in a View and lays the logo over it. The native
 * circle is pushed off screen with a negative progressViewOffset and made
 * transparent; the pull gesture itself stays native.
 *
 * iOS puts the RefreshControl *inside* the scroll view, where a wrapper View
 * would break it, so iOS keeps the native spinner, tinted brand.
 */
export default function FyncRefreshControl(props: RefreshControlProps & { children?: React.ReactNode; logoTop?: number }) {
  // A caller's progressViewOffset (spinner below a floating header) becomes the
  // logo's resting position.
  const { refreshing, style, children, progressViewOffset, logoTop = progressViewOffset ?? 16, ...rest } = props as any;

  if (Platform.OS !== 'android') {
    return <RefreshControl {...rest} style={style} refreshing={refreshing} progressViewOffset={progressViewOffset} tintColor={C.brand[500]}>{children}</RefreshControl>;
  }

  return (
    <View style={style}>
      <RefreshControl
        {...rest}
        refreshing={refreshing}
        style={{ flex: 1 }}
        colors={['transparent']}
        progressBackgroundColor="transparent"
        progressViewOffset={-1000}
      >
        {children}
      </RefreshControl>
      <LogoSpinner refreshing={!!refreshing} top={logoTop} />
    </View>
  );
}
