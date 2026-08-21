import React, { useState, useEffect, useRef } from 'react';
import {View, Text, FlatList, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator, Pressable, Animated, StatusBar, RefreshControl, ScrollView} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import socket from '../utils/socket';
import { Alert } from './ui/AlertModal';

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

const LostAndFound = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'lost' | 'found'>('lost');
    const [items, setItems] = useState<LostAndFoundItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemPlace, setNewItemPlace] = useState('');
    const [newItemImage, setNewItemImage] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const navigation = useNavigation<any>();

    // --- FETCH ITEMS ---
    const fetchItems = async () => {
        try {
            if (!refreshing) setLoading(true);
            const endpoint = activeTab === 'lost' ? '/lostAndFound/get/lost' : '/lostAndFound/get/found';
            const res = await axios.get(endpoint);
            if (res.data.success) {
                const sorted = (res.data.items || []).sort((a: any, b: any) => {
                    const aStatus = activeTab === 'lost' ? a.is_lost_item_found : a.is_found_item_claimed;
                    const bStatus = activeTab === 'lost' ? b.is_lost_item_found : b.is_found_item_claimed;
                    return Number(aStatus) - Number(bStatus);
                });
                setItems(sorted);
            }
        } catch (error) {
            console.log("Error fetching items", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchItems(); }, [activeTab]);

    // --- CREATE ITEM ---
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled) setNewItemImage(result.assets[0]);
    };

    const handleCreateItem = async () => {
        if (!newItemName || !newItemPlace) {
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
                fetchItems();
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
                            fetchItems();
                        }
                    } catch (error) {
                        Alert.alert("Error", "Sync failed.");
                    }
                }
            }
        ]);
    };

    const handleMessage = async (targetUser: any) => {
        if (!targetUser?._id) return;
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
        }
    };

    const renderItem = ({ item, index }: { item: LostAndFoundItem; index: number }) => {
        const isOwner = item.found_or_lost_by?._id === user?._id;
        const isResolved = activeTab === 'lost' ? item.is_lost_item_found : item.is_found_item_claimed;

        return (
            <View
                className={`mx-gutter mb-6 bg-card rounded-card overflow-hidden ${index === 0 ? 'border-2 border-ink' : 'border border-line'} ${isResolved ? 'opacity-50' : ''}`}
                style={index === 0 ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
            >
                <View className="p-6 flex-row">
                    <View className="w-24 h-24 bg-paper-2 rounded-card mr-6 overflow-hidden border border-line items-center justify-center relative">
                        {item.image ? (
                            <Image source={{ uri: item.image }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <Ionicons name="cube-outline" size={28} color="#C4BEB6" />
                        )}
                        {isResolved && (
                            <View className="absolute inset-0 bg-card/40 items-center justify-center">
                                <Ionicons name="checkmark-circle" size={32} color="#F97316" />
                            </View>
                        )}
                    </View>

                    <View className="flex-1 justify-between py-1">
                        <View>
                            <View className="flex-row justify-between items-start mb-1">
                                <Text className="text-ink text-lg font-display uppercase flex-1 mr-2" numberOfLines={1}>
                                    {item.item}
                                </Text>
                                <View className={`px-3 py-1 rounded-full ${activeTab === 'lost' ? 'bg-danger/10' : 'bg-success/10'}`}>
                                    <Text className={`text-label font-display uppercase ${activeTab === 'lost' ? 'text-danger' : 'text-success'}`}>
                                        {activeTab === 'lost' ? 'Lost' : 'Found'}
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row items-center">
                                <Ionicons name="location" size={10} color="#C4BEB6" />
                                <Text className="text-ink-3 text-label font-display uppercase ml-1.5" numberOfLines={1}>{item.place}</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center justify-between pt-4 mt-2 border-t border-line">
                            <View className="flex-row items-center">
                                <Image
                                    source={{ uri: item.found_or_lost_by.avatar || `https://ui-avatars.com/api/?name=${item.found_or_lost_by.username}` }}
                                    className="w-5 h-5 rounded-full bg-paper-2 border border-line mr-2"
                                />
                                <Text className="text-ink-3 text-label font-display uppercase">
                                    @{item.found_or_lost_by.username}
                                </Text>
                            </View>

                            {isResolved ? (
                                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                    <Text className="text-ink-3 font-display text-label uppercase">
                                        Resolved
                                    </Text>
                                </View>
                            ) : (
                                isOwner ? (
                                    <TouchableOpacity
                                        onPress={() => handleClaimItem(item._id)}
                                        className="bg-ink px-2.5 py-1 rounded-full"
                                    >
                                        <Text className="text-white font-display text-label uppercase">
                                            Update Status
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => handleMessage(item.found_or_lost_by)}
                                        className="bg-brand-500 px-2.5 py-1 rounded-full"
                                    >
                                        <Text className="text-ink font-display text-label uppercase">
                                            Contact Owner
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const ItemSkeleton = () => {
        const pulseAnim = useRef(new Animated.Value(0.3)).current;
        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View style={{ opacity: pulseAnim }} className="bg-card rounded-sheet mb-6 border border-line p-6 flex-row mx-gutter">
                <View className="w-24 h-24 bg-paper-2 rounded-card mr-5" />
                <View className="flex-1 justify-center">
                    <View className="h-4 bg-paper-2 rounded w-3/4 mb-3" />
                    <View className="h-3 bg-paper-2 rounded w-1/2 mb-2" />
                    <View className="h-6 bg-paper-2 rounded-xl w-1/3 mt-2" />
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-gutter pt-6">
                    <View className="flex-row items-center justify-between mb-8">
                        <View>
                            <Text className="text-ink text-3xl font-display uppercase leading-tight">Lost & <Text className="text-accent-text">Found</Text></Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Asset Recovery Protocol</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setModalVisible(true)}
                            className="w-14 h-14 rounded-card items-center justify-center bg-ink shadow-hair"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-card p-1.5 rounded-card mb-8 border border-line shadow-hair">
                        <TouchableOpacity
                            onPress={() => setActiveTab('lost')}
                            className={`flex-1 py-3.5 rounded-xl items-center ${activeTab === 'lost' ? 'bg-ink' : 'bg-transparent'}`}
                        >
                            <Text className={`font-display text-label uppercase ${activeTab === 'lost' ? 'text-white' : 'text-ink-3'}`}>Lost Assets</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('found')}
                            className={`flex-1 py-3.5 rounded-xl items-center ${activeTab === 'found' ? 'bg-brand-500' : 'bg-transparent'}`}
                        >
                            <Text className={`font-display text-label uppercase ${activeTab === 'found' ? 'text-ink' : 'text-ink-3'}`}>Found Units</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View>{[1, 2, 3, 4].map(i => <ItemSkeleton key={i} />)}</View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor="#F97316" />}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Ionicons name="search" size={32} color="#C4BEB6" />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">No Active Signals</Text>
                                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Scanning campus for artifacts...</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 bg-ink/60 justify-end">
                    <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={() => setModalVisible(false)} />
                    <View className="bg-paper rounded-t-sheet h-[80%] shadow-hair overflow-hidden">
                        <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mt-4 mb-2" />

                        <View className="px-gutter py-6 border-b border-line flex-row justify-between items-center bg-card">
                            <View>
                                <Text className="text-ink font-display uppercase text-h1">Report <Text className="text-accent-text">Incident</Text></Text>
                                <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Campus Recovery Protocol</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-paper-2 w-10 h-10 rounded-card items-center justify-center border border-line">
                                <Ionicons name="close" size={20} color="#12100E" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-card-pad" showsVerticalScrollIndicator={false}>
                            <Text className="text-ink-3 text-label font-display uppercase mb-4">Identification</Text>
                            <TextInput
                                value={newItemName}
                                onChangeText={setNewItemName}
                                placeholder="e.g. TITAN v2 Pro (Blue Frame)"
                                placeholderTextColor="#C4BEB6"
                                className="font-semibold text-base text-ink bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair rounded-md"
                            />

                            <Text className="text-ink-3 text-label font-display uppercase mb-4">Location Coordinates</Text>
                            <TextInput
                                value={newItemPlace}
                                onChangeText={setNewItemPlace}
                                placeholder={activeTab === 'lost' ? "Last seen at..." : "Discovered at..."}
                                placeholderTextColor="#C4BEB6"
                                className="font-semibold text-base text-ink bg-card p-5 mb-8 border-[1.5px] border-ink shadow-hair rounded-md"
                            />

                            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                              <Text className="text-ink-3 text-label font-display uppercase">Visual Evidence</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <TouchableOpacity onPress={pickImage} className="flex-row items-center justify-center bg-paper-2 p-card-pad rounded-card mb-10 border border-dashed border-line">
                                {newItemImage ? (
                                    <Image source={{ uri: newItemImage.uri }} className="w-full h-40 rounded-card" resizeMode="cover" />
                                ) : (
                                    <View className="items-center">
                                        <Ionicons name="camera-outline" size={28} color="#C4BEB6" />
                                        <Text className="text-ink-3 font-display uppercase text-label mt-2">Capture Asset Image</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleCreateItem}
                                disabled={submitting}
                                className={`p-5 rounded-card items-center mb-20 shadow-hair ${activeTab === 'lost' ? 'bg-ink ' : 'bg-brand-500 '}`}
                            >
                                {submitting ? <ActivityIndicator color="#12100E" /> : <Text className="text-ink font-display uppercase text-sm">Deploy Report to HQ</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default LostAndFound;
