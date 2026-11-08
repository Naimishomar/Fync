import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import Reanimated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../constants/colors';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  /** Paper-2 block for normal screens. Off: the night surface (Shorts). */
  lightMode?: boolean;
}

const SWEEP_MS = 1300;

/** Reduce-motion fallback: the old gentle opacity pulse. */
const Pulse = ({ style, className }: { style: StyleProp<ViewStyle>; className?: string }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    animation.start();
    // Without this every skeleton that ever mounted keeps looping on the
    // native side after the real content replaces it.
    return () => animation.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  return (
    <Animated.View style={[style, { opacity }]} className={className}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
  );
};

/** A soft block with a highlight sweeping across it. Give it the footprint of the real content. */
const Skeleton = ({ width, height, borderRadius = 8, style, className, lightMode = false }: SkeletonProps) => {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduce || !w) return;
    x.value = 0;
    x.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(x);
  }, [reduce, w, x]);

  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -w + x.value * 2 * w }] }));

  const block: StyleProp<ViewStyle> = [{
    width: width as any,
    height: height as any,
    borderRadius,
    backgroundColor: lightMode ? C.paper2 : C.night2,
    overflow: 'hidden',
  }, style];

  if (reduce) return <Pulse style={block} className={className} />;

  // Brighter sweep on light paper; a faint one on dark surfaces.
  const peak = lightMode && C.statusStyle === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.07)';
  return (
    <View
      style={block}
      className={className}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {w ? (
        <Reanimated.View style={[StyleSheet.absoluteFill, sweep]} pointerEvents="none">
          <LinearGradient
            colors={['rgba(255,255,255,0)', peak, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      ) : null}
    </View>
  );
};

export const ShortsSkeleton = () => {
    const { height, width } = Dimensions.get('window');
    return (
        <View style={{ height, width, backgroundColor: C.night, padding: 20, justifyContent: 'flex-end' }}>
            {/* Sidebar widgets */}
            <View className="absolute right-4 bottom-32 items-center">
                <Skeleton width={45} height={45} borderRadius={22.5} style={{ marginVertical: 8 }} />
                <Skeleton width={45} height={45} borderRadius={22.5} style={{ marginVertical: 8 }} />
                <Skeleton width={45} height={45} borderRadius={22.5} style={{ marginVertical: 8 }} />
                <Skeleton width={45} height={45} borderRadius={22.5} style={{ marginVertical: 8 }} />
            </View>

            {/* Bottom info */}
            <View className="mb-10 w-[80%]">
                <View className="flex-row items-center mb-4">
                    <Skeleton width={40} height={40} borderRadius={20} />
                    <View className="ml-3">
                        <Skeleton width={120} height={15} />
                        <Skeleton width={80} height={10} style={{ marginTop: 6 }} />
                    </View>
                </View>
                <Skeleton width="100%" height={20} />
                <Skeleton width="60%" height={15} style={{ marginTop: 8 }} />
            </View>
        </View>
    );
};

export const ConfessionSkeleton = () => (
    <View className="bg-card p-4 rounded-2xl mb-3 border border-line">
        <View className="flex-row items-center mb-4">
            <Skeleton width={40} height={40} borderRadius={20} />
            <View className="ml-3">
                <Skeleton width={100} height={15} />
                <Skeleton width={60} height={10} style={{ marginTop: 6 }} />
            </View>
        </View>
        <Skeleton width="100%" height={20} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={20} style={{ marginBottom: 8 }} />
        <Skeleton width="60%" height={20} style={{ marginBottom: 16 }} />
        <View className="flex-row justify-between items-center border-t border-line pt-4">
            <Skeleton width={60} height={10} />
            <View className="flex-row">
                <Skeleton width={30} height={15} style={{ marginRight: 15 }} />
                <Skeleton width={30} height={15} />
            </View>
        </View>
    </View>
);

export const ProfileSkeleton = () => (
    <View className="flex-1 bg-paper">
        <View className="absolute top-12 left-4 z-20">
            <Skeleton width={40} height={40} borderRadius={20} lightMode />
        </View>

        <Skeleton width="100%" height={256} borderRadius={0} lightMode />

        <View className="items-center pb-6 px-5 bg-paper rounded-t-3xl -mt-12">
            <View className="-mt-14 p-1.5 bg-card rounded-full">
                <View className="rounded-full overflow-hidden border-4 border-card">
                    <Skeleton width={110} height={110} borderRadius={55} lightMode />
                </View>
            </View>

            <Skeleton width={180} height={24} style={{ marginTop: 16 }} lightMode />
            <Skeleton width={100} height={14} style={{ marginTop: 8 }} lightMode />
            <Skeleton width="80%" height={14} style={{ marginTop: 16 }} lightMode />
            <Skeleton width="60%" height={14} style={{ marginTop: 8 }} lightMode />

            <View className="flex-row items-center mt-4 px-4 py-2 bg-paper-2 rounded-full gap-2">
                <Skeleton width={60} height={14} lightMode />
            </View>

            <View className="flex-row w-full bg-card rounded-2xl mt-6 p-4 border border-line">
                <View className="flex-1 items-center">
                    <Skeleton width={30} height={24} lightMode />
                    <Skeleton width={50} height={10} style={{ marginTop: 6 }} lightMode />
                </View>
                <View className="flex-1 items-center">
                    <Skeleton width={30} height={24} lightMode />
                    <Skeleton width={50} height={10} style={{ marginTop: 6 }} lightMode />
                </View>
                <View className="flex-1 items-center">
                    <Skeleton width={30} height={24} lightMode />
                    <Skeleton width={50} height={10} style={{ marginTop: 6 }} lightMode />
                </View>
            </View>

            <View className="flex-row gap-3 mt-6 w-full">
                <Skeleton width="48%" height={48} borderRadius={24} lightMode />
                <Skeleton width="48%" height={48} borderRadius={24} lightMode />
            </View>
        </View>

        <View className="flex-row border-b border-line bg-paper pt-2 pb-4">
            <View className="flex-1 items-center"><Skeleton width={30} height={30} borderRadius={15} lightMode /></View>
            <View className="flex-1 items-center"><Skeleton width={30} height={30} borderRadius={15} lightMode /></View>
            <View className="flex-1 items-center"><Skeleton width={30} height={30} borderRadius={15} lightMode /></View>
        </View>

        <View className="flex-row flex-wrap gap-1 px-1 bg-paper-2">
            {/* px-1 (8) + two gap-1 (8): (W/3 - 3) x3 overflowed the row and wrapped to two columns. */}
            {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} width={(Dimensions.get('window').width - 16) / 3} height={(Dimensions.get('window').width - 16) / 3} style={{ marginBottom: 2 }} lightMode />
            ))}
        </View>
    </View>
);

export const CommentSkeleton = () => (
    <View className="flex-row mb-4 px-4">
        <Skeleton width={35} height={35} borderRadius={17.5} lightMode />
        <View className="ml-3 flex-1">
            <View className="flex-row justify-between">
                <Skeleton width={80} height={12} lightMode />
                <Skeleton width={40} height={10} lightMode />
            </View>
            <Skeleton width="100%" height={15} style={{ marginTop: 8 }} lightMode />
            <Skeleton width="40%" height={10} style={{ marginTop: 8 }} lightMode />
        </View>
    </View>
);

export const ChatListSkeleton = () => (
    <View className="flex-row items-center">
        <Skeleton width={38} height={38} borderRadius={19} lightMode />
        <View className="ml-4 flex-1">
            <View className="flex-row justify-between items-center mb-2">
                <Skeleton width={120} height={18} lightMode />
                <Skeleton width={40} height={10} lightMode />
            </View>
            <Skeleton width="80%" height={14} lightMode />
        </View>
    </View>
);

export const ChatSkeleton = ({ isMe }: { isMe?: boolean }) => (
    <View className={`w-full ${isMe ? "items-end" : "items-start"} mb-4`}>
        <View className={`flex-row items-end ${isMe ? "flex-row-reverse" : "flex-row"} max-w-[85%]`}>
            <View className={`${isMe ? "ml-3" : "mr-3"}`}>
                <Skeleton width={36} height={36} borderRadius={18} lightMode />
            </View>
            <View className={`${isMe ? "items-end" : "items-start"} flex-1`}>
                <View 
                    style={{
                        borderTopLeftRadius: isMe ? 16 : 6,
                        borderBottomLeftRadius: isMe ? 16 : 6,
                        borderTopRightRadius: isMe ? 6 : 16,
                        borderBottomRightRadius: isMe ? 6 : 16,
                    }}
                    className={`p-4 w-[200px] border border-line ${isMe ? "bg-paper-2" : "bg-card"}`}
                >
                    <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} lightMode />
                    <Skeleton width="70%" height={12} lightMode />
                </View>
                <View className={`mt-1.5 ${isMe ? "items-end" : "items-start"}`}>
                    <Skeleton width={40} height={8} lightMode />
                </View>
            </View>
        </View>
    </View>
);

export const UserListSkeleton = () => (
    <View className="flex-row items-center p-4">
        <Skeleton width={50} height={50} borderRadius={25} lightMode />
        <View className="ml-4 flex-1">
            <Skeleton width={130} height={16} lightMode />
            <Skeleton width={90} height={10} style={{ marginTop: 6 }} lightMode />
        </View>
        <Skeleton width={80} height={36} borderRadius={18} lightMode />
    </View>
);

export const PostSkeleton = () => {
    const { width } = Dimensions.get('window');
    return (
        <View className="bg-card border-b border-line py-4 px-3 mb-2">
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                    <Skeleton width={28} height={28} borderRadius={14} lightMode />
                    <View className="ml-2 flex-row items-center">
                        <Skeleton width={100} height={14} lightMode />
                        <Skeleton width={30} height={14} style={{ marginLeft: 8 }} lightMode />
                    </View>
                </View>
                <Skeleton width={20} height={20} borderRadius={10} lightMode />
            </View>
            <View className="mb-3 px-1">
                <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} lightMode />
                <Skeleton width="60%" height={14} lightMode />
            </View>
            {/* Full-bleed square, the same footprint as PostItem's media, so the feed doesn't jump when posts land. */}
            <Skeleton width={width} height={width} borderRadius={0} style={{ marginHorizontal: -12, marginBottom: 16 }} lightMode />
            <View className="flex-row items-center gap-2">
                <Skeleton width={70} height={32} borderRadius={16} lightMode />
                <Skeleton width={60} height={32} borderRadius={16} lightMode />
                <Skeleton width={60} height={32} borderRadius={16} lightMode />
            </View>
        </View>
    );
};

export const TeammateSkeleton = () => (
    <View className="bg-card rounded-2xl p-4 mb-3 border border-line mx-5">
        <View className="flex-row items-center mb-5">
            <View className="p-1 rounded-full border border-line bg-card">
                <Skeleton width={64} height={64} borderRadius={32} lightMode />
            </View>
            <View className="ml-4 flex-1">
                <Skeleton width={120} height={18} style={{ marginBottom: 4 }} lightMode />
                <Skeleton width={80} height={10} style={{ marginBottom: 6 }} lightMode />
                <Skeleton width={90} height={14} borderRadius={12} lightMode />
            </View>
            <View className="flex-row gap-2">
                <Skeleton width={36} height={36} borderRadius={18} lightMode />
                <Skeleton width={36} height={36} borderRadius={18} lightMode />
            </View>
        </View>
        <View className="flex-row flex-wrap gap-2 mb-5">
            {[1, 2, 3].map(i => <Skeleton key={i} width={60} height={24} borderRadius={12} lightMode />)}
        </View>
        <View className="bg-paper-2 p-4 rounded-2xl mb-4">
            <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} lightMode />
            <Skeleton width="80%" height={12} lightMode />
        </View>
        <View className="flex-row justify-between items-center p-2 rounded-card">
            <View className="flex-row items-center flex-1 ml-1 mr-4">
                <Skeleton width={100} height={12} lightMode />
            </View>
            <Skeleton width={100} height={44} borderRadius={22} lightMode />
        </View>
    </View>
);

export const NotificationSkeleton = () => (
    <View className="flex-row items-center p-3 mb-2 rounded-2xl bg-card border border-line">
        <Skeleton width={40} height={40} borderRadius={20} lightMode />
        <View className="flex-1 ml-3">
            <Skeleton width="80%" height={12} style={{ marginBottom: 6 }} lightMode />
            <Skeleton width={60} height={10} lightMode />
        </View>
        <Skeleton width={48} height={48} borderRadius={12} style={{ marginLeft: 8 }} lightMode />
    </View>
);

export const ProjectSkeleton = () => (
    <View className="mx-gutter mb-3 rounded-2xl bg-card border border-line p-4">
        <View className="flex-row items-center mb-6">
            <Skeleton width={48} height={48} borderRadius={24} lightMode />
            <View className="ml-3">
                <Skeleton width={120} height={14} style={{ marginBottom: 6 }} lightMode />
                <Skeleton width={80} height={10} lightMode />
            </View>
        </View>
        <Skeleton width="100%" height={240} borderRadius={16} style={{ marginBottom: 16 }} lightMode />
        <Skeleton width="80%" height={24} style={{ marginBottom: 12 }} lightMode />
        <Skeleton width="100%" height={12} style={{ marginBottom: 6 }} lightMode />
        <Skeleton width="90%" height={12} style={{ marginBottom: 20 }} lightMode />
        <View className="flex-row justify-between items-center">
            <View className="flex-row gap-4">
                <Skeleton width={32} height={32} borderRadius={16} lightMode />
                <Skeleton width={32} height={32} borderRadius={16} lightMode />
            </View>
            <View className="flex-row gap-2">
                <Skeleton width={40} height={40} borderRadius={20} lightMode />
                <Skeleton width={40} height={40} borderRadius={20} lightMode />
            </View>
        </View>
    </View>
);

export default Skeleton;
