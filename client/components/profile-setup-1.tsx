import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { collegesInIndia } from 'data/college';
//@ts-ignore

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
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View className="flex-1 bg-paper">
          {/* A labelled form, not a photo + sheet. Every field carries a visible
              label rather than relying on a placeholder that vanishes on focus. */}
          <View className="px-gutter pt-14 pb-2">
            <Text className="font-display text-ink uppercase" style={{ fontSize: 34, lineHeight: 35, letterSpacing: -1.2 }}>
              Profile Setup
            </Text>
            <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>Step 1 of 2</Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="relative mt-4">
              <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
              <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Full Name</Text>
                <View className="mt-2 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50, justifyContent: 'center' }}>
                  <TextInput
                    className="font-sans text-base text-ink"
                    placeholder="Naimish Omar"
                    placeholderTextColor="#8B857E"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Birthday</Text>
                <Pressable
                  className="mt-2 flex-row items-center justify-between border-[1.5px] border-ink bg-card px-4 rounded-md"
                  style={{ minHeight: 50 }}
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                >
                  <Text className={`font-sans text-base ${birthday ? 'text-ink' : 'text-ink-3'}`}>
                    {birthday || 'Select a date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#8B857E" />
                </Pressable>

                {([
                  ['Gender', gender],
                  ['College Name', college],
                  ['Your Major', major],
                  ['Passout Year', year],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label}>
                    <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>{label}</Text>
                    <Pressable
                      className="mt-2 flex-row items-center justify-between border-[1.5px] border-ink bg-card px-4 rounded-md"
                      style={{ minHeight: 50 }}
                      onPress={() => setDropdownType(label.toLowerCase())}
                      accessibilityRole="button"
                      accessibilityLabel={`${label}. ${value || 'Not set'}`}
                    >
                      <Text className={`font-sans text-base ${value ? 'text-ink' : 'text-ink-3'}`} numberOfLines={1}>
                        {value || `Select ${label.toLowerCase()}`}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#8B857E" />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  className="mt-5 bg-brand-500 items-center justify-center border-2 border-ink rounded-md"
                  style={{ minHeight: 48 }}
                  accessibilityRole="button"
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
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Continue</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
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
            <View className="w-80 max-h-[70%] rounded-lg bg-card p-4">
              <Text className="mb-4 text-center text-lg font-display">
                Select {dropdownType}
              </Text>

              {dropdownType === 'college name' && (
                <TextInput
                  placeholder="Search college..."
                  className="mb-3 rounded-lg border-[1.5px] border-ink px-3 py-2 text-ink"
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
                  <Pressable
                    key={item}
                    className="border-b border-line p-3"
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
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                className="mt-3 rounded bg-paper-2 p-3"
                onPress={() => {
                  setSearch('');
                  setDropdownType(null);
                }}
              >
                <Text className="text-center font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
