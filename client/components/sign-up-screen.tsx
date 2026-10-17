import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
// @ts-ignore
import axios from '../context/axiosConfig';
import AuthPoster from './ui/AuthPoster';
import { C } from '../constants/colors';
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
    if (!otp.trim()) {
      Toast.show({ type: 'error', text1: 'Enter the OTP from your email' });
      return;
    }
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
        contentContainerStyle={{ flexGrow: 1, backgroundColor: '#F5F2EC' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 bg-ink">

          <AuthPoster mode="signup" grow />

          {/* The paper sheet. Rounded at the top and pulled up over the
              masthead so the content curves away from it, rather than the two
              meeting on a hard horizontal seam. */}
          <View
            className="bg-paper rounded-t-sheet"
            style={{ marginTop: -22, paddingTop: 8, paddingBottom: bottomInset }}
          >

          <View className="px-gutter pt-6 pb-2">
            {/* The logo carries its own stamp: an ink circle offset down and
                right behind it, which is the same device the cards on this
                screen use. It sits behind in source order so it renders under
                the mark without needing zIndex. */}
            <View style={{ width: 72, height: 72, alignSelf: 'center' }}>
              <View
                pointerEvents="none"
                className="absolute bg-ink rounded-full"
                style={{ left: 4, top: 4, width: 72, height: 72 }}
              />
              <Image
                source={require('../assets/fync-logo.jpg')}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: '#12100E',
                }}
                resizeMode="cover"
                accessibilityLabel="Fync"
              />
            </View>
          </View>

          <View className="px-gutter mt-5">
            <View className="relative">
              <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
              <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Email</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput className="font-sans text-base text-ink" placeholder="you@college.ac.in"
                    placeholderTextColor={C.ink3} value={email} onChangeText={setEmail}
                    keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Username</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput className="font-sans text-base text-ink" placeholder="naimish"
                    placeholderTextColor={C.ink3} value={username} onChangeText={setUsername}
                    autoCapitalize="none" autoComplete="username" />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Phone Number</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput className="font-sans text-base text-ink" placeholder="+91 98765 43210"
                    placeholderTextColor={C.ink3} keyboardType="phone-pad" value={phoneNumber}
                    onChangeText={setPhoneNumber} autoComplete="tel" />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Password</Text>
                <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                  <TextInput className="flex-1 font-sans text-base text-ink" placeholder="••••••••"
                    placeholderTextColor={C.ink3} secureTextEntry={!passwordVisible}
                    value={password} onChangeText={setPassword} autoComplete="new-password" />
                  <Pressable onPress={() => setPasswordVisible(!passwordVisible)} hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                    <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink3} />
                  </Pressable>
                </View>

                <View className="flex-row items-center mt-4" style={{ gap: 12 }}>
                  <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={C.ink} />
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
                    ? <ActivityIndicator size="small" color={C.ink} />
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
                      placeholder="––––" placeholderTextColor={C.ink4}
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
