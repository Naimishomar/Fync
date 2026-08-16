import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView,
    Platform, Image, ActivityIndicator, Alert, Linking, TouchableOpacity,
    Dimensions, Modal, ScrollView, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import axios from "../context/axiosConfig";
import socket from "../utils/socket";
import { useAuth } from "../context/auth.context";
import Avatar from "./Avatar";

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
        const isAlumni = sender?.user_access === 'alumni';

        return (
            <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-end pb-4`}>
                {!isMe && (
                    <Pressable onPress={() => sender && navigation.navigate("PublicProfile", { user: sender })}>
                        <Avatar user={sender} size={32} />
                    </Pressable>
                )}
                <View className={`ml-2 ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                        <View className="flex-row items-center mb-1">
                            <Text className={`text-[10px] font-bold ${isAlumni ? 'text-pink-500' : 'text-blue-500'}`}>
                                {sender?.name} {isAlumni ? '🎓' : '👤'}
                            </Text>
                            {sender?.company && (
                                <Text className="text-[8px] text-gray-500 ml-1 font-medium tracking-tight">• {sender.company}</Text>
                            )}
                        </View>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={() => isMe ? handleDeleteMessage(item._id) : setReplyingTo(item)}
                        className={`max-w-[280px] p-3 rounded-2xl ${isMe ? "bg-zinc-900 rounded-br-none" : "bg-white rounded-bl-none"} shadow-sm border ${isMe ? 'border-zinc-800' : 'border-gray-100'}`}>

                        {item.replyTo && (
                            <View className={`mb-2 p-2 rounded-lg border-l-2 border-pink-500 ${isMe ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                                <Text className="text-pink-500 text-[9px] font-bold">{item.replyTo.sender?.name || "User"}</Text>
                                <Text className={`${isMe ? 'text-gray-400' : 'text-zinc-500'} text-[10px]`} numberOfLines={1}>{item.replyTo.message}</Text>
                            </View>
                        )}

                        {item.messageType === 'text' && (
                            <Text className={`${isMe ? 'text-white' : 'text-zinc-800'} text-[14px] leading-5 font-medium`}>{item.message}</Text>
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
                                className={`flex-row items-center p-2 rounded-lg ${isMe ? 'bg-zinc-800' : 'bg-gray-100'}`}
                            >
                                <Ionicons name="document-text" size={24} color="#ec4899" />
                                <View className="ml-2">
                                    <Text className={`${isMe ? 'text-white' : 'text-zinc-800'} text-xs font-bold`} numberOfLines={1}>{item.fileName || "Document"}</Text>
                                    <Text className="text-gray-500 text-[10px]">Mentorship Resource (Limit 5MB)</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </TouchableOpacity>
                    <Text className="text-[8px] text-gray-400 mt-1 font-bold">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-100 shadow-sm">
                    <View className="flex-row items-center">
                        <Pressable onPress={() => navigation.goBack()} className="mr-2 p-2 bg-gray-50 rounded-full">
                            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                        </Pressable>
                        <View>
                            <Text className="text-zinc-900 font-black text-lg  tracking-tight">Professional <Text className="text-pink-500">Hub</Text></Text>
                            <Text className="text-pink-500 text-[9px] font-bold tracking-widest uppercase">{user?.college} Community</Text>
                        </View>
                    </View>
                    <View className="bg-pink-500 px-3 py-1.5 rounded-full border border-pink-100 shadow-sm shadow-pink-500/20">
                        <Text className="text-white text-[9px] font-black  tracking-tighter">STUDENT-ALUMNI</Text>
                    </View>
                </View>

                <KeyboardAvoidingView
                    behavior="padding"
                    className="flex-1"
                >
                    {loading ? (
                        <ActivityIndicator className="flex-1" color="#ec4899" />
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
                        <Text className="px-5 py-1 text-gray-500 text-[10px] font-bold ">
                            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                        </Text>
                    )}

                    {replyingTo && (
                        <View className="px-4 py-3 bg-white border-t border-gray-100 flex-row items-center justify-between">
                            <View className="border-l-2 border-pink-500 pl-3">
                                <Text className="text-pink-500 text-[10px] font-black uppercase">REPLYING TO {replyingTo.sender?.name}</Text>
                                <Text className="text-gray-500 text-xs mt-0.5 font-medium" numberOfLines={1}>{replyingTo.message}</Text>
                            </View>
                            <Pressable onPress={() => setReplyingTo(null)} className="p-1">
                                <Ionicons name="close-circle" size={20} color="#9ca3af" />
                            </Pressable>
                        </View>
                    )}

                    {showMentions && mentionResults.length > 0 && (
                        <View className="max-h-48 bg-white border-t border-gray-100 shadow-xl">
                            <FlatList
                                data={mentionResults}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => applyMention(item.username)}
                                        className="flex-row items-center px-4 py-3 border-b border-gray-50 active:bg-gray-50"
                                    >
                                        <Image source={{ uri: item.avatar }} className="w-9 h-9 rounded-full border border-gray-100" />
                                        <View className="ml-3">
                                            <Text className="text-zinc-900 font-bold text-sm">@{item.username}</Text>
                                            <Text className="text-gray-500 text-[10px] font-medium">{item.name}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}

                    <View className="p-4 bg-white border-t border-gray-100 shadow-sm">
                        <View className="flex-row items-center bg-gray-50 rounded-3xl px-3 py-1 border border-gray-100">
                            <Pressable onPress={handlePickMedia} className="p-2">
                                <Ionicons name="image-outline" size={24} color="#6b7280" />
                            </Pressable>
                            <Pressable onPress={handlePickDocument} className="p-2">
                                <Ionicons name="attach-outline" size={26} color="#6b7280" />
                            </Pressable>
                            <TextInput
                                value={text}
                                onChangeText={handleTyping}
                                placeholder="Ask alumni anything..."
                                placeholderTextColor="#9ca3af"
                                className="flex-1 text-zinc-900 py-3 px-2 text-[14px] font-medium"
                                multiline
                            />
                            {text.trim().length > 0 && (
                                <Pressable onPress={handleSendText} className="bg-pink-500 p-2.5 rounded-full ml-2 shadow-sm shadow-pink-500/30">
                                    <Ionicons name="send" size={16} color="white" />
                                </Pressable>
                            )}
                        </View>
                        <View className="flex-row items-center justify-center mt-3">
                            <Ionicons name="at-circle" size={14} color="#ec4899" />
                            <Text className="text-[10px] text-gray-500 ml-1 font-bold">Type @ followed by username to tag mentors or peers</Text>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default ProfessionalHub;
