import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const CreateOpportunity = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialType = route.params?.type || 'internship';

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: 'Remote',
    type: initialType,
    opportunityType: 'Full-Time',
    duration: '',
    stipend: '',
    description: '',
    applicationLink: ''
  });

  const handlePost = async () => {
    const { title, company, type, description, applicationLink } = formData;
    
    if (!title || !company || !description || !applicationLink) {
      Alert.alert("Required Fields", "Please fill in all mandatory fields (Title, Company, Description, Link).");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/opportunity/create', formData);
      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Opportunity Posted!',
          text2: 'Your post is now live for all candidates.'
        });
        navigation.goBack();
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.message || "Failed to post opportunity.";
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50">
            <Ionicons name="chevron-back" size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-xl font-black italic uppercase tracking-tighter">Post Opportunity</Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
          {/* Type Selector */}
          <View className="mt-6 flex-row bg-slate-100 p-1.5 rounded-2xl border border-gray-100">
            <TouchableOpacity 
              onPress={() => setFormData({...formData, type: 'internship'})}
              className={`flex-1 py-3 rounded-xl items-center ${formData.type === 'internship' ? 'bg-white' : ''}`}
            >
              <Text className={`font-black uppercase text-[10px] tracking-widest ${formData.type === 'internship' ? 'text-pink-500' : 'text-slate-400'}`}>Internship</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setFormData({...formData, type: 'job'})}
              className={`flex-1 py-3 rounded-xl items-center ${formData.type === 'job' ? 'bg-white' : ''}`}
            >
              <Text className={`font-black uppercase text-[10px] tracking-widest ${formData.type === 'job' ? 'text-pink-500' : 'text-slate-400'}`}>Full Job</Text>
            </TouchableOpacity>
          </View>

          <View className="mt-8 gap-5 pb-10">
            <InputGroup 
              label="Role Title *" 
              value={formData.title} 
              placeholder="e.g. Backend Developer Intern"
              onChange={(v: any) => setFormData({...formData, title: v})} 
            />
            
            <InputGroup 
              label="Company Name *" 
              value={formData.company} 
              placeholder="e.g. Google India"
              onChange={(v: any) => setFormData({...formData, company: v})} 
            />

            <View className="flex-row gap-4">
              <View className="flex-1">
                <InputGroup 
                  label="Location" 
                  value={formData.location} 
                  placeholder="Remote / Bangalore"
                  onChange={(v: any) => setFormData({...formData, location: v})} 
                />
              </View>
              <View className="flex-1">
                <InputGroup 
                  label="Work Type" 
                  value={formData.opportunityType} 
                  placeholder="Full-time / PPO"
                  onChange={(v: any) => setFormData({...formData, opportunityType: v})} 
                />
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <InputGroup 
                  label="Duration" 
                  value={formData.duration} 
                  placeholder="e.g. 6 Months"
                  onChange={(v: any) => setFormData({...formData, duration: v})} 
                />
              </View>
              <View className="flex-1">
                <InputGroup 
                  label={formData.type === 'internship' ? "Stipend" : "Annual Package"} 
                  value={formData.stipend} 
                  placeholder="₹20k / ₹15 LPA"
                  onChange={(v: any) => setFormData({...formData, stipend: v})} 
                />
              </View>
            </View>

            <InputGroup 
              label="Application Link *" 
              value={formData.applicationLink} 
              placeholder="https://..."
              onChange={(v: any) => setFormData({...formData, applicationLink: v})} 
            />

            <InputGroup 
              label="Description *" 
              value={formData.description} 
              placeholder="Responsibilities & requirements..."
              multiline 
              onChange={(v: any) => setFormData({...formData, description: v})} 
            />

            <TouchableOpacity 
              onPress={handlePost}
              disabled={loading}
              className="bg-zinc-900 h-16 rounded-2xl items-center justify-center mt-4"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-black italic uppercase text-lg">Launch Opportunity</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const InputGroup = ({ label, value, onChange, placeholder, multiline = false }: any) => (
  <View>
    <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-2 ml-1">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#cbd5e1"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      className={`bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-zinc-900 font-bold italic ${multiline ? 'h-32 text-top' : ''}`}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

export default CreateOpportunity;
