import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Platform,
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
import { Button, FormField, SearchField, Sheet, ListRow, Empty } from './ui/kit';
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

  const closeDropdown = () => { setSearch(''); setDropdownType(null); };
  const pick = (item: string) => {
    if (dropdownType === 'gender') setGender(item);
    if (dropdownType === 'passout year') setYear(item);
    if (dropdownType === 'your major') setMajor(item);
    if (dropdownType === 'college name') setCollege(item);
    closeDropdown();
  };
  const isCollege = dropdownType === 'college name';
  const options = dropdownType === 'gender'
    ? genderOptions
    : dropdownType === 'passout year'
    ? yearOptions
    : isCollege
    ? filteredColleges
    : majorOptions;
  const current = dropdownType === 'gender' ? gender
    : dropdownType === 'passout year' ? year
    : dropdownType === 'your major' ? major
    : college;

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
            <Text className="font-display text-ink" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -0.8 }} accessibilityRole="header">
              Profile setup
            </Text>
            <Text className="font-semibold text-sm text-ink-3 mt-2">Step 1 of 2</Text>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="bg-card border border-line rounded-2xl p-4 mt-4" style={{ gap: 16 }}>
              <FormField
                label="Full name"
                placeholder="Naimish Omar"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
              />

              <PickerField label="Birthday" value={birthday} placeholder="Select a date"
                icon="calendar-outline" onPress={() => setShowDatePicker(true)} />

              {([
                ['Gender', gender],
                ['College name', college],
                ['Your major', major],
                ['Passout year', year],
              ] as [string, string][]).map(([label, value]) => (
                <PickerField key={label} label={label} value={value}
                  placeholder={`Select ${label.toLowerCase()}`}
                  onPress={() => setDropdownType(label.toLowerCase())} />
              ))}

              <Button variant="primary" block title="Continue" onPress={handleContinue} />
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

        <Sheet
          visible={!!dropdownType}
          onClose={closeDropdown}
          title={dropdownType ? `Select ${dropdownType}` : undefined}
          scroll={false}
          height={isCollege ? '78%' : undefined}
        >
          {isCollege && (
            <SearchField
              placeholder="Search college"
              value={search}
              onChangeText={setSearch}
              containerStyle={{ marginHorizontal: 20, marginTop: 12, marginBottom: 4 }}
            />
          )}
          <FlatList
            data={options}
            keyExtractor={keyOf}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
            ListEmptyComponent={isCollege ? <Empty icon="school-outline" title={`No college matches "${search}"`} /> : null}
            renderItem={({ item }) => (
              <ListRow
                title={item}
                onPress={() => pick(item)}
                right={item === current ? <Ionicons name="checkmark" size={20} color={C.accentText} accessibilityLabel="Selected" /> : undefined}
                chevron={false}
              />
            )}
          />
        </Sheet>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const keyOf = (item: string) => item;

/** Label + tappable box that opens a picker; matches FormField's box. */
function PickerField({ label, value, placeholder, onPress, icon = 'chevron-down' }: {
  label: string; value: string; placeholder: string; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text className="font-semibold text-ink-2" style={{ fontSize: 13, lineHeight: 18 }}>{label}</Text>
      <Pressable
        className="flex-row items-center justify-between bg-paper-2 border border-line rounded-2xl px-4 active:opacity-85"
        style={{ minHeight: 48, gap: 8 }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value || 'Not set'}`}
      >
        <Text className={`flex-1 font-sans text-base ${value ? 'text-ink' : 'text-ink-3'}`} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={icon} size={20} color={C.ink3} />
      </Pressable>
    </View>
  );
}
