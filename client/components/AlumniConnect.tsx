import React, { useEffect, useState, useRef, useCallback } from "react";
import {View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Linking, TouchableOpacity, Dimensions, Modal, ScrollView} from 'react-native'
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
const { width, height } = Dimensions.get("window");

const AlumniConnect = ({ navigation }: any) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<any[]>([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);
    const [showMembers, setShowMembers] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<any>(null);

    const flatListRef = useRef<FlatList>(null);
    const isAlumni = user?.user_access === 'alumni';

    useEffect(() => {
        if (!isAlumni) {
            Alert.alert("Access Restricted", "This feature is only available for verified alumni.", [
                { text: "Go Back", onPress: () => navigation.goBack() }
            ]);
            return;
        }

        loadMessages();
        loadMembers();

        const roomData = { college: user?.college, graduationYear: user?.graduationYear };
        socket.emit("join_alumni_room", roomData);

        const handleNewMessage = (msg: any) => {
            setMessages((prev) => {
                // 1. If we already have this exact message ID, definitely skip
                if (prev.find((m) => m._id === msg._id)) return prev;

                // 2. Identify if this is a message we (the current user) sent
                const isMyMessage = (msg.sender?._id || msg.sender) === (user?._id || user?.id);

                if (isMyMessage) {
                    // Check if there's a "pending" optimistic message that matches this new real message
                    const pendingIdx = prev.findIndex(m =>
                        m.pending &&
                        (m.message === msg.message || m.fileUrl === msg.fileUrl)
                    );

                    if (pendingIdx > -1) {
                        // Replace the pending message with the real one from the server
                        const newArr = [...prev];
                        newArr[pendingIdx] = msg;
                        return newArr;
                    }
                }

                return [msg, ...prev];
            });
        };

        socket.on("new_alumni_message", handleNewMessage);

        socket.on("delete_alumni_message", (msgId: string) => {
            setMessages((prev) => prev.filter(m => m._id !== msgId));
        });

        socket.on("alumni_user_typing", ({ username }: { username: string }) => {
            setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
        });

        socket.on("alumni_user_stop_typing", ({ username }: { username: string }) => {
            setTypingUsers(prev => prev.filter(u => u !== username));
        });

        return () => {
            socket.emit("leave_alumni_room", roomData);
            socket.off("new_alumni_message");
            socket.off("delete_alumni_message");
            socket.off("alumni_user_typing");
            socket.off("alumni_user_stop_typing");
        };
    }, [user, isAlumni]);

    const loadMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get("/alumni-chat/messages");
            if (res.data.success) {
                const sorted = res.data.messages.sort(
                    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setMessages(sorted);
            }
        } catch (e) {
            console.log("Failed to load alumni messages", e);
        } finally {
            setLoading(false);
        }
    };

    const loadMembers = async () => {
        try {
            const res = await axios.get("/alumni-chat/members");
            if (res.data.success) {
                setMembers(res.data.members);
            }
        } catch (e) {
            console.log("Failed to load alumni members", e);
        }
    };

    const handleSearch = async (q: string) => {
        setSearchQuery(q);
        if (q.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            setIsSearching(true);
            const res = await axios.get(`/alumni-chat/search?q=${q}`);
            if (res.data.success) {
                setSearchResults(res.data.results);
            }
        } catch (e) {
            console.log("Search error", e);
        } finally {
            setIsSearching(false);
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
                company: user?.company,
                role: user?.role
            },
            message: msgText,
            messageType: "text",
            createdAt: new Date().toISOString(),
            pending: true,
        };

        setMessages((prev) => [tempMessage, ...prev]);

        try {
            const res = await axios.post("/alumni-chat/send", { message: msgText, messageType: "text" });
            if (res.data.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? res.data.message : m));
            }
        } catch (e) {
            console.log("Error sending alumni msg", e);
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        Alert.alert(
            "Delete Message",
            "Are you sure you want to delete this message for everyone?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await axios.delete(`/alumni-chat/delete/${msgId}`);
                            if (res.data.success) {
                                // Socket will handle the removal globally, but we can do it locally too
                                setMessages(prev => prev.filter(m => m._id !== msgId));
                            }
                        } catch (e) {
                            console.log("Delete error", e);
                            Alert.alert("Error", "Could not delete message");
                        }
                    }
                }
            ]
        );
    };

    const handleTyping = useCallback((val: string) => {
        setText(val);
        // Debounce typing emission to reduce socket load
        const roomData = { college: user?.college, graduationYear: user?.graduationYear, username: user?.username };
        
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit("alumni_typing", roomData);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("alumni_stop_typing", roomData);
            isTypingRef.current = false;
        }, 3000);
    }, [user]);

    const isTypingRef = useRef(false);

    const handlePickMedia = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.6,
        });

        if (!res.canceled) {
            const filename = res.assets[0].uri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : 'image/jpeg';
            uploadFile(res.assets[0].uri, "image", type, filename || "image.jpg");
        }
    };

    const handlePickDocument = async () => {
        const res = await DocumentPicker.getDocumentAsync({
            type: "application/pdf",
        });

        if (!res.canceled && res.assets && res.assets.length > 0) {
            const asset = res.assets[0];
            if (asset.size && asset.size > 5 * 1024 * 1024) {
                Alert.alert("File Too Large", "Please select a file smaller than 5MB.");
                return;
            }
            uploadFile(asset.uri, "file", asset.mimeType || "application/pdf", asset.name);
        }
    };

    const uploadFile = async (uri: string, type: string, mimeType: string, name: string) => {
        const tempId = "temp_" + Date.now();
        const tempMessage = {
            _id: tempId,
            sender: {
                _id: user?._id || user?.id,
                name: user?.name,
                username: user?.username,
                avatar: user?.avatar,
            },
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
            formData.append("file", {
                uri,
                name,
                type: mimeType
            } as any);

            const res = await axios.post("/alumni-chat/send", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            if (res.data.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? res.data.message : m));
            }
        } catch (e) {
            console.log("Upload error", e);
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
    };

    const renderMessage = useCallback(({ item }: { item: any }) => {
        const isMe = (item.sender?._id || item.sender) === (user?._id || user?.id);
        const sender = typeof item.sender === 'object' ? item.sender : null;

        return (
            <View className={`flex-row w-full ${isMe ? "justify-end" : "justify-start"} items-end pb-4`}>
                {!isMe && (
                    <Avatar user={sender} size={32} />
                )}
                <View className={`ml-2 ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                        <Text className="text-label text-ink-3 mb-1 ml-1">
                            {sender?.name} {sender?.company ? `• ${sender.company}` : ""}
                        </Text>
                    )}
                    <Pressable
                        onLongPress={() => isMe && !item.pending && handleDeleteMessage(item._id)}
                        delayLongPress={500}
                        className={`max-w-[280px] p-3 rounded-card ${isMe ? "bg-brand-600 rounded-br-none" : "bg-ink rounded-bl-none"} border border-white/5`}
                    >
                        {item.messageType === 'text' && (
                            <Text className="text-ink text-sm">{item.message}</Text>
                        )}
                        {item.messageType === 'image' && (
                            <Pressable onPress={() => { }}>
                                <Image source={{ uri: item.fileUrl }} className="w-48 h-48 rounded-lg" resizeMode="cover" />
                            </Pressable>
                        )}
                        {item.messageType === 'file' && (
                            <TouchableOpacity
                                onPress={async () => {
                                    if (item.fileUrl) {
                                        try {
                                            const supported = await Linking.canOpenURL(item.fileUrl);
                                            if (supported) {
                                                await Linking.openURL(item.fileUrl);
                                            } else {
                                                await WebBrowser.openBrowserAsync(item.fileUrl);
                                            }
                                        } catch (error) {
                                            Alert.alert("Error", "Could not open this PDF. Please try again later.");
                                        }
                                    }
                                }}
                                className="flex-row items-center bg-black/20 p-2 rounded-lg"
                            >
                                <Ionicons name="document-text" size={24} color="#F5B700" />
                                <View className="ml-2">
                                    <Text className="text-ink text-xs font-semibold" numberOfLines={1}>{item.fileName || "Document"}</Text>
                                    <Text className="text-ink-3 text-label">Tap to view (Limit 5MB)</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </Pressable>
                    <Text className="text-label text-ink-2 mt-1">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    }, [user?._id, user?.id, handleDeleteMessage]);

    if (!isAlumni) return null;

    return (
        <View className="flex-1 bg-paper">
            

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-line">
                    <View className="flex-row items-center">
                        <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </Pressable>
                        <View>
                            <Text className="text-ink font-display text-lg">{user?.college} Alumni</Text>
                            <Text className="text-accent-text text-xs font-semibold">Class of {user?.graduationYear}</Text>
                        </View>
                    </View>
                    <Pressable onPress={() => setShowMembers(true)} className="bg-card/10 p-2 rounded-full border border-line">
                        <Ionicons name="people" size={20} color="#F5B700" />
                    </Pressable>
                </View>

                {/* Messages */}
                <KeyboardAvoidingView behavior="padding" className="flex-1">
                    {loading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#F5B700" />
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            inverted
                            keyExtractor={(item) => item._id}
                            renderItem={renderMessage}
                            contentContainerStyle={{ padding: 16 }}
                            showsVerticalScrollIndicator={false}
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            windowSize={10}
                            keyboardShouldPersistTaps="handled"
                            removeClippedSubviews={Platform.OS === 'android'}
                        />
                    )}

                    {typingUsers.length > 0 && (
                        <View className="px-5 py-1">
                            <Text className="text-ink-3 text-label">
                                {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                            </Text>
                        </View>
                    )}

                    {/* Input Bar */}
                    <View className="p-3 bg-black/80 border-t border-line">
                        <View className="flex-row items-center bg-ink rounded-card px-3 py-1 border border-white/5">
                            <Pressable onPress={handlePickMedia} className="p-2">
                                <Ionicons name="image" size={22} color="gray" />
                            </Pressable>
                            <Pressable onPress={handlePickDocument} className="p-2">
                                <Ionicons name="attach" size={24} color="gray" />
                            </Pressable>

                            <TextInput
                                value={text}
                                onChangeText={handleTyping}
                                placeholder="Message your batch..."
                                placeholderTextColor="gray"
                                className="flex-1 text-ink py-3 px-2 text-sm"
                                multiline
                            />

                            {text.trim().length > 0 && (
                                <Pressable onPress={handleSendText} className="bg-brand-600 p-2 rounded-full ml-2">
                                    <Ionicons name="send" size={18} color="white" />
                                </Pressable>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Members Modal */}
            <Modal
                visible={showMembers}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowMembers(false)}
            >
                <View className="flex-1 bg-black/95">
                    <SafeAreaView className="flex-1">
                        <View className="flex-row items-center justify-between px-6 py-4 border-b border-line">
                            <Text className="text-ink text-xl font-display">Batch Members</Text>
                            <Pressable onPress={() => setShowMembers(false)}>
                                <Ionicons name="close" size={28} color="white" />
                            </Pressable>
                        </View>

                        {/* Search Bar */}
                        <View className="px-6 py-4">
                            <View className="flex-row items-center bg-ink px-4 py-2 border-2 border-ink rounded-md">
                                <Ionicons name="search" size={18} color="gray" />
                                <TextInput
                                    placeholder="Search by name or company..."
                                    placeholderTextColor="gray"
                                    className="flex-1 text-ink ml-2 h-10"
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                />
                            </View>
                        </View>

                        <FlatList
                            data={searchQuery.length > 0 ? searchResults : members}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                            renderItem={({ item }) => (
                                <Pressable
                                    onPress={() => {
                                        setShowMembers(false);
                                        navigation.navigate("PublicProfile", { user: item });
                                    }}
                                    className="flex-row items-center mb-6"
                                >
                                    <Avatar user={item} size={50} />
                                    <View className="ml-4">
                                        <Text className="text-ink font-semibold text-base">{item.name}</Text>
                                        <Text className="text-ink-3 text-xs">@{item.username}</Text>
                                        {item.company && (
                                            <View className="flex-row items-center mt-1">
                                                <Ionicons name="briefcase" size={10} color="#F5B700" />
                                                <Text className="text-accent-text text-label font-semibold ml-1">{item.role} at {item.company}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="gray" style={{ marginLeft: 'auto' }} />
                                </Pressable>
                            )}
                            ListEmptyComponent={
                                <View className="flex-1 items-center justify-center mt-20">
                                    <ActivityIndicator size="small" color="#F5B700" />
                                    <Text className="text-ink-3 mt-4">No classmates found</Text>
                                </View>
                            }
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
};

export default AlumniConnect;
