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
    <SafeAreaView className="flex-1 bg-paper">
      {/* HEADER DECORATION */}

      {/* --- Header --- */}
      <View className="flex-row items-center justify-between px-4 py-2 border-b border-black/5 bg-transparent z-10">
        <Pressable onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
          <Text className="text-ink text-lg">Cancel</Text>
        </Pressable>
        <Text className="text-ink font-display text-lg">Edit Profile</Text>
        <Pressable
          onPress={handleUpdate}
          disabled={loading || !hasChanges}
          style={{ opacity: (loading || !hasChanges) ? 0.5 : 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#F97316" />
          ) : (
            <Text className={`text-lg font-display ${!hasChanges ? 'text-ink-3' : 'text-accent-text'}`}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView className="p-4" showsVerticalScrollIndicator={false}>

        {/* --- Banner Image --- */}
        <Pressable onPress={() => pickImage('banner')} className="mb-6">
          <View className="h-32 w-full bg-paper-2 overflow-hidden border border-line justify-center items-center rounded-md">
            {banner ? (
              <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <Ionicons name="image-outline" size={30} color="#8B857E" />
                <Text className="text-ink-3 text-xs mt-1">Tap to add banner</Text>
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
              className="h-24 w-24 rounded-full border-4 border-paper bg-paper-2"
            />
            <View className="absolute bottom-0 right-0 bg-brand-500 p-1.5 rounded-full border-2 border-paper">
              <Ionicons name="pencil" size={14} color="#12100E" />
            </View>
          </Pressable>
          <Text className="text-accent-text text-sm font-semibold mt-2">Change Profile Photo</Text>
        </View>

        {/* --- Form Fields --- */}
        <View className="space-y-5 pb-10 gap-5">

          <InputGroup label="Name" value={name} onChange={setName} placeholder="Your Name" />
          <InputGroup label="Username" value={username} onChange={setUsername} placeholder="username" />


          <InputGroup label="About" value={about} onChange={setAbout} placeholder="Tell us more about yourself..." multiline />



          <InputGroup label="Interests" value={interest} onChange={setInterest} placeholder="e.g. AI, Web3, Cycling" />
          <InputGroup label="Hobbies" value={hobbies} onChange={setHobbies} placeholder="Reading, Gaming..." />

          <View className="bg-success/10 p-3 rounded-xl border border-success/20 mt-2">
            <InputGroup
              label="UPI ID (For receiving tips/payments)"
              value={upiId}
              onChange={setUpiId}
              placeholder="yourname@upi"
            />
            <Text className="text-success/60 text-label mt-1 ml-1 font-medium">
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
    <Text className="text-ink-3 text-sm mb-1.5 ml-1">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      className={`bg-paper-2 text-ink p-3.5 rounded-xl text-base border border-line ${multiline ? 'min-h-[80px]' : ''}`}
      placeholder={placeholder}
      placeholderTextColor="#C4BEB6"
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);
