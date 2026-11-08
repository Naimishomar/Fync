import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Sheet, FormField, Button, SegmentedTabs } from '../ui/kit';
import { FieldLabel, UploadTile } from './ProfileBits';

const STATUSES = ['completed', 'in-progress', 'archived'];
const STATUS_LABELS = { completed: 'Completed', 'in-progress': 'In progress', archived: 'Archived' };
const FIELDS = [
  { label: 'Project title *', key: 'title', ph: 'e.g. Fync AI Engine' },
  { label: 'Tagline', key: 'tagline', ph: 'One line about the project' },
  { label: 'Description', key: 'description', ph: 'What it does and how it works', multi: true },
  { label: 'Tech stack', key: 'techStack', ph: 'React, Node.js, etc (comma separated)' },
  { label: 'GitHub repository', key: 'githubUrl', ph: 'https://github.com/...', url: true },
  { label: 'Live link', key: 'liveUrl', ph: 'https://...', url: true },
] as const;

const Thumb = ({ uri, onRemove }: { uri: string; onRemove: () => void }) => (
  <View className="w-[30%] aspect-square rounded-2xl overflow-hidden border border-line bg-paper-2">
    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
    <Pressable onPress={onRemove} hitSlop={12} accessibilityRole="button" accessibilityLabel="Remove image"
      className="absolute top-1 right-1 bg-black/60 rounded-full w-7 h-7 items-center justify-center active:opacity-85">
      <Ionicons name="close" size={14} color="#FFFFFF" />
    </Pressable>
  </View>
);

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
      // selectionLimit is ignored unless multiple selection is on.
      allowsMultipleSelection: true,
      selectionLimit: 5 - existingImages.length - images.length,
      quality: 0.5,
    });

    if (!result.canceled) {
      // Android may not enforce selectionLimit; the cap is 5 in total.
      setImages(prev => [...prev, ...result.assets].slice(0, 5 - existingImages.length));
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

  const count = existingImages.length + images.length;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Edit project' : 'Add project'}
      height="85%"
      footer={<Button variant="primary" block icon={isEdit ? 'save-outline' : 'add'} title={isEdit ? 'Save changes' : 'Add project'} onPress={save} loading={saving} />}
    >
      <FieldLabel>Status</FieldLabel>
      <SegmentedTabs items={STATUSES} labels={STATUS_LABELS} value={form.status} onChange={st => setForm(p => ({ ...p, status: st }))} style={{ marginBottom: 16 }} />

      {FIELDS.map(f => (
        <FormField
          key={f.key}
          label={f.label}
          placeholder={f.ph}
          value={form[f.key]}
          onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
          multiline={'multi' in f}
          autoCapitalize={'url' in f ? 'none' : undefined}
          containerStyle={{ marginBottom: 16 }}
        />
      ))}

      <View className="flex-row items-center justify-between">
        <FieldLabel>Images ({count}/5)</FieldLabel>
        {count > 0 && count < 5 ? (
          <Pressable onPress={pickImages} hitSlop={12} accessibilityRole="button" className="mb-2 active:opacity-85">
            <Text className="text-accent-text text-sm font-semibold">Add images</Text>
          </Pressable>
        ) : null}
      </View>
      {count === 0 ? (
        <UploadTile label="Upload images" onPress={pickImages} />
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {existingImages.map((img, i) => <Thumb key={`ex-${i}`} uri={img} onRemove={() => removeImage(i, true)} />)}
          {images.map((img, i) => <Thumb key={`new-${i}`} uri={img.uri} onRemove={() => removeImage(i, false)} />)}
        </View>
      )}
    </Sheet>
  );
}
