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
    if (!navigation) return null;
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
                Alert.alert("Sector Locked", "This hub's Spark has expired. Activation required.");
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
            Alert.alert("Communication Breakdown", error.response?.data?.message || "Signal lost.");
        } finally {
            setSending(false);
        }
    };

    const handleDelete = (messageId: string) => {
        Alert.alert("Purge Message", "Remove this data from the sector frequency?", [
            { text: "Abort", style: "cancel" },
            { 
              text: "Purge", 
              style: "destructive", 
              onPress: async () => {
                try { await axios.post('/communities/sub/message/delete', { messageId, userId: user?._id }); }
                catch (e) { Alert.alert("Error", "Purge failed"); }
              }
            }
        ]);
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.sender?._id === user?._id;
        const isSenderAdmin = (item.sender?._id || item.sender) === creatorId;
        const canDelete = isMine || isCreator;

        return (
            <View className={`mb-8 flex-row gap-4 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                    <View className="shadow-sm shadow-black/5">
                        <Image source={{ uri: item.sender?.avatar || 'https://via.placeholder.com/150' }} className="w-10 h-10 rounded-[14px] bg-slate-100" />
                    </View>
                )}
                <View className="flex-1 max-w-[85%]">
                    {!isMine && (
                        <View className="flex-row items-center gap-2 mb-2 ml-1">
                            <Text className="text-zinc-900 font-black uppercase text-[9px] tracking-tight">{item.sender?.name}</Text>
                            {isSenderAdmin && (
                                <View className="bg-orange-500/10 px-2 py-0.5 rounded-lg border border-orange-200">
                                    <Text className="text-orange-600 font-black uppercase text-[7px] tracking-widest">Guardian</Text>
                                </View>
                            )}
                        </View>
                    )}
                    
                    <TouchableOpacity 
                        activeOpacity={0.9} 
                        onLongPress={() => canDelete && handleDelete(item._id)}
                        className={`rounded-[28px] px-6 py-5 shadow-sm ${isMine ? 'bg-zinc-900 rounded-tr-none shadow-black/20' : 'bg-white rounded-tl-none border border-slate-100 shadow-black/5'} ${isSenderAdmin && !isMine ? 'border-orange-100 bg-orange-50/20' : ''}`}
                    >
                        {item.repliedTo && (
                            <View className={`mb-4 p-4 rounded-2xl border-l-[4px] ${isMine ? 'bg-white/5 border-white/20' : 'bg-slate-50 border-slate-200'}`}>
                                <Text className={`text-[8px] font-black uppercase mb-1 tracking-widest ${isMine ? 'text-white/40' : 'text-slate-400'}`}>
                                    Responding to {item.repliedTo.sender?.name}
                                </Text>
                                <Text className={`text-[11px] font-medium ${isMine ? 'text-white/80' : 'text-zinc-600'}`} numberOfLines={2}>{item.repliedTo.text}</Text>
                            </View>
                        )}
                        <Text className={`font-medium text-[14px] leading-[24px] ${isMine ? 'text-white' : 'text-zinc-800'}`}>{item.text}</Text>
                        
                        <View className="flex-row items-center justify-between mt-4">
                            <Text className={`text-[9px] font-black uppercase tracking-widest ${isMine ? 'text-white/30' : 'text-slate-300'}`}>
                                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            
                            <View className="flex-row items-center gap-4">
                                <TouchableOpacity onPress={() => setReplyingTo(item)} hitSlop={15}>
                                    <Feather name="corner-up-left" size={16} color={isMine ? "rgba(255,255,255,0.3)" : "#CBD5E1"} />
                                </TouchableOpacity>
                                {canDelete && (
                                    <TouchableOpacity onPress={() => handleDelete(item._id)} hitSlop={15}>
                                        <Feather name="trash-2" size={16} color={isMine ? "rgba(255,255,255,0.3)" : "#CBD5E1"} />
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
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                {/* Modern Header */}
                <View className="px-8 py-5 flex-row items-center justify-between border-b border-slate-100 bg-white">
                    <View className="flex-row items-center gap-5">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="w-12 h-12 items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
                            <Ionicons name="chevron-back" size={22} color="#18181b" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-zinc-900 font-black uppercase text-[14px] tracking-tight">#{subName}</Text>
                            <View className="flex-row items-center gap-2 mt-0.5">
                                <View className="w-2 h-2 rounded-full bg-orange-500 shadow-sm" />
                                <Text className="text-slate-400 font-black uppercase text-[8px] tracking-[2px]">Link Established</Text>
                            </View>
                        </View>
                    </View>
                    <TouchableOpacity className="w-12 h-12 items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
                        <Feather name="more-horizontal" size={20} color="#CBD5E1" />
                    </TouchableOpacity>
                </View>

                {/* Status Bar */}
                <View className="bg-orange-50 py-2.5 items-center border-b border-orange-100/50">
                    <Text className="text-orange-600 font-black uppercase text-[8px] tracking-[4px]">Sector Signal Encrypted</Text>
                </View>

                <View className="flex-1">
                    {loading ? (
                        <View className="flex-1 items-center justify-center"><ActivityIndicator color="#f97316" /></View>
                    ) : (
                        <FlatList 
                            ref={flatListRef} 
                            data={messages} 
                            keyExtractor={(item) => item._id} 
                            renderItem={renderMessage} 
                            contentContainerStyle={{ padding: 24, paddingTop: 16 }}
                            showsVerticalScrollIndicator={false}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        />
                    )}
                </View>

                <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
                    {subType === 'announcement' && !isCreator ? (
                        <View className="p-10 bg-white items-center justify-center border-t border-slate-100">
                            <View className="bg-slate-50 px-10 py-4 rounded-[28px] border border-slate-100 flex-row items-center gap-3">
                                <Feather name="lock" size={16} color="#CBD5E1" />
                                <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest text-center">Guardian Broadcast Restricted</Text>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-white px-6 py-6 border-t border-slate-100">
                            {replyingTo && (
                                <View className="mb-5 p-5 bg-slate-50 rounded-[28px] border-l-[6px] border-orange-500 flex-row justify-between items-center shadow-sm">
                                    <View className="flex-1 mr-5">
                                        <Text className="text-orange-600 font-black uppercase text-[8px] mb-1 tracking-widest">Responding to {replyingTo.sender?.name}</Text>
                                        <Text className="text-slate-500 text-[11px] font-medium" numberOfLines={1}>{replyingTo.text}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                        <Ionicons name="close-circle" size={24} color="#CBD5E1" />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View className="flex-row items-end gap-4">
                                <TouchableOpacity className="w-14 h-14 bg-slate-50 rounded-[22px] items-center justify-center mb-0.5 border border-slate-100 shadow-sm">
                                    <Feather name="plus" size={28} color="#CBD5E1" />
                                </TouchableOpacity>
                                <View className="flex-1 min-h-[56px] max-h-[140px] bg-slate-50 rounded-[28px] px-6 border border-slate-100 justify-center shadow-sm">
                                    <TextInput 
                                        placeholder={subType === 'announcement' ? "Initiate broadcast..." : "Link message..."} 
                                        placeholderTextColor="#CBD5E1"
                                        className="font-medium text-[14px] text-zinc-900 leading-[22px]"
                                        value={text}
                                        onChangeText={setText}
                                        multiline
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={handleSend} 
                                    disabled={!text.trim() || sending} 
                                    className={`w-14 h-14 rounded-[22px] items-center justify-center shadow-xl mb-0.5 ${text.trim() ? 'bg-zinc-900 shadow-black/40' : 'bg-slate-200 shadow-none'}`}
                                >
                                    {sending ? <ActivityIndicator size="small" color="white" /> : <Feather name="arrow-up" size={28} color="white" />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    <View className="h-4 bg-white" />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default SubCommunityChat;
