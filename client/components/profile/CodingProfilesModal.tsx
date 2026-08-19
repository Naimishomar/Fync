import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, Modal, 
  ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const { height: screenHeight } = Dimensions.get('window');

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
        Toast.show({ type: 'success', text1: 'Profiles updated!' });
        onSuccess();
      }
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Update failed' });
    } finally {
      setLoading(false);
    }
  };

  const ProfileInput = ({ label, value, onChange, icon, logo }: any) => (
    <View className="mb-6">
      <View className="flex-row items-center mb-2 ml-1">
        <View className="w-6 h-6 items-center justify-center mr-2">
            {logo ? (
            <Image source={{ uri: logo }} className="w-5 h-5" resizeMode="contain" />
            ) : (
            <Feather name={icon} size={14} color="#f97316" />
            )}
        </View>
        <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">{label}</Text>
      </View>
      <View className="flex-row items-center bg-slate-50 rounded-2xl px-5 border border-slate-100 shadow-sm">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={`${label} identifier`}
          placeholderTextColor="#94A3B8"
          className="flex-1 text-slate-900 py-4 text-sm font-semibold"
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="absolute inset-0" onPress={onClose} />
        <KeyboardAvoidingView 
          behavior="padding"
          className="bg-white rounded-t-5xl overflow-hidden"
          style={{ height: screenHeight * 0.80 }}
        >
          {/* Handle */}
          <View className="items-center py-4">
            <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-8 pb-4 border-b border-slate-50">
            <View>
              <Text className="text-slate-900 font-black uppercase text-xl tracking-tighter">
                Coding <Text className="text-orange-500">Profiles</Text>
              </Text>
              <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wide mt-0.5">Competitive Protocol</Text>
            </View>
            <Pressable onPress={onClose} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
              <Ionicons name="close" size={20} color="#18181b" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-8 pt-6">
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
              icon="terminal"
            />
            <ProfileInput 
              label="HackerRank" 
              value={hackerrank} 
              onChange={setHackerrank} 
              icon="code"
            />
            <View className="h-10" />
          </ScrollView>

          {/* Footer Action */}
          <View className="p-8 border-t border-slate-50 bg-white shadow-2xl shadow-black">
            <Pressable
              onPress={handleSave}
              disabled={loading}
              className="bg-slate-900 py-5 rounded-2xl flex-row items-center justify-center shadow-xl shadow-black/20"
            >
              {loading ? (
                <ActivityIndicator color="#f97316" />
              ) : (
                <>
                  <Feather name="save" size={16} color="white" className="mr-2" />
                  <Text className="text-white font-black uppercase text-xs tracking-wide ml-2">Sync Ecosystem</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default CodingProfilesModal;
