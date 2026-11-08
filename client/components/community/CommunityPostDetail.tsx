import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Button } from '../ui/kit';
import { VoteControl, ago } from './shared';
import CommentsSheet, { CommentsApi } from '../ui/CommentsSheet';

import FyncRefreshControl from '../ui/FyncRefreshControl';
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
            <View className="flex-1 bg-paper">
                <AppBar title={subName} onBack={() => navigation.goBack()} />
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={C.brand[500]} />
                </View>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <View className="flex-1">
                <View className="flex-1">
                    <AppBar title={subName} onBack={() => navigation.goBack()} />

                    <ScrollView keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 24 }}
                        refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPost(); }} tintColor={C.brand[500]} />}
                    >
                        <View className="bg-card mx-5 p-4 rounded-2xl border border-line">
                            <Text className="text-ink-3 mb-2" style={{ fontSize: 12 }} numberOfLines={1}>
                                {post?.author?.username || 'unknown'} · {post ? ago(post.createdAt) : ''}
                            </Text>
                            <Text className="text-ink font-display" style={{ fontSize: 24, lineHeight: 30 }}>{post?.title}</Text>
                            {!!post?.body && <Text className="text-ink-2 mt-3" style={{ fontSize: 15, lineHeight: 22 }}>{post.body}</Text>}
                            {post?.image?.map((url: string) => (
                                <Image key={url} source={{ uri: url }} style={{ width: '100%', height: 224, borderRadius: 12, marginTop: 16, backgroundColor: C.paper2 }} contentFit="cover" cachePolicy="memory-disk" />
                            ))}

                            <View className="flex-row items-center mt-4" style={{ gap: 12 }}>
                                <VoteControl score={post?.score ?? 0} myVote={post?.myVote} onVote={vote} />
                                <Button small variant="tertiary" icon="chatbubble-outline" title={`${post?.commentCount ?? 0} comments`} onPress={() => setCommentsOpen(true)} />
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
