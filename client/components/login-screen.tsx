import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import Checkbox from 'expo-checkbox';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const navigation = useNavigation<LoginScreenNavigationProp>();

  return (
    <View className="flex-1 justify-center bg-white px-8">
      <View className="h-20" />

      <Image
        source={require('../assets/logo.png')}
        className="mb-10 h-14 w-28 self-center"
        resizeMode="contain"
      />
      <TextInput
        className="mb-4 w-full rounded-lg border border-gray-300 p-4 text-base"
        placeholder="Username, phone number or email"
        placeholderTextColor="#A1A1A1"
      />

      <View className="mb-3 w-full flex-row items-center rounded-lg border border-gray-300 p-4">
        <TextInput
          className="flex-1"
          placeholder="Password"
          placeholderTextColor="#A1A1A1"
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#A1A1A1" />
        </TouchableOpacity>
      </View>

      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Checkbox
            value={rememberMe}
            onValueChange={setRememberMe}
            color={rememberMe ? '#000' : undefined}
          />
          <Text className="ml-2 text-gray-700">Remember Me</Text>
        </View>

        <TouchableOpacity>
          <Text className="font-medium text-gray-700">Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity className="mt-2 items-center rounded-lg bg-black py-4">
        <Text className="text-base font-semibold text-white">Log in</Text>
      </TouchableOpacity>

      <View className="my-7 flex-row items-center">
        <View className="h-px flex-1 bg-gray-300" />
        <Text className="mx-3 text-gray-500">OR</Text>
        <View className="h-px flex-1 bg-gray-300" />
      </View>

      <TouchableOpacity className="flex-row items-center justify-center rounded-full border border-black py-3">
        <AntDesign name="google" size={20} color="black" />
        <Text className="ml-3 text-base font-medium">Log in with Google</Text>
      </TouchableOpacity>

      <View className="mt-6 flex-row justify-center">
        <Text className="text-gray-600">Don’t have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text className="font-semibold text-black">SignUp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
