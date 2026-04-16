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
import * as NavigationService from '../../utils/navigation';
 
// Using a stable key for navigation to ensure it survives re-renders
const PUBLIC_PROFILE_SCREEN = 'PublicProfile';

const AdItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-white rounded-2xl mb-4 shadow-sm border border-gray-100 overflow-hidden">
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
                    <TouchableOpacity onPress={() => onEdit(item)} className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-200">
                        <Ionicons name="pencil" size={16} color="#1A1A1A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item._id)} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                        <Ionicons name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </View>
);

const RedemptionItem = ({ item }: any) => {
    // Navigate using the global NavigationService to avoid hook context issues
    const handleViewProfile = () => {
        if (item._id) {
            NavigationService.navigate(PUBLIC_PROFILE_SCREEN, { userId: item._id });
        }
    };

    return (
        <View className="bg-white rounded-2xl mb-4 p-4 shadow-sm border border-gray-100">
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
                <Text className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-2">Items Applied For</Text>
                {item.redeemedItems?.map((prod: any, idx: number) => (
                    <View key={prod._id || idx} className="flex-row items-center gap-2 mb-2 last:mb-0">
                        <Ionicons name="gift-outline" size={14} color="#ec4899" />
                        <Text className="text-zinc-800 font-semibold text-sm">{prod.product_name}</Text>
                        <View className="ml-auto bg-amber-100 px-2 py-0.5 rounded-full">
                            <Text className="text-[10px] text-amber-700 font-bold">{prod.coins_required} 🪙</Text>
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

const AdminPortal = () => {
    const { user } = useAuth();
    
    useEffect(() => {
        if (user && user.user_access !== 'admin') {
            Alert.alert("Access Denied", "You do not have permission to view this screen.");
            NavigationService.goBack();
        }
    }, [user]);

    const [activeTab, setActiveTab] = useState<'ads' | 'rewards'>('ads');
    const [ads, setAds] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingAd, setEditingAd] = useState<any>(null);

    // Form state for Ads
    const [title, setTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
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
            const res = await axios.get('/marketplace/redemptions');
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

    useEffect(() => {
        if (activeTab === 'ads') {
            fetchAds();
        } else {
            fetchRedemptions();
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
        setIsActive(true);
        setImageUri(null);
        setImageUrl('');
        setEditingAd(null);
    };

    const handleSubmit = async () => {
        if (!imageUri && !imageUrl) {
            Toast.show({ type: 'error', text1: 'Please add an image or image URL' });
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            if (imageUri) {
                const filename = imageUri.split('/').pop() || 'ad.jpg';
                const ext = filename.split('.').pop() || 'jpg';
                formData.append('image', {
                    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
                    name: filename,
                    type: `image/${ext}`,
                } as any);
            } else if (imageUrl) {
                formData.append('imageUrl', imageUrl);
            }
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
            setModalVisible(false);
            resetForm();
            fetchAds();
        } catch (e: any) {
            console.error(e?.response?.data || e.message);
            Toast.show({ type: 'error', text1: 'Failed. Try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Ad?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await axios.delete(`/ads/${id}`);
                        setAds(prev => prev.filter(a => a._id !== id));
                        Toast.show({ type: 'success', text1: 'Ad deleted' });
                    } catch {
                        Toast.show({ type: 'error', text1: 'Failed to delete' });
                    }
                }
            }
        ]);
    };

    const handleEdit = (ad: any) => {
        setEditingAd(ad);
        setTitle(ad.title || '');
        setLinkUrl(ad.linkUrl || '');
        setIsActive(ad.isActive);
        setImageUri(null);
        setImageUrl(ad.imageUrl || '');
        setModalVisible(true);
    };

    if (user?.user_access !== 'admin') {
        return null;
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-5 py-4 bg-white border-b border-gray-100">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity onPress={() => NavigationService.goBack()} className="p-1.5 bg-gray-50 rounded-full border border-gray-200">
                            <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-zinc-900 text-xl font-black">Admin Portal</Text>
                            <Text className="text-[10px] text-pink-500 font-bold uppercase tracking-widest">Management System v1.1</Text>
                        </View>
                    </View>
                    {activeTab === 'ads' && (
                        <TouchableOpacity
                            onPress={() => { resetForm(); setModalVisible(true); }}
                            className="bg-zinc-900 px-4 py-2.5 rounded-full shadow-sm"
                        >
                            <Text className="text-white font-bold text-xs uppercase tracking-widest">+ Add Ad</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Tabs */}
                <View className="flex-row p-1 bg-gray-100 rounded-2xl">
                    <TouchableOpacity 
                        onPress={() => setActiveTab('ads')}
                        className={`flex-1 py-2.5 rounded-xl items-center ${activeTab === 'ads' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold text-xs ${activeTab === 'ads' ? 'text-zinc-900' : 'text-gray-500'}`}>Banner Ads</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setActiveTab('rewards')}
                        className={`flex-1 py-2.5 rounded-xl items-center ${activeTab === 'rewards' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`font-bold text-xs ${activeTab === 'rewards' ? 'text-zinc-900' : 'text-gray-500'}`}>Reward Applicants</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#ec4899" size="large" />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'ads' ? ads : redemptions}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => 
                        activeTab === 'ads' ? 
                        <AdItem item={item} onEdit={handleEdit} onDelete={handleDelete} /> : 
                        <RedemptionItem item={item} />
                    }
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View className="mt-20 items-center">
                            <Ionicons name={activeTab === 'ads' ? "image-outline" : "people-outline"} size={48} color="#d1d5db" />
                            <Text className="text-gray-500 mt-4 font-medium text-center">
                                {activeTab === 'ads' ? 'No ads found' : 'No reward applications found'}
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
                                <Text className="text-zinc-900 text-xl font-black">{editingAd ? 'Edit Ad' : 'New Ad Banner'}</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={18} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <TouchableOpacity onPress={pickImage} className="w-full h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center mb-4 overflow-hidden">
                                    {imageUri ? <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" /> : imageUrl ? <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" /> : (
                                        <View className="items-center">
                                            <Ionicons name="image-outline" size={36} color="#9ca3af" />
                                            <Text className="text-gray-400 font-medium text-sm mt-2">Pick banner image</Text>
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
                                    placeholder="Ad Title" 
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4" 
                                />
                                <TextInput 
                                    value={linkUrl} 
                                    onChangeText={setLinkUrl} 
                                    placeholder="Link URL" 
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4" 
                                />

                                <TouchableOpacity 
                                    onPress={handleSubmit} 
                                    disabled={submitting} 
                                    className={`py-4 rounded-xl items-center flex-row justify-center ${submitting ? 'bg-pink-300' : 'bg-pink-500'}`}
                                >
                                    {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest text-xs">{editingAd ? 'Save Changes' : 'Publish Ad'}</Text>}
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
