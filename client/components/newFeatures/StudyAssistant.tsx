import React, { useState, useRef } from 'react';
import {View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Dimensions, StatusBar} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
const { width } = Dimensions.get('window');

export default function StudyAssistant() {
    const [pdfContent, setPdfContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [chat, setChat] = useState<{ role: string, text: string }[]>([]);
    const [inputText, setInputText] = useState('');
    const [history, setHistory] = useState<{ role: string, parts: { text: string }[] }[]>([]);
    const scrollViewRef = useRef<ScrollView>(null);

    const handleUpload = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
        if (!result.canceled) {
            setLoading(true);
            const formData = new FormData();
            // @ts-ignore
            formData.append('pdf', {
                uri: result.assets[0].uri,
                name: result.assets[0].name,
                type: 'application/pdf',
            });

            try {
                const response = await axios.post('/api/study/upload-pdf', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setPdfContent(response.data.text);
                setChat([{ role: 'bot', text: "PDF memorised. I have indexed your notes. Ask me for a summary, key formulas, or a practice quiz!" }]);
            } catch (e) {
                Alert.alert("Error", "Server-side extraction failed.");
            } finally {
                setLoading(false);
            }
        }
    };

    const runAiTask = async (mode: 'CHAT' | 'QUESTIONS', query?: string) => {
        const finalQuery = query || inputText;
        if (!pdfContent) return Alert.alert("Upload PDF first");
        if (mode === 'CHAT' && !finalQuery) return;

        setLoading(true);
        setInputText('');

        if (mode === 'CHAT') {
            setChat(prev => [...prev, { role: 'user', text: finalQuery }]);
        }

        try {
            const response = await axios.post('/api/study/analyze', {
                pdfText: pdfContent,
                question: finalQuery,
                mode,
                history
            });
            const data = response.data;

            if (mode === 'QUESTIONS') {
                const html = `
                    <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 40px; line-height: 1.6; color: #12100E; }
                        h1 { color: #F97316; border-bottom: 2px solid #EDE8E0; padding-bottom: 10px; }
                        .question { font-weight: bold; color: #DB2777; margin-top: 20px; }
                    </style>
                    <body>
                        <h1>Fync Exam Prep Guide</h1>
                        ${data.answer.replace(/\n/g, '<br>')}
                    </body>
                `;
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri);
            } else {
                setChat(prev => [...prev, { role: 'bot', text: data.answer }]);
                setHistory(prev => [...prev, ...data.history]);
            }
        } catch (e) {
            Alert.alert("Error", "AI Assistant is busy. Try again.");
        } finally {
            setLoading(false);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior="padding"
                    className="flex-1 px-gutter"
                >
                    {/* --- CUSTOM HEADER --- */}
                    <View className="flex-row items-center justify-between py-6">
                        <View>
                            <Text className="text-ink text-3xl font-display uppercase">
                                Study <Text className="text-accent-text">AI</Text>
                            </Text>
                            <View className="flex-row items-center mt-1">
                                <View className={`w-2 h-2 rounded-full mr-2 ${pdfContent ? 'bg-success' : 'bg-paper-2'}`} />
                                <Text className="text-ink-3 text-label font-display uppercase">
                                    {pdfContent ? 'Intelligence Active' : 'Waiting for Source'}
                                </Text>
                            </View>
                        </View>
                        {pdfContent && (
                            <TouchableOpacity
                                onPress={() => { setPdfContent(''); setChat([]); }}
                                className="bg-card p-3 rounded-card border border-line shadow-hair"
                            >
                                <Ionicons name="trash-outline" size={20} color="#ff4b4b" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* --- CONTENT AREA --- */}
                    {!pdfContent ? (
                        <View className="flex-1 justify-center items-center">
                            <TouchableOpacity
                                onPress={handleUpload}
                                activeOpacity={0.9}
                                className="w-full"
                            >
                                <StampCard radius={26}>
                                <View className="p-card-pad items-center" style={{ paddingVertical: 32 }}>
                                    <View className="bg-paper-2 p-card-pad rounded-sheet mb-8 border border-line">
                                        <Ionicons name="cloud-upload" size={48} color="#F97316" />
                                    </View>
                                    <Text className="text-ink text-2xl font-display uppercase text-center leading-tight">Sync <Text className="text-accent-text">Source</Text></Text>
                                    <Text className="font-sans text-sm text-ink-2 text-center mt-4 px-6">
                                        Upload your lecture PDF to activate institutional AI analysis.
                                    </Text>
                                    <View className="mt-10 bg-ink px-gutter py-3.5 rounded-card shadow-hair">
                                        <Text className="font-display text-paper uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Initialize Ledger</Text>
                                    </View>
                                </View>
                                </StampCard>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="flex-1">
                            {/* Quick Action Pills */}
                            <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-4">
                                    {['Summarize', 'Key Formulas', 'Practice Quiz', 'Simplify'].map((item) => (
                                        <TouchableOpacity
                                            key={item}
                                            onPress={() => runAiTask('CHAT', item)}
                                            className="bg-card border border-line mr-3 px-2.5 py-1 rounded-full"
                                        >
                                            <Text className="text-ink font-display text-label uppercase">{item}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>

                                <TouchableOpacity
                                    onPress={() => runAiTask('QUESTIONS')}
                                    activeOpacity={0.8}
                                    className="mt-2 overflow-hidden rounded-card shadow-hair"
                                >
                                    <View
                                        className="p-6 flex-row items-center justify-between"
                                     style={{ backgroundColor: '#F97316' }}>
                                        <View className="flex-row items-center">
                                            <Ionicons name="flash" size={18} color="#12100E" />
                                            <Text className="text-ink font-display ml-4 text-label uppercase">Generate Protocol Guide</Text>
                                        </View>
                                        <Ionicons name="arrow-forward" size={18} color="white" />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Chat Interface */}
                            <ScrollView
                                ref={scrollViewRef}
                                className="flex-1 mt-8"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 40 }}
                            >
                                {chat.map((msg, i) => (
                                    <View
                                        key={i}
                                        className={`p-6 rounded-sheet mb-5 max-w-[90%] shadow-hair ${msg.role === 'user' ? 'bg-ink self-end rounded-tr-none ' : 'bg-card self-start border border-line rounded-tl-none ' }`}
                                    >
                                        <Text className={`text-sm leading-6 ${msg.role === 'user' ? 'text-white font-display uppercase ' : 'text-ink-2 font-medium '}`}>
                                            {msg.role === 'bot' ? `"${msg.text}"` : msg.text}
                                        </Text>
                                    </View>
                                ))}
                                {loading && (
                                    <View className="flex-row items-center p-5 bg-card rounded-card border border-line self-start shadow-hair">
                                        <ActivityIndicator color="#F97316" size="small" />
                                        <Text className="text-ink-3 text-label font-display uppercase ml-4">Analyzing Intel...</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- INPUT DOCK --- */}
                    {pdfContent && (
                        <View className="flex-row items-center bg-card p-2.5 border-2 border-ink mb-10 shadow-hair rounded-md">
                            <TextInput
                                placeholder="Query the intelligence..."
                                placeholderTextColor="#C4BEB6"
                                value={inputText}
                                onChangeText={setInputText}
                                className="font-semibold text-base text-ink flex-1 px-6"
                                multiline={false}
                            />
                            <TouchableOpacity
                                onPress={() => runAiTask('CHAT')}
                                className="bg-ink w-14 h-14 rounded-card items-center justify-center shadow-hair"
                            >
                                <Ionicons name="send" size={18} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
