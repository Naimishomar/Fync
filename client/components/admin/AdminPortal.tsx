import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Modal, TextInput,
    ActivityIndicator, Image, Alert, ScrollView, Switch, Platform,
    KeyboardAvoidingView, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message'; 
 
// Using a stable key for navigation to ensure it survives re-renders
const PUBLIC_PROFILE_SCREEN = 'PublicProfile';

const AdItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-white rounded-2xl mb-4 border border-gray-100 overflow-hidden">
        <Image 
            source={{ uri: item.imageUrl || 'https://via.placeholder.com/300x150?text=No+Image' }} 
            className="w-full h-36" 
            resizeMode="cover" 
        />
        <View className="p-4">
            <View className="flex-row justify-between items-start">
                <View className="flex-1">
                    <Text className="text-zinc-900 font-bold text-sm">{item.title || 'Untitled Ad'}</Text>
                    {item.linkUrl ? (
                        <Text className="text-pink-500 text-xs mt-0.5" numberOfLines={1}>{item.linkUrl}</Text>
                    ) : null}
                </View>
                <View className="flex-row gap-2 ml-2">
                    <TouchableOpacity onPress={() => onEdit(item, 'ad')} className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-200">
                        <Ionicons name="pencil" size={16} color="#1A1A1A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item._id, 'ad')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                        <Ionicons name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </View>
);

const RedemptionItem = ({ item, navigation, onToggleStatus }: any) => {
    // Navigate using the prop to ensure proper context
    const handleViewProfile = () => {
        if (item._id) {
            navigation.navigate(PUBLIC_PROFILE_SCREEN, { userId: item._id });
        }
    };

    return (
        <View className="bg-white rounded-2xl mb-4 p-4 border border-gray-100">
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-10 h-10 rounded-full bg-gray-100" />
                    <View>
                        <Text className="text-zinc-900 font-bold text-base">{item.name}</Text>
                        <Text className="text-gray-500 text-xs text-indigo-500 font-semibold italic">@{item.username}</Text>
                    </View>
                </View>
                <TouchableOpacity 
                    onPress={() => item.mobileNumber && Linking.openURL(`tel:${item.mobileNumber}`)}
                    className="p-2 bg-green-50 rounded-full"
                >
                    <Ionicons name="call" size={18} color="#16a34a" />
                </TouchableOpacity>
            </View>
            
            <View className="bg-gray-50 rounded-xl p-3">
                <Text className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-2">Redemption History</Text>
                {item.redeemedItems?.map((prod: any, idx: number) => (
                    <View key={idx} className="mb-4 last:mb-0 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="gift-outline" size={14} color="#ec4899" />
                            <Text className="text-zinc-800 font-bold text-sm">{prod.product_name}</Text>
                            <View className="ml-auto bg-amber-100 px-2 py-0.5 rounded-full">
                                <Text className="text-[10px] text-amber-700 font-bold">{prod.coins_required} 🪙</Text>
                            </View>
                        </View>
                        <View className="bg-white p-2 rounded-lg border border-gray-100">
                            <View className="flex-row justify-between items-start mb-1.5">
                                <View className="flex-row items-start gap-1.5 flex-1">
                                    <Ionicons name="location-outline" size={12} color="#6b7280" />
                                    <View className="flex-1">
                                        <Text className="text-gray-600 text-[11px] leading-4">{prod.address}</Text>
                                        <Text className="text-zinc-900 font-black text-[10px] mt-0.5">Pincode: {prod.pincode}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity 
                                    onPress={() => onToggleStatus(item._id, prod._id)}
                                    className={`w-7 h-7 rounded-full items-center justify-center border ${prod.isProcessed ? 'bg-green-500 border-green-500' : 'bg-white border-gray-200'}`}
                                >
                                    <Ionicons name="checkmark" size={16} color={prod.isProcessed ? "white" : "#d1d5db"} />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                                <Ionicons name="call-outline" size={12} color="#6b7280" />
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${prod.mobileNumber}`)}>
                                    <Text className="text-indigo-500 text-[11px] font-bold">{prod.mobileNumber}</Text>
                                </TouchableOpacity>
                                {prod.isProcessed && (
                                    <View className="ml-2 bg-green-100 px-1.5 py-0.5 rounded">
                                        <Text className="text-green-700 text-[8px] font-bold uppercase">Processed</Text>
                                    </View>
                                )}
                                <Text className="text-gray-300 text-[10px] ml-auto">{prod.redeemDate ? new Date(prod.redeemDate).toLocaleDateString() : 'No date'}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
            
            <View className="mt-4 flex-row justify-between items-center">
                 <Text className="text-gray-400 text-[10px] font-medium">{item.college}</Text>
                 <TouchableOpacity 
                    onPress={handleViewProfile}
                    className="flex-row items-center gap-1"
                >
                    <Text className="text-pink-500 font-bold text-xs">View Profile</Text>
                    <Ionicons name="chevron-forward" size={12} color="#ec4899" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const AdminPortal = ({ navigation }: any) => {
    const { user } = useAuth();
    
    useEffect(() => {
        if (user && user.user_access !== 'admin') {
            Alert.alert("Access Denied", "You do not have permission to view this screen.");
            navigation.goBack();
        }
    }, [user]);

    const [activeTab, setActiveTab] = useState<'ads' | 'rewards' | 'marketplace' | 'messages'>('ads');
    const [ads, setAds] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingAd, setEditingAd] = useState<any>(null);
    const [editingProduct, setEditingProduct] = useState<any>(null);

    // Form state for Ads & Marketplace
    const [title, setTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [description, setDescription] = useState('');
    const [coins, setCoins] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState('');

    const fetchAds = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/ads/all');
            if (res.data.success) setAds(res.data.ads);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchRedemptions = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/marketplace/redemptions');
            if (res.data.success) {
                setRedemptions(res.data.redemptions);
            }
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch redemptions' });
        } finally {
            setLoading(false);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/marketplace');
            if (res.data.success) setProducts(res.data.products);
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch items' });
        } finally {
            setLoading(false);
        }
    };

    const fetchContactMessages = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/contact-us/messages');
            if (res.data.success) setMessages(res.data.messages);
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch messages' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (userId: string, redemptionId: string) => {
        try {
            const res = await axios.post('/api/marketplace/toggle-status', { userId, redemptionId });
            if (res.data.success) {
                // Update local state
                setRedemptions(prev => prev.map(user => {
                    if (user._id === userId) {
                        return {
                            ...user,
                            redeemedItems: user.redeemedItems.map((item: any) => {
                                if (item._id === redemptionId) {
                                    return { ...item, isProcessed: res.data.isProcessed };
                                }
                                return item;
                            })
                        };
                    }
                    return user;
                }));
                Toast.show({ type: 'success', text1: res.data.message });
            }
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Failed to update status' });
        }
    };

    useEffect(() => {
        if (activeTab === 'ads') {
            fetchAds();
        } else if (activeTab === 'rewards') {
            fetchRedemptions();
        } else if (activeTab === 'marketplace') {
            fetchProducts();
        } else {
            fetchContactMessages();
        }
    }, [activeTab]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setImageUrl('');
        }
    };

    const resetForm = () => {
        setTitle('');
        setLinkUrl('');
        setDescription('');
        setCoins('');
        setIsActive(true);
        setImageUri(null);
        setImageUrl('');
        setEditingAd(null);
        setEditingProduct(null);
    };

    const handleSubmit = async () => {
        if (!imageUri && !imageUrl) {
            Toast.show({ type: 'error', text1: 'Please add an image or image URL' });
            return;
        }

        const isMarketplace = activeTab === 'marketplace';
        
        if (isMarketplace && (!title || !description || !coins)) {
            Toast.show({ type: 'error', text1: 'All fields are required' });
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            if (imageUri) {
                const filename = imageUri.split('/').pop() || (isMarketplace ? 'product.jpg' : 'ad.jpg');
                const ext = filename.split('.').pop() || 'jpg';
                formData.append(isMarketplace ? 'product_image' : 'image', {
                    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
                    name: filename,
                    type: `image/${ext}`,
                } as any);
            } else if (imageUrl) {
                formData.append(isMarketplace ? 'imageUrl' : 'imageUrl', imageUrl);
            }

            if (isMarketplace) {
                formData.append('product_name', title);
                formData.append('product_description', description);
                formData.append('coins_required', coins);
                
                if (editingProduct) {
                    await axios.put(`/api/marketplace/${editingProduct._id}`, {
                        product_name: title,
                        product_description: description,
                        coins_required: coins,
                        is_available: isActive
                    });
                    Toast.show({ type: 'success', text1: 'Item updated!' });
                } else {
                    formData.append('is_available', String(isActive));
                    await axios.post('/api/marketplace/create', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    Toast.show({ type: 'success', text1: 'Item created!' });
                }
                fetchProducts();
            } else {
                formData.append('title', title);
                formData.append('linkUrl', linkUrl);
                formData.append('isActive', String(isActive));

                if (editingAd) {
                    await axios.patch(`/ads/${editingAd._id}`, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    Toast.show({ type: 'success', text1: 'Ad updated!' });
                } else {
                    await axios.post('/ads', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    Toast.show({ type: 'success', text1: 'Ad created!' });
                }
                fetchAds();
            }
            
            setModalVisible(false);
            resetForm();
        } catch (e: any) {
            console.error(e?.response?.data || e.message);
            Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Failed. Try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: string, type: 'ad' | 'product' | 'message' = 'ad') => {
        Alert.alert(type === 'ad' ? 'Delete Ad?' : type === 'product' ? 'Delete Item?' : 'Delete Message?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        if (type === 'ad') {
                            await axios.delete(`/ads/${id}`);
                            setAds(prev => prev.filter(a => a._id !== id));
                        } else if (type === 'product') {
                            await axios.delete(`/api/marketplace/${id}`);
                            setProducts(prev => prev.filter(p => p._id !== id));
                        } else {
                            await axios.delete(`/contact-us/messages/${id}`);
                            setMessages(prev => prev.filter(m => m._id !== id));
                        }
                        Toast.show({ type: 'success', text1: 'Deleted successfully' });
                    } catch {
                        Toast.show({ type: 'error', text1: 'Failed to delete' });
                    }
                }
            }
        ]);
    };

    const handleEdit = (item: any, type: 'ad' | 'product' = 'ad') => {
        if (type === 'ad') {
            setEditingAd(item);
            setTitle(item.title || '');
            setLinkUrl(item.linkUrl || '');
            setIsActive(item.isActive);
            setImageUri(null);
            setImageUrl(item.imageUrl || '');
        } else {
            setEditingProduct(item);
            setTitle(item.product_name || '');
            setDescription(item.product_description || '');
            setCoins(String(item.coins_required || '0'));
            setIsActive(item.is_available !== false); // Default to true if undefined
            setImageUri(null);
            setImageUrl(item.product_image || '');
        }
        setModalVisible(true);
    };

    const MarketPlaceItem = ({ item, onEdit, onDelete }: any) => (
        <View className="bg-white rounded-2xl mb-4 border border-gray-100 overflow-hidden">
            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#f9fafb' }}>
                <Image 
                    source={{ uri: item.product_image || 'https://via.placeholder.com/300x150?text=No+Image' }} 
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain" 
                />
            </View>
            <View className="p-4">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                            <Text className="text-zinc-900 font-bold text-base">{item.product_name}</Text>
                            {!item.is_available && (
                                <View className="bg-red-100 px-2 py-0.5 rounded-md">
                                    <Text className="text-red-600 text-[8px] font-black uppercase">Hidden</Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-gray-500 text-xs mt-1" numberOfLines={2}>{item.product_description}</Text>
                        <View className="flex-row items-center gap-2 mt-2">
                            <View className="bg-amber-100 px-3 py-1 rounded-full self-start">
                                <Text className="text-amber-700 font-black text-[10px] uppercase">
                                    {item.coins_required} 🪙 Coins Required
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View className="flex-row gap-2 ml-2">
                        <TouchableOpacity onPress={() => onEdit(item, 'product')} className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-200">
                            <Ionicons name="pencil" size={16} color="#1A1A1A" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onDelete(item._id, 'product')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                            <Ionicons name="trash" size={16} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    const ContactMessageItem = ({ item, onDelete }: any) => (
        <View className="bg-white rounded-2xl mb-4 p-4 border border-gray-100">
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                    <Text className="text-zinc-900 font-bold text-base">{item.name}</Text>
                    <Text className="text-gray-500 text-xs italic">{item.email}</Text>
                    <Text className="text-gray-400 text-[10px] mt-1">{new Date(item.createdAt).toLocaleString()}</Text>
                </View>
                <TouchableOpacity onPress={() => onDelete(item._id, 'message')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                    <Ionicons name="trash" size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
            <View className="bg-zinc-50 rounded-xl p-3 mb-3">
                <Text className="text-zinc-800 text-sm leading-5">{item.message}</Text>
            </View>
            <View className="flex-row items-center gap-4">
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} className="flex-row items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                    <Ionicons name="call" size={14} color="#16a34a" />
                    <Text className="text-green-700 font-bold text-[10px] uppercase">{item.phone}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} className="flex-row items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                    <Ionicons name="mail" size={14} color="#2563eb" />
                    <Text className="text-blue-700 font-bold text-[10px] uppercase">Reply</Text>
                </TouchableOpacity>
            </View>
            {item.images && item.images.length > 0 && (
                <View className="mt-4 flex-row flex-wrap gap-2">
                    {item.images.map((img: string, i: number) => (
                        <Image key={i} source={{ uri: img }} className="w-16 h-16 rounded-lg bg-gray-100" />
                    ))}
                </View>
            )}
        </View>
    );

    if (user?.user_access !== 'admin') {
        return null;
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-5 py-4 bg-white border-b border-gray-100">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="p-1.5 bg-gray-50 rounded-full border border-gray-200">
                            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-zinc-900 text-xl font-black">Admin Portal</Text>
                            <Text className="text-[10px] text-pink-500 font-bold uppercase tracking-widest">Management System v1.1</Text>
                        </View>
                    </View>
                    {activeTab !== 'rewards' && activeTab !== 'messages' && (
                        <TouchableOpacity
                            onPress={() => { resetForm(); setModalVisible(true); }}
                            className="bg-zinc-900 px-4 py-2.5 rounded-full"
                        >
                            <Text className="text-white font-bold text-xs uppercase tracking-widest">+ {activeTab === 'ads' ? 'Add Ad' : 'Add Item'}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row p-1 bg-gray-100 rounded-2xl max-h-[50px]">
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ads')}
                        className={`px-4 py-2.5 rounded-xl items-center ${activeTab === 'ads' ? 'bg-white' : ''}`}
                    >
                        <Text className={`font-bold text-xs ${activeTab === 'ads' ? 'text-zinc-900' : 'text-gray-500'}`}>Banner Ads</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('marketplace')}
                        className={`px-4 py-2.5 rounded-xl items-center ${activeTab === 'marketplace' ? 'bg-white' : ''}`}
                    >
                        <Text className={`font-bold text-xs ${activeTab === 'marketplace' ? 'text-zinc-900' : 'text-gray-500'}`}>Reward Items</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('rewards')}
                        className={`px-4 py-2.5 rounded-xl items-center ${activeTab === 'rewards' ? 'bg-white' : ''}`}
                    >
                        <Text className={`font-bold text-xs ${activeTab === 'rewards' ? 'text-zinc-900' : 'text-gray-500'}`}>Redemptions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('messages')}
                        className={`px-4 py-2.5 rounded-xl items-center ${activeTab === 'messages' ? 'bg-white' : ''}`}
                    >
                        <Text className={`font-bold text-xs ${activeTab === 'messages' ? 'text-zinc-900' : 'text-gray-500'}`}>Contact Messages</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#ec4899" size="large" />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'ads' ? ads : activeTab === 'marketplace' ? products : activeTab === 'rewards' ? redemptions : messages}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => 
                        activeTab === 'ads' ? 
                        <AdItem item={item} onEdit={handleEdit} onDelete={handleDelete} /> : 
                        activeTab === 'marketplace' ?
                        <MarketPlaceItem item={item} onEdit={handleEdit} onDelete={handleDelete} /> :
                        activeTab === 'rewards' ?
                        <RedemptionItem item={item} navigation={navigation} onToggleStatus={handleToggleStatus} /> :
                        <ContactMessageItem item={item} onDelete={handleDelete} />
                    }
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View className="mt-20 items-center">
                            <Ionicons name={
                                activeTab === 'ads' ? "image-outline" : 
                                activeTab === 'marketplace' ? "gift-outline" : 
                                activeTab === 'rewards' ? "people-outline" :
                                "mail-outline"
                            } size={48} color="#d1d5db" />
                            <Text className="text-gray-500 mt-4 font-medium text-center">
                                {activeTab === 'ads' ? 'No ads found' : 
                                 activeTab === 'marketplace' ? 'No reward items found' : 
                                 activeTab === 'rewards' ? 'No reward applications found' :
                                 'No messages found'}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Create/Edit Modal for Ads */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-end">
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View className="bg-white rounded-t-[36px] p-6 pb-10 border-t border-gray-200">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-zinc-900 text-xl font-black">{editingAd || editingProduct ? 'Edit Item' : activeTab === 'ads' ? 'New Ad Banner' : 'New Reward Item'}</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={18} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <TouchableOpacity 
                                    onPress={pickImage} 
                                    className={`w-full ${activeTab === 'marketplace' ? '' : 'h-40'} bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center mb-4 overflow-hidden`}
                                    style={activeTab === 'marketplace' ? { aspectRatio: 1 } : {}}
                                >
                                    {imageUri ? <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : imageUrl ? <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : (
                                        <View className="items-center">
                                            <Ionicons name="image-outline" size={36} color="#9ca3af" />
                                            <Text className="text-gray-400 font-medium text-sm mt-2">Pick {activeTab === 'marketplace' ? 'item' : 'banner'} image</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TextInput 
                                    value={imageUrl} 
                                    onChangeText={t => { setImageUrl(t); setImageUri(null); }} 
                                    placeholder="Or paste image URL" 
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4" 
                                />
                                <TextInput 
                                    value={title} 
                                    onChangeText={setTitle} 
                                    placeholder={activeTab === 'ads' ? "Ad Title" : "Product Name"} 
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4" 
                                />

                                {activeTab === 'marketplace' && (
                                    <>
                                        <TextInput 
                                            value={description} 
                                            onChangeText={setDescription} 
                                            placeholder="Product Description" 
                                            multiline
                                            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4 min-h-[100px]" 
                                            textAlignVertical="top"
                                        />
                                        <TextInput 
                                            value={coins} 
                                            onChangeText={setCoins} 
                                            placeholder="Coins Required" 
                                            keyboardType="numeric"
                                            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4" 
                                        />
                                    </>
                                )}

                                {activeTab === 'ads' && (
                                    <TextInput 
                                        value={linkUrl} 
                                        onChangeText={setLinkUrl} 
                                        placeholder="Link URL" 
                                        className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4" 
                                    />
                                )}

                                <View className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl mb-6">
                                    <View>
                                        <Text className="text-zinc-900 font-bold text-sm">{activeTab === 'ads' ? 'Ad Visible' : 'Item Available'}</Text>
                                        <Text className="text-gray-400 text-[10px]">Toggling this will hide/show the item</Text>
                                    </View>
                                    <Switch
                                        value={isActive}
                                        onValueChange={setIsActive}
                                        trackColor={{ false: "#e4e4e7", true: "#fbcfe8" }}
                                        thumbColor={isActive ? "#ec4899" : "#a1a1aa"}
                                    />
                                </View>

                                <TouchableOpacity 
                                    onPress={handleSubmit} 
                                    disabled={submitting} 
                                    className={`py-4 rounded-xl items-center flex-row justify-center ${submitting ? 'bg-pink-300' : 'bg-pink-500'}`}
                                >
                                    {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest text-xs">{editingAd || editingProduct ? 'Save Changes' : activeTab === 'ads' ? 'Publish Ad' : 'Add to Store'}</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default AdminPortal;
