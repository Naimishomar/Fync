import {ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Pressable, Text, TextInput, TouchableWithoutFeedback, View} from 'react-native'
import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import AuthPoster from './ui/AuthPoster';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../context/axiosConfig';
//@ts-ignore
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { useBottomInset } from '../constants/layout';
import { AppBar } from './ui/kit';

const ForgotPassword = ({ route, navigation }: any) => {
  const [email, setEmail] = useState(route.params?.email || '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const bottomInset = useBottomInset();

  const togglePassword = useCallback(() => {
    setPasswordVisible((prev) => !prev);
  }, []);

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`/user/reset-password`, { email: email.trim() });
      if (response.data.success) {
        Alert.alert("OTP Sent", "Please check your email for the verification code.");
        setIsOtpSent(true);
      } else {
        Alert.alert("Error", response.data.message || "Failed to send OTP.");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.response?.data?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 2: Verify OTP & Reset Password ---
  const handleVerifyAndReset = async () => {
    if (!otp || !password) {
      Alert.alert("Error", "Please enter the OTP and your new password.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      // Call your backend verifyResetPassword endpoint
      const response = await axios.post(`/user/verify-reset-password`, {
        email: email.trim(),
        otp,
        password
      });

      if (response.data.success) {
        Alert.alert("Success", "Your password has been reset successfully!", [
          { text: "Login", onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert("Error", response.data.message || "Failed to reset password.");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.response?.data?.message || "Invalid OTP or Server Error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      {/* Same shell as login and sign-up. The form used to sit in a View
          pinned with absolute bottom-0 wrapping an unbounded ScrollView, so it
          could not scroll and its lower fields were unreachable once the OTP
          and password inputs appeared. */}
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        className="bg-paper"
      >
        <AppBar title="Forgot Password" onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, backgroundColor: '#F5F2EC' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 bg-ink">

            <AuthPoster mode="login" grow />

            <View
              className="bg-paper rounded-t-sheet"
              style={{ marginTop: -22, paddingTop: 8, paddingBottom: bottomInset }}
            >
              <View className="px-6 pt-6 pb-2">
                <View style={{ width: 72, height: 72, alignSelf: 'center' }}>
                  <View
                    pointerEvents="none"
                    className="absolute bg-ink rounded-full"
                    style={{ left: 4, top: 4, width: 72, height: 72 }}
                  />
                  <Image
                    source={require('../assets/fync-logo.jpg')}
                    style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: '#12100E' }}
                    resizeMode="cover"
                    accessibilityLabel="Fync"
                  />
                </View>

                <Text className="font-display text-ink text-center mt-4" style={{ fontSize: 22 }}>
                  {isOtpSent ? "Verify and reset" : "Forgot password"}
                </Text>
                <Text className="font-sans text-ink-2 text-center mt-2" style={{ fontSize: 13 }}>
                  {isOtpSent
                    ? "Enter the code we sent and choose a new password."
                    : "We will email you a code to reset it."}
                </Text>
              </View>

              <View className="px-6 pt-4">

              {/* One stamped card holding the whole flow, so the screen does
                  not change shape when the OTP and password fields appear. */}
              <View className="relative mb-6">
                <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
                <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                  <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Email</Text>
                  <View
                    className={`mt-2 flex-row items-center border-[1.5px] px-4 rounded-md ${isOtpSent ? 'border-line bg-paper-2' : 'border-ink bg-card'}`}
                    style={{ minHeight: 50 }}
                  >
                    <TextInput
                      className={`flex-1 font-sans text-base ${isOtpSent ? 'text-ink-2' : 'text-ink'}`}
                      placeholder="you@college.ac.in"
                      placeholderTextColor={C.ink3}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isOtpSent}
                    />
                  </View>

                  {isOtpSent && (
                    <>
                      <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Verification code</Text>
                      <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 54, justifyContent: 'center' }}>
                        <TextInput
                          className="font-display text-lg text-ink text-center"
                          placeholder="6-digit code"
                          placeholderTextColor={C.ink3}
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="number-pad"
                          autoCapitalize="none"
                          maxLength={6}
                        />
                      </View>

                      <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>New password</Text>
                      <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                        <TextInput
                          className="flex-1 font-sans text-base text-ink"
                          placeholder="At least 8 characters"
                          placeholderTextColor={C.ink3}
                          secureTextEntry={!passwordVisible}
                          value={password}
                          onChangeText={setPassword}
                        />
                        <Pressable onPress={togglePassword} hitSlop={10}>
                          <Ionicons
                            name={passwordVisible ? 'eye-off' : 'eye'}
                            size={22}
                            color={C.ink3}
                          />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              </View>

              {/* Action Button */}
              {isLoading ? (
                <Pressable className="bg-brand-500 py-4 items-center justify-center border-2 border-ink rounded-xl" style={{ minHeight: 52 }}>
                  <ActivityIndicator size="small" color={C.ink} />
                </Pressable>
              ) : (
                <Pressable
                  className="bg-brand-500 py-4 items-center justify-center border-2 border-ink rounded-xl"
                  style={{ minHeight: 52 }}
                  onPress={isOtpSent ? handleVerifyAndReset : handleSendOtp}
                >
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>
                    {isOtpSent ? "Reset Password" : "Send OTP"}
                  </Text>
                </Pressable>
              )}

              {/* Back to Edit Email (Optional UX improvement) */}
              {isOtpSent && !isLoading && (
                <Pressable onPress={() => setIsOtpSent(false)} className="mt-4 items-center">
                  <Text className="text-ink-2 font-semibold">Change email or resend</Text>
                </Pressable>
              )}

              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default ForgotPassword;
