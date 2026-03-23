import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Checkbox from 'expo-checkbox';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
// @ts-ignore
import loginImage from '../assets/loginImage.png';
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
          text1: 'OTP Sent',
          text2: 'Check your email',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed',
          text2: res.data.message,
        });
      }
    } catch (error: any) {
      console.error("Send OTP Error", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Failed to send OTP',
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
      console.error("Verify OTP Error", error);
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#F3F4F6]">
        {/* Background */}
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={{ uri: 'https://i.pinimg.com/736x/a2/05/60/a205602210656db27579657ba25f57a4.jpg' }}
            style={{ width: '100%', height: 450 }}
            className="rounded-2xl"
            resizeMode="cover"
          />
          <View className="h-56" />
        </ScrollView>

        {/* Signup Sheet */}
        <View
          className="absolute bottom-0 w-full"
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-16">
              <Image source={require('../assets/logo.png')} className="h-14 w-28 self-center" style={{ tintColor: '#000' }} resizeMode='cover' />
              <Text className="text-3xl font-bold mb-6">Sign Up</Text>

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
              />

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
                placeholder="Phone Number"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />

              <View className="mb-4 flex-row items-center rounded-xl border border-gray-300 px-4">
                <TextInput
                  className="flex-1 py-4"
                  placeholder="Password"
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setPasswordVisible(!passwordVisible)}>
                  <Ionicons
                    name={passwordVisible ? 'eye-off' : 'eye'}
                    size={22}
                    color="#9CA3AF"
                  />
                </Pressable>
              </View>

              {otpSent && (
                <TextInput
                  className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
                  placeholder="Enter OTP"
                  value={otp}
                  onChangeText={setOtp}
                />
              )}

              <View className="mb-6 flex-row items-center">
                <Checkbox value={agreeTerms} onValueChange={setAgreeTerms} />
                <Text className="ml-2 text-gray-600">
                  I agree to the Terms & Conditions
                </Text>
              </View>

              {!otpSent ? (
                <Pressable
                  className={`rounded-full py-4 items-center ${isLoading || !agreeTerms ? 'bg-gray-400' : 'bg-black'}`}
                  onPress={sendOtpToEmail}
                  disabled={isLoading || !agreeTerms}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white text-lg font-semibold">
                      Send OTP
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  className={`rounded-full py-4 items-center ${isLoading ? 'bg-gray-400' : 'bg-black'}`}
                  onPress={verifyOtpAndProceed}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white text-lg font-semibold">
                      Verify & Continue
                    </Text>
                  )}
                </Pressable>
              )}

              <View className="mt-6 flex-row justify-center">
                <Text className="text-gray-600">Already have an account? </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text className="font-semibold text-black">Login</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
