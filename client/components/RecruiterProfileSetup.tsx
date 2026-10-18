import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  TouchableOpacity
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppBar } from './ui/kit';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { C } from '../constants/colors';

export default function RecruiterProfileSetup() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { login, setUser } = useAuth();
  
  // Data passed from Step 1 (RecruiterSignup)
  const { email, phoneNumber, username, verificationToken } = route.params || {};

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleRegister = async () => {
    if (!name || !password || !company || !role) {
      Toast.show({
        type: 'error',
        text1: 'Required Fields',
        text2: 'Name, Password, Company, and Role are mandatory',
      });
      return;
    }

    try {
      setIsLoading(true);

      let deviceId = await AsyncStorage.getItem("deviceId");
      if (!deviceId) {
        deviceId = "device_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await AsyncStorage.setItem("deviceId", deviceId);
      }

      const payloadData = {
        email: email || '',
        verificationToken,
        username: username || '',
        mobileNumber: phoneNumber || '',
        password: password || '',
        name: name || '',
        company: company || '',
        role: role || '',
        professionalEmail: email || '',
        companyWebsite: companyWebsite || null,
        industry: industry || null,
        companySize: companySize || null,
        linkedIn: linkedIn || null,
        deviceId: deviceId,
        deviceModel: Device.modelName || 'Unknown Device'
      };

      // Using JSON to bypass any potential FormData bounds issues on RN Emulator
      const res = await axios.post('/user/register-recruiter', payloadData);

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Registration Successful',
          text2: 'Welcome to the platform!',
        });
        await login(email, password);
        // Register is JSON-only; the photo goes up through the same /user/update
        // multipart path RecruiterEditProfile uses, now that login stored the token.
        if (avatarUri) {
          try {
            const fileName = avatarUri.split('/').pop() || 'avatar.jpg';
            const avatarForm = new FormData();
            avatarForm.append('avatar', {
              uri: Platform.OS === 'ios' ? avatarUri.replace('file://', '') : avatarUri,
              name: fileName,
              type: `image/${fileName.split('.').pop()}`,
            } as any);
            const up = await axios.post('/user/update', avatarForm, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (up.data?.user) setUser(up.data.user);
          } catch (e) {
            console.log('Recruiter avatar upload err:', e);
            Toast.show({
              type: 'info',
              text1: 'Photo not uploaded',
              text2: 'Your account is ready. Add a photo from Edit Profile.',
            });
          }
        }
      }
    } catch (error: any) {
      console.log('Recruiter register err:', error);
      let errorDump = error.message;
      if (error.response) {
         errorDump = error.response.status + " " + JSON.stringify(error.response.data);
      } else if (!errorDump) {
         errorDump = JSON.stringify(error);
      }
      Toast.show({
        type: 'error',
        text1: 'Registration Failed',
        text2: String(errorDump).substring(0, 80),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-paper" 
      behavior="padding"
    >
      <AppBar title="Company Profile" onBack={() => navigation.goBack()}
        right={<Text className="text-ink-3 font-semibold text-xs uppercase" style={{ marginRight: 11 }}>Step 2 of 2</Text>} />
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        <View className="px-5 pt-2 pb-6 bg-paper">
          <Text className="text-ink-3 text-sm font-medium">Complete your recruiter profile.</Text>
        </View>

        <View className="px-5 py-6 border-b border-line">
          <View className="items-center mb-6">
            <Pressable onPress={pickImage} className="relative">
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} className="h-24 w-24 rounded-full" />
              ) : (
                <View className="h-24 w-24 rounded-full bg-paper-2 items-center justify-center border-4 border-line shadow-hair">
                  <Ionicons name="business" size={40} color={C.ink4} />
                </View>
              )}
              <View className="absolute right-0 bg-brand-500 border-2 border-ink h-8 w-8 items-center justify-center border-paper rounded-md bottom-0">
                <Ionicons name="camera" size={14} color={C.onBrand} />
              </View>
            </Pressable>
            <Text className="text-ink-3 font-medium text-xs mt-3">Upload Profile Picture</Text>
          </View>

          <Text className="text-sm font-semibold text-ink mb-2 mt-4">Personal Details</Text>
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text className="text-sm font-semibold text-ink mb-2 mt-4">Company Verification</Text>
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Company Name"
            value={company}
            onChangeText={setCompany}
          />
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Designation / Role"
            value={role}
            onChangeText={setRole}
          />
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Company Website URL (Optional)"
            value={companyWebsite}
            autoCapitalize="none"
            onChangeText={setCompanyWebsite}
          />
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Industry (e.g. IT, Finance) (Optional)"
            value={industry}
            onChangeText={setIndustry}
          />
          <TextInput
            className="mb-4 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="Number of Employees (Optional)"
            value={companySize}
            keyboardType="number-pad"
            onChangeText={setCompanySize}
          />
          <Text className="text-sm font-semibold text-ink mb-2 mt-4">Professional Link</Text>
          <TextInput
            className="mb-8 bg-card border-2 border-ink px-4 py-3.5 font-medium text-ink rounded-xl"
            placeholderTextColor={C.ink3}
            placeholder="LinkedIn Profile URL (Optional)"
            value={linkedIn}
            autoCapitalize="none"
            onChangeText={setLinkedIn}
          />

          <Pressable
            className={`rounded-full py-4 items-center ${isLoading ? 'bg-paper-2' : 'bg-ink'}`}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={C.ink} />
            ) : (
              <Text className="text-paper text-base font-semibold">Complete Setup</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
