import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { collegesInIndia } from '../data/college';
// @ts-ignore
import loginImage from '../assets/loginImage.png';

export default function AlumniProfileSetup() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, phoneNumber } = route.params;

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
  
  const filteredColleges = collegesInIndia.filter(c => 
    c.toLowerCase().includes(collegeSearch.toLowerCase())
  );

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
      gender,
      major
    });
  };

  return (
    <View className="flex-1 bg-[#F3F4F6]">
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: 'https://i.pinimg.com/736x/a2/05/60/a205602210656db27579657ba25f57a4.jpg' }}
          style={{ width: '100%', height: 400 }}
          className="rounded-2xl"
          resizeMode="cover"
        />
        
        <View className="mt-8 bg-white rounded-[40px] px-6 pt-8 pb-10 shadow-sm">
          <Text className="text-3xl font-bold mb-2">Professional Info</Text>
          <Text className="text-gray-500 mb-6">Step 2: Tell us about your career</Text>

          <Text className="text-gray-700 font-semibold mb-2">Basic Details</Text>
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <View className="mb-4 flex-row items-center rounded-xl border border-gray-300 px-4">
            <TextInput
              className="flex-1 py-4"
              placeholder="Password"
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setPasswordVisible(!passwordVisible)}>
              <Ionicons
                name={passwordVisible ? 'eye-off' : 'eye'}
                size={22}
                color="#9CA3AF"
              />
            </Pressable>
          </View>

          <Text className="text-gray-700 font-semibold mb-2">Education</Text>
          <Pressable 
            onPress={() => setShowCollegeModal(true)}
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4 flex-row justify-between items-center"
          >
            <Text className={college ? "text-black" : "text-gray-400"}>
              {college || "Select College"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
          </Pressable>
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="Graduation Year"
            keyboardType="number-pad"
            value={graduationYear}
            onChangeText={setGraduationYear}
          />
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="Department / Major (e.g. CSE, MBA)"
            value={major}
            onChangeText={setMajor}
          />

          <Text className="text-gray-700 font-semibold mb-2">Gender</Text>
          <View className="flex-row mb-4">
            {['Male', 'Female'].map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                className={`mr-4 px-6 py-2 rounded-full border ${
                  gender === g ? 'bg-black border-black' : 'bg-transparent border-gray-300'
                }`}
              >
                <Text className={gender === g ? 'text-white' : 'text-gray-600'}>
                  {g}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-gray-700 font-semibold mb-2 mt-2">Work Experience</Text>
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="Current Company / Startup"
            value={company}
            onChangeText={setCompany}
          />
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="Your Role (e.g. SDE-2, Founder)"
            value={role}
            onChangeText={setRole}
          />

          <Text className="text-gray-700 font-semibold mb-2">Experience Level</Text>
          <View className="flex-row flex-wrap mb-4">
            {experienceLevels.map((level) => (
              <Pressable
                key={level}
                onPress={() => setExperienceLevel(level)}
                className={`mr-2 mb-2 px-4 py-2 rounded-full border ${
                  experienceLevel === level ? 'bg-black border-black' : 'bg-transparent border-gray-300'
                }`}
              >
                <Text className={experienceLevel === level ? 'text-white' : 'text-gray-600'}>
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-gray-700 font-semibold mb-2">Domains (comma separated)</Text>
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="e.g. Backend, AI, Fintech"
            value={domains}
            onChangeText={setDomains}
          />

          <Text className="text-gray-700 font-semibold mb-2">LinkedIn URL (Optional)</Text>
          <TextInput
            className="mb-8 rounded-xl border border-gray-300 px-4 py-4"
            placeholder="https://linkedin.com/in/username"
            value={linkedIn}
            onChangeText={setLinkedIn}
            autoCapitalize="none"
          />

          <Pressable
            className="rounded-full bg-black py-4 items-center"
            onPress={handleNext}
          >
            <Text className="text-white text-lg font-semibold">Next Step</Text>
          </Pressable>

          <Text className="mt-5 text-center text-gray-500">Step 2 of 3</Text>
        </View>
      </ScrollView>

      {/* College Selection Modal */}
      <Modal
        visible={showCollegeModal}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-[40px] h-[80%] px-6 pt-8">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold">Select College</Text>
              <Pressable onPress={() => setShowCollegeModal(false)}>
                <Ionicons name="close-circle" size={32} color="#000" />
              </Pressable>
            </View>

            <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 mb-6">
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                className="flex-1 py-4 ml-2"
                placeholder="Search your college..."
                value={collegeSearch}
                onChangeText={setCollegeSearch}
              />
            </View>

            <FlatList
              data={filteredColleges}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCollege(item);
                    setShowCollegeModal(false);
                    setCollegeSearch('');
                  }}
                  className="py-4 border-b border-gray-100"
                >
                  <Text className="text-lg text-gray-800">{item}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View className="py-10 items-center">
                  <Text className="text-gray-500">No colleges found</Text>
                  <Text className="text-gray-400 text-sm mt-1">Try a different search term</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
