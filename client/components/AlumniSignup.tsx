import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Checkbox from 'expo-checkbox';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
// @ts-ignore
import loginImage from '../assets/loginImage.png';
import AuthPoster from './ui/AuthPoster';
import { C } from '../constants/colors';
import { Button, FormField } from './ui/kit';

export default function AlumniSignup() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sendOtpToWorkEmail = async () => {
    if (!email || !phoneNumber) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Email and Mobile number are required',
      });
      return;
    }

    try {
      setIsLoading(true);
      const res = await axios.post('/user/send-alumni-otp', {
        email,
        username: email.split('@')[0], // Placeholder username for OTP purpose
      });

      if (res.data.success) {
        setOtpSent(true);
        Toast.show({
          type: 'success',
          text1: 'OTP Sent',
          text2: res.data.message || 'Check your work email for OTP',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'info',
        text1: 'Already Registered',
        text2: error.response?.data?.message || 'This account migth already exist.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtpAndProceed = async () => {
    try {
      setIsLoading(true);
      const res = await axios.post('/user/verify-alumni-otp', {
        email,
        otp,
      });

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Email Verified',
        });

        navigation.navigate('AlumniProfileSetup', {
          email,
          phoneNumber,
          // Proof of the verified email; /user/register-alumni requires it.
          verificationToken: res.data.verificationToken,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.response?.data?.message || 'Invalid OTP',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      {/* Same shell as the other auth screens. This one had no
          KeyboardAvoidingView at all, and its form sat in an absolutely
          positioned View wrapping an unbounded ScrollView — so it could not
          scroll and the keyboard simply covered the fields. */}
      <KeyboardAvoidingView
        // Android already resizes the window for the keyboard; padding on top of that doubled the shift.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        className="bg-paper"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, backgroundColor: C.paper }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 bg-night">

            <AuthPoster mode="alumni" grow />

            <View
              className="bg-paper rounded-t-sheet px-gutter"
              style={{ marginTop: -22, paddingTop: 8, paddingBottom: 16 + insets.bottom }}
            >
              <Image
                source={require('../assets/fync-logo.jpg')}
                style={{ width: 72, height: 72, borderRadius: 36, alignSelf: 'center', marginTop: 16 }}
                resizeMode="cover"
                accessibilityLabel="Fync"
              />

              <Text className="font-display text-ink text-center mt-4" style={{ fontSize: 22 }} accessibilityRole="header">Join as alumni</Text>
              <Text className="font-sans text-sm text-ink-2 text-center mt-2 mb-6">
                Mentor the juniors who are where you were.
              </Text>

              {!otpSent ? (
                <>
                  <View className="bg-card border border-line rounded-2xl p-4 mb-4" style={{ gap: 16 }}>
                    <FormField label="Work email" placeholder="you@company.com" value={email} onChangeText={setEmail}
                      keyboardType="email-address" autoCapitalize="none" />
                    <FormField label="Mobile number" placeholder="10-digit number" keyboardType="phone-pad"
                      value={phoneNumber} onChangeText={setPhoneNumber} />
                  </View>

                  <View className="mb-6 flex-row items-center" style={{ gap: 12 }}>
                    <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={agreeTerms ? C.accent : C.ink3}
                      accessibilityLabel="I agree to the Terms and Conditions" />
                    <Text className="flex-1 text-sm text-ink-2">I agree to the Terms & Conditions</Text>
                  </View>

                  <Button variant="primary" block title="Send OTP" onPress={sendOtpToWorkEmail}
                    loading={isLoading} disabled={!agreeTerms} />
                </>
              ) : (
                <>
                  <View className="bg-card border border-line rounded-2xl p-4 mb-6">
                    <FormField
                      label="Verification code"
                      hint={`Sent to ${email || 'your inbox'}`}
                      style={{ textAlign: 'center', fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold' }}
                      placeholder="6-digit code"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  <Button variant="primary" block title="Verify and continue" onPress={verifyOtpAndProceed} loading={isLoading} />

                  <Pressable className="mt-4 self-center active:opacity-85" hitSlop={12} accessibilityRole="button" onPress={() => setOtpSent(false)}>
                    <Text className="text-sm font-semibold text-ink-2">Back to details</Text>
                  </Pressable>
                </>
              )}

              <View className="mt-4 flex-row justify-center items-center">
                <Text className="text-sm text-ink-2">Already have an account? </Text>
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={12} accessibilityRole="button" className="active:opacity-85">
                  <Text className="text-sm font-semibold text-accent-text">Log in</Text>
                </Pressable>
              </View>
              <Text className="mt-5 text-center text-sm text-ink-3">Step 1 of 3</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
