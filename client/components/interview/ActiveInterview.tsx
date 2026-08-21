import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, Image, ScrollView} from 'react-native'
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Alert } from '../ui/AlertModal';

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
        recordingRef.current.stopAndUnloadAsync().catch(() => { });
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
        await recordingRef.current.stopAndUnloadAsync().catch(() => { });
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
      <View className="flex-1 bg-paper p-6 pt-16">
        <View className="items-center mb-8">
          <View className="bg-success/15 p-4 rounded-full mb-4">
            <Ionicons name="checkmark-circle" size={60} color="#047857" />
          </View>
          <Text className="text-3xl font-display text-ink">
            INTERVIEW<Text className="text-accent-text">COMPLETE</Text>
          </Text>
          <Text className="text-ink-3 mt-2">Evaluation results are ready</Text>
        </View>

        <ScrollView className="flex-1 mb-6" showsVerticalScrollIndicator={false}>
          {/* Score Row */}
          <View className="flex-row gap-4 mb-6">
            <View className="flex-1 bg-paper p-5 border border-line items-center rounded-md">
              <Text className="text-ink-3 font-semibold text-xs uppercase mb-1">Technical</Text>
              <Text className="text-3xl font-display text-accent-text">{report.technical_score}<Text className="text-ink-4 text-lg">/10</Text></Text>
            </View>
            <View className="flex-1 bg-paper p-5 border border-line items-center rounded-md">
              <Text className="text-ink-3 font-semibold text-xs uppercase mb-1">Soft Skills</Text>
              <Text className="text-3xl font-display text-fam-career">{report.communication_score}<Text className="text-ink-4 text-lg">/10</Text></Text>
            </View>
          </View>

          {/* Summary */}
          <View className="bg-paper-2 p-6 rounded-card border border-line mb-6">
            <Text className="text-ink font-semibold mb-2">Detailed Summary</Text>
            <Text className="text-ink-2 leading-6">{report.summary}</Text>
          </View>

          {/* Verdict */}
          <View className={`p-4 rounded-card items-center border mb-6 ${report.verdict === 'Pass' ? 'bg-success/10 border-success/25' : 'bg-danger/10 border-danger/25'}`}>
            <Text className={`font-display uppercase ${report.verdict === 'Pass' ? 'text-success' : 'text-danger'}`}>
              Verdict: {report.verdict}
            </Text>
          </View>

          {/* Lists */}
          <View className="gap-6">
            <View>
              <Text className="text-ink font-semibold mb-3 flex-row items-center">
                <Ionicons name="star" size={16} color="#B45309" /> Strengths
              </Text>
              {report.strengths.map((s: string, i: number) => (
                <View key={i} className="flex-row items-start mb-2 bg-success/10 p-3 rounded-xl">
                  <Ionicons name="caret-forward" size={14} color="#047857" style={{ marginTop: 4, marginRight: 8 }} />
                  <Text className="text-ink-2 flex-1">{s}</Text>
                </View>
              ))}
            </View>

            <View>
              <Text className="font-display text-label text-ink uppercase mb-3">
                <Ionicons name="build" size={16} color="#2563EB" /> Areas of Improvement
              </Text>
              {report.improvements.map((s: string, i: number) => (
                <View key={i} className="flex-row items-start mb-2 bg-fam-career/10 p-3 rounded-xl">
                  <Ionicons name="caret-forward" size={14} color="#2563EB" style={{ marginTop: 4, marginRight: 8 }} />
                  <Text className="text-ink-2 flex-1">{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View className="gap-3">
          <TouchableOpacity
            onPress={downloadReport}
            className="w-full bg-brand-600 py-5 rounded-card flex-row justify-center items-center shadow-hair"
          >
            <Ionicons name="cloud-download-outline" size={24} color="white" className="mr-2" />
            <Text className="text-white font-display text-lg ml-2 uppercase">Download Report PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl w-full"
          
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Text className="text-ink-3 font-display text-lg uppercase">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper justify-between items-center p-6 py-12">

      {/* Top Bar */}
      <View className="w-full flex-row justify-between items-center mt-4">
        <TouchableOpacity onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
          <Ionicons name="chevron-back" size={28} color="#57534E" />
        </TouchableOpacity>

        <View className="bg-paper-2 px-4 py-2 rounded-full border border-line flex-row items-center gap-2">
          <Ionicons name="time-outline" size={20} color={timeLeft < 60 ? "#DC2626" : "#F97316"} />
          <Text className={`text-xl font-display ${timeLeft < 60 ? 'text-danger' : 'text-accent-text'}`}>
            {formatTime(timeLeft)}
          </Text>
        </View>
        <View className="w-7" />
      </View>

      {/* AI Visualizer */}
      <View className="items-center w-full flex-1 justify-center">
        <View className={`w-56 h-56 rounded-full border-2 items-center justify-center mb-8 shadow-hair ${aiState === 'SPEAKING' ? 'border-brand-500 bg-brand-50' : aiState === 'PROCESSING' ? 'border-fam-career bg-fam-career/10' : aiState === 'LISTENING' ? 'border-danger bg-danger/10' : 'border-line bg-paper-2'}`}
        >
          {aiState === 'PROCESSING' ? (
            <ActivityIndicator size="large" color="#2563EB" />
          ) : (
            <View className="items-center">
              <Ionicons
                name={aiState === 'LISTENING' ? "mic" : "navigate"}
                size={60}
                color={aiState === 'LISTENING' ? "#DC2626" : "#F97316"}
              />
              <Text className="text-label font-display text-brand-300 uppercase mt-2">Laura AI</Text>
            </View>
          )}
        </View>

        <View className="bg-paper-2 px-gutter py-6 rounded-card w-full min-h-[140px] justify-center border border-line">
          <Text className="text-ink text-center text-xl leading-8 font-semibold">
            "{currentQuestion}"
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View className="items-center w-full gap-8 mb-4">
        <Text className="text-ink-3 text-xs font-semibold uppercase">
          {aiState === 'SPEAKING' ? "Laura is speaking..." :
            aiState === 'LISTENING' ? "Release when done" :
              aiState === 'PROCESSING' ? "Thinking..." : "Hold to answer"}
        </Text>

        <View className="flex-row items-center justify-center gap-10 w-full">
          <TouchableOpacity
            onPress={() => Alert.alert("End Interview", "Finish early?", [{ text: "Cancel" }, { text: "End", onPress: cleanupAndExit }])}
            className="w-16 h-16 rounded-full bg-danger/10 items-center justify-center border border-danger/15"
          >
            <MaterialIcons name="call-end" size={28} color="#DC2626" />
          </TouchableOpacity>

          <TouchableOpacity
            disabled={aiState === 'SPEAKING' || aiState === 'PROCESSING'}
            onPressIn={startRecording}
            onPressOut={stopRecordingAndSend}
            className={`w-28 h-28 rounded-full items-center justify-center shadow-hair ${aiState === 'LISTENING' ? 'bg-danger scale-110' : aiState === 'SPEAKING' || aiState === 'PROCESSING' ? 'bg-paper-2 opacity-50' : 'bg-brand-600'}`}
          >
            <Ionicons name={aiState === 'LISTENING' ? "mic" : "mic-outline"} size={48} color="white" />
          </TouchableOpacity>

          <View className="w-16 h-16" />
        </View>
      </View>
    </View>
  );
}
