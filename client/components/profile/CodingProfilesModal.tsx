import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, 
  ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

interface CodingProfilesModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: any;
}

const CodingProfilesModal = ({ visible, onClose, onSuccess, initialData }: CodingProfilesModalProps) => {
  const [loading, setLoading] = useState(false);
  const [leetcode, setLeetcode] = useState(initialData?.leetcode || '');
  const [gfg, setGfg] = useState(initialData?.gfg || '');
  const [codechef, setCodechef] = useState(initialData?.codechef || '');
  const [codeforces, setCodeforces] = useState(initialData?.codeforces || '');
  const [hackerrank, setHackerrank] = useState(initialData?.hackerrank || '');

  useEffect(() => {
    if (visible) {
      setLeetcode(initialData?.leetcode || '');
      setGfg(initialData?.gfg || '');
      setCodechef(initialData?.codechef || '');
      setCodeforces(initialData?.codeforces || '');
      setHackerrank(initialData?.hackerrank || '');
    }
  }, [visible, initialData]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('leetcode', leetcode);
      formData.append('gfg', gfg);
      formData.append('codechef', codechef);
      formData.append('codeforces', codeforces);
      formData.append('hackerrank', hackerrank);

      const res = await axios.post('/user/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Coding profiles updated!' });
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  const ProfileInput = ({ label, value, onChange, icon, color, logo }: any) => (
    <View className="mb-4">
      <View className="flex-row items-center mb-1.5 ml-1">
        {logo ? (
          <Image source={{ uri: logo }} className="w-4 h-4 mr-2" resizeMode="contain" />
        ) : (
          <Ionicons name={icon} size={16} color={color} className="mr-2" />
        )}
        <Text className="text-gray-600 font-semibold text-xs">{label}</Text>
      </View>
      <View className="flex-row items-center bg-gray-50 rounded-xl px-3 border border-gray-100">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={`${label} username`}
          placeholderTextColor="#9ca3af"
          className="flex-1 text-gray-900 py-3 text-sm"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="bg-white rounded-t-[32px] overflow-hidden"
        >
          <View className="px-6 pt-8 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <View>
                <Text className="text-xl font-bold text-gray-900">Coding Profiles</Text>
                <Text className="text-gray-500 text-xs mt-1">Showcase your competitive programming handles</Text>
              </View>
              <Pressable onPress={onClose} className="bg-gray-100 p-2 rounded-full">
                <Ionicons name="close" size={20} color="#374151" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[400px]">
              <ProfileInput 
                label="LeetCode" 
                value={leetcode} 
                onChange={setLeetcode} 
                logo="https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0"
              />
              <ProfileInput 
                label="GeeksforGeeks" 
                value={gfg} 
                onChange={setGfg} 
                logo="https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png"
              />
              <ProfileInput 
                label="CodeChef" 
                value={codechef} 
                onChange={setCodechef} 
                logo="https://cdn.codechef.com/images/email/codechef-logo.png"
              />
              <ProfileInput 
                label="Codeforces" 
                value={codeforces} 
                onChange={setCodeforces} 
                icon="code-working"
                color="#3b82f6"
              />
              <ProfileInput 
                label="HackerRank" 
                value={hackerrank} 
                onChange={setHackerrank} 
                icon="terminal"
                color="#2ec866"
              />
            </ScrollView>

            <Pressable
              onPress={handleSave}
              disabled={loading}
              className={`mt-6 py-4 rounded-2xl items-center justify-center ${loading ? 'bg-indigo-400' : 'bg-indigo-600 shadow-lg shadow-indigo-200'}`}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Save Profiles</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default CodingProfilesModal;
