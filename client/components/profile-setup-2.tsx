import React, { useRef, useState } from 'react';
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
import { C } from '../constants/colors';
import { Button } from './ui/kit';



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
  // State updates are async; a quick double tap would otherwise register twice.
  const submittingRef = useRef(false);
  // Register succeeded but the follow-up login failed: a retry must only log
  // in, or /user/register answers "User already exists" and the user is stuck.
  const registeredRef = useRef(false);

  const handleUploadProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: Platform.OS === 'ios',
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const submitRegistration = async (withPhoto = true) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      setIsLoading(true);
      if (registeredRef.current) {
        await login(route.params.email, route.params.password);
        return;
      }
      const formData = new FormData();

      formData.append('email', route.params.email);
      if (route.params.verificationToken) formData.append('verificationToken', route.params.verificationToken);
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

      if (withPhoto && profileImageUri) {
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
        registeredRef.current = true;
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
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
              <Text className="font-display mb-6 text-center text-h1 text-ink" accessibilityRole="header">
                Profile setup
              </Text>

              {/* Avatar */}
              <View className="items-center mb-8">
                <Pressable
                  onPress={handleUploadProfilePic}
                  className="h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-paper-2 border border-dashed border-line active:opacity-85"
                  accessibilityRole="button"
                  accessibilityLabel={profileImageUri ? 'Change profile photo' : 'Upload profile photo'}
                >
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="camera-outline" size={36} color={C.ink3} />
                  )}
                </Pressable>
                <Text className="font-semibold text-sm text-ink-3 mt-3">Upload profile photo</Text>
              </View>

              <View style={{ gap: 12 }}>
                <Button variant="primary" block title="Continue" loading={isLoading} onPress={() => submitRegistration(true)} />
                <Button block title="Skip for now" disabled={isLoading} onPress={() => submitRegistration(false)} />
              </View>

              <Text className="mt-5 text-center text-sm text-ink-3">
                Step 2 of 2
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
