import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, Pressable, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Button, Sheet, FormField } from '../ui/kit';
import { ChatComposer, clock } from '../community/shared';
import Avatar from '../Avatar';

const votesOf = (opts: any[] = []) => opts.reduce((acc: number, o: any) => acc + (o.votes?.length ?? 0), 0);

const ClubMessage = memo(function ClubMessage({ item, myId, senderIsAdmin, onVote }: { item: any; myId?: string; senderIsAdmin: boolean; onVote: (id: string, idx: number) => void }) {
    const isMine = item.sender?._id === myId;
    const total = votesOf(item.pollOptions);
    return (
        <View className={`mb-3 flex-row ${isMine ? 'justify-end' : 'justify-start'}`} style={{ gap: 8 }}>
            {!isMine && <Avatar user={item.sender} size={32} showBadge={false} />}
            <View className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMine ? 'bg-paper-2' : 'bg-card border border-line'}`}>
                {!isMine && (
                    <Text className="text-ink font-semibold mb-1" style={{ fontSize: 13 }}>
                        {item.sender?.name}{senderIsAdmin ? ' · Admin' : ''}
                    </Text>
                )}

                {item.fileUrl && (
                    <View className="mb-2">
                        {item.fileType === 'image' ? (
                            <Image source={{ uri: item.fileUrl }} style={{ width: 192, height: 192, borderRadius: 12, backgroundColor: C.paper2 }} cachePolicy="memory-disk" />
                        ) : (
                            <View className="bg-paper-2 p-2 rounded-xl flex-row items-center" style={{ gap: 8 }}>
                                <Ionicons name="document-outline" size={20} color={C.ink2} />
                                <Text className="text-ink-2 font-semibold" style={{ fontSize: 13, flexShrink: 1 }} numberOfLines={1}>{item.fileName}</Text>
                            </View>
                        )}
                    </View>
                )}

                {item.isPoll ? (
                    <View className="w-56">
                        <Text className="text-ink font-semibold mb-3" style={{ fontSize: 15 }}>{item.pollQuestion}</Text>
                        {(item.pollOptions ?? []).map((opt: any, idx: number) => {
                            const pct = total === 0 ? 0 : ((opt.votes?.length ?? 0) / total) * 100;
                            const hasVoted = !!opt.votes?.includes(myId);
                            return (
                                <Pressable
                                    key={idx}
                                    onPress={() => onVote(item._id, idx)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${opt.optionText}, ${Math.round(pct)} percent`}
                                    accessibilityState={{ selected: hasVoted }}
                                    className={`mb-2 bg-paper-2 rounded-xl overflow-hidden border active:opacity-70 ${hasVoted ? 'border-brand-500' : 'border-line'}`}
                                >
                                    <View className="flex-row items-center justify-between p-3">
                                        <View className="absolute left-0 top-0 bottom-0 bg-brand-500/15" style={{ width: `${pct}%` }} />
                                        <View className="flex-row items-center flex-1" style={{ gap: 6 }}>
                                            <Text className="text-ink font-semibold" style={{ fontSize: 13 }}>{opt.optionText}</Text>
                                            {hasVoted && <Ionicons name="checkmark-circle" size={14} color={C.brand[500]} />}
                                        </View>
                                        <Text className="text-ink-2 font-semibold" style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}>{Math.round(pct)}%</Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                        <Text className="text-ink-3 mt-1" style={{ fontSize: 12 }}>{total} {total === 1 ? 'vote' : 'votes'}</Text>
                    </View>
                ) : (
                    <Text className="text-ink" style={{ fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
                )}

                <Text className="text-ink-3 text-right mt-1" style={{ fontSize: 11 }}>{clock(item.createdAt)}</Text>
            </View>
        </View>
    );
});

const SubGroupChat = ({ navigation, route }: any) => {
    const { subGroupId, subGroupName, clubId } = route.params ?? {};
    const { user } = useAuth();
    
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [subGroup, setSubGroup] = useState<any>(null);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [clubAdmins, setClubAdmins] = useState<string[]>([]);
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    const flatListRef = useRef<FlatList>(null);
    const pollBusy = useRef(false);

    const fetchMessages = async () => {
        try {
            setLoadError(false);
            const res = await axios.get(`/clubs/messages/${subGroupId}`);
            if (res.data?.success) {
                setMessages(res.data.messages || []);
                setSubGroup(res.data.subGroup);
            }
            
            const clubRes = await axios.get(`/clubs/${clubId}`);
            if (clubRes.data.success) {
                setClubAdmins((clubRes.data.club?.admins ?? []).map((a: any) => a._id || a));
            }
        } catch (error) {
            console.log("Chat fetch error", error);
            setLoadError(true);
        } finally {
            // No scroll timer here: onContentSizeChange already pins the list to the end.
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        socket.emit("join_club_room", { subGroupId });
        
        const onNewMessage = (msg: any) => {
            setMessages(prev => (prev.some(m => m._id === msg?._id) ? prev : [...prev, msg]));
        };
        const onPollUpdated = ({ messageId, pollOptions: newOptions }: any) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, pollOptions: newOptions } : m));
        };
        socket.on('new_club_message', onNewMessage);
        socket.on('poll_updated', onPollUpdated);

        return () => {
            socket.emit("leave_club_room", { subGroupId });
            // Remove only our handlers; a bare off(event) strips every screen's listener.
            socket.off('new_club_message', onNewMessage);
            socket.off('poll_updated', onPollUpdated);
        };
    }, [subGroupId]);

    const handleSend = async (fileData?: any) => {
        if (sending || (!text.trim() && !fileData)) return;
        setSending(true);
        const formData = new FormData();
        formData.append('subGroupId', subGroupId);
        formData.append('senderId', user?._id);
        if (text) formData.append('text', text);
        
        if (fileData) {
            formData.append('file', {
                uri: fileData.uri,
                name: fileData.name || 'file',
                type: fileData.mimeType || fileData.type || 'application/octet-stream'
            } as any);
        }

        try {
            await axios.post('/clubs/message/post', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setText('');
        } catch (error) {
            Alert.alert("Error", "Message failed to send");
        } finally {
            setSending(false);
        }
    };

    const handlePickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
        if (!result.canceled) {
            handleSend(result.assets[0]);
        }
    };

    const handleCreatePoll = async () => {
        if (pollBusy.current || !pollQuestion.trim() || pollOptions.some(o => !o.trim())) return;
        pollBusy.current = true;
        const options = pollOptions.map(o => ({ optionText: o, votes: [] }));
        
        try {
            await axios.post('/clubs/message/post', {
                subGroupId,
                senderId: user?._id,
                isPoll: true,
                pollQuestion,
                pollOptions: JSON.stringify(options)
            });
            setShowPollModal(false);
            setPollQuestion('');
            setPollOptions(['', '']);
        } catch (error) {
             Alert.alert("Error", "Could not create poll");
        } finally {
            pollBusy.current = false;
        }
    };

    const voteInPoll = async (messageId: string, optionIndex: number) => {
        try {
            await axios.post('/clubs/poll/vote', { messageId, optionIndex, userId: user?._id });
        } catch (error) {
            console.log("Vote error", error);
        }
    };

    const handleLeaveRoom = async () => {
        Alert.alert(
            "Exit Room?",
            "You will no longer receive updates from this specific room. You can rejoin later if you are still in the club.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Exit", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const res = await axios.post('/clubs/subgroup/leave', {
                                subGroupId,
                                userId: user?._id
                            });
                            if (res.data.success) {
                                navigation.goBack();
                            }
                        } catch (error: any) {
                            Alert.alert("Exit Failed", error.response?.data?.message || "Something went wrong");
                        }
                    } 
                }
            ]
        );
    };

    const isRoomAdmin = subGroup?.admins?.some((a: any) => (a?._id || a) === user?._id) || clubAdmins.includes(user?._id);
    const canType = !subGroup?.onlyAdminsCanMessage || isRoomAdmin;

    const myId = user?._id;
    const renderMessage = useCallback(({ item }: { item: any }) => (
        <ClubMessage item={item} myId={myId} senderIsAdmin={clubAdmins.includes(item.sender?._id)} onVote={voteInPoll} />
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [myId, clubAdmins]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar
                    title={subGroupName}
                    onBack={() => navigation.goBack()}
                    right={<>
                        <IconBtn name="information-circle-outline" color={C.ink2} onPress={() => navigation.navigate('EditSubGroup', { subGroupId })} accessibilityLabel="Room settings" />
                        {isRoomAdmin && (
                            <IconBtn name="bar-chart-outline" color={C.ink2} onPress={() => setShowPollModal(true)} accessibilityLabel="Create poll" />
                        )}
                        {!subGroup?.isGeneral && (
                            <IconBtn name="log-out-outline" color={C.danger} onPress={handleLeaveRoom} accessibilityLabel="Leave room" />
                        )}
                    </>}
                />

                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-1 bg-paper">
                        {loading ? (
                            <ActivityIndicator color={C.ink} className="mt-10" />
                        ) : (
                            <FlatList
                                ref={flatListRef}
                                data={messages}
                                keyExtractor={(item) => item._id}
                                renderItem={renderMessage}
                                contentContainerStyle={{ padding: 20 }}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                                ListEmptyComponent={loadError ? (
                                    <Empty
                                        icon="cloud-offline-outline"
                                        title="Couldn't load messages"
                                        action={<Button title="Try again" onPress={() => { setLoading(true); fetchMessages(); }} />}
                                    />
                                ) : (
                                    <Empty icon="chatbubbles-outline" title="No messages yet" />
                                )}
                            />
                        )}
                    </View>

                    <ChatComposer
                        value={text}
                        onChangeText={setText}
                        onSend={() => handleSend()}
                        sending={sending}
                        onAttach={handlePickDocument}
                        locked={!canType && 'Only admins can send messages'}
                    />
                </KeyboardAvoidingView>

                <Sheet
                    visible={showPollModal}
                    onClose={() => setShowPollModal(false)}
                    title="Create poll"
                    footer={<Button title="Post poll" variant="primary" block onPress={handleCreatePoll} disabled={!pollQuestion.trim() || pollOptions.some(o => !o.trim())} />}
                >
                    <View style={{ gap: 12 }}>
                        <FormField label="Question" placeholder="What's your question?" value={pollQuestion} onChangeText={setPollQuestion} />
                        {pollOptions.map((opt, idx) => (
                            <FormField
                                key={idx}
                                placeholder={`Option ${idx + 1}`}
                                accessibilityLabel={`Option ${idx + 1}`}
                                value={opt}
                                onChangeText={(val) => {
                                    const newOpts = [...pollOptions];
                                    newOpts[idx] = val;
                                    setPollOptions(newOpts);
                                }}
                            />
                        ))}
                        <View className="flex-row">
                            <Button small variant="tertiary" icon="add" title="Add option" onPress={() => setPollOptions([...pollOptions, ''])} />
                        </View>
                    </View>
                </Sheet>
            </SafeAreaView>
        </View>
    );
};

export default SubGroupChat;
