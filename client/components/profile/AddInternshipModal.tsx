import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Dimensions
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const { height: screenHeight } = Dimensions.get('window');
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
          if (key === 'techStack' && typeof val === 'string') {
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <KeyboardAvoidingView
          behavior="padding"
          className="bg-white rounded-t-5xl overflow-hidden"
          style={{ height: screenHeight * 0.85 }}
        >
          {/* Handle */}
          <View className="items-center py-4">
            <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pb-4 border-b border-slate-50">
            <View>
              <Text className="text-slate-900 font-black uppercase text-xl tracking-tighter">
                {isEdit ? 'Update' : 'Record'} <Text className="text-orange-500">Experience</Text>
              </Text>
              <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wide mt-0.5">Career History Module</Text>
            </View>
            <Pressable onPress={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
              <Ionicons name="close" size={20} color="#18181b" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="layers" size={12} color="#94A3B8" />
                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">Engagement Type</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2 pr-6">
                  {TYPES.map(t => (
                    <Pressable key={t} onPress={() => setForm(p => ({ ...p, type: t }))}
                      className={`px-4 py-2.5 rounded-xl border items-center shadow-sm ${form.type === t ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100'}`}>
                      <Text className={`text-2xs font-black uppercase tracking-widest ${form.type === t ? 'text-white' : 'text-slate-500'}`}>{t.replace('-', ' ')}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {[
              { label: 'Company *', key: 'company', ph: 'e.g. Google', icon: 'briefcase' },
              { label: 'Role *', key: 'role', ph: 'e.g. SDE Intern', icon: 'user' },
              { label: 'Description', key: 'description', ph: 'What did you work on?', multi: true, icon: 'align-left' },
              { label: 'Tech Stack', key: 'techStack', ph: 'React, Node.js, etc (comma separated)', icon: 'cpu' },
              { label: 'Location', key: 'location', ph: 'Bangalore, India', icon: 'map-pin' },
              { label: 'Start Date (YYYY-MM-DD) *', key: 'startDate', ph: '2024-06-01', icon: 'calendar' },
            ].map(f => (
              <View key={f.key} className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name={f.icon as any} size={12} color="#94A3B8" />
                  <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">{f.label}</Text>
                </View>
                <TextInput
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 text-sm font-semibold"
                  style={f.multi ? { height: 100, textAlignVertical: 'top' } : {}}
                  placeholder={f.ph} placeholderTextColor="#94A3B8"
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  multiline={!!f.multi}
                />
              </View>
            ))}

            {/* Currently working toggle */}
            <View className="flex-row items-center justify-between mb-6 bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100">
              <View className="flex-row items-center gap-2">
                <Feather name="clock" size={12} color="#18181b" />
                <Text className="text-slate-900 font-black uppercase text-2xs tracking-wide">Currently Active</Text>
              </View>
              <Switch value={form.isCurrentlyWorking}
                onValueChange={v => setForm(p => ({ ...p, isCurrentlyWorking: v }))}
                trackColor={{ true: '#f97316' }} />
            </View>

            {!form.isCurrentlyWorking && (
              <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name="calendar" size={12} color="#94A3B8" />
                  <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">End Date (YYYY-MM-DD)</Text>
                </View>
                <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 text-sm font-semibold"
                  placeholder="2024-09-30" placeholderTextColor="#94A3B8"
                  value={form.endDate} onChangeText={v => setForm(p => ({ ...p, endDate: v }))} />
              </View>
            )}

            {/* Work mode */}
            <View className="mb-8">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="globe" size={12} color="#94A3B8" />
                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">Work Mode</Text>
              </View>
              <View className="flex-row gap-3">
                {MODES.map(m => (
                  <Pressable key={m} onPress={() => setForm(p => ({ ...p, workMode: m }))}
                    className={`flex-1 py-3.5 rounded-2xl border items-center shadow-sm ${form.workMode === m ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100'}`}>
                    <Text className={`text-2xs font-black uppercase tracking-widest ${form.workMode === m ? 'text-white' : 'text-slate-500'}`}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Document Section */}
            <View className="mb-12 p-6 bg-orange-50 border border-orange-100 rounded-3xl shadow-sm shadow-orange-500/10">
               <View className="flex-row items-center mb-4">
                 <View className="w-8 h-8 bg-white rounded-xl items-center justify-center shadow-sm mr-3">
                   <Ionicons name="shield-checkmark" size={16} color="#f97316" />
                 </View>
                 <Text className="text-slate-900 font-black uppercase text-xs tracking-tight">Integrity Verification</Text>
               </View>
               
               {form.isCurrentlyWorking ? (
                 <View>
                   <Text className="text-orange-600 text-2xs uppercase font-black tracking-wide mb-3 ml-1">Upload Offer Letter (PDF)</Text>
                   <Pressable onPress={() => pickDocument('offer')} 
                     className="bg-white border border-orange-100 p-5 rounded-2xl flex-row items-center justify-between shadow-sm">
                      <View className="flex-row items-center flex-1 pr-4">
                        <Feather name="file-text" size={18} color="#f97316" />
                        <Text className="text-slate-900 text-2xs ml-3 font-black uppercase tracking-tight" numberOfLines={1}>
                          {offerLetter ? offerLetter.name : (existingOfferLetter ? 'Offer Letter Synced ✅' : 'Select PDF Manifest')}
                        </Text>
                      </View>
                      <Feather name="upload" size={16} color="#f97316" />
                   </Pressable>
                 </View>
               ) : (
                 <View>
                   <Text className="text-orange-600 text-2xs uppercase font-black tracking-wide mb-3 ml-1">Upload Completion Proof (PDF)</Text>
                   <Pressable onPress={() => pickDocument('cert')} 
                     className="bg-white border border-orange-100 p-5 rounded-2xl flex-row items-center justify-between shadow-sm">
                      <View className="flex-row items-center flex-1 pr-4">
                        <Feather name="award" size={18} color="#f97316" />
                        <Text className="text-slate-900 text-2xs ml-3 font-black uppercase tracking-tight" numberOfLines={1}>
                          {completionCertificate ? completionCertificate.name : (existingCertificate ? 'Proof Synced ✅' : 'Select PDF Manifest')}
                        </Text>
                      </View>
                      <Feather name="upload" size={16} color="#f97316" />
                   </Pressable>
                 </View>
               )}
            </View>
            <View className="h-10" />
          </ScrollView>

          {/* Footer Action */}
          <View className="p-6 border-t border-slate-50 bg-white shadow-2xl shadow-black">
            <Pressable onPress={save} disabled={saving}
              className="bg-slate-900 py-5 rounded-2xl flex-row items-center justify-center shadow-xl shadow-black/20">
              {saving ? <ActivityIndicator size="small" color="#f97316" />
                : (
                  <>
                    <Feather name={isEdit ? 'save' : 'plus'} size={16} color="white" className="mr-2" />
                    <Text className="text-white font-black uppercase text-xs tracking-wide ml-2">
                      {isEdit ? 'Update Record' : 'Commit Experience'}
                    </Text>
                  </>
                )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
