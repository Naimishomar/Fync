import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import Checkbox from 'expo-checkbox';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import Toast from 'react-native-toast-message';

type SignupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Signup'>;

export default function SignUpScreen() {
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const navigation = useNavigation<any>();

  const sendOtpToEmail = async () => {
    if (!email || !username || !phoneNumber || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'All fiels are required',
      });
      return;
    }

    const res = await fetch('http://192.168.28.164:3000/user/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username }),
    });

    const data = await res.json();

    if (data.success) {
      setOtpSent(true);
      Toast.show({
        type: 'success',
        text1: 'OTP Sent!',
        text2: 'Check your email',
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: data.message,
      });
    }
  };

  return (
    <View className="flex-1 justify-center bg-transparent px-8">
      <View className="h-16" />

      <Image
        source={require('../assets/logo.png')}
        className="mb-5 h-14 w-28 self-center"
        resizeMode="contain"
      />

      <View className="flex-col gap-3">
        <TextInput
          className="w-full rounded-lg border border-white p-4 text-base text-pink-300"
          placeholder="Email id"
          placeholderTextColor="#A1A1A1"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="w-full rounded-lg border border-white p-4 text-base text-pink-300"
          placeholder="Username"
          placeholderTextColor="#A1A1A1"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          className="w-full rounded-lg border border-white p-4 text-base text-pink-300"
          placeholder="Phone Number"
          placeholderTextColor="#A1A1A1"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
        <View className="w-full flex-row items-center rounded-lg border border-white px-3 py-1">
          <TextInput
            className="flex-1 text-pink-300"
            placeholder="Password"
            placeholderTextColor="#A1A1A1"
            secureTextEntry={!showConfirmPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#A1A1A1" />
          </TouchableOpacity>
        </View>
        {otpSent && (
          <TextInput
            className="w-full rounded-lg border border-white p-4 text-base text-pink-300"
            placeholder="Enter your OTP"
            placeholderTextColor="#A1A1A1"
            value={otp}
            onChangeText={setOtp}
          />
        )}
        <View className="mb-5 flex-row items-center">
          <Checkbox
            value={agreeTerms}
            onValueChange={setAgreeTerms}
            color={agreeTerms ? '#fbb6ce' : undefined}
          />
          <Text className="ml-2 text-white">I agree to the Terms & Conditions</Text>
        </View>
      </View>

      {!otpSent ? (
        <TouchableOpacity
          className="items-center rounded-lg bg-pink-300 py-4"
          onPress={sendOtpToEmail}>
          <Text className="text-base font-semibold text-white">Send OTP</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          className="items-center rounded-lg bg-pink-300 py-4"
          onPress={() =>
            navigation.navigate('ProfileSetup1', { email, username, phoneNumber, password, otp })
          }>
          <Text className="text-base font-semibold text-white">Sign Up</Text>
        </TouchableOpacity>
      )}

      <View className="my-7 flex-row items-center">
        <View className="h-px flex-1 bg-white" />
        <Text className="mx-3 text-white">OR</Text>
        <View className="h-px flex-1 bg-white" />
      </View>

      <TouchableOpacity className="flex-row items-center justify-center rounded-full border border-white py-3">
        <AntDesign name="google" size={20} color="white" />
        <Text className="ml-3 text-base font-medium text-white">Sign up with Google</Text>
      </TouchableOpacity>

      <View className="mt-6 flex-row justify-center">
        <Text className="text-white">Already have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text className="font-semibold text-white underline">Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
