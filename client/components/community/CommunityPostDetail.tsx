import React, { useCallback, useState } from 'react';
import {
    View, Text, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator,
    RefreshControl, StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

type Author = { _id: string; name: string; username: string; avatar: string };
type CommentNode = {
    _id: string;
    text: string;
    createdAt: string;
    commentor: Author;
    replyToUser?: { username: string };
    replies?: CommentNode[];
};

const ago = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

export default function CommunityPostDetail() {
    const navigation = useNavigation<any>();
    const { postId, subName } = useRoute<any>().params;
    const { user } = useAuth();

    const [post, setPost] = useState<any>(null);
    const [comments, setComments] = useState<CommentNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [draft, setDraft] = useState('');
    // `rootId` is the top-level ancestor: the comment thread is two levels deep,
    // so a reply to a reply attaches to the same parent but still mentions the
    // person actually being answered.
    const [replyTo, setReplyTo] = useState<{ comment: CommentNode; rootId: string } | null>(null);
    const [sending, setSending] = useState(false);

    const fetchPost = useCallback(async () => {
        try {
            const res = await axios.get(`/communities/posts/${postId}`);
            if (res.data.success) {
                setPost(res.data.post);
                setComments(res.data.comments);
            }
        } catch (err: any) {
            Alert.alert("Unavailable", err.response?.data?.message || "Could not load this post.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [postId]);

    useFocusEffect(useCallback(() => { fetchPost(); }, [fetchPost]));

    const vote = async (dir: 1 | -1) => {
        if (!post) return;
        const target = post.myVote === dir ? 0 : dir;
        const rollback = { myVote: post.myVote, score: post.score };
        setPost((p: any) => ({ ...p, myVote: target, score: p.score + (target - p.myVote) }));
        try {
            const res = await axios.post(`/communities/posts/${postId}/vote`, { dir: target });
            if (res.data.success) setPost((p: any) => ({ ...p, score: res.data.post.score, myVote: res.data.post.myVote }));
        } catch (err: any) {
            setPost((p: any) => ({ ...p, ...rollback }));
            Alert.alert("Vote Failed", err.response?.data?.message || "Try again.");
        }
    };

    const submitComment = async () => {
        if (!draft.trim()) return;
        setSending(true);
        try {
            const res = await axios.post(`/communities/posts/${postId}/comments`, {
                text: draft.trim(),
                ...(replyTo ? { parentComment: replyTo.rootId, replyToUserId: replyTo.comment.commentor?._id } : {}),
            });
            if (res.data.success) {
                setDraft('');
                setReplyTo(null);
                fetchPost();
            }
        } catch (err: any) {
            Alert.alert("Comment Failed", err.response?.data?.message || "Could not post.");
        } finally {
            setSending(false);
        }
    };

    const removeComment = (comment: CommentNode) => {
        Alert.alert("Delete Comment", "This also removes its replies.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        await axios.delete(`/communities/comments/${comment._id}`);
                        fetchPost();
                    } catch (err: any) {
                        Alert.alert("Error", err.response?.data?.message || "Could not delete.");
                    }
                }
            },
        ]);
    };

    const CommentRow = ({ comment, depth, rootId }: { comment: CommentNode; depth: number; rootId: string }) => (
        <View style={{ marginLeft: depth * 16 }} className={depth > 0 ? 'border-l-2 border-slate-100 pl-3' : ''}>
            <View className="py-3">
                <View className="flex-row items-center mb-1">
                    <Text className="text-slate-900 font-black text-2xs uppercase tracking-wide">
                        {comment.commentor?.username || 'unknown'}
                    </Text>
                    <Text className="text-slate-400 font-bold text-2xs ml-2">· {ago(comment.createdAt)}</Text>
                </View>
                {!!comment.replyToUser?.username && depth > 0 && (
                    <Text className="text-orange-500 font-black text-2xs mb-1">@{comment.replyToUser.username}</Text>
                )}
                <Text className="text-slate-700 text-sm leading-snug">{comment.text}</Text>
                <View className="flex-row items-center mt-2 gap-4">
                    <TouchableOpacity onPress={() => setReplyTo({ comment, rootId })}>
                        <Text className="text-slate-400 font-black text-2xs uppercase tracking-wide">Reply</Text>
                    </TouchableOpacity>
                    {String(comment.commentor?._id) === String(user?._id) && (
                        <TouchableOpacity onPress={() => removeComment(comment)}>
                            <Text className="text-slate-400 font-black text-2xs uppercase tracking-wide">Delete</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            {comment.replies?.map((reply) => (
                <CommentRow key={reply._id} comment={reply} depth={depth + 1} rootId={rootId} />
            ))}
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
                <ActivityIndicator size="large" color="#f97316" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                    <View className="px-5 py-2 flex-row items-center">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center">
                            <Ionicons name="chevron-back" size={24} color="#0f172a" />
                        </TouchableOpacity>
                        <Text className="text-slate-900 font-black uppercase text-2xs tracking-wide ml-1">{subName}</Text>
                    </View>

                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 24 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPost(); }} tintColor="#f97316" />}
                    >
                        <View className="bg-white mx-5 p-6 rounded-3xl border border-slate-100 shadow-sm shadow-black/5">
                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-2">
                                {post?.author?.username || 'unknown'} · {post ? ago(post.createdAt) : ''}
                            </Text>
                            <Text className="text-slate-900 text-xl font-black leading-snug tracking-tight">{post?.title}</Text>
                            {!!post?.body && <Text className="text-slate-700 text-base mt-3 leading-relaxed">{post.body}</Text>}
                            {post?.image?.map((url: string) => (
                                <Image key={url} source={{ uri: url }} className="w-full h-56 rounded-2xl mt-4" resizeMode="cover" />
                            ))}

                            <View className="flex-row items-center mt-5 gap-5">
                                <View className="flex-row items-center bg-slate-50 rounded-xl px-3 h-11 border border-slate-100">
                                    <TouchableOpacity onPress={() => vote(1)} hitSlop={8}>
                                        <Ionicons name={post?.myVote === 1 ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={24} color={post?.myVote === 1 ? '#f97316' : '#94a3b8'} />
                                    </TouchableOpacity>
                                    <Text className="text-slate-900 font-black text-sm mx-3">{post?.score ?? 0}</Text>
                                    <TouchableOpacity onPress={() => vote(-1)} hitSlop={8}>
                                        <Ionicons name={post?.myVote === -1 ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={24} color={post?.myVote === -1 ? '#3b82f6' : '#94a3b8'} />
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row items-center">
                                    <Feather name="message-circle" size={15} color="#94a3b8" />
                                    <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide ml-2">
                                        {post?.commentCount ?? 0}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View className="bg-white mx-5 mt-4 px-6 py-2 rounded-3xl border border-slate-100">
                            {comments.length === 0 ? (
                                <Text className="text-slate-400 font-black uppercase text-2xs tracking-wide text-center py-8">
                                    No comments yet
                                </Text>
                            ) : comments.map((c) => <CommentRow key={c._id} comment={c} depth={0} rootId={c._id} />)}
                        </View>
                    </ScrollView>

                    <View className="border-t border-slate-100 bg-white px-5 py-3">
                        {!!replyTo && (
                            <View className="flex-row items-center mb-2">
                                <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide flex-1">
                                    Replying to @{replyTo.comment.commentor?.username}
                                </Text>
                                <TouchableOpacity onPress={() => setReplyTo(null)}>
                                    <Ionicons name="close" size={16} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <View className="flex-row items-center gap-3">
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                placeholder="Add a comment"
                                placeholderTextColor="#94a3b8"
                                multiline
                                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-slate-900 max-h-28"
                            />
                            <TouchableOpacity
                                onPress={submitComment}
                                disabled={sending || !draft.trim()}
                                className={`w-11 h-11 rounded-xl items-center justify-center ${sending || !draft.trim() ? 'bg-slate-200' : 'bg-slate-900'}`}
                            >
                                {sending ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="send" size={17} color="white" />}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
