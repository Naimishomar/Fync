import {Image, Keyboard, KeyboardAvoidingView, Pressable, Text, TouchableWithoutFeedback, View} from 'react-native'
import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import AuthPoster from './ui/AuthPoster';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../context/axiosConfig';
//@ts-ignore
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { useBottomInset } from '../constants/layout';
import { AppBar, Button, FormField } from './ui/kit';

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
        <AppBar title="Forgot password" onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, backgroundColor: C.paper }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 bg-night">

            <AuthPoster mode="login" grow />

            <View
              className="bg-paper rounded-t-sheet"
              style={{ marginTop: -22, paddingTop: 8, paddingBottom: bottomInset }}
            >
              <View className="px-gutter pt-6 pb-2">
                <Image
                  source={require('../assets/fync-logo.jpg')}
                  style={{ width: 72, height: 72, borderRadius: 36, alignSelf: 'center' }}
                  resizeMode="cover"
                  accessibilityLabel="Fync"
                />

                <Text className="font-display text-ink text-center mt-4" style={{ fontSize: 22 }} accessibilityRole="header">
                  {isOtpSent ? "Verify and reset" : "Forgot password"}
                </Text>
                <Text className="font-sans text-sm text-ink-2 text-center mt-2">
                  {isOtpSent
                    ? "Enter the code we sent and choose a new password."
                    : "We will email you a code to reset it."}
                </Text>
              </View>

              <View className="px-gutter pt-4">
                {/* One card holding the whole flow, so the screen does not
                    change shape when the OTP and password fields appear. */}
                <View className="bg-card border border-line rounded-2xl p-4 mb-6" style={{ gap: 16 }}>
                  <FormField
                    label="Email"
                    placeholder="you@college.ac.in"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isOtpSent}
                    style={isOtpSent ? { color: C.ink2 } : undefined}
                  />

                  {isOtpSent && (
                    <>
                      <FormField
                        label="Verification code"
                        style={{ textAlign: 'center', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' }}
                        placeholder="6-digit code"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        autoCapitalize="none"
                        maxLength={6}
                      />
                      <FormField
                        label="New password"
                        placeholder="At least 8 characters"
                        secureTextEntry={!passwordVisible}
                        value={password}
                        onChangeText={setPassword}
                        right={
                          <Pressable onPress={togglePassword} hitSlop={12} accessibilityRole="button" className="active:opacity-70"
                            accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                            <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink3} />
                          </Pressable>
                        }
                      />
                    </>
                  )}
                </View>

                <Button
                  variant="primary" block
                  title={isOtpSent ? "Reset password" : "Send OTP"}
                  loading={isLoading}
                  onPress={isOtpSent ? handleVerifyAndReset : handleSendOtp}
                />

                {isOtpSent && !isLoading && (
                  <Pressable onPress={() => setIsOtpSent(false)} className="mt-4 self-center active:opacity-70" hitSlop={12} accessibilityRole="button">
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
