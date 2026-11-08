import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Ionicons from '@expo/vector-icons/Ionicons';
import { collegesInIndia } from '../data/college';
// @ts-ignore
import loginImage from '../assets/loginImage.png';
import { C } from '../constants/colors';
import { Button, Chip, FormField, SearchField, Sheet, ListRow, Empty } from './ui/kit';

export default function AlumniProfileSetup() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, phoneNumber, verificationToken } = route.params ?? {};
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [college, setCollege] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Junior');
  const [domains, setDomains] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [gender, setGender] = useState('Male');
  const [major, setMajor] = useState('');
  
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState('');
  
  // Every keystroke in any field re-renders this screen; only the search should re-filter.
  const filteredColleges = useMemo(() => {
    const q = collegeSearch.toLowerCase();
    return collegesInIndia.filter(c => c.toLowerCase().includes(q));
  }, [collegeSearch]);

  const experienceLevels = ['Junior', 'Mid', 'Senior', 'Lead', 'Founder', 'Other'];

  const handleNext = () => {
    if (!name || !username || !password || !college || !graduationYear || !company || !role || !major || !gender) {
      Toast.show({
        type: 'error',
        text1: 'Missing Fields',
        text2: 'Please fill in all required professional details',
      });
      return;
    }

    navigation.navigate('AlumniAvatarSetup', {
      email,
      phoneNumber,
      name,
      username,
      password,
      college,
      graduationYear,
      company,
      role,
      experienceLevel,
      domains,
      linkedIn,
      verificationToken,
      gender,
      major
    });
  };

  return (
    <View className="flex-1 bg-paper">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={{ uri: 'https://i.pinimg.com/736x/a2/05/60/a205602210656db27579657ba25f57a4.jpg' }}
          style={{ width: '100%', height: 400 }}
          className="rounded-2xl"
          resizeMode="cover"
        />
        
        <View className="mt-6 bg-card border border-line rounded-2xl p-5" style={{ gap: 16 }}>
          <View>
            <Text className="text-h1 font-display text-ink mb-2" accessibilityRole="header">Professional info</Text>
            <Text className="text-sm text-ink-3">Step 2: Tell us about your career</Text>
          </View>

          <Text className="text-ink font-semibold mt-2">Basic details</Text>
          <FormField label="Full name" placeholder="Full name" value={name} onChangeText={setName} />
          <FormField label="Username" placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <FormField
            label="Password"
            placeholder="Password"
            secureTextEntry={!passwordVisible}
            value={password}
            onChangeText={setPassword}
            right={
              <Pressable onPress={() => setPasswordVisible(!passwordVisible)} hitSlop={12} accessibilityRole="button" className="active:opacity-85"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink3} />
              </Pressable>
            }
          />

          <Text className="text-ink font-semibold mt-2">Education</Text>
          <View style={{ gap: 6 }}>
            <Text className="font-semibold text-ink-2" style={{ fontSize: 13, lineHeight: 18 }}>College</Text>
            <Pressable
              onPress={() => setShowCollegeModal(true)}
              className="bg-paper-2 border border-line rounded-2xl px-4 flex-row justify-between items-center active:opacity-85"
              style={{ minHeight: 48, gap: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`College. ${college || 'Not set'}`}
            >
              <Text className={`flex-1 text-base ${college ? "text-ink" : "text-ink-3"}`} numberOfLines={1}>
                {college || "Select college"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={C.ink3} />
            </Pressable>
          </View>
          <FormField label="Graduation year" placeholder="2022" keyboardType="number-pad"
            value={graduationYear} onChangeText={setGraduationYear} />
          <FormField label="Department / major" placeholder="e.g. CSE, MBA" value={major} onChangeText={setMajor} />

          <View style={{ gap: 6 }}>
            <Text className="font-semibold text-ink-2" style={{ fontSize: 13, lineHeight: 18 }}>Gender</Text>
            <View className="flex-row" style={{ gap: 8 }}>
              {['Male', 'Female'].map((g) => (
                <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />
              ))}
            </View>
          </View>

          <Text className="text-ink font-semibold mt-2">Work experience</Text>
          <FormField label="Current company / startup" placeholder="Company" value={company} onChangeText={setCompany} />
          <FormField label="Your role" placeholder="e.g. SDE-2, Founder" value={role} onChangeText={setRole} />

          <View style={{ gap: 6 }}>
            <Text className="font-semibold text-ink-2" style={{ fontSize: 13, lineHeight: 18 }}>Experience level</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {experienceLevels.map((level) => (
                <Chip key={level} label={level} active={experienceLevel === level} onPress={() => setExperienceLevel(level)} />
              ))}
            </View>
          </View>

          <FormField label="Domains" hint="Comma separated" placeholder="e.g. Backend, AI, Fintech"
            value={domains} onChangeText={setDomains} />
          <FormField label="LinkedIn URL (optional)" placeholder="https://linkedin.com/in/username"
            value={linkedIn} onChangeText={setLinkedIn} autoCapitalize="none" />

          <Button variant="primary" block title="Next step" onPress={handleNext} style={{ marginTop: 8 }} />

          <Text className="text-center text-sm text-ink-3">Step 2 of 3</Text>
        </View>
      </ScrollView>

      <Sheet
        visible={showCollegeModal}
        onClose={() => setShowCollegeModal(false)}
        title="Select college"
        scroll={false}
        height="80%"
      >
        <SearchField
          placeholder="Search your college"
          value={collegeSearch}
          onChangeText={setCollegeSearch}
          containerStyle={{ marginHorizontal: 20, marginTop: 12, marginBottom: 4 }}
        />
        <FlatList
          data={filteredColleges}
          keyExtractor={keyOf}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
          renderItem={({ item }) => (
            <ListRow
              title={item}
              titleLines={2}
              chevron={false}
              onPress={() => {
                setCollege(item);
                setShowCollegeModal(false);
                setCollegeSearch('');
              }}
              right={item === college ? <Ionicons name="checkmark" size={20} color={C.accentText} accessibilityLabel="Selected" /> : undefined}
            />
          )}
          ListEmptyComponent={<Empty icon="school-outline" title="No colleges found" hint="Try a different search term" />}
        />
      </Sheet>
    </View>
  );
}

const keyOf = (item: string) => item;
