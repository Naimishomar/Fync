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
} from 'react-native';
import Checkbox from 'expo-checkbox';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';

export default function RecruiterSignup() {
  const navigation = useNavigation<any>();

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
      <View className="flex-1 bg-paper">
        <ScrollView
          contentContainerStyle={{ padding: 0 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={{ uri: 'https://i.pinimg.com/1200x/d8/39/f1/d839f11ee984f4a725af419b6237af35.jpg' }}
            style={{ width: '100%', height: 600 }}
            resizeMode="cover"
          />
          <View className="h-96" />
        </ScrollView>

        <View className="absolute bottom-0 w-full">
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="rounded-t-sheet bg-paper px-6 pt-6 pb-8 border-t border-line">
              <View className="h-1 w-12 bg-paper-2 rounded-full self-center mb-6" />
              <Text className="font-display text-ink mb-1 text-h1">Join as a Recruiter</Text>
              <Text className="text-ink-3 mb-6 text-sm font-medium">Hire top talent and host internships.</Text>

              {!otpSent ? (
                <>
                  <TextInput
                    className="mb-4 bg-card border-[1.5px] border-ink px-4 py-4 font-medium text-ink rounded-md"
                    placeholder="Work Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  
                  <TextInput
                    className="mb-4 bg-card border-[1.5px] border-ink px-4 py-4 font-medium text-ink rounded-md"
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                  />

                  <TextInput
                    className="mb-4 bg-card border-[1.5px] border-ink px-4 py-4 font-medium text-ink rounded-md"
                    placeholder="Mobile Number"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />

                  <View className="mb-6 flex-row items-center px-2">
                    <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} color="#12100E" />
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
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white text-base font-semibold">Request Access</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="text-ink-2 mb-4 font-medium">We've sent an OTP to your email inbox</Text>
                  <TextInput
                    className="mb-6 bg-card border-[1.5px] border-ink px-4 py-4 text-center font-display text-lg text-ink rounded-md"
                    placeholder="Enter OTP"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <Pressable
                    className="bg-brand-500 py-4 items-center border-2 border-ink rounded-md"
                    onPress={verifyOtpAndProceed}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#12100E" />
                    ) : (
                      <Text className="text-ink text-base font-semibold">Verify OTP</Text>
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
              <Text className="font-sans text-sm mt-6 text-center text-ink-3">Step 1 of 2</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
