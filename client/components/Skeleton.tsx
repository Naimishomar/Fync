import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

const Skeleton = ({ width, height, borderRadius = 8, style, className }: SkeletonProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View 
      style={[{ 
        width: width as any, 
        height: height as any, 
        borderRadius, 
        overflow: 'hidden', 
        backgroundColor: '#333' 
      }, style]} 
      className={className}
    >
      <Animated.View style={{ flex: 1, opacity }}>
        <LinearGradient
          colors={['#333', '#444', '#333']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

export const ShortsSkeleton = () => {
    const { height, width } = Dimensions.get('window');
    return (
        <View style={{ height, width, backgroundColor: '#000', padding: 20, justifyContent: 'flex-end' }}>
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
    <View className="bg-zinc-900/50 p-5 rounded-3xl mb-4 border border-white/5">
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
        <View className="flex-row justify-between items-center border-t border-white/5 pt-4">
            <Skeleton width={60} height={10} />
            <View className="flex-row">
                <Skeleton width={30} height={15} style={{ marginRight: 15 }} />
                <Skeleton width={30} height={15} />
            </View>
        </View>
    </View>
);

export const ProfileSkeleton = () => (
    <View className="flex-1 bg-black">
        <View className="p-4 pt-12">
            <View className="flex-row items-center mb-8">
                <Skeleton width={40} height={40} borderRadius={20} />
                <View className="ml-4">
                    <Skeleton width={120} height={18} />
                    <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
                </View>
            </View>
            
            <View className="mx-4 bg-white/5 rounded-3xl p-5 border border-white/10 mb-10">
                <View className="flex-row items-center">
                    <Skeleton width={80} height={80} borderRadius={40} />
                    <View className="flex-1 ml-6 flex-row justify-between pr-4">
                        <View className="items-center"><Skeleton width={30} height={20} /><Skeleton width={40} height={10} style={{marginTop:4}}/></View>
                        <View className="items-center"><Skeleton width={30} height={20} /><Skeleton width={40} height={10} style={{marginTop:4}}/></View>
                        <View className="items-center"><Skeleton width={30} height={20} /><Skeleton width={40} height={10} style={{marginTop:4}}/></View>
                    </View>
                </View>
                <View className="flex-row gap-3 mt-8">
                    <Skeleton width="48%" height={45} borderRadius={12} />
                    <Skeleton width="48%" height={45} borderRadius={12} />
                </View>
            </View>

            <View className="flex-row border-b border-white/10 mx-4 mb-4 pb-4">
                <Skeleton width="30%" height={25} style={{ marginRight: '5%' }} />
                <Skeleton width="30%" height={25} style={{ marginRight: '5%' }} />
                <Skeleton width="30%" height={25} />
            </View>

            <View className="flex-row flex-wrap gap-2 px-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} width={(Dimensions.get('window').width / 3) - 13} height={120} style={{ marginBottom: 8 }} />
                ))}
            </View>
        </View>
    </View>
);

export const CommentSkeleton = () => (
    <View className="flex-row mb-4 px-4">
        <Skeleton width={35} height={35} borderRadius={17.5} />
        <View className="ml-3 flex-1">
            <View className="flex-row justify-between">
                <Skeleton width={80} height={12} />
                <Skeleton width={40} height={10} />
            </View>
            <Skeleton width="100%" height={15} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={10} style={{ marginTop: 8 }} />
        </View>
    </View>
);

export const ChatListSkeleton = () => (
    <View className="flex-row items-center p-4">
        <Skeleton width={60} height={60} borderRadius={30} />
        <View className="ml-4 flex-1">
            <View className="flex-row justify-between items-center mb-2">
                <Skeleton width={120} height={18} />
                <Skeleton width={40} height={10} />
            </View>
            <Skeleton width="80%" height={14} />
        </View>
    </View>
);

export const UserListSkeleton = () => (
    <View className="flex-row items-center p-4">
        <Skeleton width={50} height={50} borderRadius={25} />
        <View className="ml-4 flex-1">
            <Skeleton width={130} height={16} />
            <Skeleton width={90} height={10} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={80} height={35} borderRadius={10} />
    </View>
);

export default Skeleton;
