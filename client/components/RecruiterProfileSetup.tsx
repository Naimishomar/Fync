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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";

export default function RecruiterProfileSetup() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { login } = useAuth();
  
  // Data passed from Step 1 (RecruiterSignup)
  const { email, phoneNumber, username } = route.params || {};

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

      const formData = new FormData();
      formData.append('email', String(email || ''));
      formData.append('username', String(username || ''));
      formData.append('mobileNumber', String(phoneNumber || ''));
      formData.append('password', String(password || ''));
      formData.append('name', String(name || ''));
      formData.append('company', String(company || ''));
      formData.append('role', String(role || ''));
      formData.append('professionalEmail', String(email || ''));
      
      if (companyWebsite) formData.append('companyWebsite', companyWebsite);
      if (industry) formData.append('industry', industry);
      if (companySize) formData.append('companySize', companySize);
      if (linkedIn) formData.append('linkedIn', linkedIn);

      let deviceId = await AsyncStorage.getItem("deviceId");
      if (!deviceId) {
        deviceId = "device_" + Date.now() + "_" + Math.random().toString(1.36).substring(2, 9);
        await AsyncStorage.setItem("deviceId", deviceId);
      }

      const payloadData = {
        email: email || '',
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

      console.log('Sending recruiter registration via JSON...', payloadData);

      // Using JSON to bypass any potential FormData bounds issues on RN Emulator
      const res = await axios.post('/user/register-recruiter', payloadData);

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Registration Successful',
          text2: 'Welcome to the platform!',
        });
        await login(email, password);
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
      className="flex-1 bg-white" 
      behavior="padding"
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
        <View className="px-6 pt-16 pb-6 bg-[#F3F4F6]">
            <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="h-10 w-10 bg-white rounded-full items-center justify-center shadow-sm">
                    <Ionicons name="arrow-back" size={20} color="black" />
                </TouchableOpacity>
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-wide">Step 2 of 2</Text>
            </View>
            <Text className="text-2xl font-black text-slate-900 mb-1">Company Profile</Text>
            <Text className="text-slate-500 text-sm font-medium">Complete your recruiter profile.</Text>
        </View>

        <View className="px-6 py-6 border-b border-slate-100">
          <View className="items-center mb-6">
            <Pressable onPress={pickImage} className="relative">
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} className="h-24 w-24 rounded-full" />
              ) : (
                <View className="h-24 w-24 rounded-full bg-slate-100 items-center justify-center border-4 border-white shadow-sm">
                  <Ionicons name="business" size={40} color="#9ca3af" />
                </View>
              )}
              <View className="absolute bottom-0 right-0 bg-black h-8 w-8 rounded-full items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={14} color="white" />
              </View>
            </Pressable>
            <Text className="text-slate-500 font-medium text-xs mt-3">Upload Profile Picture</Text>
          </View>

          <Text className="text-sm font-bold text-slate-800 mb-2 mt-4">Personal Details</Text>
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text className="text-sm font-bold text-slate-800 mb-2 mt-4">Company Verification</Text>
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Company Name"
            value={company}
            onChangeText={setCompany}
          />
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Designation / Role"
            value={role}
            onChangeText={setRole}
          />
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Company Website URL (Optional)"
            value={companyWebsite}
            autoCapitalize="none"
            onChangeText={setCompanyWebsite}
          />
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Industry (e.g. IT, Finance) (Optional)"
            value={industry}
            onChangeText={setIndustry}
          />
          <TextInput
            className="mb-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="Number of Employees (Optional)"
            value={companySize}
            keyboardType="number-pad"
            onChangeText={setCompanySize}
          />
          <Text className="text-sm font-bold text-slate-800 mb-2 mt-4">Professional Link</Text>
          <TextInput
            className="mb-8 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3.5 font-medium"
            placeholder="LinkedIn Profile URL (Optional)"
            value={linkedIn}
            autoCapitalize="none"
            onChangeText={setLinkedIn}
          />

          <Pressable
            className={`rounded-full py-4 items-center ${isLoading ? 'bg-slate-300' : 'bg-black'}`}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-bold">Complete Setup</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
