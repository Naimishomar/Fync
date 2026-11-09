import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView, Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
// @ts-ignore
import loginImage from '../assets/loginImage.png';
import { C } from '../constants/colors';
import { Button } from './ui/kit';

export default function AlumniAvatarSetup() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { login } = useAuth();
  const params = route.params ?? {};
  const insets = useSafeAreaInsets();

  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleUploadProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS === 'ios',
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const submitRegistration = async (withPhoto = true) => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      const formData = new FormData();
      // FormData stringifies undefined to "undefined", which the server then saves.
      const add = (k: string, v: any) => { if (v != null) formData.append(k, String(v)); };

      add('email', params.email);
      add('verificationToken', params.verificationToken);
      add('username', params.username);
      add('mobileNumber', params.phoneNumber);
      add('password', params.password);
      add('name', params.name);
      add('college', params.college);
      add('graduationYear', params.graduationYear);
      add('company', params.company);
      add('role', params.role);
      add('experienceLevel', params.experienceLevel);
      formData.append('domains', JSON.stringify(String(params.domains ?? '').split(',').map((d: any) => d.trim()).filter((d: any) => d !== '')));
      add('linkedIn', params.linkedIn);
      add('gender', params.gender);
      add('major', params.major);

      let deviceId = await AsyncStorage.getItem("deviceId");
      if (!deviceId) {
        deviceId = "device_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await AsyncStorage.setItem("deviceId", deviceId);
      }
      formData.append('deviceId', deviceId);
      formData.append('deviceModel', Device.modelName || "Unknown Device");

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

      const res = await axios.post('/user/register-alumni', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Alumni account created!',
          text2: 'Welcome to Fync professional network',
        });
        await login(params.email, params.password);
      }
    } catch (error: any) {
      console.error("Alumni registration failed", error);
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
    <View className="flex-1 bg-paper">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        <Image
          source={{ uri: 'https://i.pinimg.com/736x/a2/05/60/a205602210656db27579657ba25f57a4.jpg' }}
          style={{ width: '100%', height: 400 }}
          className="rounded-2xl"
          resizeMode="cover"
        />

        <View className="mt-6 bg-card border border-line rounded-2xl p-5">
          <Text className="text-h1 font-display text-ink mb-2" accessibilityRole="header">Profile photo</Text>
          <Text className="text-sm text-ink-3 mb-6">Step 3: Add a face to your professional profile</Text>

          <View className="items-center mb-8">
            <Pressable
              onPress={handleUploadProfilePic}
              className="h-48 w-48 items-center justify-center overflow-hidden rounded-full bg-paper-2 border border-line active:opacity-85"
              accessibilityRole="button"
              accessibilityLabel={profileImageUri ? 'Change profile photo' : 'Upload profile photo'}
            >
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Ionicons name="camera-outline" size={48} color={C.ink3} />
              )}
            </Pressable>
            <Text className="mt-4 text-sm text-ink-2 font-medium">Capture or upload</Text>
          </View>

          <View style={{ gap: 12 }}>
            <Button variant="primary" block title="Finish setup" loading={isLoading} onPress={() => submitRegistration()} />
            <Button block title="Skip for now" disabled={isLoading} onPress={() => submitRegistration(false)} />
          </View>

          <Text className="mt-5 text-center text-sm text-ink-3">Step 3 of 3</Text>
        </View>
      </ScrollView>
    </View>
  );
}
