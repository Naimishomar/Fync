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
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
// @ts-ignore
import loginImage from '../assets/loginImage.png';

export default function AlumniSignup() {
  const navigation = useNavigation<any>();

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
      <View className="flex-1 bg-[#F3F4F6]">
        <ScrollView
          contentContainerStyle={{ padding: 0 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={{ uri: 'https://i.pinimg.com/1200x/14/84/57/1484572a0fbeab4c170c7a5b9da9fed8.jpg' }}
            style={{ width: '100%', height: 580 }}
            resizeMode="cover"
          />
          <View className="h-56" />
        </ScrollView>

        <View className="absolute bottom-0 w-full">
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-12">
              <Image source={require('../assets/Fync.png')} className="h-20 w-20 self-center rounded-full mb-4" resizeMode='cover' />
              <Text className="text-gray-500 mb-2">Join the exclusive professional network</Text>

              {!otpSent ? (
                <>
                  <TextInput
                    className="mb-4 rounded-xl border border-gray-300 px-4 py-4 text-black"
                    placeholder="Work Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <TextInput
                    className="mb-4 rounded-xl border border-gray-300 px-4 py-4 text-black"
                    placeholder="Mobile Number"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                  />

                  <View className="mb-6 flex-row items-center">
                    <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} />
                    <Text className="ml-2 text-gray-600">
                      I agree to the Terms & Conditions
                    </Text>
                  </View>

                  <Pressable
                    className="rounded-full bg-black py-4 items-center"
                    onPress={sendOtpToWorkEmail}
                    disabled={isLoading || !agreeTerms}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white text-lg font-semibold">Send OTP</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text className="text-gray-600 mb-4">We've sent an OTP to {email}</Text>
                  <TextInput
                    className="mb-6 rounded-xl border border-gray-300 px-4 py-4 text-black"
                    placeholder="Enter OTP"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                  />

                  <Pressable
                    className="rounded-full bg-black py-4 items-center"
                    onPress={verifyOtpAndProceed}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white text-lg font-semibold">Verify & Continue</Text>
                    )}
                  </Pressable>

                  <Pressable className="mt-4 items-center" onPress={() => setOtpSent(false)}>
                    <Text className="text-gray-500">Back to details</Text>
                  </Pressable>
                </>
              )}

              <View className="mt-3 flex-row justify-center">
                <Text className="text-gray-600">Already have an account? </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text className="font-semibold text-black">Login</Text>
                </Pressable>
              </View>
              <Text className="mt-5 text-center text-gray-500">Step 1 of 3</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
