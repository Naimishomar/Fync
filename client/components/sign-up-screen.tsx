import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
// @ts-ignore
import axios from '../context/axiosConfig';

export default function SignUpScreen() {
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sendOtpToEmail = async () => {
    if (!email || !username || !phoneNumber || !password) {
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
        email,
        username,
        mobileNumber: phoneNumber,
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
    try {
      setIsLoading(true);
      const res = await axios.post('/user/verify-email-otp', {
        email,
        otp,
      });

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'OTP Verified',
        });

        navigation.navigate('ProfileSetup1', {
          email,
          username,
          phoneNumber,
          password,
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }} 
        scrollEnabled={false} 
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 bg-paper">

          <View className="px-gutter pt-14 pb-2">
            <Text className="font-display text-5xl text-ink uppercase" style={{ letterSpacing: -1.6 }}>Fync</Text>
            <Text className="font-sans text-base text-ink-2 mt-3">Join the exclusive student network</Text>
          </View>

          <View className="px-gutter mt-5 pb-10">
            <View className="relative">
              <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
              <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Email</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput className="font-sans text-base text-ink" placeholder="you@college.ac.in"
                    placeholderTextColor="#8B857E" value={email} onChangeText={setEmail}
                    keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Username</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput className="font-sans text-base text-ink" placeholder="naimish"
                    placeholderTextColor="#8B857E" value={username} onChangeText={setUsername}
                    autoCapitalize="none" autoComplete="username" />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Phone Number</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput className="font-sans text-base text-ink" placeholder="+91 98765 43210"
                    placeholderTextColor="#8B857E" keyboardType="phone-pad" value={phoneNumber}
                    onChangeText={setPhoneNumber} autoComplete="tel" />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Password</Text>
                <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                  <TextInput className="flex-1 font-sans text-base text-ink" placeholder="••••••••"
                    placeholderTextColor="#8B857E" secureTextEntry={!passwordVisible}
                    value={password} onChangeText={setPassword} autoComplete="new-password" />
                  <Pressable onPress={() => setPasswordVisible(!passwordVisible)} hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                    <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#8B857E" />
                  </Pressable>
                </View>

                <View className="flex-row items-center mt-4" style={{ gap: 12 }}>
                  <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color="#12100E" />
                  <View className="flex-row flex-wrap flex-1">
                    <Text className="font-sans text-sm text-ink-2">I agree to the </Text>
                    <Pressable onPress={() => navigation.navigate('TermsAndCondition')} hitSlop={8}>
                      <Text className="font-semibold text-sm text-ink">Terms &amp; Conditions</Text>
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  className={`mt-4 rounded-xl border-2 border-ink items-center justify-center ${isLoading || !agreeTerms ? 'bg-paper-2' : 'bg-brand-500'}`}
                  style={{ minHeight: 48 }}
                  onPress={otpSent ? verifyOtpAndProceed : sendOtpToEmail}
                  disabled={isLoading || (!otpSent && !agreeTerms)}
                  accessibilityRole="button"
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color="#12100E" />
                    : <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>
                        {otpSent ? 'Verify & Continue' : 'Send OTP'}
                      </Text>}
                </Pressable>
              </View>
            </View>

            {/* Step 2 appears in place rather than replacing the form, so the
                sequence — password first, then the code — stays visible. */}
            {otpSent && (
              <>
                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                  <Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>Step 2</Text>
                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                  <Text className="font-display text-label text-ink-3">SENT</Text>
                </View>

                <View className="bg-card border border-line rounded-card p-card-pad">
                  <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>
                    Enter OTP (Check your email)
                  </Text>
                  <View className="mt-3 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 56, justifyContent: 'center' }}>
                    <TextInput
                      className="font-display text-ink"
                      style={{ fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
                      placeholder="––––" placeholderTextColor="#C4BEB6"
                      keyboardType="number-pad" maxLength={6}
                      value={otp} onChangeText={setOtp} autoComplete="one-time-code" />
                  </View>
                </View>
              </>
            )}

            <View className="mt-5 flex-row justify-center items-center">
              <Text className="font-sans text-sm text-ink-2">Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
                <Text className="font-semibold text-sm text-ink">Login</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
