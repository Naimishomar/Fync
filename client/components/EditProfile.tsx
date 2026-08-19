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
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
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

  const [about, setAbout] = useState(user?.about || '');



  const [hobbies, setHobbies] = useState(user?.hobbies || '');
  const [interest, setInterest] = useState(user?.interest || '');

  // --- Social Links ---
  const [githubId, setGithubId] = useState(user?.github_id || '');
  const [linkedinId, setLinkedinId] = useState(user?.linkedIn_id || '');

  const [upiId, setUpiId] = useState(user?.upiId || '');

  // --- Images ---
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [newAvatar, setNewAvatar] = useState<any>(null);
  const [banner, setBanner] = useState(user?.banner || null);
  const [newBanner, setNewBanner] = useState<any>(null);

  // --- CHANGE DETECTION ---

  const hasChanges =
    name !== (user?.name || '') ||
    username !== (user?.username || '') ||

    about !== (user?.about || '') ||

    hobbies !== (user?.hobbies || '') ||
    interest !== (user?.interest || '') ||
    githubId !== (user?.github_id || '') ||
    linkedinId !== (user?.linkedIn_id || '') ||
    upiId !== (user?.upiId || '') ||
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



  // --- SUBMIT HANDLER ---
  const handleUpdate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('username', username);

      formData.append('about', about);

      formData.append('interest', interest);
      formData.append('hobbies', hobbies);
      formData.append('github_id', githubId);
      formData.append('linkedIn_id', linkedinId);
      formData.append('upiId', upiId);


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

      // Update Profile
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
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      {/* --- Header --- */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-black/5 bg-transparent z-10">
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
            <ActivityIndicator size="small" color="#f97316" />
          ) : (
            <Text className={`text-lg font-bold ${!hasChanges ? 'text-slate-500' : 'text-orange-500'}`}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="p-4" showsVerticalScrollIndicator={false}>

        {/* --- Banner Image --- */}
        <Pressable onPress={() => pickImage('banner')} className="mb-6">
          <View className="h-32 w-full bg-slate-100 rounded-xl overflow-hidden border border-slate-200 justify-center items-center">
            {banner ? (
              <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <Ionicons name="image-outline" size={30} color="#6b7280" />
                <Text className="text-slate-500 text-xs mt-1">Tap to add banner</Text>
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
              className="h-24 w-24 rounded-full border-4 border-white bg-slate-100"
            />
            <View className="absolute bottom-0 right-0 bg-orange-500 p-1.5 rounded-full border-2 border-white">
              <Ionicons name="pencil" size={14} color="white" />
            </View>
          </Pressable>
          <Text className="text-orange-500 text-sm font-semibold mt-2">Change Profile Photo</Text>
        </View>

        {/* --- Form Fields --- */}
        <View className="space-y-5 pb-10 gap-5">

          <InputGroup label="Name" value={name} onChange={setName} placeholder="Your Name" />
          <InputGroup label="Username" value={username} onChange={setUsername} placeholder="username" />


          <InputGroup label="About" value={about} onChange={setAbout} placeholder="Tell us more about yourself..." multiline />



          <InputGroup label="Interests" value={interest} onChange={setInterest} placeholder="e.g. AI, Web3, Cycling" />
          <InputGroup label="Hobbies" value={hobbies} onChange={setHobbies} placeholder="Reading, Gaming..." />

          <View className="bg-green-900/10 p-3 rounded-xl border border-green-500/20 mt-2">
            <InputGroup
              label="UPI ID (For receiving tips/payments)"
              value={upiId}
              onChange={setUpiId}
              placeholder="yourname@upi"
            />
            <Text className="text-green-500/60 text-2xs mt-1 ml-1 font-medium ">
              * Other users will use this ID to pay you for your content.
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Reusable Input Component ---
const InputGroup = ({ label, value, onChange, placeholder, multiline = false }: any) => (
  <View>
    <Text className="text-slate-500 text-sm mb-1.5 ml-1">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      className={`bg-slate-100 text-black p-3.5 rounded-xl text-base border border-slate-200 ${multiline ? 'min-h-[80px]' : ''}`}
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);
