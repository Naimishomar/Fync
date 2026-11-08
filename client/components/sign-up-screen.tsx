import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
// @ts-ignore
import axios from '../context/axiosConfig';
import AuthHeader from './onboarding/AuthHeader';
import { C } from '../constants/colors';
import { Button, FormField } from './ui/kit';
import { useBottomInset } from '../constants/layout';

export default function SignUpScreen() {
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // The code is tied to the email it went to; editing the form after it was
  // sent would verify a different address, so send a fresh one instead.
  const resetOtp = () => {
    if (otpSent) { setOtpSent(false); setOtp(''); }
  };

  const sendOtpToEmail = async () => {
    if (!email.trim() || !username.trim() || !phoneNumber.trim() || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'All fields are required',
      });
      return;
    }

    try {
      setIsLoading(true);
      const res = await axios.post('/user/send-email-otp', {
        email: email.trim(),
        username: username.trim(),
        mobileNumber: phoneNumber.trim(),
      });

      if (res.data.success) {
        setOtpSent(true);
        Toast.show({
          type: 'success',
          text1: 'OTP sent to your Email',
          text2: res.data.message || 'Please check your email for the verification code',
        });
      } else {
        Toast.show({
          type: 'info',
          text1: 'Sign Up',
          text2: res.data.message,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'info',
        text1: 'Already Registered',
        text2: error.response?.data?.message || 'This account might already exist.',
      });
    } finally {
      setIsLoading(false);
    }
  };
  const verifyOtpAndProceed = async () => {
    if (!otp.trim()) {
      Toast.show({ type: 'error', text1: 'Enter the OTP from your email' });
      return;
    }
    try {
      setIsLoading(true);
      const res = await axios.post('/user/verify-email-otp', {
        email: email.trim(),
        otp: otp.trim(),
      });

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'OTP Verified',
        });

        navigation.navigate('ProfileSetup1', {
          email: email.trim(),
          username: username.trim(),
          phoneNumber: phoneNumber.trim(),
          password,
          // Proof of the verified email; /user/register requires it.
          verificationToken: res.data.verificationToken,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Invalid OTP',
          text2: res.data.message,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.response?.data?.message || 'Invalid OTP or Server Error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 'padding' on both platforms, not undefined on Android. targetSdkVersion
    // 35 puts the app in Android 15's enforced edge-to-edge mode, where the
    // window no longer resizes for the keyboard — so softwareKeyboardLayoutMode
    // "resize" in app.json stops having any effect, and an undefined behavior
    // meant no avoidance at all.
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      className="bg-paper"
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1, backgroundColor: C.paper }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 bg-paper">
          <AuthHeader title="Create your account" sub="Notes, placements, contests and the people already doing it." />
          <View style={{ paddingBottom: bottomInset }}>

          <View className="px-gutter">
            <View style={{ gap: 16 }}>
              <FormField label="Email" placeholder="you@college.ac.in"
                value={email} onChangeText={(v) => { setEmail(v); resetOtp(); }}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <FormField label="Username" placeholder="naimish"
                value={username} onChangeText={(v) => { setUsername(v); resetOtp(); }}
                autoCapitalize="none" autoComplete="username" />
              <FormField label="Phone number" placeholder="+91 98765 43210"
                keyboardType="phone-pad" value={phoneNumber}
                onChangeText={(v) => { setPhoneNumber(v); resetOtp(); }} autoComplete="tel" />
              <FormField label="Password" placeholder="••••••••" secureTextEntry={!passwordVisible}
                value={password} onChangeText={setPassword} autoComplete="new-password"
                right={
                  <Pressable onPress={() => setPasswordVisible(!passwordVisible)} hitSlop={12}
                    accessibilityRole="button" className="active:opacity-85"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                    <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink3} />
                  </Pressable>
                } />

              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={agreeTerms ? C.accent : C.ink3}
                  accessibilityLabel="I agree to the Terms and Conditions" />
                <View className="flex-row flex-wrap flex-1">
                  <Text className="font-sans text-sm text-ink-2">I agree to the </Text>
                  <Pressable onPress={() => navigation.navigate('TermsAndCondition')} hitSlop={12} accessibilityRole="link" className="active:opacity-85">
                    <Text className="font-semibold text-sm text-accent-text">Terms &amp; Conditions</Text>
                  </Pressable>
                </View>
              </View>

              <Button
                variant="primary" block
                title={otpSent ? 'Verify and continue' : 'Send OTP'}
                onPress={otpSent ? verifyOtpAndProceed : sendOtpToEmail}
                loading={isLoading}
                disabled={!otpSent && !agreeTerms}
              />
            </View>

            {/* Step 2 appears in place rather than replacing the form, so the
                sequence — password first, then the code — stays visible. */}
            {otpSent && (
              <View className="mt-4">
                <FormField
                  label="Enter the code from your email"
                  hint="Step 2 of 2 · code sent"
                  style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center', fontFamily: 'SpaceGrotesk_700Bold' }}
                  placeholder="––––" placeholderTextColor={C.ink4}
                  keyboardType="number-pad" maxLength={6}
                  value={otp} onChangeText={setOtp} autoComplete="one-time-code" />
              </View>
            )}

            <View className="mt-5 flex-row justify-center items-center">
              <Text className="font-sans text-sm text-ink-2">Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Login')} hitSlop={12} accessibilityRole="button" className="active:opacity-85">
                <Text className="font-semibold text-sm text-accent-text">Log in</Text>
              </Pressable>
            </View>
          </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
