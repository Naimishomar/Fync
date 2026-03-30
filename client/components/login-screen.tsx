import React, { useState, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from 'context/auth.context';
import { useNavigation } from '@react-navigation/native';
//@ts-ignore
import loginImage from '../assets/loginImage.png';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePassword = useCallback(
    () => setPasswordVisible((prev) => !prev),
    []
  );

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
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
              source={{ uri: 'https://i.pinimg.com/736x/a2/05/60/a205602210656db27579657ba25f57a4.jpg' }}
              style={{ width: '100%', height: 450 }}
              className="rounded-2xl"
              resizeMode="cover"
            />
          </View>

          <View className="h-48" />
        </ScrollView>

        {/* Login Sheet */}
        <View
          className="absolute bottom-0 w-full"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-10">
              <Image source={require('../assets/Fync.jpg')} className="h-20 w-20 self-center rounded-full mb-4" resizeMode='cover' />
              <Text className="text-3xl font-bold mb-6">Login</Text>

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4 text-base"
                placeholder="Email or username"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View className="flex-row items-center rounded-xl border border-gray-300 px-4">
                <TextInput
                  className="flex-1 py-4 text-base"
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!passwordVisible}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={togglePassword}>
                  <Ionicons
                    name={passwordVisible ? 'eye-off' : 'eye'}
                    size={22}
                    color="#9CA3AF"
                  />
                </Pressable>
              </View>

              <Pressable className='items-end mb-6 mt-1' onPress={() => navigation.navigate('ForgotPassword', {
                email
              })}>
                <Text className='text-red-400'>Forgot Password?</Text>
              </Pressable>

              {isLoading ?
                <Pressable className="rounded-full bg-black py-4 items-center">
                  <ActivityIndicator size="small" color="#9CA3AF" />
                </Pressable>
                :
                <Pressable
                  className="rounded-full bg-black py-4 items-center"
                  onPress={handleSubmit}
                >
                  <Text className="text-white text-lg font-semibold">Login</Text>
                </Pressable>
              }

              <View className="mt-5 flex-row justify-center">
                <Text className="text-gray-600">Don’t have an account? </Text>
                <Pressable onPress={() => navigation.navigate('Signup')}>
                  <Text className="font-semibold text-black">Signup</Text>
                </Pressable>
              </View>

              <View className="mt-2 border-t border-gray-100 pt-3">
                 <Text className="text-center text-gray-500 mb-3">Are you an Alumni?</Text>
                 <Pressable 
                  className="rounded-full border border-black py-3 items-center"
                  onPress={() => navigation.navigate('AlumniSignup')}
                 >
                    <Text className="text-black font-semibold">Join as Alumni</Text>
                 </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>

      </View>
    </TouchableWithoutFeedback>
  );
}
