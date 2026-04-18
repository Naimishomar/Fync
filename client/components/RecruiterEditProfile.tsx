import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

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
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-50">
        <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text className="text-zinc-900 font-black italic uppercase text-xs tracking-widest">Global Profile Settings</Text>
        <TouchableOpacity 
            onPress={handleUpdate} 
            disabled={loading || !hasChanges}
            className={`bg-indigo-600 px-5 py-2 rounded-xl shadow-sm ${(!hasChanges || loading) ? 'opacity-50' : ''}`}
        >
            {loading ? (
                <ActivityIndicator size="small" color="white" />
            ) : (
                <Text className="text-white font-black italic uppercase text-[10px] tracking-widest">Save</Text>
            )}
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Banner Section */}
        <TouchableOpacity onPress={() => pickImage('banner')} className="w-full h-40 bg-slate-100 relative">
            {banner ? (
                <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
            ) : (
                <View className="flex-1 items-center justify-center">
                    <Ionicons name="image-outline" size={32} color="#94a3b8" />
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Add Banner</Text>
                </View>
            )}
            <View className="absolute bottom-3 right-3 bg-white/90 p-2 rounded-full shadow-md">
                <Ionicons name="camera" size={18} color="#6366f1" />
            </View>
        </TouchableOpacity>

        {/* Avatar / Logo Section */}
        <View className="items-center -mt-12">
            <TouchableOpacity onPress={() => pickImage('avatar')} className="p-1.5 bg-white rounded-full shadow-lg">
                <Image 
                    source={{ uri: avatar || 'https://ui-avatars.com/api/?name=Company' }} 
                    className="h-24 w-24 rounded-full bg-slate-100"
                />
                <View className="absolute bottom-1 right-1 bg-indigo-600 p-1.5 rounded-full border-2 border-white">
                    <Ionicons name="pencil" size={14} color="white" />
                </View>
            </TouchableOpacity>
            <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-3">Company Logo / Profile</Text>
        </View>

        <View className="px-5 mt-8 pb-10 gap-6">
            
            {/* Section: Company Details */}
            <View>
                <SectionHeader title="Corporate Identity" icon="business" color="#6366f1" />
                <View className="gap-4">
                    <InputGroup label="Company Name" value={company} onChange={setCompany} placeholder="e.g. Acme Corp" />
                    <InputGroup label="Company Website" value={companyWebsite} onChange={setCompanyWebsite} placeholder="https://acme.org" keyboardType="url" />
                    <InputGroup label="Headquarters Location" value={headquarters} onChange={setHeadquarters} placeholder="e.g. Noida, India (Remote)" />
                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <InputGroup label="Industry" value={industry} onChange={setIndustry} placeholder="e.g. FinTech" />
                        </View>
                        <View className="flex-1">
                            <InputGroup label="Size" value={companySize} onChange={setCompanySize} placeholder="e.g. 100-500" />
                        </View>
                    </View>
                </View>
            </View>

            {/* Section: Your Professional Role */}
            <View>
                <SectionHeader title="Professional Identity" icon="person-circle" color="#10b981" />
                <View className="gap-4">
                    <InputGroup label="Your Name" value={name} onChange={setName} placeholder="Your full name" />
                    <InputGroup label="Role / Designation" value={role} onChange={setRole} placeholder="e.g. Head of Talent" />
                    
                    <View>
                        <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1.5 ml-1">Username (Fixed)</Text>
                        <View className="bg-slate-100 p-4 rounded-2xl border border-slate-200">
                            <Text className="text-slate-400 font-bold text-sm">@{user?.username}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Section: Professional Links */}
            <View>
                <SectionHeader title="Presence" icon="share-social" color="#ef4444" />
                <InputGroup label="LinkedIn Company/Personal URL" value={linkedinId} onChange={setLinkedinId} placeholder="https://linkedin.com/..." />
            </View>

            {/* Section: About Company */}
            <View>
                <SectionHeader title="About the Organization" icon="document-text" color="#f59e0b" />
                <InputGroup 
                    label="Company Overview" 
                    value={about} 
                    onChange={setAbout} 
                    placeholder="Tell potential candidates about your company's mission and culture..." 
                    multiline 
                />
            </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const SectionHeader = ({ title, icon, color }: any) => (
    <View className="flex-row items-center gap-2 mb-4">
        <View className="w-1 h-5 rounded-full" style={{ backgroundColor: color }} />
        <Ionicons name={icon} size={16} color={color} />
        <Text className="text-zinc-900 font-black italic uppercase text-[11px] tracking-wide">{title}</Text>
    </View>
);

const InputGroup = ({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default' }: any) => (
    <View>
      <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1.5 ml-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        className={`bg-slate-50 text-zinc-900 p-4 rounded-2xl text-sm font-bold border border-slate-100 ${multiline ? 'min-h-[100px]' : ''}`}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        keyboardType={keyboardType as any}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
