import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const PlacementPredictor = () => {
    const navigation = useNavigation<any>();
    const [gpa, setGpa] = useState('');
    const [resume, setResume] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const pickDocument = async () => {
        try {
            const res = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (!res.canceled) {
                setResume(res.assets[0]);
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    const handlePredict = async () => {
        if (!gpa || !resume) {
            return Alert.alert('Error', 'Please enter GPA and upload Resume');
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('gpa', gpa);
            formData.append('resume', {
                uri: resume.uri,
                name: resume.name,
                type: 'application/pdf',
            } as any);

            const res = await axios.post('/placement-predictor/predict', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000, // 60s for heavy AI analysis
            });

            if (res.data.success) {
                setResult(res.data.data.analysis);
            }
        } catch (err: any) {
            console.error(err);
            Alert.alert('Error', err.response?.data?.message || 'Prediction failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <View className="flex-1 bg-white">
                <StatusBar barStyle="dark-content" />
                <SafeAreaView className="flex-1">
                    <View className="px-6 pt-4 flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => setResult(null)} className="p-2 bg-slate-50 rounded-full">
                            <Ionicons name="arrow-back" size={24} color="#18181b" />
                        </TouchableOpacity>
                        <Text className="text-2xl font-black  uppercase tracking-tighter">Analysis <Text className="text-pink-500">Report</Text></Text>
                    </View>

                    <ScrollView className="flex-1 px-6 mt-6 pb-20" showsVerticalScrollIndicator={false}>
                        {/* Probability & ATS Score */}
                        <View className="flex-row items-center justify-between gap-4 mb-8">
                            <View className="flex-1 items-center bg-slate-50 p-6 rounded-4xl border border-slate-100">
                                <Text className="text-4xl font-black text-pink-500">{result.placement_probability}%</Text>
                                <Text className="text-2xs font-black uppercase text-slate-500 tracking-wide mt-1">Placement Probability</Text>
                            </View>
                            <View className="flex-1 items-center bg-slate-50 p-6 rounded-4xl border border-slate-100">
                                <Text className="text-4xl font-black text-indigo-500">{result.ats_score}%</Text>
                                <Text className="text-2xs font-black uppercase text-slate-500 tracking-wide mt-1">ATS Friendliness</Text>
                            </View>
                        </View>

                        {/* Jake's Format Badge */}
                        {result.is_jakes_format ? (
                            <View className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 flex-row items-center gap-3 mb-6">
                                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
                                <View>
                                    <Text className="text-emerald-700 font-black text-2xs uppercase tracking-wide ">Jake's Resume Standard</Text>
                                    <Text className="text-emerald-600/70 text-2xs font-bold">Your format is recruiter-optimized & ATS friendly.</Text>
                                </View>
                            </View>
                        ) : (
                            <View className="bg-amber-50 p-4 rounded-3xl border border-amber-100 flex-row items-center gap-3 mb-6">
                                <Ionicons name="warning" size={24} color="#f59e0b" />
                                <View className="flex-1">
                                    <Text className="text-amber-700 font-black text-2xs uppercase tracking-wide ">Formatting Alert</Text>
                                    <Text className="text-amber-600/70 text-2xs font-bold">{result.resume_fix_tip}</Text>
                                </View>
                            </View>
                        )}

                        {/* Salary Estimate */}
                        <LinearGradient
                            colors={['#18181b', '#3f3f46']}
                            className="p-6 rounded-4xl mb-6 flex-row items-center justify-between"
                        >
                            <View>
                                <Text className="text-white/60 text-2xs font-bold uppercase tracking-wide ">Est. Market Value (INR)</Text>
                                <Text className="text-white text-xl font-black ">{result.salary_estimate}</Text>
                            </View>
                            <View className="bg-pink-500/20 w-12 h-12 rounded-2xl items-center justify-center border border-white/10">
                                <MaterialCommunityIcons name="currency-inr" size={24} color="#ec4899" />
                            </View>
                        </LinearGradient>

                        {/* Top Roles */}
                        <Text className="text-xs font-black uppercase text-slate-500 tracking-wide mb-3">Suggested Roles</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {(result.roles || []).map((role: string, i: number) => (
                                <View key={i} className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                    <Text className="text-slate-700 font-bold text-xs">{role}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Target Companies */}
                        <Text className="text-xs font-black uppercase text-slate-500 tracking-wide mb-3">Target Companies</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {(result.target_companies || []).map((company: string, i: number) => (
                                <View key={i} className="bg-pink-50 px-4 py-2 rounded-xl border border-pink-100">
                                    <Text className="text-pink-600 font-bold text-xs">{company}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Strengths */}
                        <Text className="text-xs font-black uppercase text-slate-500 tracking-wide mb-3">Strengths</Text>
                        {(result.strengths || []).map((s: string, i: number) => (
                            <View key={i} className="flex-row items-center gap-2 mb-2">
                                <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                                <Text className="text-slate-600 font-medium text-sm flex-1">{s}</Text>
                            </View>
                        ))}

                        {/* Weaknesses */}
                        <Text className="text-xs font-black uppercase text-slate-500 tracking-wide mt-6 mb-3">Areas to Improve</Text>
                        {(result.weaknesses || []).map((w: string, i: number) => (
                            <View key={i} className="flex-row items-center gap-2 mb-2">
                                <Ionicons name="alert-circle" size={18} color="#f59e0b" />
                                <Text className="text-slate-600 font-medium text-sm flex-1">{w}</Text>
                            </View>
                        ))}

                        {/* Suggestion Roadmap */}
                        <Text className="text-xs font-black uppercase text-slate-500 tracking-wide mt-6 mb-3">Roadmap & Next Steps</Text>
                        <View className="bg-slate-50 p-5 rounded-3xl border border-slate-100 mb-20">
                            <Text className="text-slate-700 leading-6 ">{result.suggestion}</Text>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1">
                <View className="px-6 pt-4 flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-slate-50 rounded-full">
                        <Ionicons name="arrow-back" size={24} color="#18181b" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-3xl font-black  uppercase tracking-tighter">Placement <Text className="text-pink-500">Predictor</Text></Text>
                        <Text className="text-2xs font-black uppercase tracking-wide text-slate-500">AI Career Analysis</Text>
                    </View>
                </View>

                <ScrollView className="flex-1 px-6 mt-10">
                    <Text className="text-xs font-black uppercase text-slate-500 tracking-wide mb-4">Enter Academic Details</Text>

                    {/* GPA Input */}
                    <View className="bg-slate-50 p-6 rounded-4xl border border-slate-100 mb-6">
                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-2">Current CGPA / GPA</Text>
                        <TextInput
                            placeholder="e.g. 8.5"
                            placeholderTextColor="#cbd5e1"
                            value={gpa}
                            onChangeText={setGpa}
                            keyboardType="numeric"
                            className="text-2xl font-black text-slate-900"
                        />
                    </View>

                    {/* Resume Picker */}
                    <TouchableOpacity
                        onPress={pickDocument}
                        activeOpacity={0.8}
                        className={`p-10 rounded-4xl border-2 border-dashed items-center justify-center ${resume ? 'bg-pink-50 border-pink-200' : 'bg-slate-50 border-slate-200'}`}
                    >
                        <View className={`w-16 h-16 rounded-2xl items-center justify-center mb-4 ${resume ? 'bg-pink-500' : 'bg-slate-200'}`}>
                            <Ionicons name={resume ? "document-text" : "cloud-upload"} size={32} color="white" />
                        </View>
                        <Text className={`font-black uppercase text-xs tracking-widest text-center ${resume ? 'text-pink-600' : 'text-slate-500'}`}>
                            {resume ? resume.name : 'Upload PDF Resume'}
                        </Text>
                        {resume && <Text className="text-2xs font-bold text-pink-400 mt-2">Tap to change file</Text>}
                    </TouchableOpacity>

                    <View className="mt-10 bg-blue-50 p-6 rounded-3xl border border-blue-100 flex-row items-center gap-4">
                        <Ionicons name="information-circle" size={24} color="#3b82f6" />
                        <Text className="flex-1 text-blue-600 text-2xs font-bold leading-4">
                            Our AI will analyze your GPA and resume keywords to match you with top-tier companies and predict your success rate.
                        </Text>
                    </View>
                </ScrollView>

                <View className="p-6">
                    <TouchableOpacity
                        onPress={handlePredict}
                        disabled={loading}
                        activeOpacity={0.9}
                        className="w-full rounded-2xl"
                    >
                        <LinearGradient
                            colors={['#ec4899', '#db2777']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="py-4 rounded-2xl flex-row justify-center items-center shadow-2xl shadow-pink-500/30"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View className='flex-row rounded-2xl'>
                                    <Text className="text-white font-black  text-lg mr-1 uppercase">Generate Prediction</Text>
                                    <Ionicons name="flash" size={22} color="white" />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default PlacementPredictor;
