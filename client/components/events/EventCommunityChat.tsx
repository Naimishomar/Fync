import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import socket from '../../utils/socket';
import { goBack, navigate } from '../../utils/navigation';

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
    const { eventId, eventName, type } = route.params;
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
                setMessages(res.data.messages);
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

        socket.on('new_event_message', (newMessage: Message) => {
            setMessages(prev => {
                // Prevent duplicate messages if the sender just added it locally
                if (prev.some(m => m._id === newMessage._id)) return prev;
                return [...prev, newMessage];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
        });

        socket.on('event_message_deleted', ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.filter(m => m._id !== messageId));
        });

        return () => {
            socket.emit("leave_community_room", { eventId });
            socket.off('new_event_message');
            socket.off('event_message_deleted');
        };
    }, [eventId]);

    const handleSend = async (imageUri?: string) => {
        if (!inputText.trim() && !imageUri) return;
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
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
        });
        if (!result.canceled) {
            handleSend(result.assets[0].uri);
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
        const isMine = item.sender._id === user?._id;
        
        // Date separator logic
        const showDateSeparator = index === 0 || 
            new Date(messages[index - 1].createdAt).toDateString() !== new Date(item.createdAt).toDateString();

        return (
            <View>
                {showDateSeparator && (
                    <View className="items-center my-6">
                        <View className="bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200 shadow-sm">
                            <Text className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
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
                            source={{ uri: item.sender.avatar || 'https://via.placeholder.com/100' }} 
                            className="w-8 h-8 rounded-2xl mr-2 mb-1 border-2 border-indigo-50" 
                        />
                    )}
                    <View 
                        className={`max-w-[75%] shadow-sm ${isMine ? 'bg-indigo-600 rounded-3xl rounded-br-none' : 'bg-white rounded-3xl rounded-bl-none'} overflow-hidden shadow-black/10`}
                        style={{ elevation: 2 }}
                    >
                        {/* Reply Preview inside Bubble */}
                        {item.replyTo && (
                            <View className={`m-2 p-2 rounded-xl border-l-4 ${isMine ? 'bg-black/10 border-indigo-300' : 'bg-gray-100 border-indigo-500'}`}>
                                <Text className={`text-[9px] font-black uppercase ${isMine ? 'text-indigo-200' : 'text-indigo-600'}`}>
                                    {item.replyTo.sender?.name || "User"}
                                </Text>
                                <Text className={`text-[11px] ${isMine ? 'text-indigo-100' : 'text-gray-500'}`} numberOfLines={1}>
                                    {item.replyTo.text}
                                </Text>
                            </View>
                        )}

                        {item.image && (
                            <Image 
                                source={{ uri: item.image }} 
                                className="w-64 h-48" 
                                resizeMode="cover" 
                            />
                        )}
                        
                        <View className="p-3 px-4">
                            {!isMine && (
                                <Text className="text-[10px] font-black uppercase text-indigo-400 mb-1 tracking-tighter">
                                    {item.sender.name}
                                </Text>
                            )}
                            {item.text && item.text.trim() !== '' && (
                                <Text className={`text-[13px] font-bold leading-5 ${isMine ? 'text-white' : 'text-zinc-800'}`}>
                                    {item.text}
                                </Text>
                            )}
                            <View className="flex-row items-center justify-end mt-1 gap-1">
                                <Text className={`text-[8px] font-bold ${isMine ? 'text-indigo-200' : 'text-zinc-400'}`}>
                                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                {isMine && <Ionicons name="checkmark-done" size={10} color="#c7d2fe" />}
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }, [messages, user, isAdmin]);

    return (
        <View className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                {/* Header */}
                <View className="flex-row items-center p-5 bg-white border-b border-gray-100 shadow-sm shadow-black/5 z-10">
                    <TouchableOpacity onPress={() => goBack()} className="w-10 h-10 bg-gray-50 rounded-2xl items-center justify-center">
                        <Ionicons name="chevron-back" size={20} color="#1e1b4b" />
                    </TouchableOpacity>
                    
                    <View className="ml-4 flex-1">
                        <Text className="text-zinc-900 font-black italic uppercase text-base tracking-tighter" numberOfLines={1}>
                            {eventName}
                        </Text>
                        <View className="flex-row items-center">
                            <View className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5" />
                            <Text className="text-gray-400 text-[9px] font-bold uppercase tracking-widest">Community Hub</Text>
                        </View>
                    </View>

                    <TouchableOpacity className="w-10 h-10 bg-indigo-50 rounded-2xl items-center justify-center">
                        <Ionicons name="information-circle-outline" size={22} color="#4f46e5" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#6366f1" />
                        <Text className="mt-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">Encrypting Chat...</Text>
                    </View>
                ) : (
                    <FlatList 
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={m => m._id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    />
                )}
                
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
                >
                    {/* Input Area */}
                    <View className="p-4 bg-white border-t border-gray-100">
                        {/* Reply Indicator Preview */}
                        {replyingTo && (
                            <View className="px-5 py-3 bg-white border-t border-indigo-100 flex-row items-center justify-between mb-4 rounded-2xl">
                                <View className="border-l-4 border-indigo-600 pl-4">
                                    <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-widest">
                                        Replying to {replyingTo.sender.name}
                                    </Text>
                                    <Text className="text-gray-500 text-[11px] mt-0.5" numberOfLines={1}>
                                        {replyingTo.text}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                    <Ionicons name="close-circle" size={22} color="#4f46e5" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <View className="flex-row items-center bg-gray-50 rounded-[30px] px-2 py-2 border border-blue-50">
                            <TouchableOpacity 
                                onPress={pickImage}
                                className="w-10 h-10 items-center justify-center"
                            >
                                <Ionicons name="image" size={22} color="#6366f1" />
                            </TouchableOpacity>
                            <TextInput 
                                placeholder="Type a message..."
                                value={inputText}
                                onChangeText={setInputText}
                                className="flex-1 h-10 text-zinc-800 font-bold px-2 text-[13px]"
                                placeholderTextColor="#94a3b8"
                            />
                            <TouchableOpacity 
                                onPress={() => handleSend()}
                                disabled={sending || (!inputText.trim())}
                                className={`w-10 h-10 rounded-full items-center justify-center ${inputText.trim() ? 'bg-indigo-600 shadow-lg shadow-indigo-300' : 'bg-gray-200'}`}
                            >
                                {sending ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Ionicons name="send" size={18} color="white" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
