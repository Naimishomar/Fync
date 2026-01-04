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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth } from 'context/auth.context';
import loginImage from '../assets/loginImage.png';
import axios from '../context/axiosConfig';

type ProfileSetup2NavigationProp =
  NativeStackNavigationProp<RootStackParamList, 'ProfileSetup2'>;
type ProfileSetup2RouteProp =
  RouteProp<RootStackParamList, 'ProfileSetup2'>;

export default function ProfileSetup2() {
  const route = useRoute<ProfileSetup2RouteProp>();
  const navigation = useNavigation<ProfileSetup2NavigationProp>();
  const { login } = useAuth();

  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const handleUploadProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Permission required' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const formData = new FormData();

      formData.append('email', route.params.email);
      formData.append('username', route.params.username);
      formData.append('mobileNumber', route.params.phoneNumber);
      formData.append('password', route.params.password);
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
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View className="flex-1 bg-[#F3F4F6]">
          {/* Background */}
          <View className="flex-1 p-4">
            <Image
              source={loginImage}
              className="h-full w-full rounded-2xl"
              resizeMode="cover"
            />
          </View>

          {/* Bottom Sheet */}
          <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-16">
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-3xl font-bold mb-6 text-center">
                Profile Setup
              </Text>

              {/* Avatar */}
              <View className="items-center mb-8">
                <Pressable
                  onPress={handleUploadProfilePic}
                  className="h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-gray-200"
                >
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="camera" size={36} color="#6B7280" />
                  )}
                </Pressable>
                <Text className="mt-3 text-gray-600">Upload Profile Photo</Text>
              </View>

              {/* Continue */}
              <Pressable
                className="rounded-full bg-black py-4 items-center mb-4"
                onPress={submitRegistration}
              >
                <Text className="text-white text-lg font-semibold">
                  Continue
                </Text>
              </Pressable>

              {/* Skip */}
              <Pressable
                className="rounded-full border border-gray-300 py-4 items-center"
                onPress={submitRegistration}
              >
                <Text className="text-gray-700 text-lg font-semibold">
                  Skip for now
                </Text>
              </Pressable>

              <Text className="mt-5 text-center text-gray-500">
                Step 2 of 2
              </Text>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
