import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToolCard, SectionTitle } from './Common';

export const APIPlaygroundTool = React.memo(() => {
    const [url, setUrl] = useState('/posts');
    const [method, setMethod] = useState('GET');
    const [body, setBody] = useState('{\n  "title": "foo",\n  "body": "bar"\n}');
    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [activeView, setActiveView] = useState<'request' | 'history' | 'docs'>('request');
    const [responseTime, setResponseTime] = useState(0);

    const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${BACKEND_URL}/playground/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setHistory(data.history);
        } catch (e) {
            console.log("History fetch error", e);
        }
    };

    const runRequest = async () => {
        setLoading(true);
        const startTime = Date.now();
        try {
            const token = await AsyncStorage.getItem('token');
            const isLocal = url.trim().startsWith('/playground');

            let parsedBody = null;
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                try {
                    if (body.trim()) parsedBody = JSON.parse(body);
                } catch (e) {
                    Alert.alert("Invalid JSON", "Please fix your request body.");
                    setLoading(false);
                    return;
                }
            }

            let fetchOptions: any = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            };

            let targetUrl = '';

            if (isLocal) {
                targetUrl = `${BACKEND_URL}${url}`;
                fetchOptions.method = method;
                if (['POST', 'PUT', 'PATCH'].includes(method)) {
                    fetchOptions.body = JSON.stringify(parsedBody);
                }
            } else {
                targetUrl = `${BACKEND_URL}/playground/execute`;
                fetchOptions.method = 'POST';
                fetchOptions.body = JSON.stringify({
                    method,
                    endpoint: url,
                    body: parsedBody
                });
            }

            const res = await fetch(targetUrl, fetchOptions);
            const data = await res.json();

            setResponse({
                status: res.status,
                data: isLocal ? data : (data.data || data)
            });

            setResponseTime(Date.now() - startTime);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchHistory();
        } catch (e: any) {
            setResponse({ status: 500, data: { error: e.message } });
        } finally {
            setLoading(false);
        }
    };

    const DocItem = ({ step, title, desc }: any) => (
        <View className="flex-row items-center mb-4">
            <View className="w-6 h-6 rounded-full bg-orange-600 items-center justify-center mr-3">
                <Text className="text-white font-black text-[10px]">{step}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-gray-200 font-bold text-[10px]">{title}</Text>
                <Text className="text-gray-500 text-[9px]">{desc}</Text>
            </View>
        </View>
    );

    const renderRequest = () => (
        <View>
            <Text className="text-gray-500 text-[10px] font-black uppercase mb-2 ml-1">Endpoint (JSONPlaceholder Style)</Text>
            <TextInput
                value={url}
                onChangeText={setUrl}
                placeholder="/posts or https://..."
                placeholderTextColor="#444"
                className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5 font-mono text-xs"
            />

            <View className="flex-row gap-2 mb-4">
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                    <TouchableOpacity
                        key={m}
                        onPress={() => setMethod(m)}
                        className={`flex-1 py-2.5 rounded-xl border border-white/5 bg-gray-900 items-center ${method === m ? 'bg-orange-600 border-orange-400/50' : ''}`}
                    >
                        <Text className={`text-[9px] font-black ${method === m ? 'text-white' : 'text-gray-500'}`}>{m}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {['POST', 'PUT', 'PATCH'].includes(method) && (
                <View className="mb-4">
                    <Text className="text-gray-500 text-[10px] font-black uppercase mb-2 ml-1">Request Body (JSON)</Text>
                    <TextInput
                        value={body}
                        onChangeText={setBody}
                        multiline
                        numberOfLines={4}
                        placeholder="{}"
                        placeholderTextColor="#444"
                        className="bg-black p-4 rounded-xl text-orange-400 mb-4 border border-white/5 font-mono text-[10px] h-32"
                    />
                </View>
            )}

            <TouchableOpacity
                onPress={runRequest}
                disabled={loading}
                className="bg-orange-600 py-4 rounded-xl items-center shadow-lg shadow-orange-500/20"
            >
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">
                    {loading ? 'Executing...' : 'Send Request'}
                </Text>
            </TouchableOpacity>

            {response && (
                <View className="mt-6 bg-black/50 rounded-2xl border border-white/5 overflow-hidden">
                    <View className="bg-gray-900 p-3 flex-row justify-between items-center border-b border-white/5">
                        <Text className="text-gray-500 text-[10px] font-black uppercase">Response ({response.status})</Text>
                        <Text className="text-orange-500 text-[10px] font-black">{responseTime}ms</Text>
                    </View>
                    <ScrollView className="p-4 max-h-[300px]">
                        <Text className="text-orange-300 font-mono text-[10px]">
                            {JSON.stringify(response.data, null, 2)}
                        </Text>
                    </ScrollView>
                    <TouchableOpacity
                        onPress={() => {
                            Clipboard.setStringAsync(JSON.stringify(response.data, null, 2));
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        className="p-3 items-center border-t border-white/5"
                    >
                        <Text className="text-gray-500 text-[9px] font-bold uppercase">Copy Response</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );

    const renderHistory = () => (
        <ScrollView className="max-h-[500px]">
            {history.length > 0 ? history.map((item, idx) => (
                <View key={idx} className="bg-gray-900/50 p-4 rounded-2xl mb-3 border border-white/5">
                    <View className="flex-row justify-between items-center mb-2">
                        <View className="flex-row items-center">
                            <View className={`px-2 py-1 rounded-lg mr-2 ${item.method === 'GET' ? 'bg-blue-500/10' :
                                item.method === 'POST' ? 'bg-green-500/10' : 'bg-red-500/10'
                                }`}>
                                <Text className={`text-[8px] font-black ${item.method === 'GET' ? 'text-blue-500' :
                                    item.method === 'POST' ? 'text-green-500' : 'text-red-500'
                                    }`}>{item.method}</Text>
                            </View>
                            <Text className="text-white text-[10px] font-bold" numberOfLines={1}>{item.endpoint.replace('https://jsonplaceholder.typicode.com', '')}</Text>
                        </View>
                        <Text className="text-gray-500 text-[8px] font-black">{new Date(item.timestamp).toLocaleTimeString()}</Text>
                    </View>
                    <Text className="text-gray-500 text-[8px] leading-3" numberOfLines={2}>
                        Status: {item.responseStatus} • User: {item.username}
                    </Text>
                </View>
            )) : (
                <View className="items-center py-20 opacity-20">
                    <Ionicons name="time-outline" size={48} color="white" />
                    <Text className="text-white text-[10px] font-black mt-4 uppercase">No Request History</Text>
                </View>
            )}
        </ScrollView>
    );

    const renderDocs = () => (
        <View className="p-2">
            <Text className="text-white font-black text-xs mb-3">How to use API Playground?</Text>
            <View className="flex flex-col gap-4">
                <DocItem step="1" title="Your Private Server" desc="This is your personal mock API server. All data you create is stored privately under your account." />
                <DocItem step="2" title="Endpoint Structure" desc="Use the prefix /playground/:resource (e.g., /playground/posts) for your custom resources. You can also use full URLs for external APIs." />
                <DocItem step="3" title="Persistent CRUD" desc="Perform GET, POST, PUT, PATCH, DELETE operations on your resources. Data persists across sessions." />
                <DocItem step="4" title="JSON-Server Style Queries" desc="Leverage powerful query parameters for filtering, searching, sorting, and pagination." />
            </View>

            <View className="mt-6 bg-orange-600/10 p-4 rounded-2xl border border-orange-500/20">
                <Text className="text-orange-500 text-[10px] font-black uppercase mb-2">Query Examples</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Filtering:</Text> /playground/posts?userId=1</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Searching:</Text> /playground/posts?q=title</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Sorting:</Text> /playground/posts?_sort=title&_order=asc</Text>
                <Text className="text-gray-400 text-[9px] mb-1">• <Text className="font-bold">Pagination:</Text> /playground/posts?_page=1&_limit=10</Text>
                <Text className="text-gray-400 text-[9px] mt-2">• <Text className="font-bold">Full URL Example:</Text> https://jsonplaceholder.typicode.com/posts</Text>
            </View>
        </View>
    );

    return (
        <ToolCard>
            <SectionTitle text="API Playground" subText="Zero-cost mock testing with user logging." />

            <View className="flex-row bg-black p-1 rounded-2xl mb-6 border border-white/5">
                {[
                    { id: 'request', label: 'Builder', icon: 'send' },
                    { id: 'history', label: 'History', icon: 'time' },
                    { id: 'docs', label: 'Docs', icon: 'help-circle' }
                ].map(view => (
                    <TouchableOpacity
                        key={view.id}
                        onPress={() => {
                            setActiveView(view.id as any);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${activeView === view.id ? 'bg-orange-600' : ''}`}
                    >
                        <Ionicons name={`${view.icon}-outline` as any} size={14} color={activeView === view.id ? 'white' : '#666'} />
                        <Text className={`ml-2 text-[10px] font-black uppercase ${activeView === view.id ? 'text-white' : 'text-gray-500'}`}>{view.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {activeView === 'request' && renderRequest()}
            {activeView === 'history' && renderHistory()}
            {activeView === 'docs' && renderDocs()}
        </ToolCard>
    );
});
