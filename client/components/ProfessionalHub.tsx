import React, { useEffect, useState, useRef, useCallback } from "react";
import {View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Linking, TouchableOpacity, Dimensions, Modal, ScrollView, StatusBar} from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import axios from "../context/axiosConfig";
import socket from "../utils/socket";
import { useAuth } from "../context/auth.context";
import Avatar from "./Avatar";
import { Alert } from './ui/AlertModal';

import { RoleSticker } from './ui/kit';
const { width } = Dimensions.get("window");

const ProfessionalHub = ({ navigation }: any) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [mentionResults, setMentionResults] = useState<any[]>([]);
    const [showMentions, setShowMentions] = useState(false);
    const typingTimeoutRef = useRef<any>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages();

        const roomData = { college: user?.college };
        socket.emit("join_mentorship_room", roomData);

        socket.on("new_mentorship_message", (msg: any) => {
            setMessages((prev) => {
                if (prev.find((m) => m._id === msg._id)) return prev;
                const isMyMessage = (msg.sender?._id || msg.sender) === (user?._id || user?.id);

                if (isMyMessage) {
                    const pendingIdx = prev.findIndex(m =>
                        m.pending &&
                        (m.message === msg.message || m.fileUrl === msg.fileUrl)
                    );

                    if (pendingIdx !== -1) {
                        const newMessages = [...prev];
                        newMessages[pendingIdx] = msg;
                        return newMessages;
                    }
                }

                return [msg, ...prev];
            });
        });

        socket.on("delete_mentorship_message", (msgId: string) => {
            setMessages((prev) => prev.filter(m => m._id !== msgId));
        });

        socket.on("mentorship_user_typing", ({ username }: { username: string }) => {
            setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
        });

        socket.on("mentorship_user_stop_typing", ({ username }: { username: string }) => {
            setTypingUsers(prev => prev.filter(u => u !== username));
        });

        return () => {
            socket.emit("leave_mentorship_room", roomData);
            socket.off("new_mentorship_message");
            socket.off("delete_mentorship_message");
            socket.off("mentorship_user_typing");
            socket.off("mentorship_user_stop_typing");
        };
    }, [user]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/mentorship-chat/messages");
            if (res.data.success) {
                setMessages(res.data.messages);
            }
        } catch (e) {
            console.log("Failed to load mentorship messages", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSendText = async () => {
        if (!text.trim()) return;
        const msgText = text;
        setText("");

        const tempId = "temp_" + Date.now();
        const tempMessage = {
            _id: tempId,
            sender: {
                _id: user?._id || user?.id,
                name: user?.name,
                username: user?.username,
                avatar: user?.avatar,
                user_access: user?.user_access
            },
            message: msgText,
            messageType: "text",
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages((prev) => [tempMessage, ...prev]);

        try {
            const res = await axios.post("/mentorship-chat/send", {
                message: msgText,
                messageType: "text",
                replyTo: replyingTo?._id || null
            });
            if (res.data.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? { ...res.data.message, pending: false } : m));
            }
        } catch (e) {
            console.log("Error sending mentorship msg", e);
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
        setReplyingTo(null);
    };

    const handleTyping = (val: string) => {
        setText(val);
        socket.emit("mentorship_typing", { college: user?.college, username: user?.username });

        const mentionMatch = val.match(/@(\w*)$/);

        if (mentionMatch) {
            const query = mentionMatch[1];
            setShowMentions(true);
            searchMentions(query);
        } else {
            setShowMentions(false);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("mentorship_stop_typing", { college: user?.college, username: user?.username });
        }, 2000);
    };

    const searchMentions = async (q: string) => {
        try {
            const res = await axios.get(`/chat/search?q=${q}`);
            if (res.data.success) {
                setMentionResults(res.data.users || []);
            }
        } catch (e) {
            console.log("Mention search error", e);
        }
    };

    const applyMention = (username: string) => {
        const newText = text.replace(/@(\w*)$/, `@${username} `);
        setText(newText);
        setShowMentions(false);
    };

    const handlePickMedia = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
        });

        if (!res.canceled) {
            const asset = res.assets[0];
            uploadFile(asset.uri, "image", "image/jpeg", asset.fileName || "image.jpg");
        }
    };

    const handlePickDocument = async () => {
        const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });

        if (!res.canceled && res.assets && res.assets.length > 0) {
            const asset = res.assets[0];
            if (asset.size && asset.size > 5 * 1024 * 1024) {
                Alert.alert("File Too Large", "Please select a file smaller than 5MB.");
                return;
            }
            uploadFile(asset.uri, "file", asset.mimeType || "application/pdf", asset.name);
        }
    };

    const handleDeleteMessage = (msgId: string) => {
        Alert.alert("Delete Message", "Are you sure you want to delete this message?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        const res = await axios.delete(`/mentorship-chat/delete/${msgId}`);
                        if (res.data.success) {
                            setMessages(prev => prev.filter(m => m._id !== msgId));
                        }
                    } catch (e) {
                        console.log("Delete error", e);
                    }
                }
            }
        ]);
    };

    const uploadFile = async (uri: string, type: string, mimeType: string, name: string) => {
        const tempId = "temp_" + Date.now();
        const tempMessage = {
            _id: tempId,
            sender: user,
            message: "",
            messageType: type,
            fileUrl: uri,
            fileName: name,
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages((prev) => [tempMessage, ...prev]);

        try {
            const formData = new FormData();
            formData.append("messageType", type);
            formData.append("fileName", name);
            formData.append("file", { uri, name, type: mimeType } as any);

            const res = await axios.post("/mentorship-chat/send", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? res.data.message : m));
            }
        } catch (e) {
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
    };

    const renderMessage = ({ item }: { item: any }) => {
        const isMe = (item.sender?._id || item.sender) === (user?._id || user?.id);
        const sender = typeof item.sender === 'object' ? item.sender : null;

        return (
            <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-end pb-4`}>
                {!isMe && (
                    <Pressable onPress={() => sender && navigation.navigate("PublicProfile", { user: sender })}>
                        <Avatar user={sender} size={32} />
                    </Pressable>
                )}
                <View className={`ml-2 ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                        <View className="flex-row items-center mb-1" style={{ gap: 6 }}>
                            {/* Name reads as a name, not as a coloured status. The
                                role is carried by the sticker and the avatar ring,
                                so colour is never doing the job alone — and the
                                emoji is gone, per the icon rule. */}
                            <Text className="font-semibold text-sm text-ink">
                                {sender?.name}
                            </Text>
                            <RoleSticker role={sender?.user_access} />
                            {sender?.company && (
                                <Text className="font-sans text-label text-ink-3">· {sender.company}</Text>
                            )}
                        </View>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={() => isMe ? handleDeleteMessage(item._id) : setReplyingTo(item)}
                        className={`max-w-[280px] p-3 rounded-card ${isMe ? "bg-ink rounded-br-none" : "bg-card rounded-bl-none"} shadow-hair border ${isMe ? 'border-ink' : 'border-line'}`}>

                        {item.replyTo && (
                            <View className={`mb-2 p-2 rounded-lg border-l-2 border-brand-500 ${isMe ? 'bg-ink' : 'bg-paper-2'}`}>
                                <Text className="text-accent-text text-label font-semibold">{item.replyTo.sender?.name || "User"}</Text>
                                <Text className={`${isMe ? 'text-ink-3' : 'text-ink-3'} text-label`} numberOfLines={1}>{item.replyTo.message}</Text>
                            </View>
                        )}

                        {item.messageType === 'text' && (
                            <Text className={`${isMe ? 'text-white' : 'text-ink'} text-sm leading-5 font-medium`}>{item.message}</Text>
                        )}
                        {item.messageType === 'image' && (
                            <Image source={{ uri: item.fileUrl }} className="w-52 h-52 rounded-lg" resizeMode="cover" />
                        )}
                        {item.messageType === 'file' && (
                            <TouchableOpacity
                                onPress={async () => {
                                    if (item.fileUrl) {
                                        try {
                                            await WebBrowser.openBrowserAsync(item.fileUrl);
                                        } catch (error) {
                                            Alert.alert("Error", "Could not open this PDF. Please try again later.");
                                        }
                                    }
                                }}
                                className={`flex-row items-center p-2 rounded-lg ${isMe ? 'bg-ink' : 'bg-paper-2'}`}
                            >
                                <Ionicons name="document-text" size={24} color="#F97316" />
                                <View className="ml-2">
                                    <Text className={`${isMe ? 'text-white' : 'text-ink'} text-xs font-semibold`} numberOfLines={1}>{item.fileName || "Document"}</Text>
                                    <Text className="text-ink-3 text-label">Mentorship Resource (Limit 5MB)</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>
                    <Text className="text-label text-ink-3 mt-1 font-semibold">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-paper-2">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4 bg-card border-b border-line shadow-hair">
                    <View className="flex-row items-center">
                        <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                            <Ionicons name="arrow-back" size={22} color="#12100E" />
                        </Pressable>
                        <View>
                            <Text className="text-ink font-semibold text-lg">Professional <Text className="text-accent-text">Hub</Text></Text>
                            <Text className="text-accent-text text-label font-semibold uppercase">{user?.college} Community</Text>
                        </View>
                    </View>
                    <View
                        className="bg-brand-200 px-2.5 py-1 border-2 border-ink"
                        style={{
                            borderRadius: 4, transform: [{ rotate: '-1.6deg' }],
                            shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0,
                            shadowOffset: { width: 2, height: 2 }, elevation: 0,
                        }}
                    >
                        <Text className="font-display text-ink uppercase" style={{ fontSize: 10, letterSpacing: 1 }}>
                            Student-Alumni
                        </Text>
                    </View>
                </View>

                <KeyboardAvoidingView
                    behavior="padding"
                    className="flex-1"
                >
                    {loading ? (
                        <ActivityIndicator className="flex-1" color="#F97316" />
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            inverted
                            keyExtractor={(item) => item._id}
                            renderItem={renderMessage}
                            contentContainerStyle={{ padding: 16 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        />
                    )}

                    {typingUsers.length > 0 && (
                        <Text className="px-5 py-1 text-ink-3 text-label font-semibold">
                            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                        </Text>
                    )}

                    {replyingTo && (
                        <View className="px-4 py-3 bg-card border-t border-line flex-row items-center justify-between">
                            <View className="border-l-2 border-brand-500 pl-3">
                                <Text className="text-accent-text text-label font-display uppercase">REPLYING TO {replyingTo.sender?.name}</Text>
                                <Text className="text-ink-3 text-xs mt-0.5 font-medium" numberOfLines={1}>{replyingTo.message}</Text>
                            </View>
                            <Pressable onPress={() => setReplyingTo(null)} className="p-1">
                                <Ionicons name="close-circle" size={20} color="#C4BEB6" />
                            </Pressable>
                        </View>
                    )}

                    {showMentions && mentionResults.length > 0 && (
                        <View className="max-h-48 bg-card border-t border-line shadow-hair">
                            <FlatList
                                data={mentionResults}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => applyMention(item.username)}
                                        className="flex-row items-center px-4 py-3 border-b border-line active:bg-paper-2"
                                    >
                                        <Image source={{ uri: item.avatar }} className="w-9 h-9 rounded-full border border-line" />
                                        <View className="ml-3">
                                            <Text className="text-ink font-semibold text-sm">@{item.username}</Text>
                                            <Text className="text-ink-3 text-label font-medium">{item.name}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}

                    <View className="p-4 bg-card border-t border-line shadow-hair">
                        <View className="flex-row items-center bg-paper-2 rounded-card px-3 py-1 border border-line">
                            <Pressable onPress={handlePickMedia} className="p-2">
                                <Ionicons name="image-outline" size={24} color="#8B857E" />
                            </Pressable>
                            <Pressable onPress={handlePickDocument} className="p-2">
                                <Ionicons name="attach-outline" size={26} color="#8B857E" />
                            </Pressable>
                            <TextInput
                                value={text}
                                onChangeText={handleTyping}
                                placeholder="Ask alumni anything..."
                                placeholderTextColor="#C4BEB6"
                                className="flex-1 text-ink py-3 px-2 text-sm font-medium"
                                multiline
                            />
                            {text.trim().length > 0 && (
                                <Pressable onPress={handleSendText} className="bg-brand-500 p-2.5 rounded-full ml-2 shadow-hair">
                                    <Ionicons name="send" size={16} color="#12100E" />
                                </Pressable>
                            )}
                        </View>
                        <View className="flex-row items-center justify-center mt-3">
                            <Ionicons name="at-circle" size={14} color="#F97316" />
                            <Text className="text-label text-ink-3 ml-1 font-semibold">Type @ followed by username to tag mentors or peers</Text>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default ProfessionalHub;
