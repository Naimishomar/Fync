import React, { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, StatusBar } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import axios from "../context/axiosConfig";
import socket from "../utils/socket";
import { useAuth } from "../context/auth.context";
import Avatar from "./Avatar";
import { Alert } from './ui/AlertModal';

import { AppBar, Meta, RoleSticker, Tag, ListRow, IconBtn } from './ui/kit';
import { C } from '../constants/colors';

const MentionRow = React.memo(function MentionRow({ item, onPick }: { item: any; onPick: (username: string) => void }) {
    return (
        <ListRow
            leading={<Avatar user={item} size={36} />}
            title={`@${item.username}`}
            subtitle={item.name}
            chevron={false}
            onPress={() => onPick(item.username)}
            style={{ paddingHorizontal: 20 }}
        />
    );
});

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
    const mentionReqRef = useRef(0);

    useEffect(() => {
        loadMessages();

        const roomData = { college: user?.college };
        socket.emit("join_mentorship_room", roomData);

        const onNewMessage = (msg: any) => {
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
        };
        const onDeleteMessage = (msgId: string) => {
            setMessages((prev) => prev.filter(m => m._id !== msgId));
        };
        const onTyping = ({ username }: { username: string }) => {
            setTypingUsers(prev => prev.includes(username) ? prev : [...prev, username]);
        };
        const onStopTyping = ({ username }: { username: string }) => {
            setTypingUsers(prev => prev.filter(u => u !== username));
        };

        socket.on("new_mentorship_message", onNewMessage);
        socket.on("delete_mentorship_message", onDeleteMessage);
        socket.on("mentorship_user_typing", onTyping);
        socket.on("mentorship_user_stop_typing", onStopTyping);

        return () => {
            socket.emit("leave_mentorship_room", roomData);
            socket.off("new_mentorship_message", onNewMessage);
            socket.off("delete_mentorship_message", onDeleteMessage);
            socket.off("mentorship_user_typing", onTyping);
            socket.off("mentorship_user_stop_typing", onStopTyping);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
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
        const replyTo = replyingTo;
        setText("");
        setReplyingTo(null);

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
                replyTo: replyTo?._id || null
            });
            if (res.data.success) {
                setMessages((prev) => prev.map(m => m._id === tempId ? { ...res.data.message, pending: false } : m));
            }
        } catch (e) {
            console.log("Error sending mentorship msg", e);
            setMessages((prev) => prev.filter(m => m._id !== tempId));
        }
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
            mentionReqRef.current++;
            setShowMentions(false);
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("mentorship_stop_typing", { college: user?.college, username: user?.username });
        }, 2000);
    };

    const searchMentions = async (q: string) => {
        // Typing fires one search per keystroke; drop any reply that isn't the latest.
        const reqId = ++mentionReqRef.current;
        try {
            const res = await axios.get(`/chat/search?q=${encodeURIComponent(q)}`);
            if (reqId !== mentionReqRef.current) return;
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

    // Stable so typing in the composer doesn't re-render every visible bubble.
    // handleDeleteMessage only touches state setters, so the first closure is fine.
    const renderMessage = useCallback(({ item }: { item: any }) => {
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
                            {!!sender?.company && (
                                <Text className="font-sans text-label text-ink-3">· {sender.company}</Text>
                            )}
                        </View>
                    )}
                    <Pressable
                        onLongPress={() => isMe ? handleDeleteMessage(item._id) : setReplyingTo(item)}
                        accessibilityHint={isMe ? "Long press to delete" : "Long press to reply"}
                        className={`max-w-[280px] px-4 py-3 rounded-2xl active:opacity-85 ${isMe ? "bg-ink rounded-br-md" : "bg-card rounded-bl-md border border-line"}`}>

                        {item.replyTo && (
                            <View className="mb-2 px-3 py-2 rounded-xl border-l-2 border-brand-500 bg-paper-2">
                                <Text className="text-accent-text text-xs font-semibold">{item.replyTo.sender?.name || "User"}</Text>
                                <Text className="text-ink-3 text-xs" numberOfLines={1}>{item.replyTo.message}</Text>
                            </View>
                        )}

                        {item.messageType === 'text' && (
                            <Text className={`${isMe ? 'text-paper' : 'text-ink'} text-sm leading-5 font-sans`}>{item.message}</Text>
                        )}
                        {item.messageType === 'image' && (
                            <Image source={{ uri: item.fileUrl }} style={{ width: 208, height: 208, borderRadius: 8, backgroundColor: C.paper2 }} contentFit="cover" cachePolicy="memory-disk" />
                        )}
                        {item.messageType === 'file' && (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Open ${item.fileName || "document"}`}
                                onPress={async () => {
                                    if (item.fileUrl) {
                                        try {
                                            await WebBrowser.openBrowserAsync(item.fileUrl);
                                        } catch (error) {
                                            Alert.alert("Error", "Could not open this PDF. Please try again later.");
                                        }
                                    }
                                }}
                                className="flex-row items-center p-2 rounded-xl bg-paper-2 active:opacity-85"
                            >
                                <Ionicons name="document-text" size={24} color={C.brand[500]} />
                                <View className="ml-2">
                                    <Text className="text-ink text-xs font-semibold" numberOfLines={1}>{item.fileName || "Document"}</Text>
                                    <Text className="text-ink-3 text-xs">PDF resource</Text>
                                </View>
                            </Pressable>
                        )}
                    </Pressable>
                    <Text className="text-xs text-ink-3 mt-1 font-sans">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    }, [user?._id, user?.id, navigation]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar
                    title="Professional hub"
                    onBack={() => navigation.goBack()}
                    right={<Tag label="Student-alumni" style={{ marginRight: 11 }} />}
                />

                {user?.college ? (
                    <Meta style={{ paddingHorizontal: 20, paddingVertical: 8 }} numberOfLines={1}>{user.college} Community</Meta>
                ) : null}

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    {loading ? (
                        <ActivityIndicator className="flex-1" color={C.brand[500]} />
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            inverted
                            keyExtractor={(item) => item._id}
                            renderItem={renderMessage}
                            contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 20 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                        />
                    )}

                    {typingUsers.length > 0 && (
                        <Text className="px-gutter py-1 text-ink-3 text-xs font-sans">
                            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                        </Text>
                    )}

                    {replyingTo && (
                        <View className="pl-gutter py-2 bg-card border-t border-line flex-row items-center" style={{ gap: 12 }}>
                            <View className="border-l-2 border-brand-500 pl-3" style={{ flex: 1, minWidth: 0 }}>
                                <Text className="text-accent-text text-xs font-semibold">Replying to {replyingTo.sender?.name}</Text>
                                <Text className="text-ink-3 text-xs mt-0.5 font-sans" numberOfLines={1}>{replyingTo.message}</Text>
                            </View>
                            <IconBtn name="close" size={20} color={C.ink3} onPress={() => setReplyingTo(null)} accessibilityLabel="Cancel reply" style={{ marginRight: 9 }} />
                        </View>
                    )}

                    {showMentions && mentionResults.length > 0 && (
                        <View className="max-h-48 bg-card border-t border-line">
                            <FlatList keyboardShouldPersistTaps="handled"
                                data={mentionResults}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => <MentionRow item={item} onPick={applyMention} />}
                            />
                        </View>
                    )}

                    <View className="px-gutter pt-3 pb-3 bg-card border-t border-line">
                        <View className="flex-row items-center bg-paper-2 rounded-3xl px-1 border border-line" style={{ minHeight: 48 }}>
                            <IconBtn name="image-outline" color={C.ink3} onPress={handlePickMedia} accessibilityLabel="Send a photo" />
                            <IconBtn name="attach-outline" color={C.ink3} onPress={handlePickDocument} accessibilityLabel="Send a PDF" />
                            <TextInput
                                value={text}
                                onChangeText={handleTyping}
                                placeholder="Ask alumni anything"
                                placeholderTextColor={C.ink3}
                                accessibilityLabel="Message"
                                className="flex-1 text-ink py-3 px-1 text-sm font-sans"
                                multiline
                            />
                            {text.trim().length > 0 && (
                                <Pressable
                                    onPress={handleSendText}
                                    accessibilityRole="button"
                                    accessibilityLabel="Send"
                                    className="bg-brand-500 w-10 h-10 rounded-full items-center justify-center m-1 active:opacity-85"
                                    hitSlop={4}
                                >
                                    <Ionicons name="send" size={16} color={C.onBrand} />
                                </Pressable>
                            )}
                        </View>
                        <Text className="text-xs text-ink-3 mt-2 font-sans text-center">Type @ and a username to tag mentors or peers</Text>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default ProfessionalHub;
