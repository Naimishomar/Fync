import React, { useState, useEffect, useRef, useCallback } from 'react';
import {View, Text, TouchableOpacity, FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar, Modal} from 'react-native'
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Button } from '../ui/kit';
import Avatar from '../Avatar';

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

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.sender?._id === user?._id;
        const isAdmin = clubAdmins.includes(item.sender?._id);

        return (
            <View className={`mb-4 flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                    <View className="mr-2"><Avatar user={item.sender} size={32} showBadge={false} /></View>
                )}
                <View className={`max-w-[80%] rounded-card px-4 py-3 ${isMine ? 'bg-paper-2' : 'bg-card border border-line'}`}>
                    {!isMine && (
                        <Text className="text-ink font-semibold text-label mb-1">{item.sender?.name} {isAdmin && '• [Admin]'}</Text>
                    )}
                    
                    {item.fileUrl && (
                        <View className="mb-2">
                            {item.fileType === 'image' ? (
                                <Image source={{ uri: item.fileUrl }} style={{ width: 192, height: 192, borderRadius: 8 }} cachePolicy="memory-disk" />
                            ) : (
                                <View className="bg-paper-2 p-2 rounded-lg flex-row items-center border border-line">
                                    <Feather name="file" size={20} color={C.ink2} />
                                    <Text className="ml-2 text-ink-2 text-xs font-semibold" numberOfLines={1}>{item.fileName}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {item.isPoll ? (
                        <View className="w-56">
                            <Text className="text-ink font-semibold text-sm mb-3">{item.pollQuestion}</Text>
                            {(item.pollOptions ?? []).map((opt: any, idx: number) => {
                                const totalVotes = item.pollOptions.reduce((acc: number, curr: any) => acc + (curr.votes?.length ?? 0), 0);
                                const percentage = totalVotes === 0 ? 0 : ((opt.votes?.length ?? 0) / totalVotes) * 100;
                                const hasVoted = !!opt.votes?.includes(user?._id);

                                return (
                                    <TouchableOpacity 
                                        key={idx} 
                                        onPress={() => voteInPoll(item._id, idx)}
                                        className={`mb-2 bg-paper-2 rounded-lg overflow-hidden border ${hasVoted ? 'border-fam-career bg-fam-career/10' : 'border-line'}`}
                                    >
                                        <View className="flex-row items-center justify-between p-3 relative">
                                            <View 
                                                className={`absolute left-0 top-0 bottom-0 ${percentage === 100 ? 'bg-fam-career/40' : 'bg-fam-career/15'}`} 
                                                style={{ width: `${percentage}%` }} 
                                            />
                                            <View className="flex-row items-center z-10 flex-1">
                                                <Text className={`text-xs font-semibold ${hasVoted ? 'text-fam-career' : 'text-ink'}`}>{opt.optionText}</Text>
                                                {hasVoted && (
                                                    <Ionicons name="checkmark-circle" size={14} color={C.info} style={{ marginLeft: 6 }} />
                                                )}
                                            </View>
                                            <Text className={`text-label font-display z-10 ${percentage === 100 ? 'text-ink' : 'text-ink-3'}`}>{Math.round(percentage)}%</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <View className="mt-2 pt-2 border-t border-line flex-row items-center justify-between">
                                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                    <Text className="text-ink-3 text-label font-display uppercase">
                                        {(item.pollOptions ?? []).reduce((acc: number, curr: any) => acc + (curr.votes?.length ?? 0), 0)} Votes
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <Text className="text-base text-ink">{item.text}</Text>
                    )}

                    <View className="flex-row justify-end mt-1">
                         <Text className={`text-label font-semibold ${isMine ? 'text-ink-3' : 'text-ink-4'}`}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar
                    title={subGroupName}
                    onBack={() => navigation.goBack()}
                    right={<>
                        <IconBtn name="information-circle-outline" color={C.ink2} onPress={() => navigation.navigate('EditSubGroup', { subGroupId })} />
                        {isRoomAdmin && (
                            <IconBtn name="bar-chart-outline" color={C.ink2} onPress={() => setShowPollModal(true)} />
                        )}
                        {!subGroup?.isGeneral && (
                            <IconBtn name="log-out-outline" color={C.danger} onPress={handleLeaveRoom} />
                        )}
                    </>}
                />

                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                {/* Chat Area */}
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

                {/* Input Area */}
                    <View className="bg-card px-5 py-4 border-t border-line">
                        {canType ? (
                            <View className="flex-row items-end gap-3">
                                <TouchableOpacity 
                                    onPress={handlePickDocument}
                                    className="w-11 h-11 bg-paper-2 rounded-card items-center justify-center mb-1"
                                >
                                    <Feather name="paperclip" size={20} color={C.ink2} />
                                </TouchableOpacity>
                                <View className="flex-1 min-h-[40px] max-h-32 bg-paper-2 rounded-card px-4 border border-line justify-center">
                                    <TextInput placeholderTextColor={C.ink4} 
                                        placeholder="Type message..." 
                                        className="text-ink text-sm font-semibold"
                                        multiline
                                        value={text}
                                        onChangeText={setText}
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={() => handleSend()}
                                    disabled={sending || (!text.trim())}
                                    className={`w-11 h-11 rounded-card items-center justify-center mb-1 ${text.trim() ? 'bg-ink' : 'bg-paper-2'}`}
                                >
                                    {sending ? <ActivityIndicator color={C.paper} size="small" /> : <Feather name="arrow-up" size={24} color={text.trim() ? C.paper : C.ink4} />}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="bg-paper-2 py-4 rounded-card items-center justify-center border border-dashed border-line">
                                <Feather name="lock" size={14} color={C.ink3} />
                                <Text className="text-ink-3 text-label font-display uppercase mt-1">Only admins can send messages</Text>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>

                {/* Poll Creation Modal */}
                <Modal visible={showPollModal} animationType="slide" transparent onRequestClose={() => setShowPollModal(false)}>
                    <KeyboardAvoidingView className="flex-1 bg-black/60 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View className="bg-paper rounded-t-sheet p-card-pad">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-ink font-display uppercase text-h1">Create Poll</Text>
                                <TouchableOpacity onPress={() => setShowPollModal(false)} hitSlop={10}>
                                    <Ionicons name="close" size={28} color={C.ink} />
                                </TouchableOpacity>
                            </View>
                            
                            <TextInput placeholderTextColor={C.ink4} 
                                placeholder="What's your question?"
                                className="bg-paper-2 p-4 rounded-card mb-4 font-semibold text-ink"
                                value={pollQuestion}
                                onChangeText={setPollQuestion}
                            />

                            {pollOptions.map((opt, idx) => (
                                <TextInput placeholderTextColor={C.ink4} 
                                    key={idx}
                                    placeholder={`Option ${idx + 1}`}
                                    className="bg-paper-2 p-4 rounded-xl mb-3 text-ink"
                                    value={opt}
                                    onChangeText={(val) => {
                                        const newOpts = [...pollOptions];
                                        newOpts[idx] = val;
                                        setPollOptions(newOpts);
                                    }}
                                />
                            ))}

                            <TouchableOpacity 
                                onPress={() => setPollOptions([...pollOptions, ''])}
                                className="items-center py-2"
                            >
                                <Text className="text-fam-career font-semibold">+ Add Option</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleCreatePoll}
                                className="bg-ink py-4 mt-6 items-center border-2 border-ink rounded-md"
                            >
                                <Text className="text-paper font-display uppercase">Post Poll</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </SafeAreaView>
        </View>
    );
};

export default SubGroupChat;
