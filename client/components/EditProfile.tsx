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

  // --- Images ---
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [newAvatar, setNewAvatar] = useState<any>(null);
  const [banner, setBanner] = useState(user?.banner || null);
  const [newBanner, setNewBanner] = useState<any>(null);

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
    <SafeAreaView className="flex-1 bg-black">
      {/* --- Header --- */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-gray-900 bg-black z-10">
        <Pressable onPress={() => navigation.goBack()}>
          <Text className="text-white text-lg">Cancel</Text>
        </Pressable>
        <Text className="text-white font-bold text-lg">Edit Profile</Text>
        <Pressable onPress={handleUpdate} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <Text className="text-blue-500 text-lg font-bold">Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
        
        {/* --- Banner Image --- */}
        <Pressable onPress={() => pickImage('banner')} className="mb-6">
            <View className="h-32 w-full bg-gray-800 rounded-xl overflow-hidden border border-gray-700 justify-center items-center">
                {banner ? (
                    <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <View className="items-center">
                        <Ionicons name="image-outline" size={30} color="#9ca3af" />
                        <Text className="text-gray-400 text-xs mt-1">Tap to add banner</Text>
                    </View>
                )}
                <View className="absolute bg-black/40 p-2 rounded-full">
                    <Ionicons name="camera-outline" size={20} color="white" />
                </View>
            </View>
        </Pressable>

        {/* --- Avatar Image --- */}
        <View className="items-center -mt-16 mb-6">
          <Pressable onPress={() => pickImage('avatar')}>
            <Image
              source={{ uri: avatar || `https://ui-avatars.com/api/?name=${username}` }}
              className="h-24 w-24 rounded-full border-4 border-black bg-gray-800"
            />
            <View className="absolute bottom-0 right-0 bg-blue-600 p-1.5 rounded-full border-2 border-black">
                <Ionicons name="pencil" size={14} color="white" />
            </View>
          </Pressable>
          <Text className="text-blue-500 text-sm font-semibold mt-2">Change Profile Photo</Text>
        </View>

        {/* --- Form Fields --- */}
        <View className="space-y-5 pb-10">
          
          <InputGroup label="Name" value={name} onChange={setName} placeholder="Your Name" />
          <InputGroup label="Username" value={username} onChange={setUsername} placeholder="username" />
          
          <InputGroup label="Bio" value={bio} onChange={setBio} placeholder="Short bio..." multiline />
          <InputGroup label="About" value={about} onChange={setAbout} placeholder="Tell us more about yourself..." multiline />

          {/* --- Skills Tag Input --- */}
          <View>
            <Text className="text-gray-400 text-sm mb-2 ml-1">Skills (Type & comma to add)</Text>
            <View className="bg-gray-900 rounded-xl p-3 flex-row flex-wrap gap-2 border border-gray-800">
               {skills.map((skill, index) => (
                   <View key={index} className="bg-blue-900/50 border border-blue-500/30 px-3 py-1.5 rounded-full flex-row items-center">
                       <Text className="text-blue-100 font-medium mr-1">{skill}</Text>
                       <Pressable onPress={() => removeSkill(index)}>
                           <Ionicons name="close-circle" size={16} color="#93c5fd" />
                       </Pressable>
                   </View>
               ))}
               <TextInput
                  value={skillInput}
                  onChangeText={handleSkillInput}
                  placeholder={skills.length > 0 ? "" : "React, Node.js, Design..."}
                  placeholderTextColor="#6b7280"
                  className="text-white min-w-[100px] flex-1 py-1"
               />
            </View>
          </View>

          <InputGroup label="Experience" value={experience} onChange={setExperience} placeholder="e.g. SDE at Google" />
          <InputGroup label="Interests" value={interest} onChange={setInterest} placeholder="e.g. AI, Web3, Cycling" />
          <InputGroup label="Hobbies" value={hobbies} onChange={setHobbies} placeholder="Reading, Gaming..." />

          {/* --- Social & Coding Links --- */}
          <View className="pt-4 border-t border-gray-800 mt-2">
              <Text className="text-gray-300 font-bold mb-4 text-lg">Social & Coding Profiles</Text>
              
              {/* GitHub */}
              <View className="flex-row items-center bg-gray-900 rounded-xl px-3 border border-gray-800 mb-3">
                  <Ionicons name="logo-github" size={24} color="white" />
                  <TextInput
                    value={githubId}
                    onChangeText={setGithubId}
                    placeholder="Github Username"
                    placeholderTextColor="#666"
                    className="flex-1 text-white p-3.5 ml-2"
                  />
              </View>

              {/* LinkedIn */}
              <View className="flex-row items-center bg-gray-900 rounded-xl px-3 border border-gray-800 mb-3">
                  <Ionicons name="logo-linkedin" size={24} color="#0077b5" />
                  <TextInput
                    value={linkedinId}
                    onChangeText={setLinkedinId}
                    placeholder="LinkedIn Profile URL"
                    placeholderTextColor="#666"
                    className="flex-1 text-white p-3.5 ml-2"
                  />
              </View>

              {/* LeetCode */}
              <View className="flex-row items-center bg-gray-900 rounded-xl px-3 border border-gray-800 mb-3">
                  <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" }} 
                    width={16} height={16}
                    className="w-6 h-6"
                    style={{ tintColor: '#facc15' }}
                    resizeMode="contain"
                  />
                  <TextInput
                    value={leetcodeId}
                    onChangeText={setLeetcodeId}
                    placeholder="LeetCode Username"
                    placeholderTextColor="#666"
                    className="flex-1 text-white p-3.5 ml-2"
                  />
              </View>

              {/* GeeksForGeeks */}
              <View className="flex-row items-center bg-gray-900 rounded-xl px-3 border border-gray-800 mb-3">
                  <Image 
                    source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/43/GeeksforGeeks.svg" }} 
                    width={6} height={6}
                    className="w-6 h-6"
                    resizeMode="contain"
                  />
                  <TextInput
                    value={gfgId}
                    onChangeText={setGfgId}
                    placeholder="GeeksforGeeks Username"
                    placeholderTextColor="#666"
                    className="flex-1 text-white p-3.5 ml-2"
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
        <Text className="text-gray-400 text-sm mb-1.5 ml-1">{label}</Text>
        <TextInput
            value={value}
            onChangeText={onChange}
            className={`bg-gray-900 text-white p-3.5 rounded-xl text-base border border-gray-800 ${multiline ? 'min-h-[80px]' : ''}`}
            placeholder={placeholder}
            placeholderTextColor="#525252"
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
        />
    </View>
);