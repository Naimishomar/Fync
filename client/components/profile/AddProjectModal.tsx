import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [images, setImages] = useState<any[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
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
      setExistingImages(initial.images || []);
      setImages([]);
    } else {
      setForm({ title: '', tagline: '', description: '', techStack: '', githubUrl: '', liveUrl: '', status: 'completed' });
      setExistingImages([]);
      setImages([]);
    }
  }, [initial, visible]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      selectionLimit: 5 - existingImages.length,
      quality: 0.5,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets]);
    }
  };

  const removeImage = (idx: number, isExisting: boolean) => {
    if (isExisting) setExistingImages(prev => prev.filter((_, i) => i !== idx));
    else setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!form.title.trim()) return Toast.show({ type: 'error', text1: 'Project title is required' });
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('tagline', form.tagline);
      formData.append('description', form.description);
      formData.append('status', form.status);
      formData.append('githubUrl', form.githubUrl);
      formData.append('liveUrl', form.liveUrl);
      
      form.techStack.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
        formData.append('techStack', s);
      });

      existingImages.forEach(img => {
        formData.append('images', img);
      });

      images.forEach(img => {
        const fileName = img.uri.split('/').pop();
        const fileType = fileName?.split('.').pop();
        formData.append('images', {
          uri: Platform.OS === 'ios' ? img.uri.replace('file://', '') : img.uri,
          name: fileName,
          type: `image/${fileType}`,
        } as any);
      });

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        await axios.patch(`/profile/projects/${initial._id}`, formData, config);
        Toast.show({ type: 'success', text1: 'Project updated!' });
      } else {
        await axios.post('/profile/projects', formData, config);
        Toast.show({ type: 'success', text1: 'Project added!' });
      }
      onSuccess();
    } catch (e) {
      console.error(e);
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

          {/* Screenshot picking */}
          <View className="mb-10">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-700 font-semibold text-sm">Screenshots (max 5)</Text>
              {existingImages.length + images.length < 5 && (
                 <Pressable onPress={pickImages} className="flex-row items-center gap-1">
                   <Ionicons name="add-circle-outline" size={18} color="#6366F1" />
                   <Text className="text-indigo-600 text-xs font-bold">Add Images</Text>
                 </Pressable>
              )}
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
               {existingImages.map((uri, i) => (
                 <View key={`ex-${i}`} className="mr-3 w-24 h-24 rounded-xl overflow-hidden border border-gray-100 relative">
                   <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                   <Pressable onPress={() => removeImage(i, true)} className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                     <Ionicons name="close" size={12} color="white" />
                   </Pressable>
                 </View>
               ))}
               {images.map((img, i) => (
                 <View key={`new-${i}`} className="mr-3 w-24 h-24 rounded-xl overflow-hidden border border-gray-100 relative">
                   <Image source={{ uri: img.uri }} className="w-full h-full" resizeMode="cover" />
                   <Pressable onPress={() => removeImage(i, false)} className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                     <Ionicons name="close" size={12} color="white" />
                   </Pressable>
                 </View>
               ))}
               {existingImages.length + images.length === 0 && (
                 <Pressable onPress={pickImages} className="w-full h-24 border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center flex-1">
                   <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                   <Text className="text-gray-400 text-xs mt-1">Upload project screenshots</Text>
                 </Pressable>
               )}
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
