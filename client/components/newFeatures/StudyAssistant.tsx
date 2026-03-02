import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from '../../context/axiosConfig'; 
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function StudyAssistant() {
    const [pdfContent, setPdfContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [chat, setChat] = useState<{role: string, text: string}[]>([]);
    const [inputText, setInputText] = useState('');
    const [history, setHistory] = useState<{role: string, parts: {text: string}[]}[]>([]);
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
                setChat([{ role: 'bot', text: "PDF memorized! 🧠 I've indexed your notes. Ask me for a summary, key formulas, or a practice quiz!" }]);
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
                        body { font-family: 'Helvetica', sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
                        h1 { color: #ec4899; border-bottom: 2px solid #fce7f3; padding-bottom: 10px; }
                        .question { font-weight: bold; color: #be185d; margin-top: 20px; }
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
        <View className="flex-1 bg-[#020202]">
            {/* Ambient Background Glow */}
            <View className="absolute top-[-100] left-[-100] w-[300] h-[300] bg-pink-600/10 rounded-full blur-3xl" />
            
            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    className="flex-1 px-5"
                >
                    {/* --- CUSTOM HEADER --- */}
                    <View className="flex-row items-center justify-between py-4">
                        <View>
                            <Text className="text-white text-2xl font-black tracking-tighter uppercase italic">
                                Study <Text className="text-pink-500">AI</Text>
                            </Text>
                            <View className="flex-row items-center mt-1">
                                <View className={`w-1.5 h-1.5 rounded-full mr-2 ${pdfContent ? 'bg-green-500' : 'bg-white/20'}`} />
                                <Text className="text-white/40 text-[9px] font-bold uppercase tracking-[2px]">
                                    {pdfContent ? 'Intelligence Active' : 'Waiting for Source'}
                                </Text>
                            </View>
                        </View>
                        {pdfContent && (
                             <TouchableOpacity 
                                onPress={() => { setPdfContent(''); setChat([]); }} 
                                className="bg-white/5 p-2.5 rounded-2xl border border-white/10"
                             >
                                <Ionicons name="trash-outline" size={18} color="#ff4b4b" />
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
                                <LinearGradient
                                    colors={['#1a1a1a', '#080808']}
                                    className="border border-white/10 rounded-[40px] p-10 items-center overflow-hidden"
                                >
                                    <View className="bg-pink-500/10 p-6 rounded-full border border-pink-500/20 mb-6">
                                        <Ionicons name="cloud-upload" size={42} color="#ec4899" />
                                    </View>
                                    <Text className="text-white text-xl font-bold text-center">Upload Study Source</Text>
                                    <Text className="text-white/40 text-center text-xs mt-3 leading-5 px-4">
                                        Upload a PDF to sync the AI with your course material.
                                    </Text>
                                    <View className="mt-8 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                                        <Text className="text-pink-500 text-[10px] font-black uppercase">Supports up to 15MB</Text>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="flex-1">
                            {/* Quick Action Pills */}
                            <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-2">
                                    {['Summarize', 'Key Formulas', 'Practice Quiz', 'Simplify'].map((item) => (
                                        <TouchableOpacity 
                                            key={item}
                                            onPress={() => runAiTask('CHAT', item)}
                                            className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl mr-2"
                                        >
                                            <Text className="text-white/70 text-[10px] font-bold uppercase tracking-tight">{item}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                
                                <TouchableOpacity 
                                    onPress={() => runAiTask('QUESTIONS')}
                                    activeOpacity={0.8}
                                    className="mt-2 overflow-hidden rounded-2xl"
                                >
                                    <LinearGradient
                                        colors={['#ec4899', '#8b5cf6']}
                                        start={{x:0, y:0}} end={{x:1, y:1}}
                                        className="p-4 flex-row items-center justify-between"
                                    >
                                        <View className="flex-row items-center">
                                            <Ionicons name="flash" size={16} color="white" />
                                            <Text className="text-white font-black ml-3 text-[10px] uppercase">Generate Master Guide PDF</Text>
                                        </View>
                                        <Ionicons name="arrow-forward" size={16} color="white" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* Chat Interface */}
                            <ScrollView 
                                ref={scrollViewRef}
                                className="flex-1 mt-4" 
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                            >
                                {chat.map((msg, i) => (
                                    <View 
                                        key={i} 
                                        className={`p-4 rounded-2xl mb-3 max-w-[90%] ${
                                            msg.role === 'user' 
                                            ? 'bg-pink-600 self-end rounded-tr-none' 
                                            : 'bg-white/5 self-start border border-white/10 rounded-tl-none'
                                        }`}
                                    >
                                        <Text className={`text-[13px] leading-5 ${msg.role === 'user' ? 'text-white font-medium' : 'text-white/80'}`}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                ))}
                                {loading && (
                                    <View className="flex-row items-center p-4 bg-white/5 rounded-2xl border border-white/10 self-start">
                                        <ActivityIndicator color="#ec4899" size="small" />
                                        <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest ml-3">Fync AI is reading...</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- INPUT DOCK --- */}
                    {pdfContent && (
                        <View className="flex-row items-center bg-white/5 p-1.5 rounded-2xl border border-white/10 mb-4 shadow-2xl">
                            <TextInput 
                                placeholder="Type a message..."
                                placeholderTextColor="rgba(255,255,255,0.2)"
                                value={inputText}
                                onChangeText={setInputText}
                                className="flex-1 text-white px-4 text-sm font-medium"
                                multiline={false}
                            />
                            <TouchableOpacity 
                                onPress={() => runAiTask('CHAT')}
                                className="bg-pink-600 w-11 h-11 rounded-xl items-center justify-center shadow-lg"
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