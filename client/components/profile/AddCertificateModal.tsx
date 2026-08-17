import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Dimensions
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
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
                {isEdit ? 'Verify' : 'Add'} <Text className="text-orange-500">Certificate</Text>
              </Text>
              <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wide mt-0.5">Academic Validation Module</Text>
            </View>
            <Pressable onPress={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
              <Ionicons name="close" size={20} color="#18181b" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Category chips */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="tag" size={12} color="#94A3B8" />
                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">Specialization Field</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2 pr-6">
                  {CATEGORIES.map(c => (
                    <Pressable key={c} onPress={() => setForm(p => ({ ...p, category: c }))}
                      className={`px-4 py-2.5 rounded-xl border items-center shadow-sm ${form.category === c ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-100'}`}>
                      <Text className={`text-2xs font-black uppercase tracking-widest ${form.category === c ? 'text-white' : 'text-slate-500'}`}>
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
                  <Feather name={f.icon as any} size={12} color="#94A3B8" />
                  <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">{f.label}</Text>
                </View>
                <TextInput
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 text-sm font-semibold"
                  placeholder={f.ph} placeholderTextColor="#94A3B8"
                  value={(form as any)[f.key]}
                  onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                />
              </View>
            ))}

            {/* Image Picker */}
            <View className="mb-12">
              <View className="flex-row items-center gap-2 mb-4">
                <Feather name="image" size={12} color="#94A3B8" />
                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">Digital Proof / Manifest</Text>
              </View>
              <Pressable onPress={pickImage}>
                {image ? (
                   <View className="w-full h-48 rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                     <Image source={{ uri: image.uri }} className="w-full h-full" resizeMode="contain" />
                     <View className="absolute top-3 right-3 bg-black/60 rounded-full p-2 border border-white/20">
                       <Feather name="edit-2" size={14} color="white" />
                     </View>
                   </View>
                ) : existingImage ? (
                   <View className="w-full h-48 rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                     <Image source={{ uri: existingImage }} className="w-full h-full" resizeMode="contain" />
                     <View className="absolute top-3 right-3 bg-black/60 rounded-full p-2 border border-white/20">
                        <Feather name="edit-2" size={14} color="white" />
                     </View>
                   </View>
                ) : (
                   <View className="w-full h-48 border-2 border-dashed border-slate-200 rounded-4xl items-center justify-center bg-slate-50/50">
                     <View className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm mb-3">
                       <Feather name="upload-cloud" size={20} color="#f97316" />
                     </View>
                     <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Initialize Proof Upload</Text>
                   </View>
                )}
              </Pressable>
            </View>
            
            <View className="h-6" />
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
