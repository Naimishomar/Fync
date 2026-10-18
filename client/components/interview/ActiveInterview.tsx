import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, Image, ScrollView} from 'react-native'
import { Audio } from 'expo-av';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Speech from 'expo-speech';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';
import socket from '../../utils/socket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomInset } from '../../constants/layout';

export default function ActiveInterview() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const bottomInset = useBottomInset();

  // REFS
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isProcessingRef = useRef(false); // Mutex lock to prevent race conditions
  const isEnded = useRef(false);
  // Released before the recorder finished starting: stop as soon as it has.
  const stopRequested = useRef(false);

  // PARAMS
  const { sessionId, firstQuestion = "Tell me about yourself.", duration = 5 } = route.params || {};

  // STATE
  const [aiState, setAiState] = useState<'IDLE' | 'SPEAKING' | 'LISTENING' | 'PROCESSING'>('SPEAKING');
  const [currentQuestion, setCurrentQuestion] = useState(firstQuestion);
  // What the candidate just said, shown the moment Whisper returns it rather
  // than after the interviewer has finished replying.
  const [transcript, setTranscript] = useState('');
  const [timeLeft, setTimeLeft] = useState(duration * 60);
  const [report, setReport] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);

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
              // A failed cancel must not trap the user on this screen.
              await axios.post('/interview/cancel', { sessionId }).catch(() => {});
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
    if (downloading || !report) return;
    setDownloading(true);
    try {
      const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const list = (items: unknown) =>
        (Array.isArray(items) ? items : []).map((i) => `<li>${esc(i)}</li>`).join('') || '<li>None</li>';
      const html = `<html><head><meta charset="utf-8"/><style>
        body{font-family:-apple-system,Helvetica,Arial,sans-serif;padding:32px;color:#12100E}
        h1{margin:0 0 16px}h2{margin-top:24px;font-size:16px;text-transform:uppercase}
        </style></head><body>
        <h1>AI Interview Report</h1>
        <p><b>Technical Score:</b> ${esc(report.technical_score)}/10<br/>
        <b>Communication Score:</b> ${esc(report.communication_score)}/10<br/>
        <b>Verdict:</b> ${esc(report.verdict)}</p>
        <h2>Summary</h2><p>${esc(report.summary)}</p>
        <h2>Strengths</h2><ul>${list(report.strengths)}</ul>
        <h2>Improvements</h2><ul>${list(report.improvements)}</ul>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save interview report' });
    } catch (err: any) {
      Alert.alert("Error", `Could not create the report PDF: ${err?.message ?? err}`);
    } finally {
      setDownloading(false);
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

  /**
   * Streamed reply.
   *
   * Tokens arrive over the socket the app already holds. Two things make this
   * feel like a conversation rather than a request: the text appears as it is
   * generated, and each finished SENTENCE is queued to Speech immediately
   * instead of waiting for the whole answer. Speech.speak queues rather than
   * interrupts, so the interviewer starts talking after the first sentence.
   */
  const spokenUpTo = useRef(0);
  const streamBuffer = useRef('');

  useEffect(() => {
    if (!sessionId) return;

    const mine = (p: any) => String(p?.sessionId) === String(sessionId);

    const onTranscript = (p: any) => {
      if (!mine(p) || isEnded.current) return;
      setTranscript(p.text || '');
    };

    const onToken = (p: any) => {
      if (!mine(p) || isEnded.current) return;
      streamBuffer.current += p.delta || '';
      setCurrentQuestion(streamBuffer.current);

      // Speak only whole sentences: a half sentence read aloud is worse than
      // a short wait, and Speech has no way to amend what it already queued.
      const upToLastBreak = streamBuffer.current.search(/[.!?][^.!?]*$/);
      if (upToLastBreak > spokenUpTo.current) {
        const chunk = streamBuffer.current.slice(spokenUpTo.current, upToLastBreak + 1).trim();
        spokenUpTo.current = upToLastBreak + 1;
        if (chunk) {
          setAiState('SPEAKING');
          Speech.speak(chunk, { language: 'en-US' });
        }
      }
    };

    const onDone = (p: any) => {
      if (!mine(p) || isEnded.current) return;
      const full = p.text || streamBuffer.current;
      setCurrentQuestion(full);

      // Whatever the last sentence break left over, plus the case where the
      // model produced no terminal punctuation at all.
      const tail = full.slice(spokenUpTo.current).trim();

      // onDone only fires for the final queued utterance, so IDLE is set here
      // rather than per chunk. Hung on the real tail when there is one: an
      // empty utterance is not guaranteed to call back on every TTS engine.
      Speech.speak(tail, {
        language: 'en-US',
        onDone: () => setAiState('IDLE'),
        onStopped: () => setAiState('IDLE'),
        onError: () => setAiState('IDLE'),
      });

      streamBuffer.current = '';
      spokenUpTo.current = 0;
    };

    socket.on('interview:transcript', onTranscript);
    socket.on('interview:token', onToken);
    socket.on('interview:done', onDone);
    return () => {
      socket.off('interview:transcript', onTranscript);
      socket.off('interview:token', onToken);
      socket.off('interview:done', onDone);
    };
  }, [sessionId, report]);

  // 3. START RECORDING (With Mutex Lock)
  const startRecording = async () => {
    if (isProcessingRef.current || report) return;
    isProcessingRef.current = true;
    stopRequested.current = false;

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
      // A quick tap releases before createAsync resolves; without this the mic
      // kept recording with nothing left to stop it.
      if (stopRequested.current) {
        stopRequested.current = false;
        stopRecordingAndSend();
      }
    }
  };

  // 4. STOP RECORDING (Safety Checks)
  const stopRecordingAndSend = async () => {
    if (isProcessingRef.current) {
      stopRequested.current = true;
      return;
    }
    if (!recordingRef.current) return;

    isProcessingRef.current = true;
    setAiState('PROCESSING');
    streamBuffer.current = '';
    spokenUpTo.current = 0;
    setTranscript('');

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

      // The socket has normally already rendered and spoken this. Only fall
      // back to the whole-response path if no token ever arrived -- a dropped
      // socket must not cost the candidate their turn.
      if (res.data.success && !streamBuffer.current && spokenUpTo.current === 0) {
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
      <View className="flex-1 bg-paper px-5" style={{ paddingTop: insets.top + 24, paddingBottom: bottomInset + 8 }}>
        <View className="items-center mb-8">
          <View className="bg-success/15 p-4 rounded-full mb-4">
            <Ionicons name="checkmark-circle" size={60} color={C.success} />
          </View>
          <Text className="text-3xl font-display text-ink">
            INTERVIEW<Text className="text-accent-text">COMPLETE</Text>
          </Text>
          <Text className="text-ink-3 mt-2">Evaluation results are ready</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 mb-6" showsVerticalScrollIndicator={false}>
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
                <Ionicons name="star" size={16} color={C.warning} /> Strengths
              </Text>
              {(report.strengths ?? []).map((s: string, i: number) => (
                <View key={i} className="flex-row items-start mb-2 bg-success/10 p-3 rounded-xl">
                  <Ionicons name="caret-forward" size={14} color={C.success} style={{ marginTop: 4, marginRight: 8 }} />
                  <Text className="text-ink-2 flex-1">{s}</Text>
                </View>
              ))}
            </View>

            <View>
              <Text className="font-display text-label text-ink uppercase mb-3">
                <Ionicons name="build" size={16} color={C.info} /> Areas of Improvement
              </Text>
              {(report.improvements ?? []).map((s: string, i: number) => (
                <View key={i} className="flex-row items-start mb-2 bg-fam-career/10 p-3 rounded-xl">
                  <Ionicons name="caret-forward" size={14} color={C.info} style={{ marginTop: 4, marginRight: 8 }} />
                  <Text className="text-ink-2 flex-1">{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View className="gap-3">
          <TouchableOpacity
            onPress={downloadReport}
            disabled={downloading}
            className="w-full bg-brand-600 py-5 rounded-card flex-row justify-center items-center shadow-hair"
          >
            {downloading ? <ActivityIndicator color="white" /> : <Ionicons name="cloud-download-outline" size={24} color="white" className="mr-2" />}
            <Text className="text-white font-display text-lg ml-2 uppercase">{downloading ? 'Generating...' : 'Download Report PDF'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="h-12 items-center justify-center rounded-xl w-full"
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text className="text-ink-3 font-display text-lg uppercase">Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper">
      {/* Top Bar */}
      <AppBar
        title="Interview"
        onBack={() => navigation.goBack()}
        right={
          <View className="bg-paper-2 px-4 py-2 rounded-full border border-line flex-row items-center gap-2" style={{ marginRight: 11 }}>
            <Ionicons name="time-outline" size={20} color={timeLeft < 60 ? C.danger : C.brand[500]} />
            <Text className={`text-xl font-display ${timeLeft < 60 ? 'text-danger' : 'text-accent-text'}`}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        }
      />

      <View className="flex-1 justify-between items-center px-5" style={{ paddingBottom: bottomInset + 16 }}>

      {/* AI Visualizer */}
      <View className="items-center w-full flex-1 justify-center">
        <View className={`w-56 h-56 rounded-full border-2 items-center justify-center mb-8 shadow-hair ${aiState === 'SPEAKING' ? 'border-brand-500 bg-brand-50' : aiState === 'PROCESSING' ? 'border-fam-career bg-fam-career/10' : aiState === 'LISTENING' ? 'border-danger bg-danger/10' : 'border-line bg-paper-2'}`}
        >
          {aiState === 'PROCESSING' ? (
            <ActivityIndicator size="large" color={C.info} />
          ) : (
            <View className="items-center">
              <Ionicons
                name={aiState === 'LISTENING' ? "mic" : "navigate"}
                size={60}
                color={aiState === 'LISTENING' ? C.danger : C.brand[500]}
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

        {/* What Whisper heard, shown as soon as it lands. Seeing your own
            words is the fastest possible acknowledgement that the turn was
            received -- it arrives well before the interviewer starts replying. */}
        {!!transcript && (
          <View className="mt-3 w-full flex-row items-start gap-2 px-1">
            <Ionicons name="person-circle-outline" size={16} color={C.ink3} />
            <Text className="flex-1 text-ink-3 text-sm italic" numberOfLines={3}>
              {transcript}
            </Text>
          </View>
        )}
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
            <Feather name="phone-off" size={28} color={C.danger} />
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
    </View>
  );
}
