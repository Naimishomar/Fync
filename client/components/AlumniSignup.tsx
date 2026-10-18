import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
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
              className="bg-paper rounded-t-sheet px-6"
              style={{ marginTop: -22, paddingTop: 8, paddingBottom: 16 + insets.bottom }}
            >
              <View style={{ width: 72, height: 72, alignSelf: 'center', marginTop: 18 }}>
                <View
                  pointerEvents="none"
                  className="absolute bg-ink rounded-full"
                  style={{ left: 4, top: 4, width: 72, height: 72 }}
                />
                <Image
                  source={require('../assets/fync-logo.jpg')}
                  style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: C.ink }}
                  resizeMode="cover"
                  accessibilityLabel="Fync"
                />
              </View>

              <Text className="font-display text-ink text-center mt-4" style={{ fontSize: 22 }}>Join as alumni</Text>
              <Text className="font-sans text-ink-2 text-center mt-2 mb-6" style={{ fontSize: 13 }}>
                Mentor the juniors who are where you were.
              </Text>

              {!otpSent ? (
                <>
                  {/* Same stamped card as login and recruiter. */}
                  <View className="relative mb-6">
                    <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
                    <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                      <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Work email</Text>
                      <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                        <TextInput
                          className="flex-1 font-sans text-base text-ink"
                          placeholderTextColor={C.ink3}
                          placeholder="you@company.com"
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </View>

                      <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Mobile number</Text>
                      <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                        <TextInput
                          className="flex-1 font-sans text-base text-ink"
                          placeholderTextColor={C.ink3}
                          placeholder="10-digit number"
                          keyboardType="phone-pad"
                          value={phoneNumber}
                          onChangeText={setPhoneNumber}
                        />
                      </View>
                    </View>
                  </View>

                  <View className="mb-6 flex-row items-center">
                    <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={C.ink} />
                    <Text className="ml-2 text-ink-2">
                      I agree to the Terms & Conditions
                    </Text>
                  </View>

                  <Pressable
                    className="bg-brand-500 py-4 items-center justify-center border-2 border-ink rounded-xl"
                    style={{ minHeight: 52, opacity: !agreeTerms ? 0.5 : 1 }}
                    onPress={sendOtpToWorkEmail}
                    disabled={isLoading || !agreeTerms}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={C.onBrand} />
                    ) : (
                      <Text className="font-display text-on-brand uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Send OTP</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <View className="relative mb-6">
                    <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
                    <View className="bg-card border-2 border-ink rounded-card p-card-pad">
                      <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Verification code</Text>
                      <Text className="font-sans text-ink-2 mt-1" style={{ fontSize: 12 }}>Sent to {email || 'your inbox'}</Text>
                      <View className="mt-3 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 54, justifyContent: 'center' }}>
                        <TextInput
                          className="font-display text-lg text-ink text-center"
                          placeholderTextColor={C.ink3}
                          placeholder="6-digit code"
                          value={otp}
                          onChangeText={setOtp}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                      </View>
                    </View>
                  </View>

                  <Pressable
                    className="bg-brand-500 py-4 items-center justify-center border-2 border-ink rounded-xl"
                    style={{ minHeight: 52 }}
                    onPress={verifyOtpAndProceed}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={C.onBrand} />
                    ) : (
                      <Text className="font-display text-on-brand uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Verify & Continue</Text>
                    )}
                  </Pressable>

                  <Pressable className="mt-4 items-center" onPress={() => setOtpSent(false)}>
                    <Text className="text-ink-3">Back to details</Text>
                  </Pressable>
                </>
              )}

              <View className="mt-3 flex-row justify-center">
                <Text className="text-ink-2">Already have an account? </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text className="font-semibold text-ink">Login</Text>
                </Pressable>
              </View>
              <Text className="mt-5 text-center text-ink-2">Step 1 of 3</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
