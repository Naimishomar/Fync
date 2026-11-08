import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import AuthPoster from './ui/AuthPoster';
import { C } from '../constants/colors';
import { Button, FormField } from './ui/kit';
import { useBottomInset } from '../constants/layout';

export default function RecruiterSignup() {
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();

  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sendOtpToWorkEmail = async () => {
    if (!email || !phoneNumber || !username) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Email, Username and Mobile number are required',
      });
      return;
    }

    try {
      setIsLoading(true);
      const res = await axios.post('/user/send-recruiter-otp', {
        email,
        username,
        mobileNumber: phoneNumber
      });

      if (res.data.success) {
        setOtpSent(true);
        Toast.show({
          type: 'success',
          text1: 'OTP Sent',
          text2: res.data.message || 'Check your work email for OTP',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: res.data.message,
        });
      }
    } catch (error: any) {
      const isDomainError = error.response?.data?.message?.includes('Public domains');
      Toast.show({
        type: isDomainError ? 'error' : 'info',
        text1: isDomainError ? 'Invalid Domain' : 'Registration Error',
        text2: error.response?.data?.message || 'Something went wrong',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtpAndProceed = async () => {
    if (!otp.trim()) {
      Toast.show({ type: 'error', text1: 'Enter the code from your email' });
      return;
    }
    try {
      setIsLoading(true);
      const res = await axios.post('/user/verify-recruiter-otp', {
        email,
        otp,
      });

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Email Verified',
        });

        navigation.navigate('RecruiterProfileSetup', {
          email,
          phoneNumber,
          username,
          // Proof of the verified email; /user/register-recruiter requires it.
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
      {/* One scrolling column, not a form pinned to the bottom.
          The form used to live in an absolutely positioned View with an inner
          ScrollView that had no bounded height — so it sized to its content,
          ran off the screen and could not scroll. The lower fields were
          unreachable, and the keyboard covered whatever was left. */}
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        className="bg-paper"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, backgroundColor: C.paper }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 bg-night">

            {/* The recruiter cut of the masthead. Same structure as the student
                screens, different pitch and audience colour — a recruiter has no
                use for "your campus, your craft". */}
            <AuthPoster mode="recruiter" grow />

            <View
              className="bg-paper rounded-t-sheet px-gutter"
              style={{ marginTop: -22, paddingTop: 8, paddingBottom: bottomInset }}
            >
              <Image
                source={require('../assets/fync-logo.jpg')}
                style={{ width: 72, height: 72, borderRadius: 36, alignSelf: 'center', marginTop: 16 }}
                resizeMode="cover"
                accessibilityLabel="Fync"
              />

              <Text className="font-display text-ink text-center mt-4" style={{ fontSize: 22 }} accessibilityRole="header">Join as a recruiter</Text>
              <Text className="font-sans text-sm text-ink-2 text-center mt-2 mb-6">
                Hire top talent and host internships.
              </Text>

              {!otpSent ? (
                <>
                  <View className="bg-card border border-line rounded-2xl p-4 mb-4" style={{ gap: 16 }}>
                    <FormField label="Work email" placeholder="you@company.com" value={email} onChangeText={setEmail}
                      keyboardType="email-address" autoCapitalize="none" />
                    <FormField label="Username" placeholder="How you appear to students" value={username}
                      onChangeText={setUsername} autoCapitalize="none" />
                    <FormField label="Mobile number" placeholder="10-digit number" keyboardType="phone-pad"
                      value={phoneNumber} onChangeText={setPhoneNumber} />
                  </View>

                  <View className="mb-6 flex-row items-center" style={{ gap: 12 }}>
                    <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={agreeTerms ? C.accent : C.ink3}
                      accessibilityLabel="I agree to the Recruiter Terms and Conditions" />
                    <Text className="text-sm text-ink-2 flex-1">I agree to the Recruiter Terms & Conditions</Text>
                  </View>

                  <Button variant="solid" block title="Request access" onPress={sendOtpToWorkEmail}
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

                  <Button variant="primary" block title="Verify OTP" onPress={verifyOtpAndProceed} loading={isLoading} />

                  <View className="flex-row justify-between mt-4">
                    <Pressable className="py-2 active:opacity-70" hitSlop={12} accessibilityRole="button" onPress={() => setOtpSent(false)}>
                      <Text className="text-sm text-ink-2 font-semibold">Back to details</Text>
                    </Pressable>
                    <Pressable className="py-2 active:opacity-70" hitSlop={12} accessibilityRole="button" onPress={sendOtpToWorkEmail} disabled={isLoading}>
                      <Text className="text-sm text-accent-text font-semibold">Resend OTP</Text>
                    </Pressable>
                  </View>
                </>
              )}

              <View className="mt-6 flex-row justify-center items-center">
                <Text className="text-sm text-ink-2">Already recruiting with us? </Text>
                <Pressable onPress={() => navigation.navigate('Login')} hitSlop={12} accessibilityRole="button" className="active:opacity-70">
                  <Text className="text-sm font-semibold text-accent-text">Log in</Text>
                </Pressable>
              </View>
              <Text className="font-sans text-sm mt-6 text-center text-ink-3">Step 1 of 2</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
