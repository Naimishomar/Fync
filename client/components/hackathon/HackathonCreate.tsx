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
import { StatusBar } from 'expo-status-bar';

const HackathonCreate = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  // Form State
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

  // Complex Nested State
  const [eligibility, setEligibility] = useState({ Year: '', branch: '', colleges: '' });
  const [criteria, setCriteria] = useState([{ name: '', weightage: '0', description: '' }]);
  const [prizes, setPrizes] = useState([{ rank: 1, title: '', amount: '' }]);
  
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

  const addCriteria = () => setCriteria([...criteria, { name: '', weightage: '0', description: '' }]);
  const removeCriteria = (i: number) => setCriteria(criteria.filter((_, idx) => idx !== i));

  const addPrize = () => setPrizes([...prizes, { rank: prizes.length + 1, title: '', amount: '' }]);
  const removePrize = (i: number) => setPrizes(prizes.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.hackathonId || !form.title) {
      Alert.alert('Error', 'Please fill in Hackathon ID and Title');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      
      // Basic fields
      Object.entries(form).forEach(([key, val]) => {
        if (val instanceof Date) formData.append(key, val.toISOString());
        else formData.append(key, String(val));
      });

      // Tags
      formData.append('tags', JSON.stringify(form.tags.split(',').map(tag => tag.trim()).filter(t => t)));

      // Complex fields
      formData.append('eligibility', JSON.stringify({
        Year: eligibility.Year.split(',').map(s => s.trim()).filter(s => s),
        branch: eligibility.branch.split(',').map(s => s.trim()).filter(s => s),
        colleges: eligibility.colleges.split(',').map(s => s.trim()).filter(s => s),
      }));
      formData.append('judgingcriteria', JSON.stringify(criteria.filter(c => c.name)));
      formData.append('prizes', JSON.stringify(prizes.filter(p => p.title)));

      // Images
      if (bannerImage) {
        const filename = bannerImage.split('/').pop() || 'banner.jpg';
        formData.append('bannerImage', { uri: bannerImage, name: filename, type: 'image/jpeg' } as any);
      }
      if (logo) {
        const filename = logo.split('/').pop() || 'logo.jpg';
        formData.append('logo', { uri: logo, name: filename, type: 'image/jpeg' } as any);
      }

      const res = await axios.post('/hackathons', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Hackathon Live! 🚀' });
        navigation.navigate('HackathonHub');
      }
    } catch (error: any) {
      Toast.show({ 
        type: 'error', 
        text1: 'Failed to create', 
        text2: error.response?.data?.message || 'Check your fields' 
      });
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = (title: string, icon: string) => (
    <View className="flex-row items-center mt-6 mb-4">
      <View className="w-8 h-8 rounded-xl bg-indigo-100 items-center justify-center mr-2">
        <Ionicons name={icon as any} size={16} color="#4338ca" />
      </View>
      <Text className="text-zinc-900 font-black italic text-lg">{title}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar backgroundColor="#F8FAFC" />
      <SafeAreaView className="flex-1">
        
        {/* Header */}
        <View className="flex-row items-center px-5 py-4 border-b border-slate-100 bg-white">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-2xl bg-slate-50 items-center justify-center mr-3">
            <Ionicons name="arrow-back" size={20} color="#1e293b" />
          </TouchableOpacity>
          <View>
            <Text className="text-zinc-900 text-xl font-black italic uppercase tracking-tight">Create Hackathon</Text>
            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">New Ecosystem Hub</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            
            {/* Visual Assets */}
            <View className="flex-row gap-4 mb-6">
               <TouchableOpacity onPress={() => pickImage('logo')} className="w-24 h-24 rounded-3xl bg-white border-2 border-dashed border-slate-200 items-center justify-center overflow-hidden">
                 {logo ? <Image source={{ uri: logo }} className="w-full h-full" /> : <Ionicons name="image-outline" size={24} color="#94a3b8" />}
               </TouchableOpacity>

               <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 h-24 rounded-3xl bg-white border-2 border-dashed border-slate-200 items-center justify-center overflow-hidden">
                 {bannerImage ? <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" /> : <Ionicons name="images-outline" size={24} color="#94a3b8" />}
               </TouchableOpacity>
            </View>

            {/* Basic Info */}
            {renderSectionHeader('Essentials', 'rocket')}
            <View className="bg-white rounded-3xl p-5 border border-slate-100" style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
              <TextInput value={form.hackathonId} onChangeText={(t) => setForm({ ...form, hackathonId: t })} placeholder="Unique ID (e.g. hack-2024)" className="bg-slate-50 rounded-2xl px-4 py-3.5 mb-3 text-zinc-900 font-bold border border-slate-100" />
              <TextInput value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Hackathon Title" className="bg-slate-50 rounded-2xl px-4 py-3.5 mb-3 text-zinc-900 font-bold border border-slate-100" />
              <TextInput value={form.tags} onChangeText={(t) => setForm({ ...form, tags: t })} placeholder="Tags (AI, Web, ML...)" className="bg-slate-50 rounded-2xl px-4 py-3.5 mb-3 text-zinc-900 font-bold border border-slate-100" />
              <View className="flex-row gap-3">
                <TextInput value={form.prizepool} onChangeText={(t) => setForm({ ...form, prizepool: t })} placeholder="Prize Pool ($...)" className="flex-1 bg-slate-50 rounded-2xl px-4 py-3.5 text-zinc-900 font-bold border border-slate-100" />
                <TextInput value={form.MaxTeamSize} onChangeText={(t) => setForm({ ...form, MaxTeamSize: t })} placeholder="Max Teams" keyboardType="numeric" className="flex-1 bg-slate-50 rounded-2xl px-4 py-3.5 text-zinc-900 font-bold border border-slate-100" />
              </View>
            </View>

            {/* Dates */}
            {renderSectionHeader('Timeline', 'calendar')}
            <View className="bg-white rounded-3xl p-5 border border-slate-100">
              {['registrationstart', 'registrationends', 'hackathonstarts', 'hackathonends'].map((field) => (
                <TouchableOpacity key={field} onPress={() => setShowPicker(field)} className="flex-row items-center justify-between bg-slate-50 rounded-2xl px-4 py-3.5 mb-2 border border-slate-100">
                  <Text className="text-slate-500 font-bold capitalize text-xs">{field.replace(/([A-Z])/g, ' $1')}</Text>
                  <Text className="text-zinc-900 font-black">{(form as any)[field].toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Eligibility */}
            {renderSectionHeader('Eligibility', 'school')}
            <View className="bg-white rounded-3xl p-5 border border-slate-100">
              <TextInput value={eligibility.colleges} onChangeText={(t) => setEligibility({ ...eligibility, colleges: t })} placeholder="Target Colleges (Comma separated)" className="bg-slate-50 rounded-2xl px-4 py-3.5 mb-3 text-zinc-900 font-bold border border-slate-100" />
              <TextInput value={eligibility.Year} onChangeText={(t) => setEligibility({ ...eligibility, Year: t })} placeholder="Target Years (e.g. 1st, 2nd)" className="bg-slate-50 rounded-2xl px-4 py-3.5 mb-3 text-zinc-900 font-bold border border-slate-100" />
              <TextInput value={eligibility.branch} onChangeText={(t) => setEligibility({ ...eligibility, branch: t })} placeholder="Target Branches (CS, IT...)" className="bg-slate-50 rounded-2xl px-4 py-3.5 text-zinc-900 font-bold border border-slate-100" />
            </View>

            {/* Judging Criteria */}
            {renderSectionHeader('Judging Criteria', 'analytics')}
            <View className="bg-white rounded-3xl p-5 border border-slate-100">
              {criteria.map((c, i) => (
                <View key={i} className="bg-slate-50 rounded-2xl p-4 mb-3 border border-slate-200 relative">
                  <TextInput value={c.name} onChangeText={(t) => setCriteria(criteria.map((x, idx) => idx === i ? { ...x, name: t } : x))} placeholder="Criterion Name (e.g. Innovation)" className="text-zinc-900 font-black mb-2" />
                  <View className="flex-row gap-3">
                    <TextInput value={c.weightage} onChangeText={(t) => setCriteria(criteria.map((x, idx) => idx === i ? { ...x, weightage: t } : x))} placeholder="Weight %" keyboardType="numeric" className="flex-1 bg-white rounded-xl px-3 py-2 text-zinc-900 font-bold" />
                    <TextInput value={c.description} onChangeText={(t) => setCriteria(criteria.map((x, idx) => idx === i ? { ...x, description: t } : x))} placeholder="Brief description..." className="flex-[2] bg-white rounded-xl px-3 py-2 text-zinc-900 font-bold" />
                  </View>
                  <TouchableOpacity onPress={() => removeCriteria(i)} className="absolute -top-2 -right-2 bg-red-100 w-6 h-6 rounded-full items-center justify-center">
                    <Ionicons name="close" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addCriteria} className="flex-row items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl mt-2">
                <Ionicons name="add" size={20} color="#6366f1" />
                <Text className="text-indigo-600 font-black ml-1">Add Criterion</Text>
              </TouchableOpacity>
            </View>

            {/* Prizes */}
            {renderSectionHeader('Prizes', 'medal')}
            <View className="bg-white rounded-3xl p-5 border border-slate-100">
               {prizes.map((p, i) => (
                 <View key={i} className="flex-row items-center gap-2 mb-3">
                   <View className="w-10 h-10 rounded-xl bg-slate-100 items-center justify-center"><Text className="font-black">#{p.rank}</Text></View>
                   <TextInput value={p.title} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, title: t } : x))} placeholder="Prize Title" className="flex-1 bg-slate-50 rounded-xl px-4 py-3 font-bold text-zinc-900" />
                   <TextInput value={p.amount} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, amount: t } : x))} placeholder="Amount" className="flex-1 bg-slate-50 rounded-xl px-4 py-3 font-bold text-zinc-900" />
                 </View>
               ))}
               <TouchableOpacity onPress={addPrize} className="flex-row items-center justify-center p-3 border-2 border-dashed border-slate-200 rounded-2xl mt-2">
                <Ionicons name="add" size={20} color="#6366f1" />
                <Text className="text-indigo-600 font-black ml-1">Add Prize</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={loading} className="mt-10 overflow-hidden rounded-3xl">
              <LinearGradient colors={['#4338ca', '#6366f1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-5 items-center justify-center flex-row">
                {loading ? <ActivityIndicator size="small" color="white" /> : (
                  <>
                    <Text className="text-white font-black uppercase tracking-widest mr-2 text-lg italic">Launch Hackathon</Text>
                    <Ionicons name="rocket" size={20} color="white" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {showPicker && (
        <DateTimePicker value={(form as any)[showPicker]} mode="date" display="default" onChange={handleDateChange} />
      )}
    </View>
  );
};

export default HackathonCreate;

