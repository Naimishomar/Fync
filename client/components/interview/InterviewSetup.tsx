import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { useAuth } from '../../context/auth.context';

export default function InterviewSetup() {
  const navigation = useNavigation<any>();

  const [domain, setDomain] = useState('');
  const [experience, setExperience] = useState('');
  const [duration, setDuration] = useState(10);
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [html, setHtml] = useState("");
  const { user } = useAuth();

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

    setLoading(true);
    try {
      // 1. Create Order
      const resOrder = await axios.post('/interview/create-order', {
        duration: duration
      });

      if (resOrder.data.success) {
        const order = resOrder.data.order;
        const razorpayHtml = `
          <html>
            <body style="background-color: #fff;">
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
                    name: "${user?.name || ''}",
                    email: "${user?.email || ''}",
                    contact: "${user?.mobileNumber || ''}"
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
                  theme: { color: "#ec4899" }
                };
                var rzp1 = new Razorpay(options);
                rzp1.open();
              </script>
            </body>
          </html>
        `;
        setHtml(razorpayHtml);
        setShowWebView(true);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Payment initiation failed', text2: err.message });
      setLoading(false);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    const msg = JSON.parse(event.nativeEvent.data);
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
        navigation.navigate('ActiveInterview', {
          sessionId: res.data.sessionId,
          firstQuestion: res.data.question,
          duration: duration
        });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Setup failed', text2: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Background Gradient */}
      <LinearGradient colors={['rgba(236, 72, 153, 0.05)', '#ffffff']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
        >
          {/* HEADER */}
          <View className="flex-row items-center px-6 pt-4 mb-2">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="p-2 bg-gray-100 rounded-full mr-4 border border-gray-200"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text className="text-gray-900 text-3xl font-black  tracking-tighter">
              AI <Text className="text-pink-500">INTERVIEW</Text> 🤖
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} className="px-6">

            <Text className="text-gray-500 mb-8 mt-2 text-sm leading-5">
              Configure your AI interviewer. Upload your resume and let the system tailor the technical questions to your profile.
            </Text>

            {/* MAIN FORM CARD */}
            <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">

              <View className="gap-6">

                {/* Domain Input */}
                <View>
                  <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs uppercase tracking-wider">Target Role / Domain</Text>
                  <TextInput
                    placeholder="e.g. React Native, Data Scientist"
                    placeholderTextColor="#9ca3af"
                    className="bg-gray-50 text-gray-900 p-4 rounded-2xl border border-gray-200 font-medium"
                    value={domain}
                    onChangeText={setDomain}
                  />
                </View>

                {/* Experience Input */}
                <View>
                  <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs uppercase tracking-wider">Years of Experience</Text>
                  <TextInput
                    placeholder="e.g. 2"
                    placeholderTextColor="#9ca3af"
                    className="bg-gray-50 text-gray-900 p-4 rounded-2xl border border-gray-200 font-medium"
                    keyboardType="numeric"
                    value={experience}
                    onChangeText={setExperience}
                  />
                </View>

                {/* Duration Selector */}
                <View>
                  <Text className="text-gray-400 font-bold mb-3 ml-1 text-xs uppercase tracking-wider">Interview Duration & Price</Text>
                  <View className="flex-row gap-3">
                    {[10, 15].map((min) => (
                      <TouchableOpacity
                        key={min}
                        activeOpacity={0.8}
                        onPress={() => setDuration(min)}
                        className={`flex-1 p-4 rounded-2xl items-center border transition-all ${duration === min
                            ? 'bg-pink-50 border-pink-500'
                            : 'bg-gray-50 border-gray-200'
                          }`}
                      >
                        <Text className={`font-bold text-lg ${duration === min ? 'text-pink-600' : 'text-gray-500'}`}>
                          {min} <Text className="text-xs font-medium">min</Text>
                        </Text>
                        <Text className={`text-xs font-bold mt-1 ${duration === min ? 'text-pink-500' : 'text-gray-400'}`}>
                          ₹{min === 10 ? '5' : '7'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* File Upload */}
                <View>
                  <Text className="text-gray-400 font-bold mb-3 ml-1 text-xs uppercase tracking-wider">Resume (PDF)</Text>
                  <Pressable
                    onPress={pickResume}
                    className={`p-6 rounded-3xl border-2 border-dashed items-center justify-center transition-all ${resume ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-gray-50'
                      }`}
                  >
                    {resume ? (
                      <View className="items-center">
                        <View className="bg-pink-100 p-3 rounded-full mb-3 border border-pink-200">
                          <Ionicons name="document-text" size={32} color="#ec4899" />
                        </View>
                        <Text className="text-gray-900 font-bold text-center" numberOfLines={1}>
                          {resume.name}
                        </Text>
                        <Text className="text-pink-500 font-bold text-xs mt-1 uppercase tracking-widest">Ready to upload</Text>
                      </View>
                    ) : (
                      <View className="items-center py-2">
                        <Ionicons name="cloud-upload-outline" size={40} color="#9ca3af" />
                        <Text className="text-gray-400 font-bold mt-3">Tap to Upload Resume</Text>
                        <Text className="text-gray-500 text-xs mt-1">PDF format only</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

              </View>
            </View>

            {/* Start Button */}
            <View className="mt-8">
              <TouchableOpacity
                onPress={startSession}
                disabled={loading}
                className={`w-full py-5 rounded-2xl shadow-sm flex-row justify-center items-center ${loading ? 'bg-pink-400' : 'bg-pink-600'
                  }`}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-black text-xl mr-2 tracking-widest uppercase">Start Interview</Text>
                    <Ionicons name="rocket" size={20} color="white" />
                  </>
                )}
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Razorpay WebView Modal */}
      <Modal visible={showWebView} animationType="slide" transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View className="flex-row items-center justify-between p-4 border-b border-gray-100 bg-white">
            <Text className="text-gray-900 font-bold text-lg">Secure Checkout</Text>
            <Pressable onPress={() => {
              setShowWebView(false);
              setLoading(false);
              Alert.alert("Cancelled", "Payment was cancelled.");
            }}>
              <Ionicons name="close" size={24} color="#1f2937" />
            </Pressable>
          </View>
          {html ? (
            <WebView
              source={{ html }}
              originWhitelist={["*"]}
              onMessage={handleWebViewMessage}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1 bg-white justify-center items-center">
              <ActivityIndicator size="large" color="#ec4899" />
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
