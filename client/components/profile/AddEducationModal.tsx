import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Modal, KeyboardAvoidingView, ScrollView, TextInput, Switch, Dimensions } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { EducationEntry } from './EducationCard';
import { useAuth } from '../../context/auth.context';

const { height: screenHeight } = Dimensions.get('window');

export default function AddEducationModal({ visible, initial, onClose, onSuccess }: {
  visible: boolean; initial?: EducationEntry; onClose: () => void; onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    institution: user?.college || '', degree: '', field: '', grade: '',
    startYear: '', endYear: '', isCurrent: false, description: ''
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;


  useEffect(() => {
    if (initial) {
      setForm({
        institution: initial.institution || '',
        degree: initial.degree || '',
        field: initial.field || '',
        grade: initial.grade || '',
        startYear: initial.startYear?.toString() || '',
        endYear: initial.endYear?.toString() || '',
        isCurrent: initial.isCurrent || false,
        description: initial.description || ''
      });
    } else {
      setForm({ institution: user?.college || '', degree: '', field: '', grade: '', startYear: '', endYear: '', isCurrent: false, description: '' });
    }
  }, [initial, visible]);

  const save = async () => {
    if (!form.institution.trim()) return Toast.show({ type: 'error', text1: 'Institution is required' });
    setSaving(true);
    try {
      const payload = { ...form, startYear: form.startYear ? Number(form.startYear) : undefined, endYear: form.endYear ? Number(form.endYear) : undefined };
      if (isEdit) await axios.patch(`/profile/education/${initial!._id}`, payload);
      else await axios.post('/profile/education', payload);
      Toast.show({ type: 'success', text1: isEdit ? 'Education updated!' : 'Education added!' });
      onSuccess();
    } catch { Toast.show({ type: 'error', text1: 'Failed to save' }); }
    finally { setSaving(false); }
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
                {isEdit ? 'Update' : 'Record'} <Text className="text-orange-500">Education</Text>
              </Text>
              <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wide mt-0.5">Academic History Module</Text>
            </View>
            <Pressable onPress={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
              <Ionicons name="close" size={20} color="#18181b" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {[
              { label: 'Institution *', key: 'institution', ph: user?.college || 'e.g. IIT Delhi, DPS School', icon: 'book' },
              { label: 'Degree / Level', key: 'degree', ph: 'e.g. B.Tech, 12th, MBA', icon: 'award' },
              { label: 'Field / Stream', key: 'field', ph: 'e.g. Computer Science, PCM', icon: 'layers' },
              { label: 'Grade / Percentage', key: 'grade', ph: 'e.g. 9.2 CGPA, 92%', icon: 'star' },
              { label: 'Start Year', key: 'startYear', ph: '2020', icon: 'calendar', num: true },
            ].map(f => (
              <View key={f.key} className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name={f.icon as any} size={12} color="#94A3B8" />
                  <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">{f.label}</Text>
                </View>
                <TextInput
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 text-sm font-semibold"
                  placeholder={f.ph} placeholderTextColor="#94A3B8"
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  keyboardType={f.num ? 'numeric' : 'default'}
                />
              </View>
            ))}

            {/* Currently studying toggle */}
            <View className="flex-row items-center justify-between mb-6 bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100">
              <View className="flex-row items-center gap-2">
                <Feather name="clock" size={12} color="#18181b" />
                <Text className="text-slate-900 font-black uppercase text-2xs tracking-wide">Currently Studying Here</Text>
              </View>
              <Switch value={form.isCurrent}
                onValueChange={v => setForm(p => ({ ...p, isCurrent: v }))}
                trackColor={{ true: '#f97316' }} />
            </View>

            {!form.isCurrent && (
              <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name="calendar" size={12} color="#94A3B8" />
                  <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">End Year</Text>
                </View>
                <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 text-sm font-semibold"
                  placeholder="2024" placeholderTextColor="#94A3B8" keyboardType="numeric"
                  value={form.endYear} onChangeText={v => setForm(p => ({ ...p, endYear: v }))} />
              </View>
            )}

            <View className="mb-12">
              <View className="flex-row items-center gap-2 mb-2">
                <Feather name="align-left" size={12} color="#94A3B8" />
                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">Description</Text>
              </View>
              <TextInput className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 text-sm font-semibold"
                placeholder="Clubs, achievements, projects..." placeholderTextColor="#94A3B8"
                style={{ height: 100, textAlignVertical: 'top' }}
                value={form.description} multiline
                onChangeText={v => setForm(p => ({ ...p, description: v }))} />
            </View>
            <View className="h-4" />
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
                      {isEdit ? 'Update Record' : 'Commit Education'}
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
