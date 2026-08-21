import React, { useState } from 'react';
import {View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
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
            <View className="flex-1 bg-paper">
                <StatusBar barStyle="dark-content" />
                <SafeAreaView className="flex-1">
                    <View className="px-6 pt-4 flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => setResult(null)} className="p-2 bg-paper-2 rounded-full">
                            <Ionicons name="arrow-back" size={24} color="#12100E" />
                        </TouchableOpacity>
                        <Text className="text-2xl font-display uppercase">Analysis <Text className="text-accent-text">Report</Text></Text>
                    </View>

                    <ScrollView className="flex-1 px-6 mt-6 pb-20" showsVerticalScrollIndicator={false}>
                        {/* Probability & ATS Score */}
                        <View className="flex-row items-center justify-between gap-4 mb-8">
                            <StampCard style={{ flex: 1 }}>
                                <View className="items-center p-card-pad" style={{ paddingVertical: 24 }}>
                                    <Text className="font-display text-ink" style={{ fontSize: 34, lineHeight: 36, letterSpacing: -1.2 }}>
                                        {result.placement_probability}%
                                    </Text>
                                    <Text className="font-display text-label uppercase text-ink-3 mt-1">Placement Probability</Text>
                                </View>
                            </StampCard>
                            <View className="flex-1 items-center bg-paper-2 p-6 rounded-sheet border border-line">
                                <Text className="text-4xl font-display text-recruiter">{result.ats_score}%</Text>
                                <Text className="text-label font-display uppercase text-ink-3 mt-1">ATS Friendliness</Text>
                            </View>
                        </View>

                        {/* Jake's Format Badge */}
                        {result.is_jakes_format ? (
                            <View className="bg-success/10 p-4 rounded-card border border-success/15 flex-row items-center gap-3 mb-6">
                                <Ionicons name="checkmark-circle" size={24} color="#047857" />
                                <View>
                                    <Text className="text-success font-display text-label uppercase">Jake's Resume Standard</Text>
                                    <Text className="text-success/70 text-label font-semibold">Your format is recruiter-optimized & ATS friendly.</Text>
                                </View>
                            </View>
                        ) : (
                            <View className="bg-warning/10 p-4 rounded-card border border-warning/15 flex-row items-center gap-3 mb-6">
                                <Ionicons name="warning" size={24} color="#B45309" />
                                <View className="flex-1">
                                    <Text className="text-warning font-display text-label uppercase">Formatting Alert</Text>
                                    <Text className="text-warning/70 text-label font-semibold">{result.resume_fix_tip}</Text>
                                </View>
                            </View>
                        )}

                        {/* Salary Estimate */}
                        <View
                            className="p-6 rounded-sheet mb-6 flex-row items-center justify-between"
                         style={{ backgroundColor: '#12100E' }}>
                            <View>
                                <Text className="text-white/60 text-label font-semibold uppercase">Est. Market Value (INR)</Text>
                                <Text className="text-white text-xl font-display">{result.salary_estimate}</Text>
                            </View>
                            <View className="bg-brand-500/20 w-12 h-12 rounded-card items-center justify-center border border-white/10">
                                <MaterialCommunityIcons name="currency-inr" size={24} color="#F97316" />
                            </View>
                        </View>

                        {/* Top Roles */}
                        <Text className="font-semibold text-base text-ink mb-3">Suggested Roles</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {(result.roles || []).map((role: string, i: number) => (
                                <View key={i} className="bg-paper-2 px-4 py-2 rounded-xl border border-line">
                                    <Text className="text-ink-2 font-semibold text-xs">{role}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Target Companies */}
                        <Text className="font-semibold text-base text-ink mb-3">Target Companies</Text>
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {(result.target_companies || []).map((company: string, i: number) => (
                                <View key={i} className="bg-paper-2 px-4 py-2 rounded-xl border border-line">
                                    <Text className="text-accent-text font-semibold text-xs">{company}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Strengths */}
                        <Text className="font-semibold text-base text-ink mb-3">Strengths</Text>
                        {(result.strengths || []).map((s: string, i: number) => (
                            <View key={i} className="flex-row items-center gap-2 mb-2">
                                <Ionicons name="checkmark-circle" size={18} color="#047857" />
                                <Text className="text-ink-2 font-medium text-sm flex-1">{s}</Text>
                            </View>
                        ))}

                        {/* Weaknesses */}
                        <Text className="font-semibold text-base text-ink mt-6 mb-3">Areas to Improve</Text>
                        {(result.weaknesses || []).map((w: string, i: number) => (
                            <View key={i} className="flex-row items-center gap-2 mb-2">
                                <Ionicons name="alert-circle" size={18} color="#B45309" />
                                <Text className="text-ink-2 font-medium text-sm flex-1">{w}</Text>
                            </View>
                        ))}

                        {/* Suggestion Roadmap */}
                        <Text className="font-semibold text-base text-ink mt-6 mb-3">Roadmap & Next Steps</Text>
                        <View className="bg-paper-2 p-5 rounded-card border border-line mb-20">
                            <Text className="text-ink-2 leading-6">{result.suggestion}</Text>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1">
                <View className="px-6 pt-4 flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                        <Ionicons name="arrow-back" size={24} color="#12100E" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-3xl font-display uppercase">Placement <Text className="text-accent-text">Predictor</Text></Text>
                        <Text className="text-label font-display uppercase text-ink-3">AI Career Analysis</Text>
                    </View>
                </View>

                <ScrollView className="flex-1 px-6 mt-10">
                    <Text className="font-semibold text-base text-ink mb-4">Enter Academic Details</Text>

                    {/* GPA Input */}
                    <View className="bg-paper-2 p-6 rounded-sheet border border-line mb-6">
                        <Text className="text-ink-3 text-label font-display uppercase mb-2">Current CGPA / GPA</Text>
                        <TextInput
                            placeholder="e.g. 8.5"
                            placeholderTextColor="#C4BEB6"
                            value={gpa}
                            onChangeText={setGpa}
                            keyboardType="numeric"
                            className="text-2xl font-display text-ink"
                        />
                    </View>

                    {/* Resume Picker */}
                    <TouchableOpacity
                        onPress={pickDocument}
                        activeOpacity={0.8}
                        className={`p-card-pad rounded-sheet border-2 border-dashed items-center justify-center ${resume ? 'bg-brand-50 border-brand-200' : 'bg-paper-2 border-line'}`}
                    >
                        <View className={`w-16 h-16 rounded-card items-center justify-center mb-4 ${resume ? 'bg-brand-500' : 'bg-paper-2'}`}>
                            <Ionicons name={resume ? "document-text" : "cloud-upload"} size={32} color="#12100E" />
                        </View>
                        <Text className={`font-display uppercase text-sm text-center ${resume ? 'text-accent-text' : 'text-ink-3'}`}>
                            {resume ? resume.name : 'Upload PDF Resume'}
                        </Text>
                        {resume && <Text className="text-label font-semibold text-accent-text mt-2">Tap to change file</Text>}
                    </TouchableOpacity>

                    <View className="mt-10 bg-fam-career/10 p-6 rounded-card border border-fam-career/15 flex-row items-center gap-4">
                        <Ionicons name="information-circle" size={24} color="#2563EB" />
                        <Text className="flex-1 text-fam-career text-label font-semibold leading-4">
                            Our AI will analyze your GPA and resume keywords to match you with top-tier companies and predict your success rate.
                        </Text>
                    </View>
                </ScrollView>

                <View className="p-6">
                    <TouchableOpacity
                        onPress={handlePredict}
                        disabled={loading}
                        activeOpacity={0.9}
                        className="w-full rounded-card"
                    >
                        <View
                            className="py-4 rounded-card flex-row justify-center items-center shadow-hair"
                         style={{ backgroundColor: '#F97316' }}>
                            {loading ? (
                                <ActivityIndicator color="#12100E" />
                            ) : (
                                <View className='flex-row rounded-card'>
                                    <Text className="text-ink font-display text-lg mr-1 uppercase">Generate Prediction</Text>
                                    <Ionicons name="flash" size={22} color="#12100E" />
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default PlacementPredictor;
