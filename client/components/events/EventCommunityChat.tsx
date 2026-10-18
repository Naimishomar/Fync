import React, { useState, useEffect, useRef, useCallback } from 'react';
import {View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Dimensions} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import socket from '../../utils/socket';
import { goBack, navigate } from '../../utils/navigation';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

const { width } = Dimensions.get('window');

interface Message {
    _id: string;
    sender: {
        _id: string;
        name: string;
        avatar?: string;
        email: string;
        username?: string;
    };
    text: string;
    image?: string;
    createdAt: string;
    replyTo?: {
        _id: string;
        text: string;
        sender: {
            _id: string;
            name: string;
            username?: string;
        };
    };
}

export default function EventCommunityChat({ route }: any) {
    const { eventId, eventName, type } = route?.params ?? {};
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const flatListRef = useRef<FlatList>(null);

    const fetchMessages = async () => {
        try {
            const endpoint = type === 'Bootcamp' ? `/bootcamp/community/${type}/${eventId}` : `/speakers/community/${type}/${eventId}`;
            const res = await axios.get(endpoint);
            if (res.data.success) {
                setMessages(res.data.messages ?? []);
            }
        } catch (error: any) {
            console.error("Chat fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEventDetails = async () => {
        try {
            const endpoint = type === 'Bootcamp' ? `/bootcamp/${eventId}` : `/speakers/${eventId}`;
            const res = await axios.get(endpoint);
            if (res.data.success) {
                const event = res.data.session;
                const isOrg = type === 'Bootcamp'
                    ? (event.admin_email === user?.email || event.secondaryAdmins?.some((a: any) => (a.email || a) === user?.email))
                    : (event.admin_email?._id === user?._id || event.admin_email === user?._id || event.secondaryAdmins?.some((a: any) => (a._id || a) === user?._id));
                setIsAdmin(!!isOrg);
            }
        } catch (e) {
            console.log("Admin check error:", e);
        }
    };

    useEffect(() => {
        fetchMessages();
        fetchEventDetails();

        // --- SOCKET JOIN ---
        socket.emit("join_community_room", { eventId });

        const onNewMessage = (newMessage: Message) => {
            setMessages(prev => {
                // Prevent duplicate messages if the sender just added it locally
                if (prev.some(m => m._id === newMessage._id)) return prev;
                return [...prev, newMessage];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        };
        const onDeleted = ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.filter(m => m._id !== messageId));
        };
        socket.on('new_event_message', onNewMessage);
        socket.on('event_message_deleted', onDeleted);

        return () => {
            socket.emit("leave_community_room", { eventId });
            // Only our handlers — a bare off(event) strips every screen's listener.
            socket.off('new_event_message', onNewMessage);
            socket.off('event_message_deleted', onDeleted);
        };
    }, [eventId]);

    const handleSend = async (imageUri?: string) => {
        if ((!inputText.trim() && !imageUri) || sending) return;
        setSending(true);
        try {
            const formData = new FormData();
            formData.append('eventId', eventId);
            formData.append('type', type);
            formData.append('text', inputText || ' ');
            if (replyingTo) {
                formData.append('replyTo', replyingTo._id);
            }
            if (imageUri) {
                formData.append('image', {
                    uri: imageUri,
                    name: 'chat_img.jpg',
                    type: 'image/jpeg'
                } as any);
            }

            const endpoint = type === 'Bootcamp' ? '/bootcamp/community/send' : '/speakers/community/send';
            const res = await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                setMessages(prev => {
                    if (prev.some(m => m._id === res.data.message._id)) return prev;
                    return [...prev, res.data.message];
                });
                setInputText('');
                setReplyingTo(null);
                setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Failed to send message");
        } finally {
            setSending(false);
        }
    };

    const handleDeleteMessage = (messageId: string) => {
        Alert.alert("Delete Message", "Are you sure you want to delete this message?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        const endpoint = type === 'Bootcamp' ? `/bootcamp/community/message/${messageId}` : `/speakers/community/message/${messageId}`;
                        const res = await axios.delete(endpoint);
                        if (res.data.success) {
                            setMessages(prev => prev.filter(m => m._id !== messageId));
                        }
                    } catch (e: any) {
                        Alert.alert("Error", e.response?.data?.message || "Failed to delete");
                    }
                }
            }
        ]);
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.6,
            });
            if (!result.canceled && result.assets?.[0]) {
                handleSend(result.assets[0].uri);
            }
        } catch {
            Alert.alert("Error", "Could not open your photos");
        }
    };

    const formatDateHeader = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

        return date.toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'long',
            year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
    };

    const renderMessage = useCallback(({ item, index }: { item: Message, index: number }) => {
        const isMine = item.sender?._id === user?._id;

        // Date separator logic
        const showDateSeparator = index === 0 ||
            new Date(messages[index - 1].createdAt).toDateString() !== new Date(item.createdAt).toDateString();

        return (
            <View>
                {showDateSeparator && (
                    <View className="items-center my-6">
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 text-label font-display uppercase">
                                {formatDateHeader(item.createdAt)}
                            </Text>
                        </View>
                    </View>
                )}

                <TouchableOpacity
                    onLongPress={() => {
                        const options: any[] = [
                            { text: "Reply", onPress: () => setReplyingTo(item) },
                            { text: "Cancel", style: "cancel" }
                        ];
                        // Admin can delete anyone's message
                        if (isMine || isAdmin) {
                            options.splice(1, 0, { text: "Delete", style: "destructive", onPress: () => handleDeleteMessage(item._id) });
                        }
                        Alert.alert("Message Options", "What would you like to do?", options);
                    }}
                    delayLongPress={500}
                    className={`flex-row mb-4 ${isMine ? 'justify-end' : 'justify-start'} items-end px-4`}
                >
                    {!isMine && (
                        <Image
                            source={{ uri: item.sender?.avatar }}
                            style={{ width: 32, height: 32, borderRadius: 12, marginRight: 8, marginBottom: 4, backgroundColor: C.paper2 }}
                            cachePolicy="memory-disk"
                        />
                    )}
                    <View
                        className={`max-w-[75%] shadow-hair ${isMine ? 'bg-recruiter rounded-card rounded-br-none' : 'bg-card rounded-card rounded-bl-none'} overflow-hidden`}
                        style={{ elevation: 2 }}
                    >
                        {/* Reply Preview inside Bubble */}
                        {item.replyTo && (
                            <View className={`m-2 p-2 rounded-xl border-l-4 ${isMine ? 'bg-black/10 border-recruiter/40' : 'bg-paper-2 border-recruiter'}`}>
                                <Text className={`text-label font-display uppercase ${isMine ? 'text-white' : 'text-recruiter'}`}>
                                    {item.replyTo.sender?.name || "User"}
                                </Text>
                                <Text className={`text-label ${isMine ? 'text-white/80' : 'text-ink-3'}`} numberOfLines={1}>
                                    {item.replyTo.text}
                                </Text>
                            </View>
                        )}

                        {item.image && (
                            <Image
                                source={{ uri: item.image }}
                                style={{ width: 256, height: 192 }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                        )}

                        <View className="p-3 px-4">
                            {!isMine && (
                                <Text className="text-label font-display uppercase text-recruiter mb-1">
                                    {item.sender?.name}
                                </Text>
                            )}
                            {item.text && item.text.trim() !== '' && (
                                <Text className={`text-xs font-semibold leading-5 ${isMine ? 'text-white' : 'text-ink'}`}>
                                    {item.text}
                                </Text>
                            )}
                            <View className="flex-row items-center justify-end mt-1 gap-1">
                                <Text className={`text-label font-semibold ${isMine ? 'text-white/70' : 'text-ink-3'}`}>
                                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                {isMine && <Ionicons name="checkmark-done" size={10} color="rgba(255,255,255,0.7)" />}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }, [messages, user, isAdmin]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title={eventName} onBack={() => goBack()} />

                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={C.recruiter} />
                        <Text className="mt-4 text-ink-3 text-label font-semibold uppercase">Encrypting Chat...</Text>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={m => m._id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    />
                )}

                <KeyboardAvoidingView behavior="padding">
                    {/* Input Area */}
                    <View className="p-4 bg-card border-t border-line">
                        {/* Reply Indicator Preview */}
                        {replyingTo && (
                            <View className="px-5 py-3 bg-card border-t border-recruiter/15 flex-row items-center justify-between mb-4 rounded-card">
                                <View className="border-l-4 border-recruiter pl-4">
                                    <Text className="text-recruiter text-label font-display uppercase">
                                        Replying to {replyingTo.sender?.name}
                                    </Text>
                                    <Text className="text-ink-3 text-label mt-0.5" numberOfLines={1}>
                                        {replyingTo.text}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={12}>
                                    <Ionicons name="close-circle" size={22} color={C.recruiter} />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View className="flex-row items-center bg-paper-2 rounded-card px-2 py-2 border border-fam-career/10">
                            <TouchableOpacity
                                onPress={pickImage}
                                className="w-10 h-10 items-center justify-center"
                             hitSlop={2}>
                                <Ionicons name="image" size={22} color={C.recruiter} />
                            </TouchableOpacity>
                            <TextInput
                                placeholder="Type a message..."
                                value={inputText}
                                onChangeText={setInputText}
                                className="flex-1 h-10 text-ink font-semibold px-2 text-xs"
                                placeholderTextColor={C.ink3}
                            />
                            <TouchableOpacity
                                onPress={() => handleSend()}
                                disabled={sending || (!inputText.trim())}
                                className={`w-10 h-10 rounded-full items-center justify-center ${inputText.trim() ? 'bg-recruiter shadow-hair ' : 'bg-paper-2'}`}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Ionicons name="send" size={18} color={inputText.trim() ? 'white' : C.ink4} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
