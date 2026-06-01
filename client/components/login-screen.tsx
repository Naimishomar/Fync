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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';


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
      <KeyboardAvoidingView 
        behavior="padding"
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-white">
          {/* Background Feed */}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="">
              <Image
                source={{ uri: 'https://i.pinimg.com/1200x/d8/39/f1/d839f11ee984f4a725af419b6237af35.jpg' }}
                style={{ width: '100%', height: 400 }}
                resizeMode="cover"
              />
            </View>

            {/* Login Sheet */}
            <View className="flex-1 rounded-t-[50px] bg-white px-6 pt-8 pb-7 -mt-10">
              <Image source={require('../assets/Fync.png')} className="h-20 w-20 self-center rounded-full mb-4" resizeMode='cover' />
              <Text className="text-gray-500 mb-2">Login to the exclusive student network</Text>

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4 text-base text-black"
                placeholder="Email or username"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View className="flex-row items-center rounded-xl border border-gray-300 px-4">
                <TextInput
                  className="flex-1 py-4 text-base text-black"
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

              <View className="mt-4 border-t border-gray-50 pt-4">
                 <Text className="text-center text-gray-500 mb-3 text-xs uppercase tracking-widest font-bold">Other ways to join</Text>
                 <View className="flex-row gap-3">
                    <Pressable 
                      className="flex-1 rounded-xl border border-black py-3 items-center"
                      onPress={() => navigation.navigate('AlumniSignup')}
                    >
                        <Text className="text-black font-semibold">Join as Alumni</Text>
                    </Pressable>
                    <Pressable 
                      className="flex-1 rounded-xl border border-black bg-black py-3 items-center"
                      onPress={() => navigation.navigate('RecruiterSignup')}
                    >
                        <Text className="text-white font-semibold">Join as Recruiter</Text>
                    </Pressable>
                 </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
