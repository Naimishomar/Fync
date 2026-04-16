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
    <View className="flex-row items-center mt-8 mb-4">
      <View className="w-10 h-10 rounded-2xl bg-slate-50 border border-gray-100 items-center justify-center mr-3 shadow-sm">
        <Ionicons name={icon as any} size={18} color="#ec4899" />
      </View>
      <Text className="text-zinc-900 font-black italic text-xl uppercase tracking-tighter">{title}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">
        
        {/* Header */}
        <View className="flex-row items-center px-8 py-6 border-b border-slate-50 bg-white">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-12 h-12 rounded-2xl bg-zinc-900 items-center justify-center mr-4 shadow-lg shadow-zinc-900/20">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-zinc-900 text-3xl font-black italic uppercase tracking-tighter leading-7">Create</Text>
            <Text className="text-zinc-900 text-3xl font-black italic uppercase tracking-tighter leading-7">Protocol</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}>
            
            {/* Visual Assets */}
            <View className="flex-row gap-4 mt-8">
               <TouchableOpacity onPress={() => pickImage('logo')} className="w-28 h-28 rounded-[32px] bg-slate-50 border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden shadow-sm">
                 {logo ? <Image source={{ uri: logo }} className="w-full h-full" /> : <View className="items-center"><Ionicons name="flash-outline" size={28} color="#94a3b8" /><Text className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Logo</Text></View>}
               </TouchableOpacity>

               <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 h-28 rounded-[32px] bg-slate-50 border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden shadow-sm">
                 {bannerImage ? <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" /> : <View className="items-center"><Ionicons name="images-outline" size={28} color="#94a3b8" /><Text className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Banner</Text></View>}
               </TouchableOpacity>
            </View>

            {/* Basic Info */}
            {renderSectionHeader('Essentials', 'rocket')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              <TextInput value={form.hackathonId} onChangeText={(t) => setForm({ ...form, hackathonId: t })} placeholder="UNIQUE ID (E.G. HACK-2024)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
              <TextInput value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="PROTOCOL TITLE" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
              <TextInput value={form.tags} onChangeText={(t) => setForm({ ...form, tags: t })} placeholder="TAGS (AI, WEB, ML...)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
              <View className="flex-row gap-4">
                <TextInput value={form.prizepool} onChangeText={(t) => setForm({ ...form, prizepool: t })} placeholder="PRIZE POOL" placeholderTextColor="#94a3b8" className="flex-[2] bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
                <TextInput value={form.MaxTeamSize} onChangeText={(t) => setForm({ ...form, MaxTeamSize: t })} placeholder="MAX GROUP" placeholderTextColor="#94a3b8" keyboardType="numeric" className="flex-1 bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
              </View>
            </View>

            {/* Dates */}
            {renderSectionHeader('Timeline', 'calendar')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              {['registrationstart', 'registrationends', 'hackathonstarts', 'hackathonends'].map((field) => (
                <TouchableOpacity key={field} onPress={() => setShowPicker(field)} className="flex-row items-center justify-between bg-zinc-900 rounded-2xl px-6 py-4 mb-3 border border-zinc-800">
                  <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest">{field.replace(/([A-Z])/g, ' $1')}</Text>
                  <Text className="text-white font-black italic uppercase tracking-tight">{(form as any)[field].toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Eligibility */}
            {renderSectionHeader('Targeting', 'school')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              <TextInput value={eligibility.colleges} onChangeText={(t) => setEligibility({ ...eligibility, colleges: t })} placeholder="COLLEGE PROTOCOLS (COMMA SEP)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
              <TextInput value={eligibility.Year} onChangeText={(t) => setEligibility({ ...eligibility, Year: t })} placeholder="TARGET YEARS (E.G. 1ST, 2ND)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
              <TextInput value={eligibility.branch} onChangeText={(t) => setEligibility({ ...eligibility, branch: t })} placeholder="TARGET BRANCHES (CS, IT...)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black italic uppercase text-sm border border-gray-100" />
            </View>

            {/* Judging Criteria */}
            {renderSectionHeader('Evaluation', 'analytics')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              {criteria.map((c, i) => (
                <View key={i} className="bg-slate-50 rounded-2xl p-5 mb-4 border border-gray-100 relative">
                  <TextInput value={c.name} onChangeText={(t) => setCriteria(criteria.map((x, idx) => idx === i ? { ...x, name: t } : x))} placeholder="CRITERION NAME" placeholderTextColor="#94a3b8" className="text-zinc-900 font-black italic uppercase tracking-tight mb-3" />
                  <View className="flex-row gap-4">
                    <TextInput value={c.weightage} onChangeText={(t) => setCriteria(criteria.map((x, idx) => idx === i ? { ...x, weightage: t } : x))} placeholder="WT %" placeholderTextColor="#94a3b8" keyboardType="numeric" className="flex-1 bg-white rounded-xl px-4 py-2 text-zinc-900 font-black italic uppercase text-xs border border-gray-100" />
                    <TextInput value={c.description} onChangeText={(t) => setCriteria(criteria.map((x, idx) => idx === i ? { ...x, description: t } : x))} placeholder="DESCRIPTION..." placeholderTextColor="#94a3b8" className="flex-[2] bg-white rounded-xl px-4 py-2 text-zinc-900 font-black italic uppercase text-xs border border-gray-100" />
                  </View>
                  <TouchableOpacity onPress={() => removeCriteria(i)} className="absolute -top-3 -right-3 bg-white w-8 h-8 rounded-full items-center justify-center shadow-lg border border-gray-100">
                    <Ionicons name="close" size={18} color="#f43f5e" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addCriteria} className="flex-row items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-2xl mt-2">
                <Ionicons name="add" size={24} color="#ec4899" />
                <Text className="text-pink-500 font-black italic uppercase tracking-widest ml-2 text-xs">Add Criterion</Text>
              </TouchableOpacity>
            </View>

            {/* Prizes */}
            {renderSectionHeader('Rewards', 'medal')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
               {prizes.map((p, i) => (
                 <View key={i} className="flex-row items-center gap-3 mb-4">
                   <View className="w-12 h-12 rounded-2xl bg-zinc-900 items-center justify-center border border-zinc-800 shadow-sm"><Text className="font-black text-white italic text-xs">#{p.rank}</Text></View>
                   <TextInput value={p.title} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, title: t } : x))} placeholder="PRIZE TITLE" placeholderTextColor="#94a3b8" className="flex-1 bg-slate-50 rounded-2xl px-5 py-3 font-black italic uppercase text-xs text-zinc-900 border border-gray-100" />
                   <TextInput value={p.amount} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, amount: t } : x))} placeholder="AMT" placeholderTextColor="#94a3b8" className="flex-1 bg-slate-50 rounded-2xl px-5 py-3 font-black italic uppercase text-xs text-zinc-900 border border-gray-100" />
                 </View>
               ))}
               <TouchableOpacity onPress={addPrize} className="flex-row items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-2xl mt-2">
                <Ionicons name="add" size={24} color="#ec4899" />
                <Text className="text-pink-500 font-black italic uppercase tracking-widest ml-2 text-xs">Add Reward</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={loading} className="mt-12 overflow-hidden rounded-[32px] shadow-xl shadow-pink-500/30">
              <LinearGradient colors={['#ec4899', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-6 items-center justify-center flex-row">
                {loading ? <ActivityIndicator size="small" color="white" /> : (
                  <>
                    <Text className="text-white font-black italic uppercase tracking-widest mr-3 text-lg">Launch Protocol</Text>
                    <Ionicons name="rocket" size={24} color="white" />
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


