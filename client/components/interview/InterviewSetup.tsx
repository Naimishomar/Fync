import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, KeyboardAvoidingView, Pressable, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Card, Label, Button, FormField } from '../ui/kit';

export default function InterviewSetup() {
  const navigation = useNavigation<any>();

  const [domain, setDomain] = useState('');
  const [experience, setExperience] = useState('');
  const [duration, setDuration] = useState(10);
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [html, setHtml] = useState("");
  // Duration of a verified-but-unused payment. While set, starting needs no
  // new payment — this is how a failed /start is retried.
  const [paidDuration, setPaidDuration] = useState<number | null>(null);
  const { user } = useAuth();
  // A second tap lands before the re-render that disables the button: one order, one checkout.
  const ordering = useRef(false);

  useFocusEffect(useCallback(() => {
    axios.get('/interview/credit')
      .then((res) => {
        const d = res.data?.credit?.duration ?? null;
        setPaidDuration(d);
        if (d) setDuration(d);
      })
      .catch(() => { /* no credit info: fall back to the normal pay flow */ });
  }, []));

  const pickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setResume(result.assets[0]);
      }
    } catch (err) {
      console.log("Error picking document:", err);
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const startSession = async () => {
    if (!domain.trim() || !experience.trim()) {
      Alert.alert("Missing Fields", "Please enter the role and your experience.");
      return;
    }
    if (!resume) {
      Alert.alert("Resume Required", "Please upload your resume (PDF).");
      return;
    }

    if (ordering.current) return;
    if (paidDuration) {
      setLoading(true);
      ordering.current = true;
      try { await finalSubmit(); } finally { ordering.current = false; }
      return;
    }

    setLoading(true);
    ordering.current = true;
    try {
      // 1. Create Order
      const resOrder = await axios.post('/interview/create-order', {
        duration: duration
      });

      if (resOrder.data.success) {
        const order = resOrder.data.order;
        const razorpayHtml = `
          <html>
            <body style="background-color: ${C.card};">
              <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
              <script>
                var options = {
                  key: "${RAZORPAY_KEY_ID}",
                  amount: "${order.amount}",
                  currency: "INR",
                  name: "Fync AI Interview",
                  description: "${duration} Minute Mock Interview",
                  order_id: "${order.id}",
                  prefill: {
                    name: ${JSON.stringify(user?.name || '')},
                    email: ${JSON.stringify(user?.email || '')},
                    contact: ${JSON.stringify(String(user?.mobileNumber || ''))}
                  },
                  handler: function (response) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      event: "SUCCESS",
                      data: response
                    }));
                  },
                  modal: {
                    ondismiss: function () {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        event: "FAILED"
                      }));
                    }
                  },
                  theme: { color: "#F97316" }
                };
                var rzp1 = new Razorpay(options);
                rzp1.open();
              </script>
            </body>
          </html>
        `;
        setHtml(razorpayHtml);
        setShowWebView(true);
      } else {
        // Left the button spinning forever before.
        Toast.show({ type: 'error', text1: 'Payment initiation failed', text2: resOrder.data.message });
        setLoading(false);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Payment initiation failed', text2: err.message });
      setLoading(false);
    } finally {
      ordering.current = false;
    }
  };

  const handleWebViewMessage = async (event: any) => {
    let msg: any = {};
    try { msg = JSON.parse(event.nativeEvent.data); } catch { /* treated as not completed */ }
    setShowWebView(false);

    if (msg.event === "SUCCESS") {
      try {
        setLoading(true);
        // 2. Verify Payment
        const verifyRes = await axios.post('/interview/verify-payment', {
          razorpay_order_id: msg.data.razorpay_order_id,
          razorpay_payment_id: msg.data.razorpay_payment_id,
          razorpay_signature: msg.data.razorpay_signature
        });

        if (verifyRes.data.success) {
          // Paid from here on: a failed start is retried, never re-paid.
          const d = verifyRes.data.duration ?? duration;
          setPaidDuration(d);
          setDuration(d);
          // 3. Final Step: Start interview session
          await finalSubmit();
        } else {
          Alert.alert("Error", "Payment verification failed.");
          setLoading(false);
        }
      } catch (err: any) {
        Alert.alert("Error", "Verification error: " + err.message);
        setLoading(false);
      }
    } else {
      Alert.alert("Cancelled", "Payment was not completed.");
      setLoading(false);
    }
  };

  const finalSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append('resume', {
        uri: resume.uri,
        type: resume.mimeType || 'application/pdf',
        name: resume.name || 'resume.pdf',
      } as any);

      formData.append('domain', domain);
      formData.append('experience', experience);
      formData.append('duration', duration.toString());

      const res = await axios.post('/interview/start', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setPaidDuration(null);
        navigation.navigate('ActiveInterview', {
          sessionId: res.data.sessionId,
          firstQuestion: res.data.question,
          duration: res.data.duration ?? duration
        });
      } else {
        Alert.alert("Couldn't start", "Your payment is saved. Tap Retry to try again.");
      }
    } catch (err: any) {
      Alert.alert("Couldn't start", (err.response?.data?.message || err.message) + "\n\nYour payment is saved. Tap Retry to try again — you won't be charged again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-paper">

      <SafeAreaView className="flex-1" edges={['bottom']}>
        <KeyboardAvoidingView
          // Android already resizes the window for the keyboard; padding on top of that doubled the gap.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          {/* HEADER */}
          <AppBar title="AI Interview" onBack={() => navigation.goBack()} />

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} className="px-gutter">

            <Text className="text-ink-3 mb-6 mt-2 text-sm leading-5">
              Configure your AI interviewer. Upload your resume and let the system tailor the technical questions to your profile.
            </Text>

            <Card>
              <View className="gap-6">
                <FormField
                  label="Target role or domain"
                  placeholder="e.g. React Native, Data Scientist"
                  value={domain}
                  onChangeText={setDomain}
                />
                <FormField
                  label="Years of experience"
                  placeholder="e.g. 2"
                  keyboardType="numeric"
                  value={experience}
                  onChangeText={setExperience}
                />

                {/* Duration Selector */}
                <View>
                  <Label className="mb-2">Interview duration and price</Label>
                  <View className="flex-row gap-3">
                    {[10, 15].map((min) => (
                      <Pressable
                        key={min}
                        onPress={() => setDuration(min)}
                        disabled={!!paidDuration}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: duration === min, disabled: !!paidDuration }}
                        className={`flex-1 p-4 rounded-2xl items-center border active:opacity-70 ${duration === min ? 'bg-brand-50 border-brand-500' : 'bg-paper-2 border-line'}`}
                      >
                        <Text className={`font-display text-lg ${duration === min ? 'text-accent-text' : 'text-ink-2'}`}>
                          {min} <Text className="text-xs font-medium">min</Text>
                        </Text>
                        <Text className={`text-xs font-semibold mt-1 ${duration === min ? 'text-accent-text' : 'text-ink-3'}`}>
                          ₹{min === 10 ? '5' : '7'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* File Upload */}
                <View>
                  <Label className="mb-2">Resume (PDF)</Label>
                  <Pressable
                    onPress={pickResume}
                    accessibilityRole="button"
                    accessibilityLabel={resume ? `Resume ${resume.name}, tap to change` : 'Upload resume'}
                    className={`p-6 rounded-2xl border border-dashed items-center justify-center active:opacity-70 ${resume ? 'border-brand-500 bg-brand-50' : 'border-line bg-paper-2'}`}
                  >
                    {resume ? (
                      <View className="items-center">
                        <View className="bg-brand-100 p-3 rounded-full mb-3">
                          <Ionicons name="document-text" size={32} color={C.brand[500]} />
                        </View>
                        <Text className="text-ink font-semibold text-center" numberOfLines={1}>
                          {resume.name}
                        </Text>
                        <Text className="text-accent-text font-semibold text-xs mt-1">Ready to upload</Text>
                      </View>
                    ) : (
                      <View className="items-center py-2">
                        <Ionicons name="cloud-upload-outline" size={40} color={C.ink3} />
                        <Text className="text-ink-2 font-semibold mt-3">Tap to upload resume</Text>
                        <Text className="text-ink-3 text-xs mt-1">PDF format only</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>
            </Card>

            {/* Start Button */}
            <View className="mt-6">
              {paidDuration ? (
                <Text className="text-accent-text font-semibold text-xs mb-3 text-center">
                  You have a paid {paidDuration}-min interview. No payment needed.
                </Text>
              ) : null}
              <Button
                variant="primary"
                block
                loading={loading}
                disabled={loading}
                onPress={startSession}
                title={paidDuration ? 'Retry start' : 'Start interview'}
              />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Razorpay WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="slide"
        transparent={false}
        statusBarTranslucent
        onRequestClose={() => {
          setShowWebView(false);
          setLoading(false);
          Alert.alert("Cancelled", "Payment was cancelled.");
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: C.card }} edges={['bottom']}>
          <AppBar
            title="Secure Checkout"
            right={<IconBtn name="close" accessibilityLabel="Cancel payment" onPress={() => {
              setShowWebView(false);
              setLoading(false);
              Alert.alert("Cancelled", "Payment was cancelled.");
            }} />}
          />
          {html ? (
            <WebView
              source={{ html }}
              originWhitelist={["*"]}
              onMessage={handleWebViewMessage}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1 bg-paper justify-center items-center">
              <ActivityIndicator size="large" color={C.brand[500]} />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
