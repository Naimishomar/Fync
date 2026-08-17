import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, TextInput, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert,
  StatusBar, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';

const SubGroupChat = ({ navigation, route }: any) => {
    const { subGroupId, subGroupName, clubId } = route.params;
    const { user } = useAuth();
    
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [subGroup, setSubGroup] = useState<any>(null);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [clubAdmins, setClubAdmins] = useState<string[]>([]);
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);

    const flatListRef = useRef<FlatList>(null);

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`/clubs/messages/${subGroupId}`);
            if (res.data.success) {
                setMessages(res.data.messages || []);
                setSubGroup(res.data.subGroup);
            }
            
            const clubRes = await axios.get(`/clubs/${clubId}`);
            if (clubRes.data.success) {
                setClubAdmins(clubRes.data.club.admins.map((a: any) => a._id || a));
            }
        } catch (error) {
            console.log("Chat fetch error", error);
        } finally {
            setLoading(false);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 500);
        }
    };

    useEffect(() => {
        fetchMessages();
        socket.emit("join_club_room", { subGroupId });
        
        socket.on('new_club_message', (msg: any) => {
            setMessages(prev => [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
        });

        socket.on('poll_updated', ({ messageId, pollOptions: newOptions }: any) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, pollOptions: newOptions } : m));
        });

        return () => {
            socket.emit("leave_club_room", { subGroupId });
            socket.off('new_club_message');
            socket.off('poll_updated');
        };
    }, [subGroupId]);

    const handleSend = async (fileData?: any) => {
        if (!text.trim() && !fileData && !sending) return;
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
        if (!pollQuestion.trim() || pollOptions.some(o => !o.trim())) return;
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

    const isRoomAdmin = subGroup?.admins?.includes(user?._id) || clubAdmins.includes(user?._id);
    const canType = !subGroup?.onlyAdminsCanMessage || isRoomAdmin;

    const renderMessage = ({ item }: { item: any }) => {
        const isMine = item.sender?._id === user?._id;
        const isAdmin = clubAdmins.includes(item.sender?._id);

        return (
            <View className={`mb-4 flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                    <Image source={{ uri: item.sender?.avatar || 'https://via.placeholder.com/150' }} className="w-8 h-8 rounded-full bg-slate-100 mr-2" />
                )}
                <View className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMine ? 'bg-slate-200' : 'bg-white border border-slate-100'}`}>
                    {!isMine && (
                        <Text className="text-black font-bold text-2xs mb-1">{item.sender?.name} {isAdmin && '• [Admin]'}</Text>
                    )}
                    
                    {item.fileUrl && (
                        <View className="mb-2">
                            {item.fileType === 'image' ? (
                                <Image source={{ uri: item.fileUrl }} className="w-48 h-48 rounded-lg" />
                            ) : (
                                <View className="bg-slate-50 p-2 rounded-lg flex-row items-center border border-slate-100">
                                    <Feather name="file" size={20} color="#71717a" />
                                    <Text className="ml-2 text-slate-600 text-xs font-bold" numberOfLines={1}>{item.fileName}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {item.isPoll ? (
                        <View className="w-56">
                            <Text className="text-slate-900 font-bold text-sm mb-3">{item.pollQuestion}</Text>
                            {item.pollOptions.map((opt: any, idx: number) => {
                                const totalVotes = item.pollOptions.reduce((acc: number, curr: any) => acc + curr.votes.length, 0);
                                const percentage = totalVotes === 0 ? 0 : (opt.votes.length / totalVotes) * 100;
                                const hasVoted = opt.votes.includes(user?._id);

                                return (
                                    <TouchableOpacity 
                                        key={idx} 
                                        onPress={() => voteInPoll(item._id, idx)}
                                        className={`mb-2 bg-slate-50 rounded-lg overflow-hidden border ${hasVoted ? 'border-blue-400 bg-blue-50/30' : 'border-slate-100'}`}
                                    >
                                        <View className="flex-row items-center justify-between p-3 relative">
                                            <View 
                                                className={`absolute left-0 top-0 bottom-0 ${percentage === 100 ? 'bg-blue-300' : 'bg-blue-100'}`} 
                                                style={{ width: `${percentage}%` }} 
                                            />
                                            <View className="flex-row items-center z-10 flex-1">
                                                <Text className={`text-xs font-bold ${hasVoted ? 'text-blue-900' : 'text-slate-800'}`}>{opt.optionText}</Text>
                                                {hasVoted && (
                                                    <Ionicons name="checkmark-circle" size={14} color="#1d4ed8" style={{ marginLeft: 6 }} />
                                                )}
                                            </View>
                                            <Text className={`text-2xs font-black z-10 ${percentage === 100 ? 'text-white' : 'text-slate-500'}`}>{Math.round(percentage)}%</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                            <View className="mt-2 pt-2 border-t border-slate-100 flex-row items-center justify-between">
                                <View className="bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-tight">
                                        {item.pollOptions.reduce((acc: number, curr: any) => acc + curr.votes.length, 0)} Votes
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <Text className={`text-md ${isMine ? 'text-black' : 'text-slate-800'}`}>{item.text}</Text>
                    )}

                    <View className="flex-row justify-end mt-1">
                         <Text className={`text-2xs font-bold ${isMine ? 'text-slate-500' : 'text-slate-300'}`}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                {/* Header */}
                <View className="px-5 py-4 flex-row items-center border-b border-slate-50">
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color="black" />
                    </TouchableOpacity>
                    <View className="ml-4 flex-1">
                        <View className="flex-row items-center">
                            {subGroup?.isGeneral && <MaterialCommunityIcons name="shield-check" size={14} color="#10b981" style={{ marginRight: 4 }} />}
                            <Text className="text-slate-900 font-black uppercase text-xs">{subGroupName}</Text>
                        </View>
                        <Text className="text-green-500 font-bold text-2xs uppercase tracking-wide">{subGroup?.isGeneral ? 'Community Hub' : 'Connected Now'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.navigate('EditSubGroup', { subGroupId })} className="mr-4">
                        <Feather name="info" size={22} color="#52525b" />
                    </TouchableOpacity>
                    {isRoomAdmin && (
                        <TouchableOpacity onPress={() => setShowPollModal(true)} className="mr-4">
                            <MaterialCommunityIcons name="poll" size={24} color="#52525b" />
                        </TouchableOpacity>
                    )}
                    {!subGroup?.isGeneral && (
                        <TouchableOpacity onPress={handleLeaveRoom}>
                            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Chat Area */}
                <View className="flex-1 bg-slate-50">
                    {loading ? (
                        <ActivityIndicator color="#000" className="mt-10" />
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
                        />
                    )}
                </View>

                {/* Input Area */}
                <KeyboardAvoidingView behavior="padding">
                    <View className="bg-white px-5 py-4 border-t border-slate-100">
                        {canType ? (
                            <View className="flex-row items-end gap-3">
                                <TouchableOpacity 
                                    onPress={handlePickDocument}
                                    className="w-11 h-11 bg-slate-100 rounded-2xl items-center justify-center mb-1"
                                >
                                    <Feather name="paperclip" size={20} color="#71717a" />
                                </TouchableOpacity>
                                <View className="flex-1 min-h-[40px] max-h-32 bg-slate-100 rounded-2xl px-4 border border-slate-100 justify-center">
                                    <TextInput 
                                        placeholder="Type message..." 
                                        className="text-slate-900 text-sm font-semibold"
                                        multiline
                                        value={text}
                                        onChangeText={setText}
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={() => handleSend()}
                                    disabled={sending || (!text.trim())}
                                    className={`w-11 h-11 rounded-2xl items-center justify-center mb-1 ${text.trim() ? 'bg-black' : 'bg-slate-200'}`}
                                >
                                    {sending ? <ActivityIndicator color="white" size="small" /> : <Feather name="arrow-up" size={24} color="white" />}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="bg-slate-50 py-4 rounded-2xl items-center justify-center border border-dashed border-slate-200">
                                <Feather name="lock" size={14} color="#a1a1aa" />
                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">Only admins can send messages</Text>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>

                {/* Poll Creation Modal */}
                <Modal visible={showPollModal} animationType="slide" transparent>
                    <View className="flex-1 bg-black/60 justify-end">
                        <View className="bg-white rounded-t-5xl p-8">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-slate-900 text-xl font-black uppercase tracking-widest">Create Poll</Text>
                                <TouchableOpacity onPress={() => setShowPollModal(false)}>
                                    <Ionicons name="close" size={28} color="#000" />
                                </TouchableOpacity>
                            </View>
                            
                            <TextInput 
                                placeholder="What's your question?"
                                className="bg-slate-100 p-4 rounded-2xl mb-4 font-bold"
                                value={pollQuestion}
                                onChangeText={setPollQuestion}
                            />

                            {pollOptions.map((opt, idx) => (
                                <TextInput 
                                    key={idx}
                                    placeholder={`Option ${idx + 1}`}
                                    className="bg-slate-100 p-4 rounded-xl mb-3"
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
                                <Text className="text-blue-600 font-bold">+ Add Option</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleCreatePoll}
                                className="bg-black py-4 rounded-2xl mt-6 items-center"
                            >
                                <Text className="text-white font-black uppercase tracking-widest">Post Poll</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
};

export default SubGroupChat;
