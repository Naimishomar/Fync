import React, { useCallback, useState } from 'react';
import {View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, StatusBar} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';
import CommentsSheet, { CommentsApi } from '../ui/CommentsSheet';

// Backend (communityPost.routes): comments come back with the post from
// GET /communities/posts/:id as `comments` (getCommentThread, commentor populated).
// POST takes `parentComment`; DELETE /communities/comments/:id. No update route.
const COMMUNITY_COMMENTS: CommentsApi = {
    list: (id) => `/communities/posts/${id}`,
    add: (id) => `/communities/posts/${id}/comments`,
    // One level of nesting server-side: always the thread's top-level comment,
    // with the replied-to author mentioned.
    body: (text, _parentId, reply) => ({
        text,
        ...(reply ? { parentComment: reply.rootId, replyToUserId: reply.userId } : {}),
    }),
    pick: (data) => data?.comments,
    replies: true,
    remove: (id) => ({ method: 'delete', url: `/communities/comments/${id}` }),
};

const ago = (iso: string) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

export default function CommunityPostDetail() {
    const navigation = useNavigation<any>();
    const { postId, subName } = useRoute<any>().params ?? {};
    const { user } = useAuth();

    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [commentsOpen, setCommentsOpen] = useState(false);

    const fetchPost = useCallback(async () => {
        try {
            const res = await axios.get(`/communities/posts/${postId}`);
            if (res.data.success) {
                setPost(res.data.post);
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
        const rollback = { myVote: post.myVote ?? 0, score: post.score ?? 0 };
        setPost((p: any) => ({ ...p, myVote: target, score: (p.score ?? 0) + (target - (p.myVote ?? 0)) }));
        try {
            const res = await axios.post(`/communities/posts/${postId}/vote`, { dir: target });
            if (res.data.success) setPost((p: any) => ({ ...p, score: res.data.post.score, myVote: res.data.post.myVote }));
        } catch (err: any) {
            setPost((p: any) => ({ ...p, ...rollback }));
            Alert.alert("Vote Failed", err.response?.data?.message || "Try again.");
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-paper items-center justify-center">
                <ActivityIndicator size="large" color={C.brand[500]} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            <View className="flex-1">
                <View className="flex-1">
                    <AppBar title={subName} onBack={() => navigation.goBack()} />

                    <ScrollView
                        contentContainerStyle={{ paddingBottom: 24 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPost(); }} tintColor={C.brand[500]} />}
                    >
                        <View className="bg-card mx-5 p-6 rounded-card border border-line shadow-hair">
                            <Text className="text-ink-3 font-display text-label uppercase mb-2">
                                {post?.author?.username || 'unknown'} · {post ? ago(post.createdAt) : ''}
                            </Text>
                            <Text className="text-ink text-xl font-display leading-snug">{post?.title}</Text>
                            {!!post?.body && <Text className="text-ink-2 text-base mt-3 leading-relaxed">{post.body}</Text>}
                            {post?.image?.map((url: string) => (
                                <Image key={url} source={{ uri: url }} className="w-full h-56 rounded-card mt-4" resizeMode="cover" />
                            ))}

                            <View className="flex-row items-center mt-5 gap-5">
                                <View className="flex-row items-center bg-paper-2 rounded-card px-3 h-11 border border-line">
                                    <TouchableOpacity onPress={() => vote(1)} hitSlop={8}>
                                        <Ionicons name={post?.myVote === 1 ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={24} color={post?.myVote === 1 ? '#F97316' : '#8B857E'} />
                                    </TouchableOpacity>
                                    <Text className="text-ink font-display text-sm mx-3">{post?.score ?? 0}</Text>
                                    <TouchableOpacity onPress={() => vote(-1)} hitSlop={8}>
                                        <Ionicons name={post?.myVote === -1 ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={24} color={post?.myVote === -1 ? '#2563EB' : '#8B857E'} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity onPress={() => setCommentsOpen(true)} hitSlop={8} className="flex-row items-center">
                                    <Feather name="message-circle" size={15} color={C.ink3} />
                                    <Text className="text-ink-3 font-display text-label uppercase ml-2">
                                        {post?.commentCount ?? 0}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                </View>
            </View>

            <CommentsSheet
                visible={commentsOpen}
                onClose={() => setCommentsOpen(false)}
                resource={COMMUNITY_COMMENTS}
                targetId={postId}
                currentUser={user}
                onCountChange={(_id, count) => setPost((p: any) => (p ? { ...p, commentCount: count } : p))}
            />
        </View>
    );
}
