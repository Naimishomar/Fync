import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

import { AppBar, BottomBar, Button, Card, FormField, IconTile, Label, Num, SectionHeader, Tag, TagRow } from '../ui/kit';
import { C } from '../../constants/colors';
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
                setResult(res.data.data?.analysis ?? null);
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
                <StatusBar barStyle={C.barStyle} />
                <SafeAreaView className="flex-1" edges={['bottom']}>
                    <AppBar title="Analysis report" onBack={() => setResult(null)} />

                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
                        <View className="flex-row mb-4" style={{ gap: 12 }}>
                            <Card padded style={{ flex: 1, alignItems: 'center', paddingVertical: 24 }}>
                                <Num style={{ fontSize: 34, lineHeight: 38 }}>{result.placement_probability}%</Num>
                                <Label style={{ marginTop: 4, textAlign: 'center' }}>Placement probability</Label>
                            </Card>
                            <Card padded style={{ flex: 1, alignItems: 'center', paddingVertical: 24 }}>
                                <Num style={{ fontSize: 34, lineHeight: 38, color: C.recruiter }}>{result.ats_score}%</Num>
                                <Label style={{ marginTop: 4, textAlign: 'center' }}>ATS friendliness</Label>
                            </Card>
                        </View>

                        <Card padded style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Ionicons name={result.is_jakes_format ? 'checkmark-circle' : 'warning'} size={24} color={result.is_jakes_format ? C.success : C.warning} />
                            <View className="flex-1">
                                <Text className="text-ink font-semibold text-sm">{result.is_jakes_format ? "Jake's resume format" : 'Formatting tip'}</Text>
                                <Text className="text-ink-3 text-sm font-sans mt-0.5">
                                    {result.is_jakes_format ? 'Your format is recruiter-optimised and ATS friendly.' : result.resume_fix_tip}
                                </Text>
                            </View>
                        </Card>

                        <Card padded style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View className="flex-1">
                                <Label>Estimated salary (INR)</Label>
                                <Text className="text-ink text-xl font-display mt-1">{result.salary_estimate}</Text>
                            </View>
                            <IconTile icon="cash-outline" color={C.accentText} />
                        </Card>

                        <SectionHeader title="Suggested roles" style={{ marginBottom: 12 }} />
                        <TagRow style={{ marginBottom: 24 }}>
                            {(result.roles || []).map((role: string, i: number) => <Tag key={i} label={role} />)}
                        </TagRow>

                        <SectionHeader title="Target companies" style={{ marginBottom: 12 }} />
                        <TagRow style={{ marginBottom: 24 }}>
                            {(result.target_companies || []).map((company: string, i: number) => <Tag key={i} label={company} />)}
                        </TagRow>

                        <SectionHeader title="Strengths" style={{ marginBottom: 12 }} />
                        {(result.strengths || []).map((s: string, i: number) => (
                            <View key={i} className="flex-row items-center mb-2" style={{ gap: 8 }}>
                                <Ionicons name="checkmark-circle" size={18} color={C.success} />
                                <Text className="text-ink-2 font-sans text-sm flex-1">{s}</Text>
                            </View>
                        ))}

                        <SectionHeader title="Areas to improve" style={{ marginTop: 24, marginBottom: 12 }} />
                        {(result.weaknesses || []).map((w: string, i: number) => (
                            <View key={i} className="flex-row items-center mb-2" style={{ gap: 8 }}>
                                <Ionicons name="alert-circle" size={18} color={C.warning} />
                                <Text className="text-ink-2 font-sans text-sm flex-1">{w}</Text>
                            </View>
                        ))}

                        <SectionHeader title="Next steps" style={{ marginTop: 24, marginBottom: 12 }} />
                        <Card padded>
                            <Text className="text-ink-2 font-sans text-base leading-6">{result.suggestion}</Text>
                        </Card>
                    </ScrollView>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title="Placement Predictor" onBack={() => navigation.goBack()} />

                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
                    <FormField
                        label="Current CGPA / GPA"
                        placeholder="e.g. 8.5"
                        value={gpa}
                        onChangeText={setGpa}
                        keyboardType="numeric"
                    />

                    <Pressable
                        onPress={pickDocument}
                        accessibilityRole="button"
                        accessibilityLabel={resume ? `Resume ${resume.name}, tap to change` : 'Upload PDF resume'}
                        className={`p-6 rounded-2xl border border-dashed items-center justify-center active:opacity-85 ${resume ? 'bg-brand-50 border-brand-500' : 'bg-card border-line'}`}
                    >
                        <IconTile icon={resume ? 'document-text-outline' : 'cloud-upload-outline'} size={56} color={resume ? C.accentText : C.ink} style={{ marginBottom: 12 }} />
                        <Text className="font-semibold text-sm text-center text-ink" numberOfLines={2}>
                            {resume ? resume.name : 'Upload PDF resume'}
                        </Text>
                        {resume ? <Text className="text-xs font-semibold text-accent-text mt-1">Tap to change file</Text> : null}
                    </Pressable>

                    <Card padded style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons name="information-circle-outline" size={22} color={C.ink3} />
                        <Text className="flex-1 text-ink-3 text-sm font-sans leading-5">
                            Our AI analyses your GPA and resume keywords to match you with top companies and predict your chances.
                        </Text>
                    </Card>
                </ScrollView>

                <BottomBar>
                    <Button title="Generate prediction" icon="flash" variant="primary" block loading={loading} onPress={handlePredict} />
                </BottomBar>
            </SafeAreaView>
        </View>
    );
};

export default PlacementPredictor;
