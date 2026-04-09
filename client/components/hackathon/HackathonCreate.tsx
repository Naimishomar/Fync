import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';

const HackathonCreate = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    hackathonId: '',
    title: '',
    registrationstart: new Date(),
    registrationends: new Date(),
    hackathonstarts: new Date(),
    hackathonends: new Date(),
    prizepool: '',
    MaxTeamSize: '4',
    tags: '',
  });

  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<string | null>(null);

  const pickImage = async (type: 'banner' | 'logo') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'banner' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'banner') setBannerImage(result.assets[0].uri);
        else setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate && showPicker) {
      setForm({ ...form, [showPicker]: selectedDate });
    }
    setShowPicker(null);
  };

  const handleSubmit = async () => {
    if (!form.hackathonId || !form.title) {
      Alert.alert('Error', 'Please fill in Hackathon ID and Title');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Append basic fields
      formData.append('hackathonId', form.hackathonId);
      formData.append('title', form.title);
      formData.append('registrationstart', form.registrationstart.toISOString());
      formData.append('registrationends', form.registrationends.toISOString());
      formData.append('hackathonstarts', form.hackathonstarts.toISOString());
      formData.append('hackathonends', form.hackathonends.toISOString());
      formData.append('prizepool', form.prizepool);
      formData.append('MaxTeamSize', form.MaxTeamSize);
      formData.append('tags', JSON.stringify(form.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')));

      // Append images
      if (bannerImage) {
        const filename = bannerImage.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('bannerImage', { uri: bannerImage, name: filename, type } as any);
      }

      if (logo) {
        const filename = logo.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('logo', { uri: logo, name: filename, type } as any);
      }

      const res = await axios.post('/hackathons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Hackathon created successfully!' });
        navigation.navigate('HackathonHub');
      }
    } catch (error: any) {
      Toast.show({ 
        type: 'error', 
        text1: 'Failed to create hackathon', 
        text2: error.response?.data?.message || 'Something went wrong' 
      });
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, value: string, onChange: (text: string) => void, placeholder: string, keyboardType: any = 'default') => (
    <View className="mb-4">
      <Text className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-2 ml-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        keyboardType={keyboardType}
        className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white font-semibold"
      />
    </View>
  );

  const renderDatePicker = (label: string, field: string) => (
    <View className="mb-4">
      <Text className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-2 ml-1">{label}</Text>
      <TouchableOpacity 
        onPress={() => setShowPicker(field)}
        className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex-row items-center justify-between"
      >
        <Text className="text-white font-semibold">
          {(form as any)[field].toLocaleDateString()}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#6366f1" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black italic uppercase">Create Hackathon</Text>
          <View className="w-10" />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            <View className="bg-zinc-900/50 rounded-3xl p-6 border border-white/5 mt-4">
              
              {/* Image Selectors */}
              <View className="flex-row gap-4 mb-6">
                 {/* Logo Picker */}
                 <TouchableOpacity 
                  onPress={() => pickImage('logo')}
                  className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 items-center justify-center overflow-hidden"
                 >
                   {logo ? (
                     <Image source={{ uri: logo }} className="w-full h-full" />
                   ) : (
                     <>
                      <Ionicons name="image-outline" size={24} color="#6366f1" />
                      <Text className="text-[10px] text-zinc-500 font-bold mt-1">Logo</Text>
                     </>
                   )}
                 </TouchableOpacity>

                 {/* Banner Picker */}
                 <TouchableOpacity 
                  onPress={() => pickImage('banner')}
                  className="flex-1 h-24 rounded-2xl bg-white/5 border border-white/10 items-center justify-center overflow-hidden"
                 >
                   {bannerImage ? (
                     <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" />
                   ) : (
                     <>
                      <Ionicons name="images-outline" size={24} color="#6366f1" />
                      <Text className="text-[10px] text-zinc-500 font-bold mt-1">Banner Image</Text>
                     </>
                   )}
                 </TouchableOpacity>
              </View>

              {renderInput('Hackathon ID', form.hackathonId, (t) => setForm({ ...form, hackathonId: t }), 'Unique ID (e.g. fync-hack-2024)')}
              {renderInput('Hackathon Title', form.title, (t) => setForm({ ...form, title: t }), 'Enter Title')}
              
              <View className="flex-row gap-4">
                <View className="flex-1">
                  {renderDatePicker('Reg Start', 'registrationstart')}
                </View>
                <View className="flex-1">
                  {renderDatePicker('Reg End', 'registrationends')}
                </View>
              </View>

              <View className="flex-row gap-4">
                <View className="flex-1">
                  {renderDatePicker('Hack Start', 'hackathonstarts')}
                </View>
                <View className="flex-1">
                  {renderDatePicker('Hack End', 'hackathonends')}
                </View>
              </View>

              {renderInput('Prize Pool', form.prizepool, (t) => setForm({ ...form, prizepool: t }), 'e.g. $5,000')}
              {renderInput('Max Team Size', form.MaxTeamSize, (t) => setForm({ ...form, MaxTeamSize: t }), '4', 'numeric')}
              {renderInput('Tags', form.tags, (t) => setForm({ ...form, tags: t }), 'React, Node, AI (comma separated)')}

              <TouchableOpacity 
                onPress={handleSubmit} 
                className="mt-6 overflow-hidden rounded-2xl"
                disabled={loading}
              >
                <LinearGradient
                  colors={['#6366f1', '#ec4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="py-4 items-center justify-center flex-row"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Text className="text-white font-black uppercase tracking-widest mr-2">Create Hackathon</Text>
                      <Ionicons name="rocket" size={18} color="white" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {showPicker && (
        <DateTimePicker
          value={(form as any)[showPicker]}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

export default HackathonCreate;
