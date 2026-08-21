import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Modal, KeyboardAvoidingView, ScrollView, TextInput, Switch, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
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
                {isEdit ? 'Update' : 'Record'} <Text className="text-accent-text">Education</Text>
              </Text>
              <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">Academic History Module</Text>
            </View>
            <Pressable onPress={onClose} className="w-11 h-11 rounded-xl items-center justify-center" hitSlop={2}>
              <Ionicons name="close" size={20} color="#12100E" />
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
                  <Feather name={f.icon as any} size={12} color="#8B857E" />
                  <Text className="text-ink-3 font-display uppercase text-label">{f.label}</Text>
                </View>
                <TextInput
                  className="bg-card border-[1.5px] border-ink px-4 text-ink text-base font-sans rounded-md"
            style={{ minHeight: 50 }}
                  placeholder={f.ph} placeholderTextColor="#8B857E"
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  keyboardType={f.num ? 'numeric' : 'default'}
                />
              </View>
            ))}

            {/* Currently studying toggle */}
            <View className="flex-row items-center justify-between mb-6 bg-paper-2 px-5 py-4 rounded-card border border-line">
              <View className="flex-row items-center gap-2">
                <Feather name="clock" size={12} color="#12100E" />
                <Text className="text-ink font-display uppercase text-label">Currently Studying Here</Text>
              </View>
              <Switch value={form.isCurrent}
                onValueChange={v => setForm(p => ({ ...p, isCurrent: v }))}
                trackColor={{ true: '#F97316' }} />
            </View>

            {!form.isCurrent && (
              <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name="calendar" size={12} color="#8B857E" />
                  <Text className="text-ink-3 font-display uppercase text-label">End Year</Text>
                </View>
                <TextInput className="bg-card border-[1.5px] border-ink px-4 text-ink text-base font-sans rounded-md"
            style={{ minHeight: 50 }}
                  placeholder="2024" placeholderTextColor="#8B857E" keyboardType="numeric"
                  value={form.endYear} onChangeText={v => setForm(p => ({ ...p, endYear: v }))} />
              </View>
            )}

            <View className="mb-12">
              <View className="flex-row items-center gap-2 mb-2">
                <Feather name="align-left" size={12} color="#8B857E" />
                <Text className="text-ink-3 font-display uppercase text-label">Description</Text>
              </View>
              <TextInput className="bg-card border-[1.5px] border-ink px-4 py-3 text-ink text-base font-sans rounded-md"
                placeholder="Clubs, achievements, projects..." placeholderTextColor="#8B857E"
                style={{ minHeight: 100, textAlignVertical: 'top' }}
                value={form.description} multiline
                onChangeText={v => setForm(p => ({ ...p, description: v }))} />
            </View>
            <View className="h-4" />
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
