import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';

import { useNavigation } from '@react-navigation/native';
import { AppBar, Button, Card, Chip, ChipRow, Empty, FormField, IconBtn } from '../ui/kit';
import { C } from '../../constants/colors';
const QUICK = ['Summarize', 'Key formulas', 'Practice quiz', 'Simplify'];

export default function StudyAssistant() {
    const [pdfContent, setPdfContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [chat, setChat] = useState<{ role: string, text: string }[]>([]);
    const [inputText, setInputText] = useState('');
    const [history, setHistory] = useState<{ role: string, parts: { text: string }[] }[]>([]);
    const scrollViewRef = useRef<ScrollView>(null);
    const navigation = useNavigation<any>();

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
                setHistory([]);
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
        if (loading) return;

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
                        ${String(data.answer || '').replace(/\n/g, '<br>')}
                    </body>
                `;
                const { uri } = await Print.printToFileAsync({ html });
                await Sharing.shareAsync(uri);
            } else {
                setChat(prev => [...prev, { role: 'bot', text: data.answer }]);
                setHistory(prev => [...prev, ...(data.history || [])]);
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
            <StatusBar barStyle={C.barStyle} />

            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar
                    title="Study AI"
                    onBack={() => navigation.goBack()}
                    right={pdfContent ? (
                        <IconBtn
                            name="trash-outline"
                            color={C.danger}
                            accessibilityLabel="Remove PDF"
                            onPress={() => { setPdfContent(''); setChat([]); setHistory([]); }}
                        />
                    ) : undefined}
                />
                <KeyboardAvoidingView behavior="padding" className="flex-1 px-gutter">
                    <View className="flex-row items-center pb-4">
                        <View className={`w-2 h-2 rounded-full mr-2 ${pdfContent ? 'bg-success' : 'bg-ink-4'}`} />
                        <Text className="text-ink-3 text-xs font-semibold">
                            {pdfContent ? 'Notes loaded' : 'No notes yet'}
                        </Text>
                    </View>

                    {!pdfContent ? (
                        <View className="flex-1 justify-center">
                            <Card padded style={{ paddingVertical: 32 }}>
                                <Empty
                                    icon="cloud-upload-outline"
                                    title="Upload your notes"
                                    hint="Upload a lecture PDF and ask for summaries, formulas or a practice quiz."
                                    action={<Button title="Upload PDF" icon="document-attach-outline" variant="primary" loading={loading} onPress={handleUpload} />}
                                />
                            </Card>
                        </View>
                    ) : (
                        <View className="flex-1">
                            <ChipRow style={{ marginHorizontal: -20 }}>
                                {QUICK.map((item) => (
                                    <Chip key={item} label={item} onPress={() => runAiTask('CHAT', item)} />
                                ))}
                            </ChipRow>

                            <Button
                                title="Generate exam prep guide"
                                icon="flash"
                                variant="primary"
                                block
                                style={{ marginTop: 12 }}
                                onPress={() => runAiTask('QUESTIONS')}
                            />

                            <ScrollView keyboardShouldPersistTaps="handled"
                                ref={scrollViewRef}
                                className="flex-1 mt-4"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 24 }}
                            >
                                {chat.map((msg, i) => (
                                    <View
                                        key={i}
                                        className={`px-4 py-3 rounded-2xl mb-3 max-w-[90%] ${msg.role === 'user' ? 'bg-ink self-end rounded-tr-sm' : 'bg-card self-start border border-line rounded-tl-sm'}`}
                                    >
                                        <Text className={`text-base leading-6 font-sans ${msg.role === 'user' ? 'text-paper' : 'text-ink-2'}`}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                ))}
                                {loading ? (
                                    <View className="flex-row items-center px-4 py-3 bg-card rounded-2xl border border-line self-start">
                                        <ActivityIndicator color={C.brand[500]} size="small" />
                                        <Text className="text-ink-3 text-sm font-sans ml-3">Thinking...</Text>
                                    </View>
                                ) : null}
                            </ScrollView>
                        </View>
                    )}

                    {pdfContent ? (
                        <View className="flex-row items-center mb-4" style={{ gap: 8 }}>
                            <FormField
                                containerStyle={{ flex: 1 }}
                                accessibilityLabel="Ask about your notes"
                                placeholder="Ask about your notes"
                                value={inputText}
                                onChangeText={setInputText}
                                returnKeyType="send"
                                onSubmitEditing={() => runAiTask('CHAT')}
                            />
                            <Pressable
                                onPress={() => runAiTask('CHAT')}
                                accessibilityRole="button"
                                accessibilityLabel="Send"
                                className="bg-brand-500 w-12 h-12 rounded-full items-center justify-center active:opacity-85"
                            >
                                <Ionicons name="send" size={18} color={C.onBrand} />
                            </Pressable>
                        </View>
                    ) : null}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
