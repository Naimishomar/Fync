import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // --- Basic Info ---
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [about, setAbout] = useState(user?.about || '');
  const [experience, setExperience] = useState(user?.experience || '');

  // --- Arrays / Tags ---
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [skillInput, setSkillInput] = useState('');

  const [hobbies, setHobbies] = useState(user?.hobbies || '');
  const [interest, setInterest] = useState(user?.interest || '');

  // --- Social Links ---
  const [githubId, setGithubId] = useState(user?.github_id || '');
  const [linkedinId, setLinkedinId] = useState(user?.linkedIn_id || '');

  // --- Coding Profiles (New) ---
  const [leetcodeId, setLeetcodeId] = useState(user?.codingProfiles?.leetcode || '');
  const [gfgId, setGfgId] = useState(user?.codingProfiles?.gfg || '');
  const [codechefId, setCodechefId] = useState(user?.codingProfiles?.codechef || '');
  const [upiId, setUpiId] = useState(user?.upiId || '');

  // --- Images ---
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [newAvatar, setNewAvatar] = useState<any>(null);
  const [banner, setBanner] = useState(user?.banner || null);
  const [newBanner, setNewBanner] = useState<any>(null);

  // --- CHANGE DETECTION ---
  const initialSkills = user?.skills || [];
  const hasChanges = 
    name !== (user?.name || '') ||
    username !== (user?.username || '') ||
    bio !== (user?.bio || '') ||
    about !== (user?.about || '') ||
    experience !== (user?.experience || '') ||
    hobbies !== (user?.hobbies || '') ||
    interest !== (user?.interest || '') ||
    githubId !== (user?.github_id || '') ||
    linkedinId !== (user?.linkedIn_id || '') ||
    leetcodeId !== (user?.codingProfiles?.leetcode || '') ||
    gfgId !== (user?.codingProfiles?.gfg || '') ||
    codechefId !== (user?.codingProfiles?.codechef || '') ||
    upiId !== (user?.upiId || '') ||
    JSON.stringify(skills) !== JSON.stringify(initialSkills) ||
    newAvatar !== null ||
    newBanner !== null;

  // --- IMAGE PICKER ---
  const pickImage = async (type: 'avatar' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.5,
    });

    if (!result.canceled) {
      if (type === 'avatar') {
        setAvatar(result.assets[0].uri);
        setNewAvatar(result.assets[0]);
      } else {
        setBanner(result.assets[0].uri);
        setNewBanner(result.assets[0]);
      }
    }
  };

  // --- SKILL TAG LOGIC ---
  const handleSkillInput = (text: string) => {
    if (text.endsWith(',')) {
      const newSkill = text.slice(0, -1).trim();
      if (newSkill.length > 0 && !skills.includes(newSkill)) {
        setSkills([...skills, newSkill]);
      }
      setSkillInput('');
    } else {
      setSkillInput(text);
    }
  };

  const removeSkill = (indexToRemove: number) => {
    setSkills(skills.filter((_, index) => index !== indexToRemove));
  };

  // --- SUBMIT HANDLER ---
  const handleUpdate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('username', username);
      formData.append('bio', bio);
      formData.append('about', about);
      formData.append('experience', experience);
      formData.append('interest', interest);
      formData.append('hobbies', hobbies);
      formData.append('github_id', githubId);
      formData.append('linkedIn_id', linkedinId);
      formData.append('leetcode', leetcodeId);
      formData.append('gfg', gfgId);
      formData.append('codechef', codechefId);
      formData.append('upiId', upiId);

      skills.forEach((skill) => {
        formData.append('skills', skill);
      });

      // Append Avatar
      if (newAvatar) {
        const fileName = newAvatar.uri.split('/').pop();
        const fileType = fileName?.split('.').pop();
        formData.append('avatar', {
          uri: Platform.OS === 'ios' ? newAvatar.uri.replace('file://', '') : newAvatar.uri,
          name: fileName,
          type: `image/${fileType}`,
        } as any);
      }

      // Append Banner
      if (newBanner) {
        const fileName = newBanner.uri.split('/').pop();
        const fileType = fileName?.split('.').pop();
        formData.append('banner', {
          uri: Platform.OS === 'ios' ? newBanner.uri.replace('file://', '') : newBanner.uri,
          name: fileName,
          type: `image/${fileType}`,
        } as any);
      }

      const res = await axios.post('/user/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        if (setUser) setUser(res.data.user);
        Toast.show({ type: 'success', text1: 'Profile updated successfully!' });
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Update failed', text2: 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* --- Header --- */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-black/5 bg-white z-10">
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-black text-lg">Cancel</Text>
        </Pressable>
        <Text className="text-black font-bold text-lg">Edit Profile</Text>
        <Pressable 
          onPress={handleUpdate} 
          disabled={loading || !hasChanges}
          style={{ opacity: (loading || !hasChanges) ? 0.5 : 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Text className={`text-lg font-bold ${!hasChanges ? 'text-gray-400' : 'text-blue-500'}`}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="p-4" showsVerticalScrollIndicator={false}>

        {/* --- Banner Image --- */}
        <Pressable onPress={() => pickImage('banner')} className="mb-6">
          <View className="h-32 w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200 justify-center items-center">
            {banner ? (
              <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <Ionicons name="image-outline" size={30} color="#6b7280" />
                <Text className="text-gray-500 text-xs mt-1">Tap to add banner</Text>
              </View>
            )}
            <View className="absolute bg-black/20 p-2 rounded-full">
              <Ionicons name="camera-outline" size={20} color="white" />
            </View>
          </View>
        </Pressable>

        {/* --- Avatar Image --- */}
        <View className="items-center -mt-16 mb-1">
          <Pressable onPress={() => pickImage('avatar')}>
            <Image
              source={{ uri: avatar || `https://ui-avatars.com/api/?name=${username}` }}
              className="h-24 w-24 rounded-full border-4 border-white bg-gray-100"
            />
            <View className="absolute bottom-0 right-0 bg-blue-600 p-1.5 rounded-full border-2 border-white">
              <Ionicons name="pencil" size={14} color="white" />
            </View>
          </Pressable>
          <Text className="text-blue-500 text-sm font-semibold mt-2">Change Profile Photo</Text>
        </View>

        {/* --- Form Fields --- */}
        <View className="space-y-5 pb-10 gap-5">

          <InputGroup label="Name" value={name} onChange={setName} placeholder="Your Name" />
          <InputGroup label="Username" value={username} onChange={setUsername} placeholder="username" />

          <InputGroup label="Bio" value={bio} onChange={setBio} placeholder="Short bio..." multiline />
          <InputGroup label="About" value={about} onChange={setAbout} placeholder="Tell us more about yourself..." multiline />

          {/* --- Skills Tag Input --- */}
          <View>
            <Text className="text-gray-500 text-sm mb-2 ml-1">Skills (Type & comma to add)</Text>
            <View className="bg-gray-100 rounded-xl p-3 flex-row flex-wrap gap-2 border border-gray-200">
              {skills.map((skill, index) => (
                <View key={index} className="bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-full flex-row items-center">
                  <Text className="text-blue-800 font-medium mr-1">{skill}</Text>
                  <Pressable onPress={() => removeSkill(index)}>
                    <Ionicons name="close-circle" size={16} color="#3b82f6" />
                  </Pressable>
                </View>
              ))}
              <TextInput
                value={skillInput}
                onChangeText={handleSkillInput}
                placeholder={skills.length > 0 ? "" : "React, Node.js, Design..."}
                placeholderTextColor="#9ca3af"
                className="text-black min-w-[100px] flex-1 py-1"
              />
            </View>
          </View>

          <InputGroup label="Experience" value={experience} onChange={setExperience} placeholder="e.g. SDE at Google" />
          <InputGroup label="Interests" value={interest} onChange={setInterest} placeholder="e.g. AI, Web3, Cycling" />
          <InputGroup label="Hobbies" value={hobbies} onChange={setHobbies} placeholder="Reading, Gaming..." />

          <View className="bg-green-900/10 p-3 rounded-xl border border-green-500/20 mt-2">
            <InputGroup
              label="UPI ID (For receiving tips/payments)"
              value={upiId}
              onChange={setUpiId}
              placeholder="yourname@upi"
            />
            <Text className="text-green-500/60 text-[10px] mt-1 ml-1 font-medium italic">
              * Other users will use this ID to pay you for your content.
            </Text>
          </View>

          {/* --- Social & Coding Links --- */}
          <View className="pt-4 border-t border-gray-200 mt-2">
            <Text className="text-gray-800 font-bold mb-4 text-lg">Social & Coding Profiles</Text>

            {/* GitHub */}
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 border border-gray-200 mb-3">
              <Ionicons name="logo-github" size={24} color="#1A1A1A" />
              <TextInput
                value={githubId}
                onChangeText={setGithubId}
                placeholder="Github Username"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-black p-3.5"
              />
            </View>

            {/* LinkedIn */}
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 border border-gray-200 mb-3">
              <Ionicons name="logo-linkedin" size={24} color="#0077b5" />
              <TextInput
                value={linkedinId}
                onChangeText={setLinkedinId}
                placeholder="LinkedIn Profile URL"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-black p-3.5"
              />
            </View>

            {/* LeetCode */}
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 border border-gray-200 mb-3">
              <Image
                source={{ uri: "https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0" }}
                width={16} height={16}
                className="w-6 h-6"
                resizeMode="contain"
              />
              <TextInput
                value={leetcodeId}
                onChangeText={setLeetcodeId}
                placeholder="LeetCode Username"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-black p-3.5"
              />
            </View>

            {/* GeeksForGeeks */}
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 border border-gray-200 mb-3">
              <Image
                source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png" }}
                width={16} height={16}
                className="w-6 h-6"
                resizeMode="contain"
              />
              <TextInput
                value={gfgId}
                onChangeText={setGfgId}
                placeholder="GeeksforGeeks Username"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-black p-3.5"
              />
            </View>
            {/* CodeChef */}
            <View className="flex-row items-center bg-gray-100 rounded-xl px-3 border border-gray-200 mb-3">
              <Text style={{ fontSize: 20 }}>👨‍🍳</Text>
              <TextInput
                value={codechefId}
                onChangeText={setCodechefId}
                placeholder="CodeChef Username"
                placeholderTextColor="#9ca3af"
                className="flex-1 text-black p-3.5"
              />
            </View>

          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Reusable Input Component ---
const InputGroup = ({ label, value, onChange, placeholder, multiline = false }: any) => (
  <View>
    <Text className="text-gray-500 text-sm mb-1.5 ml-1">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      className={`bg-gray-100 text-black p-3.5 rounded-xl text-base border border-gray-200 ${multiline ? 'min-h-[80px]' : ''}`}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);