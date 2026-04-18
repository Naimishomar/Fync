import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const TYPES = ['internship', 'full-time', 'part-time', 'freelance', 'contract', 'open-source'];
const MODES = ['remote', 'onsite', 'hybrid'];

interface Props {
  visible: boolean;
  initial?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddInternshipModal({ visible, initial, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    company: '', role: '', type: 'internship', description: '',
    techStack: '', startDate: '', endDate: '', isCurrentlyWorking: false,
    location: '', workMode: 'remote',
  });
  const [offerLetter, setOfferLetter] = useState<any>(null);
  const [completionCertificate, setCompletionCertificate] = useState<any>(null);
  const [existingOfferLetter, setExistingOfferLetter] = useState<string | null>(null);
  const [existingCertificate, setExistingCertificate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;

  useEffect(() => {
    if (initial) {
      setForm({
        company: initial.company || '',
        role: initial.role || '',
        type: initial.type || 'internship',
        description: initial.description || '',
        techStack: (initial.techStack || []).join(', '),
        startDate: initial.startDate ? initial.startDate.slice(0, 10) : '',
        endDate: initial.endDate ? initial.endDate.slice(0, 10) : '',
        isCurrentlyWorking: initial.isCurrentlyWorking || false,
        location: initial.location || '',
        workMode: initial.workMode || 'remote',
      });
      setExistingOfferLetter(initial.offerLetterUrl || null);
      setExistingCertificate(initial.completionCertificateUrl || null);
      setOfferLetter(null);
      setCompletionCertificate(null);
    } else {
      setForm({ company: '', role: '', type: 'internship', description: '', techStack: '', startDate: '', endDate: '', isCurrentlyWorking: false, location: '', workMode: 'remote' });
      setExistingOfferLetter(null);
      setExistingCertificate(null);
      setOfferLetter(null);
      setCompletionCertificate(null);
    }
  }, [initial, visible]);

  const pickDocument = async (field: 'offer' | 'cert') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        if (field === 'offer') setOfferLetter(result.assets[0]);
        else setCompletionCertificate(result.assets[0]);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Error picking document' });
    }
  };

  const save = async () => {
    if (!form.company.trim() || !form.role.trim() || !form.startDate)
      return Toast.show({ type: 'error', text1: 'Company, role and start date are required' });

    // Enforce Verification Documents
    if (form.isCurrentlyWorking && !offerLetter && !existingOfferLetter) {
        return Toast.show({ type: 'error', text1: 'Offer letter is required for current jobs' });
    }
    if (!form.isCurrentlyWorking && !completionCertificate && !existingCertificate) {
        return Toast.show({ type: 'error', text1: 'Completion certificate is required for past jobs' });
    }

    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
          if (key === 'techStack') {
              val.split(',').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => {
                  formData.append('techStack', s);
              });
          } else {
              formData.append(key, String(val));
          }
      });

      if (offerLetter) {
          formData.append('offerLetter', {
              uri: Platform.OS === 'ios' ? offerLetter.uri.replace('file://', '') : offerLetter.uri,
              name: offerLetter.name || 'offer_letter.pdf',
              type: 'application/pdf'
          } as any);
      }
      if (completionCertificate) {
          formData.append('completionCertificate', {
              uri: Platform.OS === 'ios' ? completionCertificate.uri.replace('file://', '') : completionCertificate.uri,
              name: completionCertificate.name || 'certificate.pdf',
              type: 'application/pdf'
          } as any);
      }

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        await axios.patch(`/profile/internships/${initial._id}`, formData, config);
        Toast.show({ type: 'success', text1: 'Experience updated!' });
      } else {
        await axios.post('/profile/internships', formData, config);
        Toast.show({ type: 'success', text1: 'Experience added!' });
      }
      onSuccess();
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-4 py-4 mt-10 border-b border-gray-100">
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></Pressable>
          <Text className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Experience' : 'Add Experience'}</Text>
          <Pressable onPress={save} disabled={saving} className="bg-indigo-600 px-4 py-2 rounded-xl">
            {saving ? <ActivityIndicator size="small" color="white" />
              : <Text className="text-white font-bold">Save</Text>}
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Type */}
          <Text className="text-gray-700 font-semibold text-sm mb-2">Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {TYPES.map(t => (
                <Pressable key={t} onPress={() => setForm(p => ({ ...p, type: t }))}
                  className={`px-3 py-2 rounded-xl border ${form.type === t ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 border-gray-200'}`}>
                  <Text className={`text-xs font-semibold capitalize ${form.type === t ? 'text-white' : 'text-gray-600'}`}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {[
            { label: 'Company *', key: 'company', ph: 'e.g. Google' },
            { label: 'Role *', key: 'role', ph: 'e.g. SDE Intern' },
            { label: 'Description', key: 'description', ph: 'What did you work on?', multi: true },
            { label: 'Tech Stack (comma separated)', key: 'techStack', ph: 'React, Node.js, AWS' },
            { label: 'Location', key: 'location', ph: 'Bangalore, India' },
            { label: 'Start Date (YYYY-MM-DD) *', key: 'startDate', ph: '2024-06-01' },
          ].map(f => (
            <View key={f.key} className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">{f.label}</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                style={f.multi ? { height: 80, textAlignVertical: 'top' } : {}}
                placeholder={f.ph} placeholderTextColor="#9CA3AF"
                value={form[f.key as keyof typeof form] as string}
                onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                multiline={!!f.multi}
              />
            </View>
          ))}

          {/* Currently working toggle */}
          <View className="flex-row items-center justify-between mb-4 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
            <Text className="text-gray-700 font-semibold text-sm">Currently Working Here</Text>
            <Switch value={form.isCurrentlyWorking}
              onValueChange={v => setForm(p => ({ ...p, isCurrentlyWorking: v }))}
              trackColor={{ true: '#6366F1' }} />
          </View>

          {!form.isCurrentlyWorking && (
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">End Date (YYYY-MM-DD)</Text>
              <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                placeholder="2024-09-30" placeholderTextColor="#9CA3AF"
                value={form.endDate} onChangeText={v => setForm(p => ({ ...p, endDate: v }))} />
            </View>
          )}

          {/* Work mode */}
          <Text className="text-gray-700 font-semibold text-sm mb-2">Work Mode</Text>
          <View className="flex-row gap-2 mb-6">
            {MODES.map(m => (
              <Pressable key={m} onPress={() => setForm(p => ({ ...p, workMode: m }))}
                className={`flex-1 py-2.5 rounded-xl border items-center ${form.workMode === m ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 border-gray-200'}`}>
                <Text className={`text-xs font-semibold capitalize ${form.workMode === m ? 'text-white' : 'text-gray-600'}`}>{m}</Text>
              </Pressable>
            ))}
          </View>

          {/* Document Section */}
          <View className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
             <View className="flex-row items-center mb-2">
               <Ionicons name="shield-checkmark" size={18} color="#4F46E5" />
               <Text className="text-indigo-900 font-bold text-sm ml-2">Verification Required</Text>
             </View>
             
             {form.isCurrentlyWorking ? (
               <View>
                 <Text className="text-indigo-600 text-[10px] uppercase font-black tracking-widest mb-3">Please upload your Offer Letter (PDF)</Text>
                 <Pressable onPress={() => pickDocument('offer')} 
                   className="bg-white border border-indigo-200 p-4 rounded-xl flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <Ionicons name="document-text" size={20} color="#6366F1" />
                      <Text className="text-gray-700 text-xs ml-3 font-semibold" numberOfLines={1}>
                        {offerLetter ? offerLetter.name : (existingOfferLetter ? 'Offer Letter Uploaded ✅' : 'Select Offer Letter PDF')}
                      </Text>
                    </View>
                    <Ionicons name="cloud-upload-outline" size={18} color="#6366F1" />
                 </Pressable>
               </View>
             ) : (
               <View>
                 <Text className="text-indigo-600 text-[10px] uppercase font-black tracking-widest mb-3">Please upload Completion Certificate (PDF)</Text>
                 <Pressable onPress={() => pickDocument('cert')} 
                   className="bg-white border border-indigo-200 p-4 rounded-xl flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <Ionicons name="ribbon" size={20} color="#6366F1" />
                      <Text className="text-gray-700 text-xs ml-3 font-semibold" numberOfLines={1}>
                        {completionCertificate ? completionCertificate.name : (existingCertificate ? 'Certificate Uploaded ✅' : 'Select Certificate PDF')}
                      </Text>
                    </View>
                    <Ionicons name="cloud-upload-outline" size={18} color="#6366F1" />
                 </Pressable>
               </View>
             )}
          </View>
          
          <View className="h-10" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
