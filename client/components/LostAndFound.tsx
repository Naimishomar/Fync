import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Animated, StatusBar, Platform } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import socket from '../utils/socket';
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { AppBar, IconBtn, Empty, Button, SegmentedTabs, Tag, Sheet, FormField } from './ui/kit';
import { Image } from 'expo-image';

import FyncRefreshControl from './ui/FyncRefreshControl';
// Module scope: declared inside the screen it was a new component type on every
// render, so each keystroke remounted it and started another endless loop.
const ItemSkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    return (
        <Animated.View style={{ opacity: pulseAnim }} className="bg-card rounded-2xl mb-3 border border-line p-4 flex-row mx-gutter">
            <View className="w-20 h-20 bg-paper-2 rounded-xl mr-4" />
            <View className="flex-1 justify-center">
                <View className="h-4 bg-paper-2 rounded w-3/4 mb-3" />
                <View className="h-3 bg-paper-2 rounded w-1/2 mb-2" />
                <View className="h-6 bg-paper-2 rounded-xl w-1/3 mt-2" />
            </View>
        </Animated.View>
    );
};

// --- TYPES ---
interface LostAndFoundItem {
    _id: string;
    item: string;
    image?: string;
    place: string;
    lostOrFound: 'lost' | 'found';
    found_or_lost_by: {
        _id: string;
        name: string;
        username: string;
        avatar?: string;
    };
    createdAt: string;
    is_found_item_claimed?: boolean;
    is_lost_item_found?: boolean;
}
const TABS = ['lost', 'found'] as const;
const TAB_LABELS = { lost: 'Lost', found: 'Found' };

/** One report. Module scope + memo so the list updates rows instead of remounting. */
const LFRow = memo(function LFRow({ item, tab, isOwner, onClaim, onMessage }: {
    item: LostAndFoundItem; tab: 'lost' | 'found'; isOwner: boolean;
    onClaim: (id: string) => void; onMessage: (u: any) => void;
}) {
    const isResolved = tab === 'lost' ? item.is_lost_item_found : item.is_found_item_claimed;
    const by = item.found_or_lost_by;
    return (
        <View className="mx-gutter mb-3 bg-card rounded-2xl border border-line p-4 flex-row" style={{ gap: 16 }}>
            <View className="w-20 h-20 bg-paper-2 rounded-xl overflow-hidden items-center justify-center" style={isResolved ? { opacity: 0.5 } : undefined}>
                {item.image ? (
                    <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.image} />
                ) : (
                    <Ionicons name="cube-outline" size={28} color={C.ink3} />
                )}
            </View>

            <View className="flex-1" style={{ minWidth: 0 }}>
                <View className="flex-row items-start" style={{ gap: 8 }}>
                    <Text className="text-ink text-base font-semibold flex-1" numberOfLines={1}>{item.item}</Text>
                    {/* Words, not just colour: the tag says lost / found / resolved. */}
                    {isResolved
                        ? <Tag icon="checkmark-circle" label="Resolved" />
                        : <Tag label={tab === 'lost' ? 'Lost' : 'Found'} tone={{ fg: tab === 'lost' ? C.danger : C.success }} />}
                </View>
                <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
                    <Ionicons name="location-outline" size={14} color={C.ink3} />
                    <Text className="text-ink-3 text-sm font-sans flex-1" numberOfLines={1}>{item.place}</Text>
                </View>

                <View className="flex-row items-center justify-between mt-3" style={{ gap: 8 }}>
                    <View className="flex-row items-center flex-1" style={{ minWidth: 0, gap: 8 }}>
                        <Image
                            source={{ uri: by?.avatar || `https://ui-avatars.com/api/?name=${by?.username || 'U'}` }}
                            style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.paper2 }}
                            cachePolicy="memory-disk"
                        />
                        <Text className="text-ink-3 text-sm font-sans flex-shrink" numberOfLines={1}>@{by?.username || 'unknown'}</Text>
                    </View>
                    {isResolved ? null : isOwner ? (
                        <Button small title="Update status" onPress={() => onClaim(item._id)} />
                    ) : (
                        <Button small variant="primary" title="Contact" onPress={() => onMessage(by)} accessibilityLabel={`Contact ${by?.username || 'owner'}`} />
                    )}
                </View>
            </View>
        </View>
    );
});

const LostAndFound = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'lost' | 'found'>('lost');
    const [items, setItems] = useState<LostAndFoundItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const contacting = useRef(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPlace, setNewItemPlace] = useState('');
    const [newItemImage, setNewItemImage] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const navigation = useNavigation<any>();

    // --- FETCH ITEMS ---
    // Only the latest request may write: switching tabs mid-load used to let the
    // other tab's list land on this one.
    const reqId = useRef(0);
    const fetchItems = async (silent = false) => {
        const id = ++reqId.current;
        try {
            // Silent on pull-to-refresh and after an update, so the list is not
            // swapped for skeletons while it is already on screen.
            if (!silent) setLoading(true);
            const endpoint = activeTab === 'lost' ? '/lostAndFound/get/lost' : '/lostAndFound/get/found';
            const res = await axios.get(endpoint);
            if (id !== reqId.current) return;
            setLoadError(false);
            if (res.data?.success) {
                const sorted = (res.data.items || []).sort((a: any, b: any) => {
                    const aStatus = activeTab === 'lost' ? a.is_lost_item_found : a.is_found_item_claimed;
                    const bStatus = activeTab === 'lost' ? b.is_lost_item_found : b.is_found_item_claimed;
                    return Number(aStatus) - Number(bStatus);
                });
                setItems(sorted);
            }
        } catch (error) {
            console.log("Error fetching items", error);
            // A failed tab switch used to leave the other tab's items on screen.
            if (id === reqId.current) { setItems([]); setLoadError(true); }
        } finally {
            if (id === reqId.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    useEffect(() => { fetchItems(); }, [activeTab]);

    // --- CREATE ITEM ---
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: Platform.OS === 'ios',
            quality: 0.7,
        });
        if (!result.canceled) setNewItemImage(result.assets[0]);
    };

    const handleCreateItem = async () => {
        if (!newItemName.trim() || !newItemPlace.trim()) {
            Alert.alert("Error", "Name and Place are required.");
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('item', newItemName);
            formData.append('place', newItemPlace);

            if (newItemImage) {
                // @ts-ignore
                formData.append('productImage', {
                    uri: newItemImage.uri,
                    type: 'image/jpeg',
                    name: 'item.jpg',
                });
            }

            const endpoint = activeTab === 'lost'
                ? '/lostAndFound/create/lost'
                : '/lostAndFound/create/found';

            const res = await axios.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data.success) {
                Alert.alert("Success", "Incident reported to HQ.");
                setModalVisible(false);
                setNewItemName('');
                setNewItemPlace('');
                setNewItemImage(null);
                fetchItems(true);
            }
        } catch (error) {
            Alert.alert("Error", "Transmission failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClaimItem = async (itemId: string) => {
        const title = activeTab === 'lost' ? "Recovery Confirmed?" : "Handover Confirmed?";
        const message = activeTab === 'lost'
            ? "Have you recovered your lost asset?"
            : "Has the artifact been handed over to its owner?";

        Alert.alert(title, message, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Confirm",
                onPress: async () => {
                    try {
                        const endpoint = activeTab === 'lost'
                            ? `/lostAndFound/claimed/lost/${itemId}`
                            : `/lostAndFound/claimed/found/${itemId}`;

                        const res = await axios.post(endpoint, { claimed_by: user?._id });

                        if (res.data.success) {
                            Alert.alert("HQ Synced", "Incident status updated.");
                            fetchItems(true);
                        }
                    } catch (error) {
                        Alert.alert("Error", "Sync failed.");
                    }
                }
            }
        ]);
    };

    const handleMessage = async (targetUser: any) => {
        if (!targetUser?._id || contacting.current) return;
        contacting.current = true;
        try {
            const response = await axios.post("/chat/start", { userId: targetUser._id });
            const conversationId = response.data.conversation._id;

            socket.emit("join", { conversationId });

            navigation.navigate("Chat", {
                conversationId,
                otherUser: {
                    _id: targetUser._id,
                    name: targetUser.name || targetUser.username,
                    username: targetUser.username,
                    avatar: targetUser.avatar || `https://ui-avatars.com/api/?name=${targetUser.username}`
                }
            });
        } catch (error: any) {
            Alert.alert("Error", "Could not initiate contact protocol.");
        } finally {
            contacting.current = false;
        }
    };

    const claimRef = useRef(handleClaimItem);
    claimRef.current = handleClaimItem;
    const messageRef = useRef(handleMessage);
    messageRef.current = handleMessage;
    const onClaim = useCallback((id: string) => claimRef.current(id), []);
    const onMessage = useCallback((u: any) => messageRef.current(u), []);
    const renderItem = useCallback(({ item }: { item: LostAndFoundItem }) => (
        <LFRow item={item} tab={activeTab} isOwner={item.found_or_lost_by?._id === user?._id} onClaim={onClaim} onMessage={onMessage} />
    ), [activeTab, user?._id, onClaim, onMessage]);

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    title="Lost & found"
                    onBack={() => navigation.goBack()}
                    right={<IconBtn name="add" boxed onPress={() => setModalVisible(true)} accessibilityLabel={activeTab === 'lost' ? 'Report a lost item' : 'Report a found item'} />}
                />
                <View className="px-gutter mb-4">
                    <SegmentedTabs items={TABS} labels={TAB_LABELS} value={activeTab} onChange={setActiveTab} />
                </View>

                {loading && !refreshing ? (
                    <View>{[1, 2, 3, 4].map(i => <ItemSkeleton key={i} />)}</View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={items}
                        keyExtractor={item => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(true); }} tintColor={C.brand[500]} />}
                        ListEmptyComponent={loadError ? (
                            <Empty icon="cloud-offline-outline" title="Couldn't load items" action={<Button title="Try again" onPress={() => fetchItems()} />} />
                        ) : (
                            <Empty
                                icon="search-outline"
                                title={activeTab === 'lost' ? 'Nothing lost right now' : 'Nothing found right now'}
                                hint={activeTab === 'lost' ? 'Lost something? Let campus know.' : 'Found something? Help it get home.'}
                                action={<Button variant="primary" title={activeTab === 'lost' ? 'Report lost item' : 'Report found item'} onPress={() => setModalVisible(true)} />}
                            />
                        )}
                    />
                )}
            </View>

            <Sheet
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={activeTab === 'lost' ? 'Report a lost item' : 'Report a found item'}
                subtitle="Others on campus will see this"
                footer={
                    <Button
                        block
                        variant="primary"
                        title="Post report"
                        loading={submitting}
                        onPress={handleCreateItem}
                    />
                }
            >
                <View style={{ gap: 16 }}>
                    <FormField
                        label="Item"
                        value={newItemName}
                        onChangeText={setNewItemName}
                        placeholder="e.g. Blue water bottle"
                    />
                    <FormField
                        label={activeTab === 'lost' ? 'Last seen at' : 'Found at'}
                        value={newItemPlace}
                        onChangeText={setNewItemPlace}
                        placeholder={activeTab === 'lost' ? "Last seen at..." : "Discovered at..."}
                    />
                    <View style={{ gap: 6 }}>
                        <Text className="font-semibold text-ink-2" style={{ fontSize: 13 }}>Photo (optional)</Text>
                        <Pressable
                            onPress={pickImage}
                            accessibilityRole="button"
                            accessibilityLabel={newItemImage ? 'Change photo' : 'Add a photo'}
                            className="items-center justify-center bg-paper-2 rounded-2xl border border-dashed border-line overflow-hidden active:opacity-85"
                            style={{ minHeight: 120 }}
                        >
                            {newItemImage ? (
                                <Image source={{ uri: newItemImage.uri }} style={{ width: '100%', height: 160 }} contentFit="cover" />
                            ) : (
                                <View className="items-center" style={{ gap: 8 }}>
                                    <Ionicons name="camera-outline" size={28} color={C.ink3} />
                                    <Text className="text-ink-3 font-sans text-sm">Add a photo</Text>
                                </View>
                            )}
                        </Pressable>
                    </View>
                </View>
            </Sheet>
        </View>
    );
};

export default LostAndFound;
