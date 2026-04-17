import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const CATEGORIES = ['coding', 'design', 'cloud', 'ai-ml', 'cybersecurity', 'management', 'data-science', 'other'];

interface Props {
  visible: boolean;
  initial?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCertificateModal({ visible, initial, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    title: '', issuer: '', issueDate: '', expiryDate: '',
    credentialUrl: '', credentialId: '', category: 'other',
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || '',
        issuer: initial.issuer || '',
        issueDate: initial.issueDate ? initial.issueDate.slice(0, 10) : '',
        expiryDate: initial.expiryDate ? initial.expiryDate.slice(0, 10) : '',
        credentialUrl: initial.credentialUrl || '',
        credentialId: initial.credentialId || '',
        category: initial.category || 'other',
      });
    } else {
      setForm({ title: '', issuer: '', issueDate: '', expiryDate: '', credentialUrl: '', credentialId: '', category: 'other' });
    }
  }, [initial, visible]);

  const save = async () => {
    if (!form.title.trim() || !form.issuer.trim())
      return Toast.show({ type: 'error', text1: 'Title and issuer are required' });
    setSaving(true);
    try {
      if (isEdit) {
        await axios.patch(`/profile/certificates/${initial._id}`, form);
        Toast.show({ type: 'success', text1: 'Certificate updated!' });
      } else {
        await axios.post('/profile/certificates', form);
        Toast.show({ type: 'success', text1: 'Certificate added!' });
      }
      onSuccess();
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></Pressable>
          <Text className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Certificate' : 'Add Certificate'}</Text>
          <Pressable onPress={save} disabled={saving} className="bg-indigo-600 px-4 py-2 rounded-xl">
            {saving ? <ActivityIndicator size="small" color="white" />
              : <Text className="text-white font-bold">Save</Text>}
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Category chips */}
          <Text className="text-gray-700 font-semibold text-sm mb-2">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {CATEGORIES.map(c => (
                <Pressable key={c} onPress={() => setForm(p => ({ ...p, category: c }))}
                  className={`px-3 py-2 rounded-xl border ${form.category === c ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 border-gray-200'}`}>
                  <Text className={`text-xs font-semibold capitalize ${form.category === c ? 'text-white' : 'text-gray-600'}`}>
                    {c.replace('-', ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {[
            { label: 'Certificate Title *', key: 'title', ph: 'e.g. AWS Cloud Practitioner' },
            { label: 'Issuing Organization *', key: 'issuer', ph: 'e.g. Amazon Web Services' },
            { label: 'Issue Date (YYYY-MM-DD)', key: 'issueDate', ph: '2024-03-15' },
            { label: 'Expiry Date (YYYY-MM-DD)', key: 'expiryDate', ph: '2027-03-15' },
            { label: 'Credential ID', key: 'credentialId', ph: 'ABC123XYZ' },
            { label: 'Credential URL', key: 'credentialUrl', ph: 'https://...' },
          ].map(f => (
            <View key={f.key} className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">{f.label}</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                placeholder={f.ph} placeholderTextColor="#9CA3AF"
                value={form[f.key as keyof typeof form]}
                onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
              />
            </View>
          ))}
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
