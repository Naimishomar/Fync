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
  }, [initial, visible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
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
                {isEdit ? 'Verify' : 'Add'} <Text className="text-accent-text">Certificate</Text>
              </Text>
              <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">Academic Validation Module</Text>
            </View>
            <Pressable onPress={onClose} className="w-11 h-11 rounded-xl items-center justify-center" hitSlop={2}>
              <Ionicons name="close" size={20} color="#12100E" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Category chips */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="tag" size={12} color="#8B857E" />
                <Text className="text-ink-3 font-display uppercase text-label">Specialization Field</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2 pr-6">
                  {CATEGORIES.map(c => (
                    <Pressable key={c} onPress={() => setForm(p => ({ ...p, category: c }))}
                      className={`px-4 py-2.5 rounded-xl border items-center shadow-hair ${form.category === c ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                      <Text className={`text-label font-display uppercase ${form.category === c ? 'text-white' : 'text-ink-3'}`}>
                        {c.replace('-', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {[
              { label: 'Certificate Title *', key: 'title', ph: 'e.g. AWS Cloud Practitioner', icon: 'award' },
              { label: 'Issuing Organization *', key: 'issuer', ph: 'e.g. Amazon Web Services', icon: 'home' },
              { label: 'Issue Date (YYYY-MM-DD)', key: 'issueDate', ph: '2024-03-15', icon: 'calendar' },
              { label: 'Expiry Date (YYYY-MM-DD)', key: 'expiryDate', ph: '2027-03-15', icon: 'clock' },
              { label: 'Credential ID', key: 'credentialId', ph: 'ABC123XYZ', icon: 'hash' },
              { label: 'Credential URL', key: 'credentialUrl', ph: 'https://...', icon: 'link' },
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
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                />
              </View>
            ))}

            {/* Image Picker */}
            <View className="mb-12">
              <View className="flex-row items-center gap-2 mb-4">
                <Feather name="image" size={12} color="#8B857E" />
                <Text className="text-ink-3 font-display uppercase text-label">Digital Proof / Manifest</Text>
              </View>
              <Pressable onPress={pickImage}>
                {image ? (
                   <View className="w-full h-48 rounded-card overflow-hidden border border-line shadow-hair">
                     <Image source={{ uri: image.uri }} className="w-full h-full" resizeMode="contain" />
                     <View className="absolute top-3 right-3 bg-black/60 rounded-full p-2 border border-white/20">
                       <Feather name="edit-2" size={14} color="white" />
                     </View>
                   </View>
                ) : existingImage ? (
                   <View className="w-full h-48 rounded-card overflow-hidden border border-line shadow-hair">
                     <Image source={{ uri: existingImage }} className="w-full h-full" resizeMode="contain" />
                     <View className="absolute top-3 right-3 bg-black/60 rounded-full p-2 border border-white/20">
                        <Feather name="edit-2" size={14} color="white" />
                     </View>
                   </View>
                ) : (
                   <View className="w-full h-48 border-2 border-dashed border-line rounded-sheet items-center justify-center bg-paper-2/50">
                     <View className="w-12 h-12 bg-card rounded-full items-center justify-center shadow-hair mb-3">
                       <Feather name="upload-cloud" size={20} color="#F97316" />
                     </View>
                     <Text className="text-ink-3 text-label font-display uppercase">Initialize Proof Upload</Text>
                   </View>
                )}
              </Pressable>
            </View>
            
            <View className="h-6" />
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
                      {isEdit ? 'Update Certificate' : 'Verify Achievement'}
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
