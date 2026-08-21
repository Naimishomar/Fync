import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Dimensions
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const { height: screenHeight } = Dimensions.get('window');
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
        formData.append('existingImages', img);
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
          {/* Drag Handle */}
          <View className="items-center py-4">
            <View className="w-12 h-1.5 bg-ink-4 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-gutter pb-3 border-b border-line">
            <View>
              <Text className="text-ink font-display uppercase text-h1">
                {isEdit ? 'Upgrade' : 'Deploy'} <Text className="text-accent-text">Project</Text>
              </Text>
              <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">Ecosystem Contribution</Text>
            </View>
            <Pressable onPress={onClose} className="w-11 h-11 rounded-xl items-center justify-center" hitSlop={2}>
              <Ionicons name="close" size={20} color="#12100E" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Status Selector */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="activity" size={12} color="#8B857E" />
                <Text className="text-ink-3 font-display uppercase text-label">Project Lifecycle</Text>
              </View>
              <View className="flex-row gap-2">
                {STATUSES.map(s => (
                  <Pressable key={s} onPress={() => setForm(p => ({ ...p, status: s }))}
                    className={`flex-1 py-3 rounded-xl border items-center shadow-hair ${form.status === s ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                    <Text className={`text-label font-display uppercase ${form.status === s ? 'text-white' : 'text-ink-3'}`}>{s.replace('-', ' ')}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {[
              { label: 'Project Title *', key: 'title', ph: 'e.g. Fync AI Engine', icon: 'zap' },
              { label: 'Tagline', key: 'tagline', ph: 'One-liner about the mission', icon: 'type' },
              { label: 'Technical Specifications', key: 'description', ph: 'Deep dive into the architecture...', multi: true, icon: 'cpu' },
              { label: 'Tech Stack', key: 'techStack', ph: 'React, Node.js, etc (comma separated)', icon: 'layers' },
              { label: 'GitHub Repository', key: 'githubUrl', ph: 'https://github.com/...', icon: 'github' },
              { label: 'Live Manifest', key: 'liveUrl', ph: 'https://...', icon: 'globe' },
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
                  value={form[f.key as keyof typeof form]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                  multiline={!!f.multi}
                />
              </View>
            ))}

            {/* Media Upload */}
            <View className="mb-12">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-2">
                  <Feather name="image" size={12} color="#8B857E" />
                  <Text className="text-ink-3 font-display uppercase text-label">Visual Evidence ({existingImages.length + images.length}/5)</Text>
                </View>
                {existingImages.length + images.length < 5 && (
                  <Pressable onPress={pickImages} className="bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full">
                    <Text className="text-accent-text font-display uppercase text-label">Add Media</Text>
                  </Pressable>
                )}
              </View>

              <View className="flex-row flex-wrap gap-3">
                {existingImages.map((img, i) => (
                  <View key={`ex-${i}`} className="w-[30%] aspect-square rounded-card overflow-hidden border border-line shadow-hair">
                    <Image source={{ uri: img }} className="w-full h-full" />
                    <Pressable onPress={() => removeImage(i, true)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1 border border-white/20">
                      <Ionicons name="close" size={12} color="white" />
                    </Pressable>
                  </View>
                ))}
                {images.map((img, i) => (
                  <View key={`new-${i}`} className="w-[30%] aspect-square rounded-card overflow-hidden border border-line shadow-hair">
                    <Image source={{ uri: img.uri }} className="w-full h-full" />
                    <Pressable onPress={() => removeImage(i, false)} className="absolute top-1 right-1 bg-black/60 rounded-full p-1 border border-white/20">
                      <Ionicons name="close" size={12} color="white" />
                    </Pressable>
                  </View>
                ))}
                {existingImages.length + images.length === 0 && (
                  <Pressable onPress={pickImages} className="w-full h-32 border-2 border-dashed border-line rounded-sheet items-center justify-center bg-paper-2/50">
                    <View className="w-10 h-10 bg-card rounded-full items-center justify-center shadow-hair mb-2">
                      <Feather name="upload-cloud" size={18} color="#F97316" />
                    </View>
                    <Text className="text-ink-3 text-label font-display uppercase">Initialize Media Manifest</Text>
                  </Pressable>
                )}
              </View>
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
                      {isEdit ? 'Update Artifact' : 'Commit Deployment'}
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
