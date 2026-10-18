import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar} from 'react-native'
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

const SubCommunityChat = ({ navigation, route }: any) => {
    const { subId, subName, communityId } = route?.params ?? {};
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
        const onNewMessage = (msg: any) => {
            if (msg?.subCommunityId === subId) {
                setMessages(prev => {
                    const exists = prev.find(m => m._id === msg._id);
                    if (exists) return prev;
                    return [...prev, msg];
                });
                setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
            }
        };
        const onDeleted = ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.filter(m => m._id !== messageId));
        };
        socket.on('new_message', onNewMessage);
        socket.on('message_deleted', onDeleted);
        return () => {
            socket.emit("leave_echo_room", { subId });
            // Remove only our handlers: a bare off(event) also strips other
            // screens' listeners (direct chat uses 'new_message' too).
            socket.off('new_message', onNewMessage);
            socket.off('message_deleted', onDeleted);
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
                    <View className="shadow-hair">
                        <Image source={{ uri: item.sender?.avatar }} style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
                    </View>
                )}
                <View className="flex-1 max-w-[85%]">
                    {!isMine && (
                        <View className="flex-row items-center gap-2 mb-2 ml-1">
                            <Text className="text-ink font-display uppercase text-label">{item.sender?.name}</Text>
                            {isSenderAdmin && (
                                <View className="bg-brand-500/10 border border-ink px-2.5 py-1 rounded-full">
                                    <Text className="text-accent-text font-display uppercase text-label">Guardian</Text>
                                </View>
                            )}
                        </View>
                    )}
                    
                    <TouchableOpacity 
                        activeOpacity={0.9} 
                        onLongPress={() => canDelete && handleDelete(item._id)}
                        className={`rounded-card px-6 py-5 shadow-hair ${isMine ? 'bg-ink rounded-tr-none ' : 'bg-card rounded-tl-none border border-line '} ${isSenderAdmin && !isMine ? 'border-line bg-paper-2/20' : ''}`}
                    >
                        {item.repliedTo && (
                            <View className={`mb-4 p-4 rounded-card border-l-[4px] ${isMine ? 'bg-paper/5 border-paper/20' : 'bg-paper-2 border-line'}`}>
                                <Text className={`text-label font-display uppercase mb-1 ${isMine ? 'text-paper/40' : 'text-ink-3'}`}>
                                    Responding to {item.repliedTo.sender?.name}
                                </Text>
                                <Text className={`text-label font-medium ${isMine ? 'text-paper/80' : 'text-ink-2'}`} numberOfLines={2}>{item.repliedTo.text}</Text>
                            </View>
                        )}
                        <Text className={`font-medium text-sm leading-[24px] ${isMine ? 'text-paper' : 'text-ink'}`}>{item.text}</Text>
                        
                        <View className="flex-row items-center justify-between mt-4">
                            <Text className={`text-label font-display uppercase ${isMine ? 'text-paper/30' : 'text-ink-4'}`}>
                                {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </Text>
                            
                            <View className="flex-row items-center gap-4">
                                <TouchableOpacity onPress={() => setReplyingTo(item)} hitSlop={15}>
                                    <Feather name="corner-up-left" size={16} color={isMine ? C.paper + '4D' : C.ink4} />
                                </TouchableOpacity>
                                {canDelete && (
                                    <TouchableOpacity onPress={() => handleDelete(item._id)} hitSlop={15}>
                                        <Feather name="trash-2" size={16} color={isMine ? C.paper + '4D' : C.ink4} />
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
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} translucent backgroundColor="transparent" />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar
                    title={`#${subName}`}
                    onBack={() => navigation.goBack()}
                    right={<IconBtn name="ellipsis-horizontal" color={C.ink4} boxed />}
                />

                {/* Status Bar */}
                <View className="bg-paper-2 py-2.5 items-center border-b border-line">
                    <Text className="text-accent-text font-display uppercase text-label">Sector Signal Encrypted</Text>
                </View>

                <View className="flex-1">
                    {loading ? (
                        <View className="flex-1 items-center justify-center"><ActivityIndicator color={C.brand[500]} /></View>
                    ) : (
                        <FlatList 
                            ref={flatListRef} 
                            data={messages} 
                            keyExtractor={(item) => item._id} 
                            renderItem={renderMessage} 
                            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, paddingTop: 16 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        />
                    )}
                </View>

                <KeyboardAvoidingView behavior="padding">
                    {subType === 'announcement' && !isCreator ? (
                        <View className="p-card-pad bg-card items-center justify-center border-t border-line">
                            <View className="bg-paper-2 px-gutter py-4 rounded-card border border-line flex-row items-center gap-3">
                                <Feather name="lock" size={16} color={C.ink4} />
                                <Text className="font-sans text-sm text-ink-3 text-center">Guardian Broadcast Restricted</Text>
                            </View>
                        </View>
                    ) : (
                        <View className="bg-card px-5 py-6 border-t border-line">
                            {replyingTo && (
                                <View className="mb-5 p-5 bg-paper-2 rounded-card border-l-[6px] border-brand-500 flex-row justify-between items-center shadow-hair">
                                    <View className="flex-1 mr-5">
                                        <Text className="text-accent-text font-display uppercase text-label mb-1">Responding to {replyingTo.sender?.name}</Text>
                                        <Text className="text-ink-3 text-label font-medium" numberOfLines={1}>{replyingTo.text}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                        <Ionicons name="close-circle" size={24} color={C.ink4} />
                                    </TouchableOpacity>
                                </View>
                            )}
                            <View className="flex-row items-end gap-4">
                                <TouchableOpacity className="w-14 h-14 bg-paper-2 rounded-card items-center justify-center mb-0.5 border border-line shadow-hair">
                                    <Feather name="plus" size={28} color={C.ink4} />
                                </TouchableOpacity>
                                <View className="flex-1 min-h-[56px] max-h-[140px] bg-paper-2 rounded-card px-6 border border-line justify-center shadow-hair">
                                    <TextInput 
                                        placeholder={subType === 'announcement' ? "Initiate broadcast..." : "Link message..."} 
                                        placeholderTextColor={C.ink4}
                                        className="font-medium text-sm text-ink leading-[22px]"
                                        value={text}
                                        onChangeText={setText}
                                        multiline
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={handleSend} 
                                    disabled={!text.trim() || sending} 
                                    className={`w-14 h-14 rounded-card items-center justify-center shadow-hair mb-0.5 ${text.trim() ? 'bg-ink ' : 'bg-paper-2 shadow-none'}`}
                                >
                                    {sending ? <ActivityIndicator size="small" color={C.paper} /> : <Feather name="arrow-up" size={28} color={C.paper} />}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    <View className="h-4 bg-card" />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default SubCommunityChat;
