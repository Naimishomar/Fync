import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import AuthPoster from './ui/AuthPoster';
import { C } from '../constants/colors';
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
              className="bg-paper rounded-t-sheet px-6"
              style={{ marginTop: -22, paddingTop: 8, paddingBottom: bottomInset }}
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

              <Text className="font-display text-ink text-center mt-4" style={{ fontSize: 22 }}>Join as a recruiter</Text>
              <Text className="font-sans text-ink-2 text-center mt-2 mb-6" style={{ fontSize: 13 }}>
                Hire top talent and host internships.
              </Text>

              {!otpSent ? (
                <>
                  {/* The stamped card from the login screen: an offset ink
                      layer behind a bordered white card, with each field
                      labelled above its own bordered row. Bare inputs stacked
                      on paper read as a different product. */}
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

                      <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Username</Text>
                      <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                        <TextInput
                          className="flex-1 font-sans text-base text-ink"
                          placeholderTextColor={C.ink3}
                          placeholder="How you appear to students"
                          value={username}
                          onChangeText={setUsername}
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

                  <View className="mb-6 flex-row items-center px-2">
                    <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color={C.ink} />
                    <Text className="ml-3 text-ink-2 font-medium text-xs flex-1">
                      I agree to the Recruiter Terms & Conditions
                    </Text>
                  </View>

                  <Pressable
                    className={`rounded-full py-4 items-center ${isLoading || !agreeTerms ? 'bg-paper-2' : 'bg-ink'}`}
                    onPress={sendOtpToWorkEmail}
                    disabled={isLoading || !agreeTerms}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={C.ink} />
                    ) : (
                      <Text className="text-paper text-base font-semibold">Request Access</Text>
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
                      <Text className="text-on-brand text-base font-semibold">Verify OTP</Text>
                    )}
                  </Pressable>

                  <View className="flex-row justify-between w-full mt-4 px-4">
                    <Pressable className="items-center py-2" onPress={() => setOtpSent(false)}>
                      <Text className="text-ink-3 font-semibold">Back to details</Text>
                    </Pressable>
                    <Pressable className="items-center py-2" onPress={sendOtpToWorkEmail} disabled={isLoading}>
                      <Text className="text-recruiter font-semibold">Resend OTP</Text>
                    </Pressable>
                  </View>
                </>
              )}

              <View className="mt-6 flex-row justify-center items-center">
                <Text className="text-ink-3 font-medium">Already recruiting with us? </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text className="font-semibold text-ink border-b border-ink">Log in</Text>
                </Pressable>
              </View>
              <Text className="font-sans text-sm mt-6 text-center text-ink-2">Step 1 of 2</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
