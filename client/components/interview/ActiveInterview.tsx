import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function ActiveInterview() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  // Safe destructuring
  const { sessionId, firstQuestion = "Tell me about yourself.", duration = 5 } = route.params || {};

  const [aiState, setAiState] = useState<'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING'>('SPEAKING');
  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  
  // Track if we have already cleaned up to prevent loops
  const isEnded = useRef(false);

  // 1. INTERCEPT BACK BUTTON / GESTURES
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
        // If normally ending (timer 0 or manual end confirmed), let it pass
        if (isEnded.current) {
            return;
        }

        // Prevent default behavior of leaving the screen
        e.preventDefault();

        // Prompt the user
        Alert.alert(
            "End Interview?",
            "Leaving now will end the session and delete your progress.",
            [
                { text: "Stay", style: "cancel", onPress: () => {} },
                { 
                    text: "End Session", 
                    style: 'destructive', 
                    onPress: async () => {
                        // User confirmed exit
                        await cleanupAndExit();
                        // Retry the navigation action
                        navigation.dispatch(e.data.action);
                    } 
                }
            ]
        );
    });

    return unsubscribe;
  }, [navigation, sessionId]);

  // 2. TIMER LOGIC
  useEffect(() => {
    if (!sessionId) {
        Alert.alert("Error", "Session ID missing.");
        navigation.goBack();
        return;
    }

    speak(currentQuestion);
    
    const timer = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                clearInterval(timer);
                cleanupAndExit(); // Auto-end when time is up
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => {
        clearInterval(timer);
        Speech.stop(); 
    };
  }, []);

  // --- CLEANUP FUNCTION (Calls Backend to Delete Files) ---
  const cleanupAndExit = async () => {
      if (isEnded.current) return;
      isEnded.current = true; // Mark as done

      Speech.stop();
      setAiState('PROCESSING');

      try {
          if (sessionId) {
              console.log("Ending session and cleaning up Cloudinary files...");
              const res = await axios.post('/interview/end', { sessionId });
              
              if (res.data.success) {
                  Alert.alert("Interview Completed", "Your files have been cleaned up and report generated.");
                  // Note: Navigation back happens automatically if triggered by 'beforeRemove'
                  // If triggered by Timer or Button, we navigate manually:
                  if (navigation.isFocused()) {
                      navigation.goBack();
                  }
              }
          }
      } catch (error) {
          console.log("Error ending session", error);
          // Force exit even if backend fails
          if (navigation.isFocused()) navigation.goBack();
      }
  };

  const speak = (text: string) => {
    setAiState('SPEAKING');
    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0, 
      onDone: () => setAiState('IDLE'),
      onError: () => setAiState('IDLE')
    });
  };

const startRecording = async () => {
    try {
      // 1. SAFETY CHECK: Unload any stuck recording before starting new one
      if (recording) {
          try {
              await recording.stopAndUnloadAsync();
          } catch (cleanupErr) {
              // Ignore errors during cleanup, just proceed
              console.log("Cleanup warning:", cleanupErr);
          }
          setRecording(null);
      }

      // 2. Request Permissions
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
          Alert.alert("Permission Denied", "Microphone access is required.");
          return;
      }

      // 3. Set Mode
      await Audio.setAudioModeAsync({ 
          allowsRecordingIOS: true, 
          playsInSilentModeIOS: true 
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
         Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setAiState('LISTENING');

    } catch (err) {
      console.error('Failed to start recording', err);
      setAiState('IDLE');
      setRecording(null);
    }
  };

  const stopRecordingAndSend = async () => {
    if (!recording) return;
    setAiState('PROCESSING');
    
    try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        if (!uri) return;

        const formData = new FormData();
        formData.append('audio', {
            uri,
            type: 'audio/mp3', 
            name: 'answer.mp3'
        } as any);
        formData.append('sessionId', sessionId);

        const res = await axios.post('/interview/answer', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success) {
            setCurrentQuestion(res.data.text);
            speak(res.data.text);
        }
    } catch (err) {
        console.log("Error sending answer", err);
        setAiState('IDLE');
        Alert.alert("Error", "Could not send answer.");
    }
  };

  // Manual Button Press
  const handleEndPress = () => {
      // We manually trigger the alert, calling cleanupAndExit on confirm
      Alert.alert(
          "End Interview",
          "Are you sure you want to finish early? All files will be deleted.",
          [
              { text: "Cancel", style: "cancel" },
              { text: "End Interview", style: 'destructive', onPress: cleanupAndExit }
          ]
      );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View className="flex-1 bg-black justify-between items-center p-6 py-12">
      
      {/* Top Bar */}
      <View className="w-full flex-row justify-between items-center mt-4">
        {/* Back Button (Trigger interception) */}
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="gray" />
        </TouchableOpacity>

        <View className="bg-gray-900 px-4 py-2 rounded-full border border-gray-800 flex-row items-center gap-2">
            <Ionicons name="time-outline" size={20} color={timeLeft < 60 ? "#ef4444" : "#4ade80"} />
            <Text className={`font-mono text-xl font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-green-400'}`}>
                {formatTime(timeLeft)}
            </Text>
        </View>
        
        {/* Spacer for centering */}
        <View className="w-7" />
      </View>

      {/* AI Visualizer */}
      <View className="items-center w-full flex-1 justify-center">
        <View className={`w-48 h-48 rounded-full border-4 items-center justify-center mb-8 
            ${aiState === 'SPEAKING' ? 'border-blue-500 bg-blue-900/20' : 
              aiState === 'PROCESSING' ? 'border-purple-500 bg-purple-900/20' : 
              aiState === 'LISTENING' ? 'border-red-500 bg-red-900/20' : 'border-gray-800 bg-gray-900'}`}
        >
             {aiState === 'PROCESSING' ? (
                 <ActivityIndicator size="large" color="#a855f7" />
             ) : (
                 <Image 
                    source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4712/4712109.png' }} 
                    className="w-24 h-24 opacity-80"
                    resizeMode="contain"
                 />
             )}
        </View>
        
        <View className="bg-gray-900 px-6 py-5 rounded-3xl w-full min-h-[120px] justify-center border border-gray-800">
            <Text className="text-white text-center text-lg leading-7 font-medium">
                {currentQuestion}
            </Text>
        </View>
      </View>

      {/* Controls */}
      <View className="items-center w-full gap-8 mb-4">
        <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest">
            {aiState === 'SPEAKING' ? "AI IS SPEAKING..." : 
             aiState === 'LISTENING' ? "RELEASE TO SEND" : 
             aiState === 'PROCESSING' ? "ANALYZING ANSWER..." : "HOLD TO SPEAK"}
        </Text>

        <View className="flex-row items-center justify-center gap-10 w-full">
            <TouchableOpacity 
                onPress={handleEndPress}
                className="w-16 h-16 rounded-full bg-red-900/50 items-center justify-center border border-red-500"
            >
                <MaterialIcons name="call-end" size={28} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
                disabled={aiState === 'SPEAKING' || aiState === 'PROCESSING'}
                onPressIn={startRecording}
                onPressOut={stopRecordingAndSend}
                className={`w-24 h-24 rounded-full items-center justify-center shadow-lg
                    ${aiState === 'LISTENING' ? 'bg-red-500 scale-110 shadow-red-500/50' : 
                      aiState === 'SPEAKING' || aiState === 'PROCESSING' ? 'bg-gray-700 opacity-50' : 'bg-blue-600 shadow-blue-500/50'}`}
            >
                <Ionicons name={aiState === 'LISTENING' ? "mic" : "mic-outline"} size={40} color="white" />
            </TouchableOpacity>

            <View className="w-16 h-16" /> 
        </View>
      </View>

    </View>
  );
}