import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';

// Define navigation types for this screen
type ProfileSetup1NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup1'>;

export default function ProfileSetup1() {
  const navigation = useNavigation<ProfileSetup1NavigationProp>();

  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [year, setYear] = useState('');
  const [major, setMajor] = useState('');

  const handleContinue = () => {
    navigation.navigate('ProfileSetup2');
  };

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
      }}
      className="flex-1 bg-transparent px-8 pt-12"
      keyboardShouldPersistTaps="handled">
      <View>
        <Text className="mb-10 text-center text-3xl font-bold text-white">Profile Set Up</Text>

        <TextInput
          className="mb-6 w-full rounded-lg border border-white p-4 text-base"
          placeholder="Full Name"
          placeholderTextColor="#A1A1A1"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
        />

        <TouchableOpacity className="mb-6 w-full flex-row items-center justify-between rounded-lg border border-white p-4 text-base">
          <Text className={birthday ? 'text-base text-gray-900' : 'text-base text-[#A1A1A1]'}>
            {birthday || 'Birthday'}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#A1A1A1" />
        </TouchableOpacity>

        <TouchableOpacity className="mb-6 w-full flex-row items-center justify-between rounded-lg border border-gray-300 p-4 text-base">
          <Text className={gender ? 'text-base text-gray-900' : 'text-base text-[#A1A1A1]'}>
            {gender || 'Gender'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
        </TouchableOpacity>

        <TouchableOpacity className="mb-6 w-full flex-row items-center justify-between rounded-lg border border-gray-300 p-4 text-base">
          <Text className={year ? 'text-base text-gray-900' : 'text-base text-[#A1A1A1]'}>
            {year || 'Year'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
        </TouchableOpacity>

        <TouchableOpacity className="mb-8 w-full flex-row items-center justify-between rounded-lg border border-gray-300 p-4 text-base">
          <Text className={major ? 'text-base text-gray-900' : 'text-base text-[#A1A1A1]'}>
            {major || 'Your Major'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
        </TouchableOpacity>
      </View>

      <View className="mb-4">
        <TouchableOpacity
          className="w-full items-center rounded-lg bg-pink-300 py-4 active:opacity-80"
          onPress={handleContinue}>
          <Text className="text-base font-semibold text-white">Continue</Text>
        </TouchableOpacity>
        <Text className="mt-4 text-center text-sm text-white">Step 1 of 2</Text>
      </View>
    </ScrollView>
  );
}
