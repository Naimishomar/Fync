import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';

type ProfileSetup2NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup2'>;
type ProfileSetup2RouteProp = RouteProp<RootStackParamList, 'ProfileSetup2'>;

export default function ProfileSetup2() {
  const route = useRoute<ProfileSetup2RouteProp>();
  const navigation = useNavigation<ProfileSetup2NavigationProp>();
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);

  const handleUploadProfilePic = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      alert('Permission to access gallery is required!');
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
    const formData = new FormData();

    formData.append("email", route.params.email);
    formData.append("username", route.params.username);
    formData.append("mobileNumber", route.params.phoneNumber);
    formData.append("password", route.params.password);
    formData.append("name", route.params.fullName);
    formData.append("dob", route.params.birthday);
    formData.append("college", route.params.college);
    formData.append("year", route.params.year);
    formData.append("gender", route.params.gender);
    formData.append("major", route.params.major);
    formData.append("userOTP", route.params.otp);

    if (profileImageUri) {
      formData.append("avatar", {
        uri: profileImageUri,
        type: "image/jpeg",
        name: "avatar.jpg",
      } as any);
    }

    const res = await fetch("http://10.21.170.90:3000/user/register", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      alert(data.success);
      Toast.show({
        type: "success",
        text1: "Registeed successfully!",
        text2: "Register"
      });
      navigation.navigate("Home1");
    } else {
      alert(data.message);
      Toast.show({
        type: "error",
        text1: "Failed",
        text2: data.message
      });
    }
  };
  const handleSkip = () => {
    console.log('Skipped profile pic');
  };

  return (
    <View className="flex-1 items-center justify-center bg-transparent px-8">
      <View className="mb-10 w-full items-center">
        <Text className="text-3xl font-bold text-white">Profile Set Up</Text>
      </View>

      <View className="flex-col items-center justify-center">
        <TouchableOpacity
          className="mb-4 h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-pink-200"
          onPress={handleUploadProfilePic}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Ionicons name="pencil" size={40} color="gray" />
          )}
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-white">Profile Pic</Text>
      </View>

      <View className="mt-12 w-full">
        <TouchableOpacity
          className="mb-4 w-full items-center rounded-lg bg-pink-300 py-4 shadow-md active:opacity-80"
          onPress={submitRegistration}>
          <Text className="text-base font-semibold text-white">Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-full items-center rounded-lg border border-white py-4 active:bg-gray-50"
          onPress={submitRegistration}>
          <Text className="text-base font-semibold text-white">Skip for now</Text>
        </TouchableOpacity>
        <Text className="mt-4 text-center text-sm text-white">Step 2 of 2</Text>
      </View>
    </View>
  );
}
