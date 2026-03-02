import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
    <View className="flex-1 bg-black">
      {/* Background Gradient */}
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          className="flex-1"
        >
          {/* HEADER */}
          <View className="flex-row items-center px-6 pt-4 mb-2">
            <TouchableOpacity 
              onPress={() => navigation.goBack()} 
              className="p-2 bg-white/10 rounded-full mr-4 border border-white/10"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-3xl font-black italic tracking-tighter">
              AI<Text className="text-pink-500">INTERVIEW</Text> 🤖
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} className="px-6">
            
            <Text className="text-gray-400 mb-8 mt-2 text-sm leading-5">
              Configure your AI interviewer. Upload your resume and let the system tailor the technical questions to your profile.
            </Text>

            {/* MAIN FORM CARD */}
            <View className="bg-[#1e1e1e]/80 p-6 rounded-3xl border border-white/10 shadow-2xl">
              
              <View className="gap-6">
                  
                  {/* Domain Input */}
                  <View>
                      <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs uppercase tracking-wider">Target Role / Domain</Text>
                      <TextInput 
                          placeholder="e.g. React Native, Data Scientist" 
                          placeholderTextColor="#6b7280"
                          className="bg-[#2a2a2a] text-white p-4 rounded-2xl border border-white/10 font-medium"
                          value={domain}
                          onChangeText={setDomain}
                      />
                  </View>

                  {/* Experience Input */}
                  <View>
                      <Text className="text-gray-400 font-bold mb-2 ml-1 text-xs uppercase tracking-wider">Years of Experience</Text>
                      <TextInput 
                          placeholder="e.g. 2" 
                          placeholderTextColor="#6b7280"
                          className="bg-[#2a2a2a] text-white p-4 rounded-2xl border border-white/10 font-medium"
                          keyboardType="numeric"
                          value={experience}
                          onChangeText={setExperience}
                      />
                  </View>

                  {/* Duration Selector */}
                  <View>
                      <Text className="text-gray-400 font-bold mb-3 ml-1 text-xs uppercase tracking-wider">Interview Duration</Text>
                      <View className="flex-row gap-3">
                          {[5, 10, 15].map((min) => (
                          <TouchableOpacity 
                              key={min} 
                              activeOpacity={0.8}
                              onPress={() => setDuration(min)}
                              className={`flex-1 p-4 rounded-2xl items-center border transition-all ${
                                  duration === min 
                                      ? 'bg-pink-600/20 border-pink-500' 
                                      : 'bg-[#2a2a2a] border-white/5'
                              }`}
                          >
                              <Text className={`font-bold text-lg ${duration === min ? 'text-white' : 'text-gray-500'}`}>
                                  {min} <Text className="text-xs font-medium">min</Text>
                              </Text>
                          </TouchableOpacity>
                          ))}
                      </View>
                  </View>

                  {/* File Upload */}
                  <View>
                      <Text className="text-gray-400 font-bold mb-3 ml-1 text-xs uppercase tracking-wider">Resume (PDF)</Text>
                      <Pressable 
                          onPress={pickResume} 
                          className={`p-6 rounded-3xl border-2 border-dashed items-center justify-center transition-all ${
                              resume ? 'border-pink-500 bg-pink-500/10' : 'border-white/20 bg-[#2a2a2a]/50'
                          }`}
                      >
                          {resume ? (
                              <View className="items-center">
                                    <View className="bg-pink-500/20 p-3 rounded-full mb-3 border border-pink-500/30">
                                      <Ionicons name="document-text" size={32} color="#ec4899" />
                                    </View>
                                    <Text className="text-white font-bold text-center" numberOfLines={1}>
                                      {resume.name}
                                    </Text>
                                    <Text className="text-pink-500 font-bold text-xs mt-1 uppercase tracking-widest">Ready to upload</Text>
                              </View>
                          ) : (
                              <View className="items-center py-2">
                                  <Ionicons name="cloud-upload-outline" size={40} color="#6b7280" />
                                  <Text className="text-gray-400 font-bold mt-3">Tap to Upload Resume</Text>
                                  <Text className="text-gray-600 text-xs mt-1">PDF format only</Text>
                              </View>
                          )}
                      </Pressable>
                  </View>

              </View>
            </View>

            {/* Start Button */}
            <View className="mt-8">
                <TouchableOpacity 
                    onPress={startSession}
                    disabled={loading}
                    className={`w-full py-5 rounded-2xl shadow-lg flex-row justify-center items-center border ${
                        loading ? 'bg-pink-600/50 border-pink-500/30' : 'bg-pink-600 border-pink-500/50'
                    }`}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="text-white font-black text-xl mr-2 tracking-widest uppercase">Start Interview</Text>
                            <Ionicons name="rocket" size={20} color="white" />
                        </>
                    )}
                </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}