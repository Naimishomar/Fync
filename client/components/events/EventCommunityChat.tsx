import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
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
import { AppBar, IconBtn } from '../ui/kit';

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

const MessageRow = memo(function MessageRow({ item, isMine, canDelete, showDate, onReply, onDelete }: {
    item: Message; isMine: boolean; canDelete: boolean; showDate: boolean;
    onReply: (m: Message) => void; onDelete: (id: string) => void;
}) {
    return (
        <View>
            {showDate && (
                <View className="items-center my-4">
                    <View className="bg-paper-2 px-3 py-1 rounded-full">
                        <Text className="text-ink-3 text-xs font-semibold">{formatDateHeader(item.createdAt)}</Text>
                    </View>
                </View>
            )}

            <Pressable
                onLongPress={() => {
                    const options: any[] = [
                        { text: "Reply", onPress: () => onReply(item) },
                        { text: "Cancel", style: "cancel" }
                    ];
                    // Admin can delete anyone's message
                    if (canDelete) {
                        options.splice(1, 0, { text: "Delete", style: "destructive", onPress: () => onDelete(item._id) });
                    }
                    Alert.alert("Message options", "What would you like to do?", options);
                }}
                delayLongPress={500}
                accessibilityHint="Long press for options"
                className={`flex-row mb-3 ${isMine ? 'justify-end' : 'justify-start'} items-end px-4 active:opacity-70`}
            >
                {!isMine && (
                    <Image
                        source={{ uri: item.sender?.avatar }}
                        style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8, marginBottom: 4, backgroundColor: C.paper2 }}
                        cachePolicy="memory-disk"
                    />
                )}
                <View className={`max-w-[75%] overflow-hidden rounded-2xl ${isMine ? 'bg-recruiter rounded-br-md' : 'bg-card border border-line rounded-bl-md'}`}>
                    {item.replyTo && (
                        <View className={`m-2 p-2 rounded-xl border-l-4 ${isMine ? 'bg-black/10 border-paper/40' : 'bg-paper-2 border-recruiter'}`}>
                            <Text className={`text-xs font-semibold ${isMine ? 'text-paper' : 'text-recruiter'}`}>
                                {item.replyTo.sender?.name || "User"}
                            </Text>
                            <Text className={`text-xs ${isMine ? 'text-paper/80' : 'text-ink-3'}`} numberOfLines={1}>
                                {item.replyTo.text}
                            </Text>
                        </View>
                    )}

                    {item.image && (
                        <Image source={{ uri: item.image }} style={{ width: 256, height: 192 }} contentFit="cover" cachePolicy="memory-disk" />
                    )}

                    <View className="px-3 py-2">
                        {!isMine && (
                            <Text className="text-xs font-semibold text-recruiter mb-0.5">{item.sender?.name}</Text>
                        )}
                        {item.text && item.text.trim() !== '' ? (
                            <Text className={`text-base font-sans ${isMine ? 'text-paper' : 'text-ink'}`}>{item.text}</Text>
                        ) : null}
                        <View className="flex-row items-center justify-end mt-0.5" style={{ gap: 4 }}>
                            <Text className={`text-xs font-sans ${isMine ? 'text-paper/70' : 'text-ink-3'}`}>
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            {isMine && <Ionicons name="checkmark-done" size={12} color={C.paper} style={{ opacity: 0.7 }} />}
                        </View>
                    </View>
                </View>
            </Pressable>
        </View>
    );
});

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


    const onReply = useCallback((m: Message) => setReplyingTo(m), []);
    const renderMessage = useCallback(({ item, index }: { item: Message, index: number }) => {
        const isMine = item.sender?._id === user?._id;
        const showDate = index === 0 ||
            new Date(messages[index - 1].createdAt).toDateString() !== new Date(item.createdAt).toDateString();
        return <MessageRow item={item} isMine={isMine} canDelete={isMine || isAdmin} showDate={showDate} onReply={onReply} onDelete={handleDeleteMessage} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages, user, isAdmin]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title={eventName} onBack={() => goBack()} />

                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color={C.recruiter} />
                        <Text className="mt-4 text-ink-3 text-sm font-sans">Loading chat…</Text>
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
                    <View className="px-4 pt-3 pb-3 bg-card border-t border-line">
                        {replyingTo && (
                            <View className="px-3 py-2 bg-paper-2 flex-row items-center justify-between mb-3 rounded-2xl">
                                <View className="border-l-4 border-recruiter pl-3 flex-1">
                                    <Text className="text-recruiter text-xs font-semibold">Replying to {replyingTo.sender?.name}</Text>
                                    <Text className="text-ink-3 text-xs mt-0.5" numberOfLines={1}>{replyingTo.text}</Text>
                                </View>
                                <IconBtn name="close-circle" color={C.ink3} size={20} onPress={() => setReplyingTo(null)} accessibilityLabel="Cancel reply" />
                            </View>
                        )}

                        <View className="flex-row items-center bg-paper-2 rounded-full pl-1 pr-1 min-h-[48px] border border-line">
                            <IconBtn name="image-outline" color={C.ink2} onPress={pickImage} accessibilityLabel="Send a photo" />
                            <TextInput
                                placeholder="Type a message"
                                value={inputText}
                                onChangeText={setInputText}
                                accessibilityLabel="Message"
                                className="flex-1 text-ink font-sans text-base px-1 py-2"
                                placeholderTextColor={C.ink3}
                            />
                            <Pressable
                                onPress={() => handleSend()}
                                disabled={sending || (!inputText.trim())}
                                accessibilityRole="button"
                                accessibilityLabel="Send message"
                                accessibilityState={{ disabled: sending || !inputText.trim(), busy: sending }}
                                className={`w-10 h-10 rounded-full items-center justify-center active:opacity-70 ${inputText.trim() ? 'bg-recruiter' : 'bg-paper-2'}`}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color={C.paper} />
                                ) : (
                                    <Ionicons name="send" size={18} color={inputText.trim() ? C.paper : C.ink3} />
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
