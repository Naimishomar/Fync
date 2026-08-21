import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch, Dimensions
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
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
          className="bg-paper rounded-t-sheet overflow-hidden"
          style={{ height: screenHeight * 0.85 }}
        >
          {/* Handle */}
          <View className="items-center py-4">
            <View className="w-12 h-1.5 bg-ink-4 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-gutter pb-3 border-b border-line">
            <View>
              <Text className="text-ink font-display uppercase text-h1">
                {isEdit ? 'Update' : 'Record'} <Text className="text-accent-text">Experience</Text>
              </Text>
              <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">Career History Module</Text>
            </View>
            <Pressable onPress={onClose} className="w-11 h-11 rounded-xl items-center justify-center" hitSlop={2}>
              <Ionicons name="close" size={20} color="#12100E" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="layers" size={12} color="#8B857E" />
                <Text className="text-ink-3 font-display uppercase text-label">Engagement Type</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2 pr-6">
                  {TYPES.map(t => (
                    <Pressable key={t} onPress={() => setForm(p => ({ ...p, type: t }))}
                      className={`px-4 py-2.5 rounded-xl border items-center shadow-hair ${form.type === t ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                      <Text className={`text-label font-display uppercase ${form.type === t ? 'text-white' : 'text-ink-3'}`}>{t.replace('-', ' ')}</Text>
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
                  <Feather name={f.icon as any} size={12} color="#8B857E" />
                  <Text className="text-ink-3 font-display uppercase text-label">{f.label}</Text>
                </View>
                <TextInput
                  className="bg-card border-[1.5px] border-ink px-4 text-ink text-base font-sans rounded-md"
                  style={[{ minHeight: 50 }, f.multi ? { height: 100, textAlignVertical: 'top' } : null]}
                  placeholder={f.ph} placeholderTextColor="#8B857E"
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  multiline={!!f.multi}
                />
              </View>
            ))}

            {/* Currently working toggle */}
            <View className="flex-row items-center justify-between mb-6 bg-paper-2 px-5 py-4 rounded-card border border-line">
              <View className="flex-row items-center gap-2">
                <Feather name="clock" size={12} color="#12100E" />
                <Text className="text-ink font-display uppercase text-label">Currently Active</Text>
              </View>
              <Switch value={form.isCurrentlyWorking}
                onValueChange={v => setForm(p => ({ ...p, isCurrentlyWorking: v }))}
                trackColor={{ true: '#F97316' }} />
            </View>

            {!form.isCurrentlyWorking && (
              <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name="calendar" size={12} color="#8B857E" />
                  <Text className="text-ink-3 font-display uppercase text-label">End Date (YYYY-MM-DD)</Text>
                </View>
                <TextInput className="bg-card border-[1.5px] border-ink px-4 text-ink text-base font-sans rounded-md"
            style={{ minHeight: 50 }}
                  placeholder="2024-09-30" placeholderTextColor="#8B857E"
                  value={form.endDate} onChangeText={v => setForm(p => ({ ...p, endDate: v }))} />
              </View>
            )}

            {/* Work mode */}
            <View className="mb-8">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="globe" size={12} color="#8B857E" />
                <Text className="text-ink-3 font-display uppercase text-label">Work Mode</Text>
              </View>
              <View className="flex-row gap-3">
                {MODES.map(m => (
                  <Pressable key={m} onPress={() => setForm(p => ({ ...p, workMode: m }))}
                    className={`flex-1 py-3.5 rounded-card border items-center shadow-hair ${form.workMode === m ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                    <Text className={`text-label font-display uppercase ${form.workMode === m ? 'text-white' : 'text-ink-3'}`}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Document Section */}
            <View className="mb-12 p-6 bg-paper-2 border border-line rounded-card shadow-hair">
               <View className="flex-row items-center mb-4">
                 <View className="w-8 h-8 bg-card rounded-xl items-center justify-center shadow-hair mr-3">
                   <Ionicons name="shield-checkmark" size={16} color="#F97316" />
                 </View>
                 <Text className="font-semibold text-base text-ink">Integrity Verification</Text>
               </View>
               
               {form.isCurrentlyWorking ? (
                 <View>
                   <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                     <Text className="text-accent-text text-label uppercase font-display">Upload Offer Letter (PDF)</Text>
                     <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                   </View>
                   <Pressable onPress={() => pickDocument('offer')} 
                     className="bg-card border border-line p-5 rounded-card flex-row items-center justify-between shadow-hair">
                      <View className="flex-row items-center flex-1 pr-4">
                        <Feather name="file-text" size={18} color="#F97316" />
                        <Text className="text-ink text-label ml-3 font-display uppercase" numberOfLines={1}>
                          {offerLetter ? offerLetter.name : (existingOfferLetter ? 'Offer Letter Synced' : 'Select PDF Manifest')}
                        </Text>
                      </View>
                      <Feather name="upload" size={16} color="#F97316" />
                   </Pressable>
                 </View>
               ) : (
                 <View>
                   <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                     <Text className="text-accent-text text-label uppercase font-display">Upload Completion Proof (PDF)</Text>
                     <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                   </View>
                   <Pressable onPress={() => pickDocument('cert')} 
                     className="bg-card border border-line p-5 rounded-card flex-row items-center justify-between shadow-hair">
                      <View className="flex-row items-center flex-1 pr-4">
                        <Feather name="award" size={18} color="#F97316" />
                        <Text className="text-ink text-label ml-3 font-display uppercase" numberOfLines={1}>
                          {completionCertificate ? completionCertificate.name : (existingCertificate ? 'Proof Synced' : 'Select PDF Manifest')}
                        </Text>
                      </View>
                      <Feather name="upload" size={16} color="#F97316" />
                   </Pressable>
                 </View>
               )}
            </View>
            <View className="h-10" />
          </ScrollView>

          {/* Footer Action */}
          <View className="p-card-pad border-t border-line bg-paper">
            <Pressable onPress={save} disabled={saving}
              className="bg-ink py-5 flex-row items-center justify-center border-2 border-ink rounded-md">
              {saving ? <ActivityIndicator size="small" color="#F97316" />
                : (
                  <>
                    <Feather name={isEdit ? 'save' : 'plus'} size={16} color="white" className="mr-2" />
                    <Text className="text-white font-display uppercase text-xs ml-2">
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
