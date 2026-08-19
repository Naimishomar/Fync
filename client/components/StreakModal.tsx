import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface StreakModalProps {
  visible: boolean;
  streakCount: number;
  onClose: () => void;
}

const StreakModal: React.FC<StreakModalProps> = ({ visible, streakCount, onClose }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto close after 2.5 seconds
      const timer = setTimeout(() => {
        // Exit animation
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onClose());
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      // Reset animations when not visible
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 justify-center items-center">
        <Animated.View 
          className="w-[80%] rounded-4xl overflow-hidden border border-orange-500/30"
          style={{ 
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim
          }}
        >
          <BlurView intensity={80} tint="dark" className="flex-1">
            <LinearGradient
              colors={['rgba(255, 140, 0, 0.2)', 'rgba(0, 0, 0, 0.8)']}
              className="p-8 items-center"
            >
              <View className="mb-5">
                <View className="w-[110px] h-[110px] rounded-full bg-orange-500/20 justify-center items-center p-[5px]">
                  <LinearGradient
                    colors={['#FFD700', '#FF8C00', '#f97316']}
                    className="w-[100px] h-[100px] rounded-full justify-center items-center shadow-lg shadow-orange-500 elevation-10"
                  >
                    <Ionicons name="flame" size={60} color="white" />
                  </LinearGradient>
                </View>
              </View>

              <Text 
                className="text-6xl font-black text-yellow-400"
                style={{
                  textShadowColor: 'rgba(0, 0, 0, 0.5)',
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 10,
                }}
              >
                {streakCount}
              </Text>
              <Text className="text-2xl font-bold text-white -mt-1 uppercase tracking-[2px]">
                Day Streak!
              </Text>
              
              <View className="mt-6 items-center">
                <Text className="text-yellow-400 text-base font-bold tracking-[1px]">
                  Daily Goal Achieved
                </Text>
                <View className="h-[1px] w-10 bg-white/20 my-2" />
                <Text className="text-white/60 text-xs font-medium">
                  See you tomorrow!
                </Text>
              </View>
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default StreakModal;
