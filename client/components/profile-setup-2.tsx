import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth } from 'context/auth.context';
//@ts-ignore
import loginImage from '../assets/loginImage.png';
import axios from '../context/axiosConfig';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";



type ProfileSetup2NavigationProp =
  NativeStackNavigationProp<RootStackParamList, 'ProfileSetup2'>;
type ProfileSetup2RouteProp =
  RouteProp<RootStackParamList, 'ProfileSetup2'>;

export default function ProfileSetup2() {
  const route = useRoute<ProfileSetup2RouteProp>();
  const navigation = useNavigation<ProfileSetup2NavigationProp>();
  const { login } = useAuth();

  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const submitRegistration = async () => {
    try {
      setIsLoading(true);
      const formData = new FormData();

      formData.append('email', route.params.email);
      formData.append('username', route.params.username);
      formData.append('mobileNumber', route.params.phoneNumber);
      formData.append('password', route.params.password);

      let deviceId = await AsyncStorage.getItem("deviceId");
      if (!deviceId) {
        deviceId = "device_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await AsyncStorage.setItem("deviceId", deviceId);
      }
      formData.append('deviceId', deviceId);
      formData.append('deviceModel', Device.modelName || "Unknown Device");

      formData.append('name', route.params.fullName);


      formData.append('dob', route.params.birthday);
      formData.append('college', route.params.college);
      formData.append('year', route.params.year);
      formData.append('gender', route.params.gender);
      formData.append('major', route.params.major);

      if (profileImageUri) {
        const filename = profileImageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('avatar', {
          uri: profileImageUri,
          name: filename || 'avatar.jpg',
          type: type,
        } as any);
      }
      const res = await axios.post('/user/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Registered successfully',
        });
        await login(route.params.email, route.params.password);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed',
          text2: res.data.message || 'Registration failed',
        });
      }
    } catch (error: any) {
      console.error("Registration Error", error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.response?.data?.message || 'Something went wrong',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View className="flex-1 bg-paper">
          {/* Background */}
          <View className="flex-1 p-4">
            <Image
              source={loginImage}
              className="h-full w-full rounded-card"
              resizeMode="cover"
            />
          </View>

          {/* Bottom Sheet */}
          <View className="rounded-t-sheet bg-paper px-6 pt-8 pb-16">
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="font-display mb-6 text-center text-h1">
                Profile Setup
              </Text>

              {/* Avatar */}
              <View className="items-center mb-8">
                <Pressable
                  onPress={handleUploadProfilePic}
                  className="h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-paper-2 border-2 border-dashed border-ink-4"
                >
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="camera-outline" size={36} color="#8B857E" />
                  )}
                </Pressable>
                <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>Upload Profile Photo</Text>
              </View>

              {/* Continue */}
              {isLoading ? (
                <Pressable className="bg-brand-500 items-center justify-center mb-4 border-2 border-ink rounded-md" style={{ minHeight: 48 }}>
                  <ActivityIndicator size="small" color="#12100E" />
                </Pressable>
              ) : (
                <Pressable
                  className="bg-brand-500 items-center justify-center mb-4 border-2 border-ink rounded-md"
                  style={{ minHeight: 48 }}
                  onPress={submitRegistration}
                  accessibilityRole="button"
                >
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>
                    Continue
                  </Text>
                </Pressable>
              )}

              {/* Skip */}
              {isLoading ? (
                <Pressable className="rounded-full border border-line py-4 items-center">
                  <ActivityIndicator size="small" color="#8B857E" />
                </Pressable>
              ) : (
                <Pressable
                  className="rounded-full border border-line py-4 items-center"
                  onPress={submitRegistration}
                >
                  <Text className="text-ink-2 text-lg font-semibold">
                    Skip for now
                  </Text>
                </Pressable>
              )}

              <Text className="mt-5 text-center text-ink-3">
                Step 2 of 2
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
