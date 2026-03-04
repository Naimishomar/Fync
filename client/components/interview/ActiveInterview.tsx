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
  
  // REFS
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isProcessingRef = useRef(false); // Mutex lock to prevent race conditions
  const isEnded = useRef(false);

  // PARAMS
  const { sessionId, firstQuestion = "Tell me about yourself.", duration = 5 } = route.params || {};

  // STATE
  const [aiState, setAiState] = useState<'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING'>('SPEAKING');
  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion);
  const [timeLeft, setTimeLeft] = useState(duration * 60);

  // 1. INTERCEPT BACK BUTTON
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (isEnded.current) return;
      e.preventDefault();

      Alert.alert(
        "End Interview?",
        "Leaving now will end the session and delete your progress.",
        [
          { text: "Stay", style: "cancel" },
          { 
            text: "End Session", 
            style: 'destructive', 
            onPress: async () => {
              await cleanupAndExit();
              navigation.dispatch(e.data.action);
            } 
          }
        ]
      );
    });
    return unsubscribe;
  }, [navigation, sessionId]);

  // 2. TIMER & INITIAL SPEECH
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
          cleanupAndExit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      Speech.stop(); 
      // Force cleanup of recorder hardware on unmount
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const cleanupAndExit = async () => {
    if (isEnded.current) return;
    isEnded.current = true;

    Speech.stop();
    setAiState('PROCESSING');

    try {
      if (sessionId) {
        await axios.post('/interview/end', { sessionId });
        if (navigation.isFocused()) {
          navigation.goBack();
        }
      }
    } catch (error) {
      if (navigation.isFocused()) navigation.goBack();
    }
  };

  const speak = (text: string) => {
    setAiState('SPEAKING');
    Speech.speak(text, {
      language: 'en-US',
      onDone: () => setAiState('IDLE'),
      onError: () => setAiState('IDLE')
    });
  };

  // 3. START RECORDING (With Mutex Lock)
  const startRecording = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // Force cleanup existing objects
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {}
        recordingRef.current = null;
      }

      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert("Permission Denied", "Microphone access is required.");
        isProcessingRef.current = false;
        return;
      }

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: true, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      setAiState('LISTENING');

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = newRecording;
    } catch (err) {
      console.error('Failed to start recording', err);
      setAiState('IDLE');
    } finally {
      isProcessingRef.current = false;
    }
  };

  // 4. STOP RECORDING (Safety Checks)
  const stopRecordingAndSend = async () => {
    // If startRecording is still running, we wait
    if (isProcessingRef.current) return;

    const currentRecording = recordingRef.current;
    if (!currentRecording) {
      setAiState('IDLE');
      return;
    }

    isProcessingRef.current = true;
    setAiState('PROCESSING');
    
    try {
      const status = await currentRecording.getStatusAsync();
      if (status.canRecord) {
        await currentRecording.stopAndUnloadAsync();
      }

      const uri = currentRecording.getURI();
      recordingRef.current = null; // Clear ref immediately

      if (!uri) {
        setAiState('IDLE');
        return;
      }

      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a', 
        name: 'answer.m4a'
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
      setAiState('IDLE');
    } finally {
      isProcessingRef.current = false;
      recordingRef.current = null;
    }
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="gray" />
        </TouchableOpacity>

        <View className="bg-gray-900 px-4 py-2 rounded-full border border-gray-800 flex-row items-center gap-2">
            <Ionicons name="time-outline" size={20} color={timeLeft < 60 ? "#ef4444" : "#4ade80"} />
            <Text className={`font-mono text-xl font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-green-400'}`}>
                {formatTime(timeLeft)}
            </Text>
        </View>
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
                onPress={() => Alert.alert("End Interview", "Finish early?", [{text: "Cancel"}, {text: "End", onPress: cleanupAndExit}])}
                className="w-16 h-16 rounded-full bg-red-900/50 items-center justify-center border border-red-500"
            >
                <MaterialIcons name="call-end" size={28} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
                disabled={aiState === 'SPEAKING' || aiState === 'PROCESSING'}
                onPressIn={startRecording}
                onPressOut={stopRecordingAndSend}
                className={`w-24 h-24 rounded-full items-center justify-center shadow-lg
                    ${aiState === 'LISTENING' ? 'bg-red-500 scale-110' : 
                      aiState === 'SPEAKING' || aiState === 'PROCESSING' ? 'bg-gray-700 opacity-50' : 'bg-blue-600'}`}
            >
                <Ionicons name={aiState === 'LISTENING' ? "mic" : "mic-outline"} size={40} color="white" />
            </TouchableOpacity>
            <View className="w-16 h-16" /> 
        </View>
      </View>
    </View>
  );
}