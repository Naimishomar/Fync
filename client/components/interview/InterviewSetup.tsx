import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

export default function InterviewSetup() {
  const navigation = useNavigation<any>();
  
  const [domain, setDomain] = useState('');
  const [experience, setExperience] = useState('');
  const [duration, setDuration] = useState(5);
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setResume(result.assets[0]);
      }
    } catch (err) {
      console.log("Error picking document:", err);
      Alert.alert("Error", "Failed to pick document");
    }
  };

  const startSession = async () => {
    if (!domain.trim() || !experience.trim()) {
      Alert.alert("Missing Fields", "Please enter the role and your experience.");
      return;
    }
    if (!resume) {
      Alert.alert("Resume Required", "Please upload your resume (PDF).");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', {
        uri: resume.uri,
        type: resume.mimeType || 'application/pdf',
        name: resume.name || 'resume.pdf',
      } as any);

      formData.append('domain', domain);
      formData.append('experience', experience);
      formData.append('duration', duration.toString());

      console.log("Submitting Interview Setup...");

      const res = await axios.post('/interview/start', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        console.log("Session Created ID:", res.data.sessionId);
        navigation.navigate('ActiveInterview', {
          sessionId: res.data.sessionId,
          firstQuestion: res.data.question,
          duration: duration
        });
      }

    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Setup failed', text2: err.message });
      console.error("Setup Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="bg-black p-6">
        
        {/* Header */}
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-8 mb-6">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-3xl text-white font-bold mb-2">AI Mock Interview</Text>
        <Text className="text-gray-400 mb-8">
          Upload your resume and let our AI interviewer test your skills based on your profile.
        </Text>

        {/* Form Inputs */}
        <View className="gap-6">
            
            {/* Domain Input */}
            <View>
                <Text className="text-gray-300 font-bold mb-2 ml-1">Target Role / Domain</Text>
                <TextInput 
                    placeholder="e.g. React Native Developer, Data Scientist" 
                    placeholderTextColor="#6b7280"
                    className="bg-gray-900 text-white p-4 rounded-xl border border-gray-800 focus:border-blue-500"
                    value={domain}
                    onChangeText={setDomain}
                />
            </View>

            {/* Experience Input */}
            <View>
                <Text className="text-gray-300 font-bold mb-2 ml-1">Years of Experience</Text>
                <TextInput 
                    placeholder="e.g. 2" 
                    placeholderTextColor="#6b7280"
                    className="bg-gray-900 text-white p-4 rounded-xl border border-gray-800 focus:border-blue-500"
                    keyboardType="numeric"
                    value={experience}
                    onChangeText={setExperience}
                />
            </View>

            {/* Duration Selector */}
            <View>
                <Text className="text-gray-300 font-bold mb-3 ml-1">Interview Duration</Text>
                <View className="flex-row gap-4">
                    {[5, 10, 15].map((min) => (
                    <TouchableOpacity 
                        key={min} 
                        onPress={() => setDuration(min)}
                        className={`flex-1 p-4 rounded-xl items-center border ${
                            duration === min 
                                ? 'bg-blue-600 border-blue-500' 
                                : 'bg-gray-900 border-gray-800'
                        }`}
                    >
                        <Text className={`font-bold text-lg ${duration === min ? 'text-white' : 'text-gray-400'}`}>
                            {min} min
                        </Text>
                    </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* File Upload */}
            <View>
                <Text className="text-gray-300 font-bold mb-2 ml-1">Resume (PDF)</Text>
                <Pressable 
                    onPress={pickResume} 
                    className={`p-6 rounded-xl border-2 border-dashed items-center justify-center ${
                        resume ? 'border-green-500 bg-green-900/10' : 'border-gray-700 bg-gray-900'
                    }`}
                >
                    {resume ? (
                        <View className="items-center">
                             <Ionicons name="document-text" size={40} color="#4ade80" />
                             <Text className="text-white font-bold mt-2 text-center" numberOfLines={1}>
                                {resume.name}
                             </Text>
                             <Text className="text-green-500 text-xs mt-1">Ready to upload</Text>
                        </View>
                    ) : (
                        <View className="items-center">
                            <Ionicons name="cloud-upload-outline" size={40} color="#6b7280" />
                            <Text className="text-gray-400 font-bold mt-2">Tap to Upload Resume</Text>
                        </View>
                    )}
                </Pressable>
            </View>

        </View>

        {/* Start Button */}
        <View className="mt-10 mb-10">
            <TouchableOpacity 
                onPress={startSession}
                disabled={loading}
                className={`w-full py-4 rounded-full flex-row justify-center items-center ${
                    loading ? 'bg-blue-800' : 'bg-blue-600'
                }`}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Text className="text-white font-bold text-lg mr-2">Start Interview</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                    </>
                )}
            </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}