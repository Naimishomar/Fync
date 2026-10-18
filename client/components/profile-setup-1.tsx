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
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { collegesInIndia } from 'data/college';
import { PASSOUT_YEARS, MAJORS } from 'data/academics';
import { C } from '../constants/colors';
//@ts-ignore

type ProfileSetup1RouteProp = RouteProp<RootStackParamList, 'ProfileSetup1'>;
type ProfileSetup1NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProfileSetup1'
>;

export default function ProfileSetup1() {
  const navigation = useNavigation<ProfileSetup1NavigationProp>();
  const route = useRoute<ProfileSetup1RouteProp>();
  const { email, username, phoneNumber, password, verificationToken } = route.params ?? ({} as ProfileSetup1RouteProp['params']);

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
      // Local date parts: toISOString() is UTC and shifts the day back for
      // anyone east of Greenwich picking before 05:30 IST.
      const pad = (n: number) => String(n).padStart(2, '0');
      setBirthday(`${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`);
    }
  };

  // /user/register rejects the whole form if any of these is empty; catch it
  // here, not after the photo step.
  const handleContinue = () => {
    const missing = ([
      ['full name', fullName.trim()], ['birthday', birthday], ['gender', gender],
      ['college', college], ['major', major], ['passout year', year],
    ] as [string, string][]).find(([, v]) => !v);
    if (missing) {
      Toast.show({ type: 'error', text1: `Please add your ${missing[0]}` });
      return;
    }
    navigation.navigate('ProfileSetup2', {
      email,
      username,
      phoneNumber,
      password,
      fullName: fullName.trim(),
      birthday,
      gender,
      college,
      major,
      year,
      verificationToken,
    });
  };

  const genderOptions = ['Male', 'Female', 'Other'];
  // Shared with hackathon eligibility — a batch a host can target has to be a
  // batch a student can pick.
  const yearOptions = PASSOUT_YEARS;
  const majorOptions = MAJORS;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                    placeholderTextColor={C.ink3}
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
                  <Ionicons name="calendar-outline" size={20} color={C.ink3} />
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
                      <Ionicons name="chevron-down" size={20} color={C.ink3} />
                    </Pressable>
                  </View>
                ))}

                <Pressable
                  className="mt-5 bg-brand-500 items-center justify-center border-2 border-ink rounded-md"
                  style={{ minHeight: 48 }}
                  accessibilityRole="button"
                  onPress={handleContinue}
                >
                  <Text className="font-display text-on-brand uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Continue</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>

        {/* Date Picker */}
        {showDatePicker && (
          <DateTimePicker
            value={birthday ? new Date(`${birthday}T12:00:00`) : new Date(2005, 0, 1)}
            maximumDate={new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Dropdown Modal */}
        <Modal
          transparent
          visible={!!dropdownType}
          animationType="fade"
          onRequestClose={() => {
            setSearch('');
            setDropdownType(null);
          }}
        >
          <View className="flex-1 items-center justify-center" style={{ backgroundColor: C.scrim }}>
            <View className="w-80 max-h-[70%] rounded-lg bg-card p-4">
              <Text className="mb-4 text-center text-lg font-display text-ink">
                Select {dropdownType}
              </Text>

              {dropdownType === 'college name' && (
                <TextInput
                  placeholder="Search college..."
                  className="mb-3 rounded-lg border-[1.5px] border-ink px-3 py-2 text-ink"
                  placeholderTextColor={C.ink3}
                  value={search}
                  onChangeText={setSearch}
                />
              )}

              <ScrollView keyboardShouldPersistTaps="handled">
                {dropdownType === 'college name' && filteredColleges.length === 0 && (
                  <Text className="text-center text-ink-3 p-3">No college matches "{search}"</Text>
                )}
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
                    <Text className="text-center text-ink">{item}</Text>
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
                <Text className="text-center font-semibold text-ink">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
