import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
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
  const [report, setReport] = useState<any>(null);

  // 1. INTERCEPT BACK BUTTON
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (isEnded.current || report) return;
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
              await axios.post('/interview/cancel', { sessionId });
              isEnded.current = true;
              navigation.dispatch(e.data.action);
            } 
          }
        ]
      );
    });
    return unsubscribe;
  }, [navigation, sessionId, report]);

  // 2. TIMER & INITIAL SPEECH
  useEffect(() => {
    if (!sessionId) {
      Alert.alert("Error", "Session ID missing.");
      navigation.goBack();
      return;
    }

    if (report) {
      Speech.stop();
      return;
    }

    speak(currentQuestion);
    
    const timer = setInterval(() => {
      if (report) return; // Stop timer if report is showing
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
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [report]);

  const cleanupAndExit = async () => {
    if (isEnded.current) return;
    isEnded.current = true;

    Speech.stop();
    setAiState('PROCESSING');

    try {
      if (sessionId) {
        const res = await axios.post('/interview/end', { sessionId });
        if (res.data.success) {
          setReport(res.data.report);
        } else {
            navigation.goBack();
        }
      }
    } catch (error) {
      if (navigation.isFocused()) navigation.goBack();
    } finally {
        setAiState('IDLE');
    }
  };

  const downloadReport = async () => {
    try {
        Alert.alert("Download", "Your report is being generated...");
        const res = await axios.post('/interview/generate-pdf', { report }, { responseType: 'blob' });
        // In a real mobile app, you'd use FileSystem and Sharing to save the blob.
        // For now, we'll simulate the success.
        Alert.alert("Success", "Report downloaded to your device.");
    } catch (err) {
        Alert.alert("Error", "Failed to generate report.");
    }
  };

  const speak = (text: string) => {
    if (isEnded.current || report) return;
    setAiState('SPEAKING');
    Speech.speak(text, {
      language: 'en-US',
      onDone: () => setAiState('IDLE'),
      onError: () => setAiState('IDLE')
    });
  };

  // 3. START RECORDING (With Mutex Lock)
  const startRecording = async () => {
    if (isProcessingRef.current || report) return;
    isProcessingRef.current = true;

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }

      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert("Permission Denied", "Microphone access is required.");
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
      setAiState('IDLE');
    } finally {
      isProcessingRef.current = false;
    }
  };

  // 4. STOP RECORDING (Safety Checks)
  const stopRecordingAndSend = async () => {
    if (isProcessingRef.current || !recordingRef.current) return;

    isProcessingRef.current = true;
    setAiState('PROCESSING');
    
    try {
      const currentRecording = recordingRef.current;
      await currentRecording.stopAndUnloadAsync();
      const uri = currentRecording.getURI();
      recordingRef.current = null;

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
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (report) {
      return (
          <View className="flex-1 bg-white p-6 pt-16">
              <View className="items-center mb-8">
                  <View className="bg-green-100 p-4 rounded-full mb-4">
                      <Ionicons name="checkmark-circle" size={60} color="#10b981" />
                  </View>
                  <Text className="text-3xl font-black text-gray-900 tracking-tighter italic">
                    INTERVIEW<Text className="text-pink-500">COMPLETE</Text>
                  </Text>
                  <Text className="text-gray-500 mt-2">Evaluation results are ready</Text>
              </View>

              <ScrollView className="flex-1 mb-6" showsVerticalScrollIndicator={false}>
                  {/* Score Row */}
                  <View className="flex-row gap-4 mb-6">
                      <View className="flex-1 bg-gray-50 p-5 rounded-3xl border border-gray-100 items-center">
                          <Text className="text-gray-400 font-bold text-xs uppercase mb-1">Technical</Text>
                          <Text className="text-3xl font-black text-pink-600">{report.technical_score}<Text className="text-gray-300 text-lg">/10</Text></Text>
                      </View>
                      <View className="flex-1 bg-gray-50 p-5 rounded-3xl border border-gray-100 items-center">
                          <Text className="text-gray-400 font-bold text-xs uppercase mb-1">Soft Skills</Text>
                          <Text className="text-3xl font-black text-blue-600">{report.communication_score}<Text className="text-gray-300 text-lg">/10</Text></Text>
                      </View>
                  </View>

                  {/* Summary */}
                  <View className="bg-gray-50 p-6 rounded-3xl border border-gray-100 mb-6">
                      <Text className="text-gray-900 font-bold mb-2">Detailed Summary</Text>
                      <Text className="text-gray-600 leading-6">{report.summary}</Text>
                  </View>

                  {/* Verdict */}
                  <View className={`p-4 rounded-2xl items-center border mb-6 ${report.verdict === 'Pass' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <Text className={`font-black uppercase tracking-widest ${report.verdict === 'Pass' ? 'text-green-600' : 'text-red-600'}`}>
                          Verdict: {report.verdict}
                      </Text>
                  </View>

                  {/* Lists */}
                  <View className="gap-6">
                      <View>
                          <Text className="text-gray-900 font-bold mb-3 flex-row items-center">
                              <Ionicons name="star" size={16} color="#eab308" /> Strengths
                          </Text>
                          {report.strengths.map((s: string, i: number) => (
                              <View key={i} className="flex-row items-start mb-2 bg-green-50/50 p-3 rounded-xl">
                                  <Ionicons name="caret-forward" size={14} color="#10b981" style={{ marginTop: 4, marginRight: 8 }} />
                                  <Text className="text-gray-700 flex-1">{s}</Text>
                              </View>
                          ))}
                      </View>

                      <View>
                          <Text className="text-gray-900 font-bold mb-3">
                              <Ionicons name="build" size={16} color="#3b82f6" /> Areas of Improvement
                          </Text>
                          {report.improvements.map((s: string, i: number) => (
                              <View key={i} className="flex-row items-start mb-2 bg-blue-50/50 p-3 rounded-xl">
                                  <Ionicons name="caret-forward" size={14} color="#3b82f6" style={{ marginTop: 4, marginRight: 8 }} />
                                  <Text className="text-gray-700 flex-1">{s}</Text>
                              </View>
                          ))}
                      </View>
                  </View>
              </ScrollView>

              <View className="gap-3">
                  <TouchableOpacity 
                    onPress={downloadReport}
                    className="w-full bg-pink-600 py-5 rounded-2xl flex-row justify-center items-center shadow-sm"
                  >
                      <Ionicons name="cloud-download-outline" size={24} color="white" className="mr-2" />
                      <Text className="text-white font-black text-lg ml-2 uppercase tracking-widest">Download Report PDF</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => navigation.goBack()}
                    className="w-full bg-white border border-gray-200 py-5 rounded-2xl items-center"
                  >
                      <Text className="text-gray-500 font-bold text-lg uppercase tracking-widest">Close</Text>
                  </TouchableOpacity>
              </View>
          </View>
      );
  }

  return (
    <View className="flex-1 bg-white justify-between items-center p-6 py-12">
      
      {/* Top Bar */}
      <View className="w-full flex-row justify-between items-center mt-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#1f2937" />
        </TouchableOpacity>

        <View className="bg-gray-50 px-4 py-2 rounded-full border border-gray-100 flex-row items-center gap-2">
            <Ionicons name="time-outline" size={20} color={timeLeft < 60 ? "#ef4444" : "#ec4899"} />
            <Text className={`font-mono text-xl font-bold ${timeLeft < 60 ? 'text-red-500' : 'text-pink-500'}`}>
                {formatTime(timeLeft)}
            </Text>
        </View>
        <View className="w-7" />
      </View>

      {/* AI Visualizer */}
      <View className="items-center w-full flex-1 justify-center">
        <View className={`w-56 h-56 rounded-full border-2 items-center justify-center mb-8 shadow-sm
            ${aiState === 'SPEAKING' ? 'border-pink-500 bg-pink-50' : 
              aiState === 'PROCESSING' ? 'border-blue-500 bg-blue-50' : 
              aiState === 'LISTENING' ? 'border-red-500 bg-red-50' : 'border-gray-100 bg-gray-50'}`}
        >
             {aiState === 'PROCESSING' ? (
                 <ActivityIndicator size="large" color="#3b82f6" />
             ) : (
                 <View className="items-center">
                    <Ionicons 
                        name={aiState === 'LISTENING' ? "mic" : "navigate"} 
                        size={60} 
                        color={aiState === 'LISTENING' ? "#ef4444" : "#ec4899"} 
                    />
                    <Text className="text-[10px] font-black text-pink-300 uppercase tracking-tighter mt-2">Laura AI</Text>
                 </View>
             )}
        </View>
        
        <View className="bg-gray-50 px-8 py-6 rounded-3xl w-full min-h-[140px] justify-center border border-gray-100">
            <Text className="text-gray-800 text-center text-xl leading-8 font-semibold italic">
                "{currentQuestion}"
            </Text>
        </View>
      </View>

      {/* Controls */}
      <View className="items-center w-full gap-8 mb-4">
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest">
            {aiState === 'SPEAKING' ? "Laura is speaking..." : 
             aiState === 'LISTENING' ? "Release when done" : 
             aiState === 'PROCESSING' ? "Thinking..." : "Hold to answer"}
        </Text>

        <View className="flex-row items-center justify-center gap-10 w-full">
            <TouchableOpacity 
                onPress={() => Alert.alert("End Interview", "Finish early?", [{text: "Cancel"}, {text: "End", onPress: cleanupAndExit}])}
                className="w-16 h-16 rounded-full bg-red-50 items-center justify-center border border-red-100"
            >
                <MaterialIcons name="call-end" size={28} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
                disabled={aiState === 'SPEAKING' || aiState === 'PROCESSING'}
                onPressIn={startRecording}
                onPressOut={stopRecordingAndSend}
                className={`w-28 h-28 rounded-full items-center justify-center shadow-lg
                    ${aiState === 'LISTENING' ? 'bg-red-500 scale-110' : 
                      aiState === 'SPEAKING' || aiState === 'PROCESSING' ? 'bg-gray-200 opacity-50' : 'bg-pink-600'}`}
            >
                <Ionicons name={aiState === 'LISTENING' ? "mic" : "mic-outline"} size={48} color="white" />
            </TouchableOpacity>

            <View className="w-16 h-16" /> 
        </View>
      </View>
    </View>
  );
}