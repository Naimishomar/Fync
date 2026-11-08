import React, { memo, useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Button, Chip, ChipRow, Empty, Sheet, FormField } from '../ui/kit';
import { VoteControl, ago } from './shared';
import { useBottomInset } from '../../constants/layout';

import FyncRefreshControl from '../ui/FyncRefreshControl';
type Post = {
    _id: string;
    title: string;
    body: string;
    image: string[];
    score: number;
    commentCount: number;
    myVote: 1 | 0 | -1;
    createdAt: string;
    author?: { _id: string; name: string; username: string; avatar: string };
};

const SORTS = [
    { key: 'hot', label: 'Hot', icon: 'flame-outline' },
    { key: 'new', label: 'New', icon: 'sparkles-outline' },
    { key: 'top', label: 'Top', icon: 'trophy-outline' },
] as const;

const PostRow = memo(function PostRow({ item, onOpen, onVote }: { item: Post; onOpen: (id: string) => void; onVote: (p: Post, dir: 1 | -1) => void }) {
    return (
        <Pressable
            onPress={() => onOpen(item._id)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            className="bg-card mx-5 mb-3 rounded-2xl border border-line p-4 active:opacity-85"
        >
            <Text className="text-ink-3 mb-1" style={{ fontSize: 12 }} numberOfLines={1}>
                {item.author?.username || 'unknown'} · {ago(item.createdAt)}
            </Text>
            <Text className="text-ink font-semibold" style={{ fontSize: 16, lineHeight: 22 }}>{item.title}</Text>
            {!!item.body && (
                <Text numberOfLines={3} className="text-ink-2 text-sm mt-1">{item.body}</Text>
            )}
            {!!item.image?.length && (
                <Image source={{ uri: item.image[0] }} style={{ width: '100%', height: 176, borderRadius: 12, marginTop: 12, backgroundColor: C.paper2 }} contentFit="cover" cachePolicy="memory-disk" />
            )}
            <View className="flex-row items-center mt-3" style={{ gap: 16 }}>
                <VoteControl score={item.score} myVote={item.myVote} onVote={(d) => onVote(item, d)} />
                <View className="flex-row items-center" style={{ gap: 6 }}>
                    <Ionicons name="chatbubble-outline" size={16} color={C.ink3} />
                    <Text className="text-ink-3" style={{ fontSize: 13 }}>
                        {item.commentCount} {item.commentCount === 1 ? 'comment' : 'comments'}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
});

export default function CommunityFeed() {
    const navigation = useNavigation<any>();
    const { subId, subName } = useRoute<any>().params ?? {};
    const bottomInset = useBottomInset();

    const [sort, setSort] = useState<'hot' | 'new' | 'top'>('hot');
    const [posts, setPosts] = useState<Post[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const [composerOpen, setComposerOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [posting, setPosting] = useState(false);
    // Bumped on every fresh (non-append) load. A response from an older
    // generation — a sort the user already switched away from — is dropped.
    const gen = useRef(0);
    const loadingMoreRef = useRef(false);

    const fetchFeed = useCallback(async (nextSort = sort, append = false, after: string | null = null) => {
        const myGen = append ? gen.current : ++gen.current;
        try {
            const res = await axios.get(`/communities/sub/${subId}/posts`, {
                params: { sort: nextSort, ...(after ? { cursor: after } : {}) },
            });
            if (myGen !== gen.current) return;
            if (res.data.success) {
                setPosts((prev) => (append ? [...prev, ...res.data.posts] : res.data.posts));
                setCursor(res.data.nextCursor);
            }
        } catch (err: any) {
            if (!append) Alert.alert("Feed Unavailable", err.response?.data?.message || "Could not load this room.");
        } finally {
            if (append) loadingMoreRef.current = false;
            if (myGen === gen.current) {
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        }
    }, [subId, sort]);

    useFocusEffect(useCallback(() => { fetchFeed(sort); }, [subId, sort]));

    const changeSort = (next: typeof sort) => {
        if (next === sort) return;
        setSort(next);
        setLoading(true);
        setCursor(null);
    };

    const loadMore = () => {
        // Ref, not state: onEndReached can fire twice before a re-render.
        if (!cursor || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        fetchFeed(sort, true, cursor);
    };

    // The arrow updates before the request resolves, and rolls back if it fails.
    // Waiting for a round-trip on every tap makes a feed feel broken.
    const vote = useCallback(async (post: Post, dir: 1 | -1) => {
        const target = post.myVote === dir ? 0 : dir;
        const delta = target - post.myVote;
        const rollback = { myVote: post.myVote, score: post.score };

        setPosts((prev) => prev.map((p) =>
            p._id === post._id ? { ...p, myVote: target as Post['myVote'], score: p.score + delta } : p
        ));

        try {
            const res = await axios.post(`/communities/posts/${post._id}/vote`, { dir: target });
            if (res.data.success) {
                setPosts((prev) => prev.map((p) =>
                    p._id === post._id ? { ...p, score: res.data.post.score, myVote: res.data.post.myVote } : p
                ));
            }
        } catch (err: any) {
            setPosts((prev) => prev.map((p) => (p._id === post._id ? { ...p, ...rollback } : p)));
            Alert.alert("Vote Failed", err.response?.data?.message || "Try again.");
        }
    }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (!result.canceled) setImage(result.assets[0].uri);
    };

    const submitPost = async () => {
        if (!title.trim()) return Alert.alert("Title Required", "Give your post a title.");
        setPosting(true);
        try {
            const formData = new FormData();
            formData.append('subCommunityId', subId);
            formData.append('title', title.trim());
            formData.append('body', body.trim());
            if (image) {
                const filename = image.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('image', { uri: image, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }
            const res = await axios.post('/communities/posts', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data.success) {
                setComposerOpen(false);
                setTitle(''); setBody(''); setImage(null);
                setSort('new');
                setLoading(true);
                fetchFeed('new');
            }
        } catch (err: any) {
            Alert.alert("Post Failed", err.response?.data?.message || "Could not publish.");
        } finally {
            setPosting(false);
        }
    };

    const openPost = useCallback((postId: string) => navigation.navigate('CommunityPostDetail', { postId, subName }), [navigation, subName]);
    const renderPost = useCallback(({ item }: { item: Post }) => <PostRow item={item} onOpen={openPost} onVote={vote} />, [openPost, vote]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <AppBar
                title={subName}
                onBack={() => navigation.goBack()}
                right={<IconBtn name="add" boxed onPress={() => setComposerOpen(true)} accessibilityLabel="New post" />}
            />

            <ChipRow style={{ marginBottom: 12 }}>
                {SORTS.map((s) => (
                    <Chip key={s.key} icon={s.icon} label={s.label} active={sort === s.key} onPress={() => changeSort(s.key)} />
                ))}
            </ChipRow>

            {loading ? (
                <ActivityIndicator size="large" color={C.brand[500]} className="mt-10" />
            ) : (
                <FlatList keyboardShouldPersistTaps="handled"
                    data={posts}
                    keyExtractor={(p) => p._id}
                    renderItem={renderPost}
                    contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                    ListFooterComponent={loadingMore ? <ActivityIndicator color={C.brand[500]} className="my-4" /> : null}
                    refreshControl={
                        <FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setCursor(null); fetchFeed(sort); }} tintColor={C.brand[500]} />
                    }
                    ListEmptyComponent={
                        <Empty
                            icon="create-outline"
                            title="Nothing posted yet"
                            action={<Button title="Write a post" variant="primary" onPress={() => setComposerOpen(true)} />}
                        />
                    }
                />
            )}

            <Sheet
                visible={composerOpen}
                onClose={() => setComposerOpen(false)}
                title="New post"
                footer={<Button title="Post" variant="primary" block loading={posting} disabled={!title.trim()} onPress={submitPost} />}
            >
                <View style={{ gap: 16 }}>
                    <FormField label="Title" placeholder="Title" value={title} onChangeText={setTitle} maxLength={300} />
                    <FormField label="Body" placeholder="Optional" value={body} onChangeText={setBody} multiline />
                    {!!image && <Image source={{ uri: image }} style={{ width: '100%', height: 160, borderRadius: 12 }} contentFit="cover" />}
                    <View className="flex-row">
                        <Button small variant="tertiary" icon="image-outline" title={image ? 'Change image' : 'Add image'} onPress={pickImage} />
                    </View>
                </View>
            </Sheet>
        </View>
    );
}
