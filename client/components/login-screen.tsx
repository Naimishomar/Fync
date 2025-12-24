import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import Checkbox from 'expo-checkbox';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuth } from 'context/auth.context';

export default function LoginScreen() {
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { login } = useAuth();

  const togglePassword = useCallback(() => setPasswordVisible((prev) => !prev), []);

  const handleSubmit = async () => {
    const res = await fetch('http://10.21.97.246:3000/user/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    const data = await res.json();
    if (data.success) {
      login(email, password);
      alert(data.success);
      Toast.show({
        type: 'success',
        text1: 'Logged in successfully!',
        text2: 'Home',
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
      <View className="h-20" />
      <Image
        source={require('../assets/logo.png')}
        className="mb-5 h-14 w-28 self-center"
        resizeMode="contain"
      />
      <View className="flex-col gap-3">
        <TextInput
          className="w-full rounded-lg border border-white px-3 py-4 text-base text-pink-300"
          placeholder="Username, phone number or email"
          placeholderTextColor="#A1A1A1"
          value={email}
          onChangeText={setEmail}
        />
        <View className="mb-2 w-full flex-row items-center rounded-lg border border-white px-3 py-1">
          <TextInput
            className="flex-1 text-pink-300"
            placeholder="Password"
            placeholderTextColor="#A1A1A1"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={togglePassword}>
            <Ionicons name={passwordVisible ? 'eye-off' : 'eye'} size={22} color="#A1A1A1" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mb-5 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Checkbox
            value={rememberMe}
            onValueChange={setRememberMe}
            color={rememberMe ? '#fbb6ce' : undefined}
          />
          <Text className="ml-2 text-white">Remember Me</Text>
        </View>

        <TouchableOpacity>
          <Text className="font-medium text-white">Forgot Password?</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        className="mt-2 items-center rounded-lg bg-pink-300 py-4"
        onPress={handleSubmit}>
        <Text className="text-base font-semibold text-white">Log in</Text>
      </TouchableOpacity>

      <View className="my-7 flex-row items-center justify-center">
        <View className="h-px flex-1 bg-white" />
        <Text className="mx-3 text-center text-white">OR</Text>
        <View className="h-px flex-1 bg-white" />
      </View>

      <TouchableOpacity className="flex-row items-center justify-center rounded-full border border-white py-3">
        <AntDesign name="google" size={20} color="white" />
        <Text className="ml-3 text-base font-medium text-white">Log in with Google</Text>
      </TouchableOpacity>

      <View className="mt-6 flex-row justify-center">
        <Text className="text-white">Don’t have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text className="font-semibold text-white underline">SignUp</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
