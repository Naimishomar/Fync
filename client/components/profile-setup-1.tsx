import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { collegesInIndia } from 'data/college';
import loginImage from '../assets/loginImage.png';

type ProfileSetup1RouteProp = RouteProp<RootStackParamList, 'ProfileSetup1'>;
type ProfileSetup1NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileSetup1'
>;

export default function ProfileSetup1() {
  const navigation = useNavigation<ProfileSetup1NavigationProp>();
  const route = useRoute<ProfileSetup1RouteProp>();
  const { email, username, phoneNumber, password } = route.params;

  const [fullName, setFullName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [college, setCollege] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dropdownType, setDropdownType] = useState<null | string>(null);
  const [search, setSearch] = useState('');

  const filteredColleges = collegesInIndia.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  const handleDateChange = (_: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setBirthday(selectedDate.toISOString().split('T')[0]);
    }
  };

  const genderOptions = ['Male', 'Female', 'Other'];
  const yearOptions = ['2025', '2026', '2027', '2028', '2029', '2030'];
  const majorOptions = ['B.Tech', 'BCA', 'MCA', 'MBA', 'Pharmacy', 'B.Sc', 'M.Tech'];

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
              className="w-full h-full rounded-2xl"
              resizeMode="cover"
            />
          </View>

          {/* Bottom Sheet */}
          <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-16">
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text className="text-3xl font-bold mb-6">Profile Setup</Text>

              <TextInput
                className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
                placeholder="Full Name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />

              <TouchableOpacity
                className="mb-4 flex-row items-center justify-between rounded-xl border border-gray-300 px-4 py-4"
                onPress={() => setShowDatePicker(true)}
              >
                <Text className={birthday ? 'text-black' : 'text-gray-400'}>
                  {birthday || 'Birthday'}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#9CA3AF" />
              </TouchableOpacity>

              {[
                ['Gender', gender],
                ['College Name', college],
                ['Your Major', major],
                ['Passout Year', year],
              ].map(([label, value]) => (
                <TouchableOpacity
                  key={label}
                  className="mb-4 flex-row items-center justify-between rounded-xl border border-gray-300 px-4 py-4"
                  onPress={() => setDropdownType(label.toLowerCase())}
                >
                  <Text className={value ? 'text-black' : 'text-gray-400'}>
                    {value || label}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                className="mt-4 rounded-full bg-black py-4 items-center"
                onPress={() =>
                  navigation.navigate('ProfileSetup2', {
                    email,
                    username,
                    phoneNumber,
                    password,
                    fullName,
                    birthday,
                    gender,
                    college,
                    major,
                    year,
                  })
                }
              >
                <Text className="text-white text-lg font-semibold">Continue</Text>
              </TouchableOpacity>

              <Text className="mt-4 text-center text-gray-500">
                Step 1 of 2
              </Text>
            </ScrollView>
          </View>
        </View>

        {/* Date Picker */}
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
          <View className="flex-1 items-center justify-center bg-black/50">
            <View className="w-80 max-h-[70%] rounded-lg bg-white p-4">
              <Text className="mb-4 text-center text-lg font-bold">
                Select {dropdownType}
              </Text>

              {dropdownType === 'college name' && (
                <TextInput
                  placeholder="Search college..."
                  className="mb-3 rounded-lg border border-gray-300 px-3 py-2"
                  value={search}
                  onChangeText={setSearch}
                />
              )}

              <ScrollView>
                {(dropdownType === 'gender'
                  ? genderOptions
                  : dropdownType === 'passout year'
                  ? yearOptions
                  : dropdownType === 'college name'
                  ? filteredColleges
                  : majorOptions
                ).map((item) => (
                  <TouchableOpacity
                    key={item}
                    className="border-b border-gray-200 p-3"
                    onPress={() => {
                      if (dropdownType === 'gender') setGender(item);
                      if (dropdownType === 'passout year') setYear(item);
                      if (dropdownType === 'your major') setMajor(item);
                      if (dropdownType === 'college name') setCollege(item);
                      setSearch('');
                      setDropdownType(null);
                    }}
                  >
                    <Text className="text-center">{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                className="mt-3 rounded bg-gray-200 p-3"
                onPress={() => {
                  setSearch('');
                  setDropdownType(null);
                }}
              >
                <Text className="text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
