import React, { useCallback, useRef, useState } from 'react';
import {View, Text, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, RefreshControl, StatusBar, KeyboardAvoidingView, Platform} from 'react-native'
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

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

const ago = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (Number.isNaN(mins)) return '';
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

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
    const vote = async (post: Post, dir: 1 | -1) => {
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
    };

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

    const renderPost = ({ item }: { item: Post }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('CommunityPostDetail', { postId: item._id, subName })}
            className="bg-card mx-5 mb-3 rounded-card border border-line shadow-hair flex-row overflow-hidden"
        >
            {/* Vote rail */}
            <View className="bg-paper-2 px-3 py-5 items-center justify-start border-r border-line">
                <TouchableOpacity onPress={() => vote(item, 1)} hitSlop={8}>
                    <Ionicons name={item.myVote === 1 ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={26} color={item.myVote === 1 ? '#F97316' : '#8B857E'} />
                </TouchableOpacity>
                <Text className={`font-display text-sm my-1 ${item.myVote === 1 ? 'text-accent-text' : item.myVote === -1 ? 'text-fam-career' : 'text-ink'}`}>
                    {item.score}
                </Text>
                <TouchableOpacity onPress={() => vote(item, -1)} hitSlop={8}>
                    <Ionicons name={item.myVote === -1 ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={26} color={item.myVote === -1 ? '#2563EB' : '#8B857E'} />
                </TouchableOpacity>
            </View>

            <View className="flex-1 p-5">
                <Text className="text-ink-3 font-display text-label uppercase mb-1">
                    {item.author?.username || 'unknown'} · {ago(item.createdAt)}
                </Text>
                <Text className="text-ink font-semibold text-base leading-snug">{item.title}</Text>
                {!!item.body && (
                    <Text numberOfLines={3} className="text-ink-2 text-sm mt-2 leading-snug">{item.body}</Text>
                )}
                {!!item.image?.length && (
                    <Image source={{ uri: item.image[0] }} style={{ width: '100%', height: 176, borderRadius: 20, marginTop: 12 }} contentFit="cover" cachePolicy="memory-disk" />
                )}
                <View className="flex-row items-center mt-3">
                    <Feather name="message-circle" size={14} color={C.ink3} />
                    <Text className="text-ink-3 font-display text-label uppercase ml-2">
                        {item.commentCount} {item.commentCount === 1 ? 'Comment' : 'Comments'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            <View className="flex-1">
                <AppBar
                    title={subName}
                    onBack={() => navigation.goBack()}
                    right={<IconBtn name="add" boxed onPress={() => setComposerOpen(true)} />}
                />

                <View className="flex-row px-5 gap-2 mb-4">
                    {SORTS.map((s) => (
                        <TouchableOpacity
                            key={s.key}
                            onPress={() => changeSort(s.key)}
                            className={`flex-row items-center px-4 h-10 rounded-xl border ${sort === s.key ? 'bg-ink border-ink' : 'bg-card border-line'}`}
                        >
                            <Ionicons name={s.icon as any} size={14} color={sort === s.key ? '#fff' : '#8B857E'} />
                            <Text className={`font-display text-label uppercase ml-2 ${sort === s.key ? 'text-white' : 'text-ink-3'}`}>
                                {s.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

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
                            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setCursor(null); fetchFeed(sort); }} tintColor={C.brand[500]} />
                        }
                        ListEmptyComponent={
                            <View className="bg-paper-2 mx-5 p-card-pad rounded-sheet items-center border border-line border-dashed">
                                <Feather name="feather" size={32} color={C.ink4} />
                                <Text className="font-sans text-sm text-ink-3 mt-4 text-center">Nothing posted yet</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <Modal visible={composerOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setComposerOpen(false)}>
                <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                        <AppBar
                            title="New Post"
                            onBack={() => setComposerOpen(false)}
                            right={<TouchableOpacity
                                onPress={submitPost}
                                disabled={posting || !title.trim()}
                                style={{ marginRight: 11 }}
                                className={`px-5 h-10 rounded-xl items-center justify-center ${posting || !title.trim() ? 'bg-paper-2' : 'bg-ink'}`}
                            >
                                {posting
                                    ? <ActivityIndicator color="white" size="small" />
                                    : <Text className="text-white font-display uppercase text-label">Post</Text>}
                            </TouchableOpacity>}
                        />

                        <View className="p-5 flex-1">
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Title"
                                placeholderTextColor={C.ink3}
                                maxLength={300}
                                className="text-ink text-xl font-display mb-4"
                            />
                            <TextInput
                                value={body}
                                onChangeText={setBody}
                                placeholder="Body (optional)"
                                placeholderTextColor={C.ink3}
                                multiline
                                className="text-ink-2 text-base flex-1 leading-relaxed"
                                textAlignVertical="top"
                            />
                            {!!image && <Image source={{ uri: image }} style={{ width: '100%', height: 160, borderRadius: 20, marginBottom: 12 }} contentFit="cover" />}
                            <TouchableOpacity onPress={pickImage} className="flex-row items-center h-12 px-4 bg-paper-2 rounded-card border border-line">
                                <Feather name="image" size={16} color={C.brand[500]} />
                                <Text className="text-ink-3 font-display uppercase text-label ml-3">
                                    {image ? 'Change Image' : 'Add Image'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}
