import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const STATUSES = ['completed', 'in-progress', 'archived'];

interface Props {
  visible: boolean;
  initial?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProjectModal({ visible, initial, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    title: '', tagline: '', description: '', techStack: '',
    githubUrl: '', liveUrl: '', status: 'completed',
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || '',
        tagline: initial.tagline || '',
        description: initial.description || '',
        techStack: (initial.techStack || []).join(', '),
        githubUrl: initial.githubUrl || '',
        liveUrl: initial.liveUrl || '',
        status: initial.status || 'completed',
      });
    } else {
      setForm({ title: '', tagline: '', description: '', techStack: '', githubUrl: '', liveUrl: '', status: 'completed' });
    }
  }, [initial, visible]);

  const save = async () => {
    if (!form.title.trim()) return Toast.show({ type: 'error', text1: 'Project title is required' });
    setSaving(true);
    try {
      const payload = {
        ...form,
        techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (isEdit) {
        await axios.patch(`/profile/projects/${initial._id}`, payload);
        Toast.show({ type: 'success', text1: 'Project updated!' });
      } else {
        await axios.post('/profile/projects', payload);
        Toast.show({ type: 'success', text1: 'Project added!' });
      }
      onSuccess();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to save project' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></Pressable>
          <Text className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Project' : 'Add Project'}</Text>
          <Pressable onPress={save} disabled={saving}
            className="bg-indigo-600 px-4 py-2 rounded-xl">
            {saving ? <ActivityIndicator size="small" color="white" />
              : <Text className="text-white font-bold">Save</Text>}
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {[
            { label: 'Project Title *', key: 'title', ph: 'e.g. Fync App' },
            { label: 'Tagline', key: 'tagline', ph: 'e.g. A student platform built with React Native' },
            { label: 'Description', key: 'description', ph: 'Describe your project...', multi: true },
            { label: 'Tech Stack (comma separated)', key: 'techStack', ph: 'React Native, Node.js, MongoDB' },
            { label: 'GitHub URL', key: 'githubUrl', ph: 'https://github.com/...' },
            { label: 'Live URL', key: 'liveUrl', ph: 'https://...' },
          ].map(f => (
            <View key={f.key} className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">{f.label}</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                style={f.multi ? { height: 80, textAlignVertical: 'top' } : {}}
                placeholder={f.ph}
                placeholderTextColor="#9CA3AF"
                value={form[f.key as keyof typeof form]}
                onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                multiline={!!f.multi}
              />
            </View>
          ))}

          {/* Status selector */}
          <Text className="text-gray-700 font-semibold text-sm mb-1.5">Status</Text>
          <View className="flex-row gap-2 mb-6">
            {STATUSES.map(s => (
              <Pressable key={s} onPress={() => setForm(p => ({ ...p, status: s }))}
                className={`flex-1 py-2.5 rounded-xl border items-center ${form.status === s ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-50 border-gray-200'}`}>
                <Text className={`text-xs font-semibold capitalize ${form.status === s ? 'text-white' : 'text-gray-600'}`}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
