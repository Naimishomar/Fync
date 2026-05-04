import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

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

      // Auto close after 2 seconds
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
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container, 
            { 
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim
            }
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.blur}>
            <LinearGradient
              colors={['rgba(255, 140, 0, 0.2)', 'rgba(0, 0, 0, 0.8)']}
              style={styles.gradient}
            >
              <View style={styles.iconContainer}>
                <View style={styles.fireOuter}>
                  <LinearGradient
                    colors={['#FFD700', '#FF8C00', '#FF4500']}
                    style={styles.fireGradient}
                  >
                    <Ionicons name="flame" size={60} color="white" />
                  </LinearGradient>
                </View>
              </View>

              <Text style={styles.streakNumber}>{streakCount}</Text>
              <Text style={styles.streakText}>Day Streak!</Text>
              
              <View style={styles.messageContainer}>
                <Text style={styles.message}>Daily Goal Achieved</Text>
                <View style={styles.line} />
                <Text style={styles.subMessage}>See you tomorrow!</Text>
              </View>
            </LinearGradient>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: width * 0.8,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)',
  },
  blur: {
    flex: 1,
  },
  gradient: {
    padding: 30,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  fireOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    padding: 5,
    backgroundColor: 'rgba(255, 140, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fireGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  streakText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: -5,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  messageContainer: {
    marginTop: 25,
    alignItems: 'center',
  },
  message: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  line: {
    height: 1,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 8,
  },
  subMessage: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default StreakModal;
