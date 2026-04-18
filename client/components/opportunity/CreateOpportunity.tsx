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
  Alert,
  Switch,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';

const CreateOpportunity = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const initialType = route.params?.type || 'internship';
  const initialData = route.params?.initialData;
  const isEdit = !!initialData;

  const [loading, setLoading] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(initialData?.companyLogo || null);
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    company: initialData?.company || '',
    location: initialData?.location || 'Remote',
    type: initialData?.type || initialType,
    opportunityType: initialData?.opportunityType || 'Full-Time',
    duration: initialData?.duration || '',
    isPaid: initialData?.isPaid || false,
    stipend: initialData?.stipend || '',
    description: initialData?.description || '',
    applicationLink: initialData?.applicationLink || '',
    requireResume: initialData?.requireResume !== false,
    experience: initialData?.experience || 'Fresher'
  });

  const pickLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const handlePost = async () => {
    const { title, company, description, isPaid, stipend } = formData;
    
    if (!title || !company || !description) {
      Alert.alert("Required Fields", "Please fill in Title, Company, and Description.");
      return;
    }

    if (!logoUri) {
      Alert.alert("Company Logo Required", "Please upload your company logo.");
      return;
    }

    if (isPaid && !stipend) {
      Alert.alert("Required Fields", "Please enter the stipend or package amount.");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('company', formData.company);
      data.append('location', formData.location);
      data.append('type', formData.type);
      data.append('opportunityType', formData.opportunityType);
      data.append('duration', formData.duration);
      data.append('isPaid', String(formData.isPaid));
      data.append('stipend', formData.isPaid ? formData.stipend : 'Unpaid');
      data.append('description', formData.description);
      data.append('applicationLink', formData.applicationLink);
      data.append('requireResume', String(formData.requireResume));
      data.append('experience', formData.experience);
      // Append logo image if newly picked
      if (logoUri && !logoUri.startsWith('http')) {
        const uriParts = logoUri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        data.append('companyLogo', {
          uri: logoUri,
          name: `logo.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }
      
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
      };

      let res;
      if (isEdit) {
        res = await axios.patch(`/opportunity/update/${initialData._id}`, data, config);
      } else {
        res = await axios.post('/opportunity/create', data, config);
      }

      if (res.data.success) {
        Toast.show({
          type: 'success',
          text1: isEdit ? 'Opportunity Updated!' : 'Opportunity Posted!',
          text2: 'Your changes are now live.'
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

  const SelectionGroup = ({ label, options, field }: { label: string, options: string[], field: string }) => (
    <View className="mb-5">
      <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-3 ml-1">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => (
          <TouchableOpacity 
            key={opt}
            onPress={() => setFormData({...formData, [field]: opt})}
            className={`px-6 py-3 rounded-2xl border ${formData[field as keyof typeof formData] === opt ? 'bg-zinc-900 border-zinc-900' : 'bg-slate-50 border-slate-100'}`}
          >
            <Text className={`font-black italic uppercase text-[10px] ${formData[field as keyof typeof formData] === opt ? 'text-white' : 'text-slate-400'}`}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between">
           <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50">
            <Ionicons name="chevron-back" size={24} color="black" />
          </TouchableOpacity>
          <Text className="text-xl font-black uppercase tracking-tighter">{isEdit ? 'Edit Opportunity' : 'Post Opportunity'}</Text>
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

            {/* Company Logo Picker */}
            <View>
              <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-3 ml-1">Company Logo *</Text>
              <TouchableOpacity 
                onPress={pickLogo}
                activeOpacity={0.8}
                className="items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6"
              >
                {logoUri ? (
                  <View className="items-center">
                    <Image source={{ uri: logoUri }} className="w-24 h-24 rounded-2xl" resizeMode="contain" />
                    <Text className="text-pink-500 font-bold text-[10px] uppercase mt-3">Tap to change</Text>
                  </View>
                ) : (
                  <View className="items-center">
                    <View className="w-16 h-16 bg-slate-100 rounded-2xl items-center justify-center mb-3">
                      <Ionicons name="image-outline" size={28} color="#94a3b8" />
                    </View>
                    <Text className="text-zinc-600 font-black uppercase text-xs">Upload Company Logo</Text>
                    <Text className="text-slate-400 text-[10px] mt-1">PNG, JPG • Square recommended</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

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

            <SelectionGroup 
              label="Location Mode *" 
              options={["Remote", "Onsite", "Hybrid"]} 
              field="location" 
            />

            <SelectionGroup 
              label="Work Schedule *" 
              options={["Full-Time", "Part-Time"]} 
              field="opportunityType" 
            />

            <SelectionGroup 
              label="Experience Required *" 
              options={["Fresher", "Entry Level", "1-2 Years", "3-5 Years", "5+ Years"]} 
              field="experience" 
            />

            <View className="flex-row gap-4">
                <View className="flex-1">
                    <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-3 ml-1">Payment *</Text>
                    <View className="flex-row gap-2">
                        {["Unpaid", "Paid"].map(opt => (
                            <TouchableOpacity 
                                key={opt}
                                onPress={() => setFormData({...formData, isPaid: opt === 'Paid'})}
                                className={`px-6 py-3 rounded-2xl border ${ (formData.isPaid && opt === 'Paid') || (!formData.isPaid && opt === 'Unpaid') ? 'bg-zinc-900 border-zinc-900' : 'bg-slate-50 border-slate-100'}`}
                            >
                                <Text className={`font-black italic uppercase text-[10px] ${ (formData.isPaid && opt === 'Paid') || (!formData.isPaid && opt === 'Unpaid') ? 'text-white' : 'text-slate-400'}`}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                {formData.isPaid && (
                   <View className="flex-[1.5]">
                        <InputGroup 
                            label={formData.type === 'internship' ? "Stipend Amount *" : "Package / Salary *"} 
                            value={formData.stipend} 
                            placeholder="e.g. ₹25k / ₹12 LPA"
                            onChange={(v: any) => setFormData({...formData, stipend: v})} 
                        />
                   </View>
                )}
            </View>

            {formData.type === 'internship' && (
              <InputGroup 
                  label="Duration" 
                  value={formData.duration} 
                  placeholder="e.g. 6 Months / Performance Based"
                  onChange={(v: any) => setFormData({...formData, duration: v})} 
              />
            )}

            <InputGroup 
              label="Application Link (Optional)" 
              value={formData.applicationLink} 
              placeholder="https://company.com/careers/..."
              onChange={(v: any) => setFormData({...formData, applicationLink: v})} 
            />

            {/* Require Resume Toggle */}
            <View className="bg-slate-50 p-5 rounded-3xl flex-row items-center justify-between border border-slate-100">
                <View className="flex-1 mr-4">
                    <Text className="text-zinc-900 font-black uppercase text-xs tracking-tighter">Require Resume?</Text>
                    <Text className="text-slate-400 font-bold text-[9px] uppercase mt-1">Candidates must share their resume to apply</Text>
                </View>
                <Switch 
                   value={formData.requireResume}
                   onValueChange={(v) => setFormData({...formData, requireResume: v})}
                   trackColor={{ false: "#e2e8f0", true: "#f9a8d4" }}
                   thumbColor={formData.requireResume ? "#ec4899" : "#94a3b8"}
                />
            </View>

            <InputGroup 
              label="Description *" 
              value={formData.description} 
              placeholder="Key responsibilities, skills, and about the role..."
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
                <Text className="text-white font-black uppercase text-lg">{isEdit ? 'Update Changes' : 'Post Live Opportunity'}</Text>
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
      className={`bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-zinc-900 font-bold italic ${multiline ? 'h-40 text-top' : ''}`}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  </View>
);

export default CreateOpportunity;
