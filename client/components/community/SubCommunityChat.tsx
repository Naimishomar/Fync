import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, TextInput, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { LinearGradient } from 'expo-linear-gradient';

const SubCommunityChat = ({ navigation, route }: any) => {
    if (!navigation) return null; // Bridge context check
    const { subId, subName, communityId } = route.params;
    const { user } = useAuth();

    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [isCreator, setIsCreator] = useState(false);
    const [creatorId, setCreatorId] = useState<string | null>(null);
    const [subType, setSubType] = useState('chat');
    const flatListRef = useRef<FlatList>(null);

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`/communities/sub/messages/${subId}`);
            if (res.data.success) {
                setMessages(res.data.messages || []);
                setSubType(res.data.sub?.type || 'chat');
            }
            
            const commRes = await axios.get(`/communities/details/${communityId}`);
            if (commRes.data.success) {
                const cId = commRes.data.community.creator?._id || commRes.data.community.creator;
                setCreatorId(cId);
                setIsCreator(cId === user?._id);
            }
        } catch (error: any) {
            if (error.response?.status === 403) {
                Alert.alert("Hub Locked", "This hub's Spark has expired. Access is suspended.");
                navigation.goBack();
            }
        } finally {
            setLoading(false);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 500);
        }
    };

    useEffect(() => {
        fetchMessages();
        socket.emit("join_echo_room", { subId });
        socket.on('new_message', (msg: any) => {
            if (msg.subCommunityId === subId) {
                setMessages(prev => {
                    const exists = prev.find(m => m._id === msg._id);
                    if (exists) return prev;
                    return [...prev, msg];
                });
                setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
            }
        });
        socket.on('message_deleted', ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.filter(m => m._id !== messageId));
        });
        return () => {
            socket.emit("leave_echo_room", { subId });
            socket.off('new_message');
            socket.off('message_deleted');
        };
    }, [subId]);

    const handleSend = async () => {
        if (!text.trim() || sending) return;
        setSending(true);
        const tempText = text;
        const tempReplyId = replyingTo?._id;
        setText('');
        setReplyingTo(null);
        try {
            await axios.post('/communities/sub/message/send', {
                subCommunityId: subId,
                senderId: user?._id,
                text: tempText,
                repliedTo: tempReplyId
            });
        } catch (error: any) {
            Alert.alert("Denied", error.response?.data?.message || "Communication failed.");
        } finally {
            setSending(false);
        }
    };

    const handleDelete = (messageId: string) => {
        Alert.alert("Delete Message", "Purge this message for everyone?", [
            { text: "Keep", style: "cancel" },
            { 
              text: "Delete", 
              style: "destructive", 
              onPress: async () => {
                try { await axios.post('/communities/sub/message/delete', { messageId, userId: user?._id }); }
                catch (e) { Alert.alert("Error", "Could not delete"); }
              }
            }
        ]);
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.sender?._id === user?._id;
        const isSenderAdmin = (item.sender?._id || item.sender) === creatorId;
        const canDelete = isMine || isCreator;

        return (
            <View className={`mb-6 flex-row gap-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                    <View className="shadow-sm shadow-black/5">
                        <Image source={{ uri: item.sender?.avatar || 'https://via.placeholder.com/150' }} className="w-9 h-9 rounded-xl bg-zinc-100" />
                    </View>
                )}
                <View className="flex-1 max-w-[82%]">
                    {!isMine && (
                        <View className="flex-row items-center gap-2 mb-1.5 ml-1">
                            <Text className="text-zinc-500 font-black uppercase text-[8px] tracking-widest">{item.sender?.name}</Text>
                            {isSenderAdmin && (
                                <View className="bg-indigo-600/10 px-2 py-0.5 rounded-full border border-indigo-200">
                                    <Text className="text-indigo-600 font-black uppercase text-[6px]">Admin</Text>
                                </View>
                            )}
                        </View>
                    )}
                    
                    <TouchableOpacity 
                        activeOpacity={0.95} 
                        onLongPress={() => canDelete && handleDelete(item._id)}
                        className={`rounded-[22px] px-5 py-4 ${isMine ? 'bg-[#1a1a1a] rounded-tr-none' : 'bg-white rounded-tl-none border border-zinc-100'} ${isSenderAdmin && !isMine ? 'border-indigo-100 bg-indigo-50/30' : ''}`}
                    >
                        {item.repliedTo && (
                            <View className={`mb-3 p-3 rounded-2xl border-l-[3px] ${isMine ? 'bg-[#2a2a2a] border-white/20' : 'bg-zinc-100/50 border-zinc-300'}`}>
                                <Text className={`text-[8px] font-black uppercase mb-1 ${isMine ? 'text-white/40' : 'text-zinc-400'}`}>
                                    Replying to {item.repliedTo.sender?.name}
                                </Text>
                                <Text className={`text-[10px] font-bold ${isMine ? 'text-white/80' : 'text-zinc-600'}`} numberOfLines={1}>{item.repliedTo.text}</Text>
                            </View>
                        )}
                        <Text className={`font-semibold text-sm leading-[22px] ${isMine ? 'text-white' : 'text-zinc-800'}`}>{item.text}</Text>
                        
                        <View className="flex-row items-center justify-between mt-2.5">
                            <Text className={`text-[8px] font-bold uppercase tracking-tighter ${isMine ? 'text-white/30' : 'text-zinc-300'}`}>
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            
                            <View className="flex-row items-center gap-3">
                                <TouchableOpacity onPress={() => setReplyingTo(item)} hitSlop={15}>
                                    <Feather name="corner-up-left" size={14} color={isMine ? "rgba(255,255,255,0.3)" : "#D1D5DB"} />
                                </TouchableOpacity>
                                {canDelete && (
                                    <TouchableOpacity onPress={() => handleDelete(item._id)} hitSlop={15}>
                                        <Feather name="trash-2" size={14} color={isMine ? "rgba(255,255,255,0.3)" : "#D1D5DB"} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                {/* Modern Elevated Header */}
                <View className="px-6 py-4 flex-row items-center justify-between border-b border-zinc-50 bg-white shadow-sm shadow-black/5">
                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-xl">
                            <Ionicons name="chevron-back" size={20} color="black" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-zinc-900 font-black uppercase text-xs tracking-tighter">#{subName}</Text>
                            <Text className="text-teal-500 font-bold text-[8px] uppercase tracking-widest">Active Connection</Text>
                        </View>
                    </View>
                    <TouchableOpacity className="w-10 h-10 items-center justify-center bg-zinc-50 rounded-xl">
                        <Feather name="more-horizontal" size={18} color="black" />
                    </TouchableOpacity>
                </View>

                {/* Minimal Purge Warning */}
                <View className="bg-amber-50/50 py-2 items-center">
                    <Text className="text-amber-700/60 font-black uppercase text-[7px] tracking-[2px]">30-Day Auto Purge Active</Text>
                </View>

                <View className="flex-1 bg-[#F9FAFB]">
                    {loading ? (
                        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#6366f1" /></View>
                    ) : (
                        <FlatList 
                            ref={flatListRef} 
                            data={messages} 
                            keyExtractor={(item) => item._id} 
                            renderItem={renderMessage} 
                            contentContainerStyle={{ padding: 20, paddingTop: 10 }}
                            showsVerticalScrollIndicator={false}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        />
                    )}
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                    {subType === 'announcement' && !isCreator ? (
                        <View className="p-8 bg-zinc-100/50 items-center justify-center border-t border-zinc-200">
                            <View className="bg-white px-8 py-3 rounded-full border border-zinc-100 shadow-sm flex-row items-center gap-2">
                                <Feather name="lock" size={12} color="#94a3b8" />
                                <Text className="text-zinc-500 font-black uppercase text-[9px] tracking-widest">Administrator Broadcast Only</Text>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-white px-5 py-4 border-t border-zinc-100">
                            {replyingTo && (
                                <View className="mb-4 p-4 bg-zinc-50 rounded-2xl border-l-[4px] border-indigo-500 flex-row justify-between items-center">
                                    <View className="flex-1 mr-4">
                                        <Text className="text-indigo-600 font-black uppercase text-[7px] mb-1">Replying to {replyingTo.sender?.name}</Text>
                                        <Text className="text-zinc-500 text-[10px] font-bold" numberOfLines={1}>{replyingTo.text}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                        <Ionicons name="close-circle" size={20} color="#D1D5DB" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View className="flex-row items-end gap-3">
                                <TouchableOpacity className="w-12 h-12 bg-zinc-100 rounded-[18px] items-center justify-center mb-1">
                                    <Feather name="plus" size={24} color="#94a3b8" />
                                </TouchableOpacity>
                                <View className="flex-1 min-h-[50px] max-h-[120px] bg-zinc-100 rounded-[24px] px-5 py-3 border border-zinc-200 justify-center">
                                    <TextInput 
                                        placeholder={subType === 'announcement' ? "Make a broadcast..." : "Message..."} 
                                        placeholderTextColor="#94a3b8"
                                        className="font-semibold text-sm text-zinc-900 leading-[20px]"
                                        value={text}
                                        onChangeText={setText}
                                        multiline
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={handleSend} 
                                    disabled={!text.trim() || sending} 
                                    className={`w-12 h-12 rounded-[18px] items-center justify-center shadow-lg mb-1 ${text.trim() ? 'bg-indigo-600 shadow-indigo-200' : 'bg-zinc-200 shadow-none'}`}
                                >
                                    {sending ? <ActivityIndicator size="small" color="white" /> : <Feather name="arrow-up" size={24} color="white" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    <View className="h-2 bg-white" />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default SubCommunityChat;
