import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';
import { AppBar, Button, FormField } from './ui/kit';
import { getFullUrl } from '../utils/imageUtils';
import { ACCENT_KEYS, PROFILE_ACCENTS, profileAccent } from '../constants/profileAccents';

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
  const savedAccent = user?.accentColor || 'orange';
  const [accentColor, setAccentColor] = useState<string>(savedAccent);

  // --- Images ---
  const [avatar, setAvatar] = useState(getFullUrl(user?.avatar));
  const [newAvatar, setNewAvatar] = useState<any>(null);
  const [banner, setBanner] = useState(getFullUrl(user?.banner));
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
    accentColor !== savedAccent ||
    newAvatar !== null ||
    newBanner !== null;

  // --- IMAGE PICKER ---
  const pickImage = async (type: 'avatar' | 'banner') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      // Android's native crop screen came up blank white with no confirm
      // button, so a picked banner could never be applied. Both images are
      // shown with cover (centre crop) everywhere, so skip it there.
      allowsEditing: Platform.OS === 'ios',
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
    if (!name.trim() || !username.trim()) {
      Toast.show({ type: 'error', text1: 'Name and username cannot be empty' });
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('username', username.trim());

      formData.append('about', about);

      formData.append('interest', interest);
      formData.append('hobbies', hobbies);
      formData.append('github_id', githubId);
      formData.append('linkedIn_id', linkedinId);
      formData.append('upiId', upiId);
      formData.append('accentColor', accentColor);


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
        Toast.show({ type: 'success', text1: 'Profile updated successfully!' });
        navigation.goBack();
        // A new colour remounts the navigator (App.tsx AccentScope); let the back
        // transition land first so the restored stack no longer has this screen.
        if (accentColor !== savedAccent) setTimeout(() => setUser?.(res.data.user), 400);
        else setUser?.(res.data.user);
      } else {
        Toast.show({ type: 'error', text1: 'Update failed', text2: res.data.message || 'Please try again.' });
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Update failed', text2: error?.response?.data?.message || 'Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    // AppBar owns the top inset, so the SafeAreaView only handles the bottom.
    <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
      <AppBar
        title="Edit profile"
        onBack={() => navigation.goBack()}
        right={
          <Button small variant="primary" title="Save" loading={loading} disabled={!hasChanges} onPress={handleUpdate} />
        }
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView className="px-gutter pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* --- Banner Image --- */}
        <Pressable onPress={() => pickImage('banner')} className="mb-6 active:opacity-85" accessibilityRole="button" accessibilityLabel="Change banner">
          <View className="h-32 w-full bg-paper-2 overflow-hidden border border-line justify-center items-center rounded-2xl">
            {banner ? (
              <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <Ionicons name="image-outline" size={30} color={C.ink3} />
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
          <Pressable onPress={() => pickImage('avatar')} className="active:opacity-85" accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Image
              source={{ uri: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}` }}
              className="h-24 w-24 rounded-full border-4 border-paper bg-paper-2"
            />
            <View className="absolute right-0 bg-brand-500 p-1.5 rounded-full border-2 border-paper" style={{ bottom: 0 }}>
              <Ionicons name="pencil" size={14} color={C.onBrand} />
            </View>
          </Pressable>
          <Text className="text-accent-text text-sm font-semibold mt-2">Change profile photo</Text>
        </View>

        {/* --- Form Fields --- */}
        <View className="pb-10 mt-4" style={{ gap: 16 }}>

          <FormField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <FormField label="Username" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" />


          <FormField label="About" value={about} onChangeText={setAbout} placeholder="Tell us more about yourself..." multiline />



          <FormField label="Interests" value={interest} onChangeText={setInterest} placeholder="e.g. AI, Web3, Cycling" />
          <FormField label="Hobbies" value={hobbies} onChangeText={setHobbies} placeholder="Reading, Gaming..." />

          <View>
            <Text className="font-semibold text-ink-2 mb-2" style={{ fontSize: 13, lineHeight: 18 }}>Profile colour</Text>
            <View className="flex-row flex-wrap" style={{ gap: 12 }} accessibilityRole="radiogroup">
              {ACCENT_KEYS.map((k) => {
                const on = accentColor === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setAccentColor(k)}
                    className="w-11 h-11 rounded-full items-center justify-center active:opacity-85"
                    style={{ backgroundColor: PROFILE_ACCENTS[k].fill, borderWidth: on ? 2 : 0, borderColor: C.ink }}
                    accessibilityRole="radio"
                    accessibilityLabel={PROFILE_ACCENTS[k].label}
                    accessibilityState={{ selected: on }}
                  >
                    {on && <Ionicons name="checkmark" size={20} color={profileAccent(k).on} />}
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-ink-3 text-xs mt-2">Changes Fync&apos;s colour everywhere for you. Orange is the default.</Text>
          </View>

          {isFeatureOn('creatorTips') && (
          <FormField
            label="UPI ID (for receiving tips and payments)"
            value={upiId}
            onChangeText={setUpiId}
            placeholder="yourname@upi"
            autoCapitalize="none"
            hint="Other users will use this ID to pay you for your content."
          />
          )}

        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
