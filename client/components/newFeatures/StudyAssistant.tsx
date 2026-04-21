import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, KeyboardAvoidingView, Platform, Dimensions, StatusBar } from 'react-native';
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
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            
            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                    className="flex-1 px-8"
                >
                    {/* --- CUSTOM HEADER --- */}
                    <View className="flex-row items-center justify-between py-6">
                        <View>
                            <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase italic">
                                Study <Text className="text-pink-500">AI</Text>
                            </Text>
                            <View className="flex-row items-center mt-1">
                                <View className={`w-2 h-2 rounded-full mr-2 ${pdfContent ? 'bg-green-500' : 'bg-slate-200'}`} />
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">
                                    {pdfContent ? 'Intelligence Active' : 'Waiting for Source'}
                                </Text>
                            </View>
                        </View>
                        {pdfContent && (
                             <TouchableOpacity 
                                onPress={() => { setPdfContent(''); setChat([]); }} 
                                className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm shadow-black/5"
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
                                <View className="bg-white border border-slate-100 rounded-[48px] p-12 items-center shadow-2xl shadow-black/5">
                                    <View className="bg-pink-50 p-8 rounded-[32px] mb-8">
                                        <Ionicons name="cloud-upload" size={48} color="#ec4899" />
                                    </View>
                                    <Text className="text-zinc-900 text-2xl font-black italic uppercase tracking-tight text-center">Sync Source</Text>
                                    <Text className="text-slate-400 text-center font-bold text-[10px] mt-3 leading-5 px-6 uppercase tracking-widest">
                                        Upload your lecture PDF to activate institutional AI analysis.
                                    </Text>
                                    <View className="mt-8 bg-zinc-900 px-6 py-2.5 rounded-full shadow-lg shadow-black/20">
                                        <Text className="text-white text-[10px] font-black uppercase tracking-widest">Max 15MB Ledger</Text>
                                    </View>
                                </View>
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
                                            className="bg-white border border-slate-100 px-5 py-2.5 rounded-2xl mr-2 shadow-sm shadow-black/5"
                                        >
                                            <Text className="text-zinc-900 font-black italic text-[9px] uppercase tracking-widest">{item}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                
                                <TouchableOpacity 
                                    onPress={() => runAiTask('QUESTIONS')}
                                    activeOpacity={0.8}
                                    className="mt-3 overflow-hidden rounded-3xl shadow-lg shadow-pink-500/20"
                                >
                                    <LinearGradient
                                        colors={['#ec4899', '#f97316']}
                                        start={{x:0, y:0}} end={{x:1, y:1}}
                                        className="p-5 flex-row items-center justify-between"
                                    >
                                        <View className="flex-row items-center">
                                            <Ionicons name="flash" size={18} color="white" />
                                            <Text className="text-white font-black italic ml-4 text-xs uppercase tracking-widest">Generate Protocol Guide</Text>
                                        </View>
                                        <Ionicons name="arrow-forward" size={18} color="white" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* Chat Interface */}
                            <ScrollView 
                                ref={scrollViewRef}
                                className="flex-1 mt-6" 
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 40 }}
                            >
                                {chat.map((msg, i) => (
                                    <View 
                                        key={i} 
                                        className={`p-5 rounded-[28px] mb-4 max-w-[85%] shadow-sm ${
                                            msg.role === 'user' 
                                            ? 'bg-zinc-900 self-end rounded-tr-none shadow-black/20' 
                                            : 'bg-white self-start border border-slate-100 rounded-tl-none shadow-black/5'
                                        }`}
                                    >
                                        <Text className={`text-sm leading-6 ${msg.role === 'user' ? 'text-white font-medium italic' : 'text-zinc-600 font-medium'}`}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                ))}
                                {loading && (
                                    <View className="flex-row items-center p-5 bg-white rounded-2xl border border-slate-100 self-start shadow-sm shadow-black/5">
                                        <ActivityIndicator color="#ec4899" size="small" />
                                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest ml-4">AI Is Analyzing Ledger...</Text>
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- INPUT DOCK --- */}
                    {pdfContent && (
                        <View className="flex-row items-center bg-white p-2 rounded-[24px] border border-slate-100 mb-8 shadow-2xl shadow-black/5">
                            <TextInput 
                                placeholder="Query the intelligence..."
                                placeholderTextColor="#CBD5E1"
                                value={inputText}
                                onChangeText={setInputText}
                                className="flex-1 text-zinc-900 px-5 text-sm font-black italic uppercase"
                                multiline={false}
                            />
                            <TouchableOpacity 
                                onPress={() => runAiTask('CHAT')}
                                className="bg-zinc-900 w-12 h-12 rounded-2xl items-center justify-center shadow-lg"
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