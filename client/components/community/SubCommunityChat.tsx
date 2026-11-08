import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, Pressable, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Tag } from '../ui/kit';
import { ChatComposer, clock } from './shared';

const EchoMessage = memo(function EchoMessage({ item, myId, creatorId, isCreator, onReply, onDelete }: {
    item: any; myId?: string; creatorId: string | null; isCreator: boolean;
    onReply: (m: any) => void; onDelete: (id: string) => void;
}) {
    const isMine = item.sender?._id === myId;
    const isSenderAdmin = (item.sender?._id || item.sender) === creatorId;
    const canDelete = isMine || isCreator;
    const fg = isMine ? C.paper : C.ink;
    const sub = isMine ? C.paper + 'B3' : C.ink3;

    return (
        <View className={`mb-4 flex-row ${isMine ? 'justify-end' : 'justify-start'}`} style={{ gap: 8 }}>
            {!isMine && (
                <Image source={{ uri: item.sender?.avatar }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
            )}
            <View className="max-w-[80%]" style={{ flexShrink: 1 }}>
                {!isMine && (
                    <View className="flex-row items-center mb-1 ml-1" style={{ gap: 6 }}>
                        <Text className="text-ink font-semibold" style={{ fontSize: 13 }}>{item.sender?.name}</Text>
                        {isSenderAdmin && <Tag label="Owner" />}
                    </View>
                )}
                <Pressable
                    onLongPress={canDelete ? () => onDelete(item._id) : undefined}
                    className={`rounded-2xl px-4 py-3 ${isMine ? 'bg-ink rounded-tr-md' : 'bg-card border border-line rounded-tl-md'}`}
                >
                    {item.repliedTo && (
                        <View className="mb-2 pl-3 py-1" style={{ borderLeftWidth: 3, borderLeftColor: isMine ? C.paper + '4D' : C.line }}>
                            <Text className="font-semibold" style={{ fontSize: 12, color: sub }}>Replying to {item.repliedTo.sender?.name}</Text>
                            <Text style={{ fontSize: 13, color: sub }} numberOfLines={2}>{item.repliedTo.text}</Text>
                        </View>
                    )}
                    <Text style={{ fontSize: 15, lineHeight: 21, color: fg }}>{item.text}</Text>
                    <View className="flex-row items-center justify-between mt-2" style={{ gap: 16 }}>
                        <Text style={{ fontSize: 11, color: sub }}>{clock(item.createdAt)}</Text>
                        <View className="flex-row items-center" style={{ gap: 16 }}>
                            <Pressable onPress={() => onReply(item)} hitSlop={14} accessibilityRole="button" accessibilityLabel="Reply" className="active:opacity-60">
                                <Ionicons name="arrow-undo-outline" size={16} color={sub} />
                            </Pressable>
                            {canDelete && (
                                <Pressable onPress={() => onDelete(item._id)} hitSlop={14} accessibilityRole="button" accessibilityLabel="Delete message" className="active:opacity-60">
                                    <Ionicons name="trash-outline" size={16} color={sub} />
                                </Pressable>
                            )}
                        </View>
                    </View>
                </Pressable>
            </View>
        </View>
    );
});

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
        Alert.alert("Delete message?", "This removes it for everyone.", [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Delete", 
              style: "destructive", 
              onPress: async () => {
                try { await axios.post('/communities/sub/message/delete', { messageId, userId: user?._id }); }
                catch (e) { Alert.alert("Error", "Purge failed"); }
              }
            }
        ]);
    };

    const myId = user?._id;
    const renderMessage = useCallback(({ item }: { item: any }) => (
        <EchoMessage item={item} myId={myId} creatorId={creatorId} isCreator={isCreator} onReply={setReplyingTo} onDelete={handleDelete} />
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [myId, creatorId, isCreator]);

    const locked = subType === 'announcement' && !isCreator;

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} translucent backgroundColor="transparent" />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title={`#${subName}`} onBack={() => navigation.goBack()} />

                <View className="flex-1">
                    {loading ? (
                        <View className="flex-1 items-center justify-center"><ActivityIndicator color={C.brand[500]} /></View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            keyExtractor={(item) => item._id}
                            renderItem={renderMessage}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                            ListEmptyComponent={<Empty icon="chatbubbles-outline" title="No messages yet" />}
                        />
                    )}
                </View>

                <KeyboardAvoidingView behavior="padding">
                    <ChatComposer
                        value={text}
                        onChangeText={setText}
                        onSend={handleSend}
                        sending={sending}
                        placeholder={subType === 'announcement' ? 'Write an announcement' : 'Message'}
                        locked={locked && 'Only the owner can post here'}
                        top={replyingTo ? (
                            <View className="mb-3 pl-3 pr-1 py-2 bg-paper-2 rounded-xl flex-row items-center" style={{ borderLeftWidth: 3, borderLeftColor: C.brand[500], gap: 8 }}>
                                <View className="flex-1" style={{ minWidth: 0 }}>
                                    <Text className="text-accent-text font-semibold" style={{ fontSize: 12 }}>Replying to {replyingTo.sender?.name}</Text>
                                    <Text className="text-ink-3" style={{ fontSize: 13 }} numberOfLines={1}>{replyingTo.text}</Text>
                                </View>
                                <IconBtn name="close-circle" size={20} color={C.ink3} onPress={() => setReplyingTo(null)} accessibilityLabel="Cancel reply" />
                            </View>
                        ) : null}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default SubCommunityChat;
