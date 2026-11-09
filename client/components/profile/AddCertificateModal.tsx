import React, { useState, useEffect } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Sheet, FormField, Button } from '../ui/kit';
import { ChoiceChips, FieldLabel, UploadTile } from './ProfileBits';

const CATEGORIES = ['coding', 'design', 'cloud', 'ai-ml', 'cybersecurity', 'management', 'data-science', 'other'];

interface Props {
  visible: boolean;
  initial?: any;
  onClose: () => void;
  onSuccess: () => void;
}

const FIELDS = [
  { label: 'Certificate title *', key: 'title', ph: 'e.g. AWS Cloud Practitioner' },
  { label: 'Issuing organization *', key: 'issuer', ph: 'e.g. Amazon Web Services' },
  { label: 'Issue date (YYYY-MM-DD)', key: 'issueDate', ph: '2024-03-15' },
  { label: 'Expiry date (YYYY-MM-DD)', key: 'expiryDate', ph: '2027-03-15' },
  { label: 'Credential ID', key: 'credentialId', ph: 'ABC123XYZ' },
  { label: 'Credential URL', key: 'credentialUrl', ph: 'https://...', url: true },
] as const;

export default function AddCertificateModal({ visible, initial, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    title: '', issuer: '', issueDate: '', expiryDate: '',
    credentialUrl: '', credentialId: '', category: 'other',
  });
  const [image, setImage] = useState<any>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
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
      setExistingImage(initial.imageUrl || null);
    } else {
      setForm({ title: '', issuer: '', issueDate: '', expiryDate: '', credentialUrl: '', credentialId: '', category: 'other' });
      setExistingImage(null);
    }
    // A photo picked for the previous certificate must not ride along with this one.
    setImage(null);
  }, [initial, visible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS === 'ios',
      quality: 0.5,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.issuer.trim())
      return Toast.show({ type: 'error', text1: 'Title and issuer are required' });
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        formData.append(key, val);
      });

      if (image) {
        const fileName = image.uri.split('/').pop();
        const fileType = fileName?.split('.').pop();
        formData.append('image', {
          uri: Platform.OS === 'ios' ? image.uri.replace('file://', '') : image.uri,
          name: fileName,
          type: `image/${fileType}`,
        } as any);
      }

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        await axios.patch(`/profile/certificates/${initial._id}`, formData, config);
        Toast.show({ type: 'success', text1: 'Certificate updated!' });
      } else {
        await axios.post('/profile/certificates', formData, config);
        Toast.show({ type: 'success', text1: 'Certificate added!' });
      }
      onSuccess();
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const preview = image?.uri || existingImage;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Edit certificate' : 'Add certificate'}
      height="85%"
      footer={<Button variant="primary" block icon={isEdit ? 'save-outline' : 'add'} title={isEdit ? 'Save changes' : 'Add certificate'} onPress={save} loading={saving} />}
    >
      <ChoiceChips label="Category" items={CATEGORIES} value={form.category} onChange={c => setForm(p => ({ ...p, category: c }))} />

      {FIELDS.map(f => (
        <FormField
          key={f.key}
          label={f.label}
          placeholder={f.ph}
          value={form[f.key]}
          onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
          autoCapitalize={'url' in f ? 'none' : undefined}
          containerStyle={{ marginBottom: 16 }}
        />
      ))}

      <FieldLabel>Certificate image</FieldLabel>
      {preview ? (
        <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel="Change certificate image"
          className="w-full h-48 rounded-2xl overflow-hidden border border-line bg-paper-2 active:opacity-85">
          <Image source={{ uri: preview }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          <View className="absolute top-3 right-3 bg-black/60 rounded-full w-9 h-9 items-center justify-center">
            <Feather name="edit-2" size={14} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : (
        <UploadTile label="Upload certificate image" onPress={pickImage} height={192} />
      )}
    </Sheet>
  );
}
