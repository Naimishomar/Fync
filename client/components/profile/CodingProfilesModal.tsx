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
            <Feather name={icon} size={14} color="#F97316" />
            )}
        </View>
        <Text className="text-ink-3 font-display uppercase text-label">{label}</Text>
      </View>
      <View className="flex-row items-center bg-paper-2 px-5 border-2 border-ink shadow-hair rounded-md">
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={`${label} identifier`}
          placeholderTextColor="#8B857E"
          className="flex-1 text-ink py-4 text-sm font-semibold"
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
          className="bg-paper rounded-t-sheet overflow-hidden"
          style={{ height: screenHeight * 0.80 }}
        >
          {/* Handle */}
          <View className="items-center py-4">
            <View className="w-12 h-1.5 bg-ink-4 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-gutter pb-4 border-b border-line">
            <View>
              <Text className="text-ink font-display uppercase text-h1">
                Coding <Text className="text-accent-text">Profiles</Text>
              </Text>
              <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">Competitive Protocol</Text>
            </View>
            <Pressable onPress={onClose} className="w-11 h-11 rounded-xl items-center justify-center" hitSlop={2}>
              <Ionicons name="close" size={20} color="#12100E" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-gutter pt-6">
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
          <View className="p-card-pad border-t border-line bg-card shadow-hair">
            <Pressable
              onPress={handleSave}
              disabled={loading}
              className="bg-ink py-5 flex-row items-center justify-center border-2 border-ink rounded-md"
            >
              {loading ? (
                <ActivityIndicator color="#F97316" />
              ) : (
                <>
                  <Feather name="save" size={16} color="white" className="mr-2" />
                  <Text className="text-white font-display uppercase text-xs ml-2">Sync Ecosystem</Text>
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
