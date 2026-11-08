import React, { useState } from 'react';
import { View, Text, Image, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';
import { AppBar, Button, FormField, SectionHeader } from './ui/kit';
import { C } from '../constants/colors';

export default function RecruiterEditProfile() {
  const { user, setUser } = useAuth();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);

  // --- Recruiter / Company Info ---
  const [company, setCompany] = useState(user?.company || '');
  const [role, setRole] = useState(user?.role || '');
  const [industry, setIndustry] = useState(user?.industry || '');
  const [companySize, setCompanySize] = useState(user?.companySize || '');
  const [companyWebsite, setCompanyWebsite] = useState(user?.companyWebsite || '');
  const [linkedinId, setLinkedinId] = useState(user?.linkedIn_id || '');
  const [about, setAbout] = useState(user?.about || '');
  const [headquarters, setHeadquarters] = useState(user?.college || '');

  // --- Personal Info ---
  const [name, setName] = useState(user?.name || '');

  // --- Images ---
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [newAvatar, setNewAvatar] = useState<any>(null);
  const [banner, setBanner] = useState(user?.banner || null);
  const [newBanner, setNewBanner] = useState<any>(null);

  // --- Change Detection ---
  const hasChanges =
    company !== (user?.company || '') ||
    role !== (user?.role || '') ||
    industry !== (user?.industry || '') ||
    companySize !== (user?.companySize || '') ||
    companyWebsite !== (user?.companyWebsite || '') ||
    linkedinId !== (user?.linkedIn_id || '') ||
    about !== (user?.about || '') ||
    headquarters !== (user?.college || '') ||
    name !== (user?.name || '') ||
    newAvatar !== null ||
    newBanner !== null;

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

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('company', company);
      formData.append('role', role);
      formData.append('industry', industry);
      formData.append('companySize', companySize);
      formData.append('companyWebsite', companyWebsite);
      formData.append('college', headquarters);
      formData.append('linkedIn_id', linkedinId);
      formData.append('about', about);

      if (newAvatar) {
        const fileName = newAvatar.uri.split('/').pop();
        const fileType = fileName?.split('.').pop();
        formData.append('avatar', {
          uri: Platform.OS === 'ios' ? newAvatar.uri.replace('file://', '') : newAvatar.uri,
          name: fileName,
          type: `image/${fileType}`,
        } as any);
      }

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
        Toast.show({ type: 'success', text1: 'Corporate profile updated!' });
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
      <StatusBar style={C.statusStyle} />

      <AppBar
        title="Profile settings"
        onBack={() => navigation.goBack()}
        right={<Button small variant="primary" title="Save" loading={loading} disabled={!hasChanges} onPress={handleUpdate}/>}
      />

      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1" showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <Pressable
          onPress={() => pickImage('banner')}
          className="mx-gutter h-40 bg-paper-2 rounded-2xl overflow-hidden border border-line active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Change banner"
        >
          {banner ? (
            <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={32} color={C.ink3} />
              <Text className="text-ink-3 text-sm mt-2">Add banner</Text>
            </View>
          )}
          <View className="absolute right-3 bottom-3 bg-card p-2 rounded-full">
            <Ionicons name="camera-outline" size={18} color={C.ink} />
          </View>
        </Pressable>

        {/* Logo */}
        <View className="items-center -mt-12">
          <Pressable
            onPress={() => pickImage('avatar')}
            className="p-1 bg-paper rounded-full active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Change company logo"
          >
            <Image
              source={{ uri: avatar || 'https://ui-avatars.com/api/?name=Company' }}
              className="h-24 w-24 rounded-full bg-paper-2"
            />
            <View className="absolute right-1 bottom-1 bg-brand-500 p-1.5 rounded-full border-2 border-paper">
              <Ionicons name="pencil" size={14} color={C.onBrand} />
            </View>
          </Pressable>
          <Text className="text-ink-3 text-sm mt-2">Company logo</Text>
        </View>

        <View className="px-gutter pb-10">
          <SectionHeader title="Company" />
          <View style={{ gap: 16 }}>
            <FormField label="Company name" value={company} onChangeText={setCompany} placeholder="e.g. Acme Corp" />
            <FormField label="Company website" value={companyWebsite} onChangeText={setCompanyWebsite} placeholder="https://acme.org" keyboardType="url" autoCapitalize="none" />
            <FormField label="Headquarters" value={headquarters} onChangeText={setHeadquarters} placeholder="e.g. Noida, India (Remote)" />
            <View className="flex-row" style={{ gap: 12 }}>
              <FormField containerStyle={{ flex: 1 }} label="Industry" value={industry} onChangeText={setIndustry} placeholder="e.g. FinTech" />
              <FormField containerStyle={{ flex: 1 }} label="Size" value={companySize} onChangeText={setCompanySize} placeholder="e.g. 100-500" />
            </View>
          </View>

          <SectionHeader title="You" />
          <View style={{ gap: 16 }}>
            <FormField label="Your name" value={name} onChangeText={setName} placeholder="Your full name" />
            <FormField label="Role or designation" value={role} onChangeText={setRole} placeholder="e.g. Head of Talent" />
            <FormField label="Username" value={`@${user?.username ?? ''}`} editable={false} hint="Usernames can't be changed." style={{ color: C.ink3 }} />
          </View>

          <SectionHeader title="Presence" />
          <FormField label="LinkedIn URL" value={linkedinId} onChangeText={setLinkedinId} placeholder="https://linkedin.com/..." autoCapitalize="none" keyboardType="url" />

          <SectionHeader title="About the organization" />
          <FormField
            label="Company overview"
            value={about}
            onChangeText={setAbout}
            placeholder="Tell potential candidates about your company's mission and culture..."
            multiline
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
