import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from 'context/auth.context';
import { useNavigation } from '@react-navigation/native';
import loginImage from '../assets/loginImage.png';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  const togglePassword = useCallback(
    () => setPasswordVisible((prev) => !prev),
    []
  );

  const handleSubmit = async () => {
    try {
      await login(email, password);
      Toast.show({
        type: 'success',
        text1: 'Logged in successfully!',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: error?.response?.data?.message || 'Something went wrong',
      });
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#F3F4F6]">
        {/* Background Feed */}
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="">
            <Image
              source={loginImage}
              className="w-full min-h-full rounded-2xl"
              resizeMode='cover'
            />
          </View>

          <View className="h-48" />
        </ScrollView>

        {/* Login Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          className="absolute bottom-0 w-full"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-10">
              <Image source={require('../assets/logo.png')} className="h-14 w-28 self-center" style={{ tintColor: '#000' }} resizeMode='cover' />
              <Text className="text-3xl font-bold mb-6">Login</Text>

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4 text-base"
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View className="mb-6 flex-row items-center rounded-xl border border-gray-300 px-4">
                <TextInput
                  className="flex-1 py-4 text-base"
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={togglePassword}>
                  <Ionicons
                    name={passwordVisible ? 'eye-off' : 'eye'}
                    size={22}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                className="rounded-full bg-black py-4 items-center"
                onPress={handleSubmit}
              >
                <Text className="text-white text-lg font-semibold">Login</Text>
              </TouchableOpacity>

              <View className="mt-5 flex-row justify-center">
                <Text className="text-gray-600">Don’t have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text className="font-semibold text-black">Signup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

      </View>
    </TouchableWithoutFeedback>
  );
}
