import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { collegesInIndia } from 'data/college';

type ProfileSetup1RouteProp = RouteProp<RootStackParamList, 'ProfileSetup1'>;
type ProfileSetup1NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup1'>;

export default function ProfileSetup1() {
  const navigation = useNavigation<ProfileSetup1NavigationProp>();
  const route = useRoute<ProfileSetup1RouteProp>();
  const { email, username, phoneNumber, password, otp } = route.params;

  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [college, setCollege] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');

  // Modal controls
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dropdownType, setDropdownType] = useState<null | string>(null);
  const [search, setSearch] = useState("");

  const filteredColleges = collegesInIndia.filter((col) =>
    col.toLowerCase().includes(search.toLowerCase())
  );

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formatted = selectedDate.toISOString().split("T")[0];
      setBirthday(formatted);
    }
  };

  const genderOptions = ["Male", "Female", "Other"];
  const yearOptions = ["2025", "2026", "2027", "2028", "2029", "2030"];
  const majorOptions = ["B.Tech", "BCA", "MCA", "MBA", "Pharmacy", "B.Sc", "M.Tech"];

  const openDropdown = (type: any) => {
    setDropdownType(type);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
        }}
        className="flex-1 bg-transparent px-8 pt-12"
        keyboardShouldPersistTaps="handled">

        <Text className="mb-10 text-center text-4xl font-bold text-white">Profile Setup</Text>

        <View className='flex-col gap-3'>
          <TextInput
            className="w-full rounded-lg border border-white p-4 text-base text-pink-300"
            placeholder="Full Name"
            placeholderTextColor="#A1A1A1"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />

          <TouchableOpacity
            className="w-full flex-row items-center justify-between rounded-lg border border-white p-4"
            onPress={() => setShowDatePicker(true)}
          >
            <Text className={birthday ? 'text-base text-pink-300' : 'text-base text-[#A1A1A1]'}>
              {birthday || 'Birthday'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full flex-row items-center justify-between rounded-lg border border-white p-4"
            onPress={() => openDropdown("gender")}
          >
            <Text className={gender ? 'text-base text-pink-300' : 'text-base text-[#A1A1A1]'}>
              {gender || 'Gender'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full flex-row items-center justify-between rounded-lg border border-white p-4"
            onPress={() => openDropdown("college")}
          >
            <Text className={college ? 'text-base text-pink-300' : 'text-base text-[#A1A1A1]'}>
              {college || 'College Name'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full flex-row items-center justify-between rounded-lg border border-white p-4"
            onPress={() => openDropdown("major")}
          >
            <Text className={major ? 'text-base text-pink-300' : 'text-base text-[#A1A1A1]'}>
              {major || 'Your Major'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
          </TouchableOpacity>

          <TouchableOpacity
            className="mb-8 w-full flex-row items-center justify-between rounded-lg border border-white p-4"
            onPress={() => openDropdown("year")}
          >
            <Text className={year ? 'text-base text-pink-300' : 'text-base text-[#A1A1A1]'}>
              {year || 'Passout Year'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#A1A1A1" />
          </TouchableOpacity>
        </View>

        {/* Continue */}
        <TouchableOpacity
          className="w-full items-center rounded-lg bg-pink-300 py-4 active:opacity-80"
          onPress={() => navigation.navigate("ProfileSetup2", { email, username, phoneNumber, password, otp, fullName, birthday, gender, college, major, year })}
        >
          <Text className="text-base font-semibold text-white">Continue</Text>
        </TouchableOpacity>

        <Text className="mt-4 text-center text-sm text-white">Step 1 of 2</Text>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* Dropdown Modal */}
      <Modal transparent visible={!!dropdownType} animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="w-80 bg-white rounded-lg p-4 max-h-[70%]">
            <Text className="text-lg font-bold mb-4 text-center">
              Select {dropdownType}
            </Text>

            {/* Search Bar for College Dropdown */}
            {dropdownType === "college" && (
              <TextInput
                placeholder="Search college..."
                placeholderTextColor="#888"
                className="border border-gray-300 rounded-lg px-3 py-2 mb-3"
                onChangeText={(t) => setSearch(t)}
                value={search}
              />
            )}

            <ScrollView className="max-h-[60%]">
              {(dropdownType === "gender"
                ? genderOptions
                : dropdownType === "year"
                  ? yearOptions
                  : dropdownType === "college"
                    ? filteredColleges
                    : majorOptions
              ).map((item) => (
                <TouchableOpacity
                  key={item}
                  className="p-3 border-b border-gray-200"
                  onPress={() => {
                    if (dropdownType === "gender") setGender(item);
                    if (dropdownType === "year") setYear(item);
                    if (dropdownType === "major") setMajor(item);
                    if (dropdownType === "college") setCollege(item);

                    setSearch(""); // reset search
                    setDropdownType(null);
                  }}
                >
                  <Text className="text-center text-base">{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Cancel */}
            <TouchableOpacity
              className="mt-3 p-3 rounded bg-gray-200"
              onPress={() => {
                setSearch("");
                setDropdownType(null);
              }}
            >
              <Text className="text-center font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}