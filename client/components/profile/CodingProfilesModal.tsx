import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { C } from '../../constants/colors';
import { Sheet, FormField, Button } from '../ui/kit';

interface CodingProfilesModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData: any;
}

const ProfileInput = ({ label, value, onChange, icon, logo }: any) => (
  <FormField
    label={label}
    value={value}
    onChangeText={onChange}
    placeholder="Username"
    autoCapitalize="none"
    autoCorrect={false}
    accessibilityLabel={`${label} username`}
    containerStyle={{ marginBottom: 16 }}
    right={
      <View className="w-6 h-6 items-center justify-center">
        {logo ? <Image source={{ uri: logo }} style={{ width: 20, height: 20 }} contentFit="contain" cachePolicy="memory-disk" />
          : <Feather name={icon} size={16} color={C.ink3} />}
      </View>
    }
  />
);

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


  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Coding profiles"
      subtitle="Add your usernames to show stats on your profile"
      height="80%"
      footer={<Button variant="primary" block icon="save-outline" title="Save profiles" onPress={handleSave} loading={loading} />}
    >
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
    </Sheet>
  );
};

export default CodingProfilesModal;
