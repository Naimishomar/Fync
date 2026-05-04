import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Modal, TextInput,
    ActivityIndicator, Image, Alert, ScrollView, Switch, Platform,
    KeyboardAvoidingView, Linking, BackHandler,
    StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import { AdItem, RedemptionItem, MarketPlaceItem, ReportItem, ContactMessageItem, UserItem, MediaItem } from './AdminComponents';

// Using a stable key for navigation to ensure it survives re-renders
const PUBLIC_PROFILE_SCREEN = 'PublicProfile';


const AdminPortal = ({ navigation }: any) => {
    const { user } = useAuth();

    useEffect(() => {
        if (user && user.user_access !== 'admin') {
            Alert.alert("Access Denied", "You do not have permission to view this screen.");
            navigation.goBack();
        }
    }, [user]);

    const [activeTab, setActiveTab] = useState<'ads' | 'rewards' | 'marketplace' | 'messages' | 'media' | 'reports' | 'users'>('ads');
    const [view, setView] = useState<'hub' | 'feature'>('hub');
    const [ads, setAds] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [fyncMedia, setFyncMedia] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingAd, setEditingAd] = useState<any>(null);
    const [editingProduct, setEditingProduct] = useState<any>(null);

    useEffect(() => {
        const backAction = () => {
            if (view === 'feature') {
                setView('hub');
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [view]);

    // Form state for Ads & Marketplace
    const [title, setTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [description, setDescription] = useState('');
    const [coins, setCoins] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState('');
    const [tags, setTags] = useState('');
    const [userSearch, setUserSearch] = useState('');

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

    const fetchFyncMedia = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/fync-media/all?limit=50');
            if (res.data.success) setFyncMedia(res.data.data);
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch Media' });
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

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/post/admin/reports');
            if (res.data.success) setReports(res.data.reports);
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch reports' });
        } finally {
            setLoading(false);
        }
    };

    const fetchAdminUsers = async (search = '') => {
        try {
            setLoading(true);
            const res = await axios.get(`/user/admin/users?search=${search}`);
            if (res.data.success) setUsers(res.data.users);
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch users' });
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

    const handleToggleMessageReadStatus = async (id: string) => {
        try {
            const res = await axios.patch(`/contact-us/messages/${id}/read`);
            if (res.data.success) {
                setMessages(prev => prev.map(msg =>
                    msg._id === id ? { ...msg, isRead: res.data.isRead } : msg
                ));
                Toast.show({ type: 'success', text1: res.data.message });
            }
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Failed to update message status' });
        }
    };

    useEffect(() => {
        if (activeTab === 'ads') {
            fetchAds();
        } else if (activeTab === 'rewards') {
            fetchRedemptions();
        } else if (activeTab === 'marketplace') {
            fetchProducts();
        } else if (activeTab === 'media') {
            fetchFyncMedia();
        } else if (activeTab === 'reports') {
            fetchReports();
        } else if (activeTab === 'users') {
            if (userSearch.trim()) {
                fetchAdminUsers(userSearch);
            } else {
                setUsers([]);
            }
        } else {
            fetchContactMessages();
        }
    }, [activeTab]);

    const handleToggleBan = async (userId: string, currentBanStatus: boolean) => {
        Alert.alert(
            "Confirm Ban",
            "Are you sure you want to BAN this user? This action will permanently delete their profile and all associated data.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Ban User",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const res = await axios.post(`/user/admin/ban/${userId}`, { isBanned: !currentBanStatus });
                            if (res.data.success) {
                                if (res.data.isDeleted) {
                                    setUsers(prev => prev.filter(u => u._id !== userId));
                                } else {
                                    setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBanned: !currentBanStatus } : u));
                                }
                                Toast.show({ type: 'success', text1: res.data.message });
                            }
                        } catch (e: any) {
                            Toast.show({ type: 'error', text1: e.response?.data?.message || 'Action failed' });
                        }
                    }
                }
            ]
        );
    };

    // Debounced search logic
    useEffect(() => {
        if (activeTab !== 'users') return;
        
        const delayDebounceFn = setTimeout(() => {
            if (userSearch.trim()) {
                fetchAdminUsers(userSearch);
            } else {
                setUsers([]);
            }
        }, 1000);

        return () => clearTimeout(delayDebounceFn);
    }, [userSearch]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            aspect: [16, 9],
            allowsEditing: true
        });
        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setImageUrl('');
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.8,
        });
        if (!result.canceled) {
            setVideoUri(result.assets[0].uri);
        }
    };

    const resetForm = () => {
        setTitle('');
        setLinkUrl('');
        setDescription('');
        setCoins('');
        setVideoUri(null);
        setTags('');
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
        const isMedia = activeTab === 'media';

        if (isMarketplace && (!title || !description || !coins)) {
            Toast.show({ type: 'error', text1: 'All fields are required' });
            return;
        }

        if (isMedia && (!title || !description || (!imageUri && !imageUrl) || !videoUri)) {
            Toast.show({ type: 'error', text1: 'Title, Description, Thumbnail and Video are required' });
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
            } else if (isMedia) {
                const mediaData = new FormData();
                mediaData.append('title', title);
                mediaData.append('description', description);
                mediaData.append('tags', tags);

                if (imageUri) {
                    const filename = imageUri.split('/').pop() || 'thumb.jpg';
                    const ext = filename.split('.').pop() || 'jpg';
                    mediaData.append('thumbnail', {
                        uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
                        name: filename,
                        type: `image/${ext}`,
                    } as any);
                }

                if (videoUri) {
                    const vidFilename = videoUri.split('/').pop() || 'media.mp4';
                    const vidExt = vidFilename.split('.').pop() || 'mp4';
                    mediaData.append('video', {
                        uri: Platform.OS === 'android' ? videoUri : videoUri.replace('file://', ''),
                        name: vidFilename,
                        type: `video/${vidExt}`,
                    } as any);
                }

                await axios.post('/fync-media/create', mediaData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Toast.show({ type: 'success', text1: 'Media published!' });
                fetchFyncMedia();
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

    const handleDelete = (id: string, type: 'ad' | 'product' | 'message' | 'media' | 'report' = 'ad') => {
        Alert.alert(
            type === 'ad' ? 'Delete Ad?' : type === 'product' ? 'Delete Item?' : type === 'report' ? 'Delete Post?' : 'Delete Message?', 
            'This cannot be undone.', [
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
                        } else if (type === 'media') {
                            await axios.delete(`/fync-media/delete/${id}`);
                            setFyncMedia(prev => prev.filter(m => m._id !== id));
                        } else if (type === 'report') {
                            // The report ID is passed as id, but we also need the post ID
                            const report = reports.find(r => r._id === id);
                            if (report) {
                                await axios.post('/post/admin/delete-post', { postId: report.post?._id, reportId: id });
                                setReports(prev => prev.filter(r => r._id !== id));
                            }
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



    if (user?.user_access !== 'admin') {
        return null;
    }

    const HubButton = ({ title, tab, icon, color, description }: { title: string, tab: any, icon: any, color: string, description: string }) => (
        <TouchableOpacity
            onPress={() => { setActiveTab(tab); setView('feature'); }}
            className="mb-4 rounded-[32px] overflow-hidden border border-[#F1F5F9] shadow-sm bg-white"
            activeOpacity={0.9}
        >
            <LinearGradient colors={[`${color}10`, '#fff']} className="flex-1 flex-row items-center p-6">
                <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: `${color}20` }}>
                    <Ionicons name={icon} size={24} color={color} />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-black text-[#1A1A1A] uppercase tracking-[0.5px] mb-1">{title}</Text>
                    <Text className="text-[10px] text-[#64748B] leading-[14px] font-medium">{description}</Text>
                </View>
                <View className="w-8 h-8 rounded-xl bg-[#F8FAFC] justify-center items-center ml-2 border border-[#F1F5F9]">
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    const HubView = () => (
        <ScrollView 
            className="flex-1 px-8 pt-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <Text className="text-[#94A3B8] text-[8px] font-black uppercase tracking-[2px] mb-6">Management Systems</Text>
            
            <HubButton 
                title="Banner Ads" 
                tab="ads" 
                icon="megaphone" 
                color="#f97316" 
                description="Manage campus-wide banner advertisements and promotion campaigns." 
            />
            <HubButton 
                title="User Management" 
                tab="users" 
                icon="people" 
                color="#10b981" 
                description="Oversee student profiles, moderation status, and account access." 
            />
            <HubButton 
                title="Fync Media" 
                tab="media" 
                icon="play-circle" 
                color="#0ea5e9" 
                description="Manage educational content, campus videos, and digital media." 
            />
            <HubButton 
                title="Reported Content" 
                tab="reports" 
                icon="flag" 
                color="#ef4444" 
                description="Review flagged posts and enforce community safety protocols." 
            />
            <HubButton 
                title="Reward Items" 
                tab="marketplace" 
                icon="cart" 
                color="#6366f1" 
                description="Update the Fync store inventory and redemption items." 
            />
            <HubButton 
                title="Redemptions" 
                tab="rewards" 
                icon="gift" 
                color="#a855f7" 
                description="Process student reward claims and inventory payouts." 
            />
            <HubButton 
                title="Contact Messages" 
                tab="messages" 
                icon="mail" 
                color="#64748b" 
                description="Review and respond to official support and inquiry messages." 
            />

            <View className="mt-8 p-6 bg-zinc-900 rounded-[32px] shadow-xl shadow-zinc-900/20">
                <View className="flex-row items-center mb-4">
                    <Ionicons name="stats-chart" size={18} color="#ec4899" />
                    <Text className="text-white font-black text-[10px] uppercase tracking-[2px] ml-3">System Health</Text>
                </View>
                <View className="flex-row justify-between">
                    <View>
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Pending Reports</Text>
                        <Text className="text-white text-xl font-black mt-1">{reports.length}</Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-zinc-500 text-[8px] font-black uppercase">Total Redemptions</Text>
                        <Text className="text-white text-xl font-black mt-1">{redemptions.length}</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Gradient */}
            <LinearGradient 
                colors={['rgba(249, 115, 22, 0.35)', 'rgba(249, 115, 22, 0)']} 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, zIndex: 0 }} 
                pointerEvents="none"
            />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-8 pt-6">
                    <View className="flex-row items-center justify-between mb-8">
                        <View className="flex-row items-center gap-4">
                            <View>
                                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                                    {view === 'hub' ? 'ADMIN PANEL' : activeTab === 'marketplace' ? 'Store' : activeTab.toUpperCase()} <Text className="text-orange-500">{view === 'hub' ? 'PORTAL' : 'CORE'}</Text>
                                </Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-0.5">
                                    {view === 'hub' ? 'Control Center v2.0' : 'Operational Protocol'}
                                </Text>
                            </View>
                        </View>
                        {view === 'feature' && activeTab !== 'rewards' && activeTab !== 'messages' && activeTab !== 'reports' && activeTab !== 'users' && (
                            <TouchableOpacity
                                onPress={() => { resetForm(); setModalVisible(true); }}
                                className="w-14 h-14 bg-zinc-900 rounded-2xl items-center justify-center shadow-2xl shadow-black/40"
                            >
                                <Ionicons name="add" size={28} color="white" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {view === 'feature' && activeTab === 'users' && (
                        <View className="flex-row items-center bg-white p-1.5 rounded-2xl mb-8 border border-slate-100 shadow-sm">
                            <View className="flex-row items-center flex-1 px-4 py-2.5">
                                <Ionicons name="search" size={18} color="#64748B" />
                                <TextInput 
                                    className="flex-1 ml-3 text-[12px] font-black text-[#1A1A1A] uppercase tracking-[0.5px]"
                                    placeholder="Search student signals..."
                                    placeholderTextColor="#CBD5E1"
                                    value={userSearch}
                                    onChangeText={setUserSearch}
                                    onSubmitEditing={() => {
                                        if (userSearch.trim()) fetchAdminUsers(userSearch);
                                        else setUsers([]);
                                    }}
                                    returnKeyType="search"
                                />
                                {userSearch ? (
                                    <TouchableOpacity onPress={() => { setUserSearch(''); setUsers([]); }}>
                                        <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    if (userSearch.trim()) fetchAdminUsers(userSearch);
                                    else setUsers([]);
                                }}
                                className="bg-[#1A1A1A] px-5 py-3 rounded-xl ml-2"
                            >
                                <Text className="text-white font-black text-[10px] uppercase tracking-[1px]">Search</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

            {view === 'hub' ? (
                <HubView />
            ) : (
                loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color="#ec4899" size="large" />
                    </View>
                ) : (
                    <FlatList
                        data={
                            activeTab === 'ads' ? ads : 
                            activeTab === 'marketplace' ? products : 
                            activeTab === 'rewards' ? redemptions : 
                            activeTab === 'reports' ? reports :
                            activeTab === 'users' ? users :
                            messages
                        }
                        keyExtractor={item => item._id}
                        renderItem={({ item }) =>
                            activeTab === 'ads' ?
                                <AdItem item={item} onEdit={handleEdit} onDelete={handleDelete} /> :
                                activeTab === 'media' ?
                                    <MediaItem item={item} onDelete={handleDelete} /> :
                                    activeTab === 'marketplace' ?
                                        <MarketPlaceItem item={item} onEdit={handleEdit} onDelete={handleDelete} /> :
                                        activeTab === 'rewards' ?
                                            <RedemptionItem item={item} navigation={navigation} onToggleStatus={handleToggleStatus} /> :
                                            activeTab === 'reports' ?
                                                <ReportItem item={item} onDelete={handleDelete} /> :
                                                activeTab === 'users' ?
                                                    <UserItem item={item} onToggleBan={handleToggleBan} /> :
                                                    <ContactMessageItem item={item} onDelete={handleDelete} onToggleRead={handleToggleMessageReadStatus} />
                        }
                        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center py-20">
                                <Text className="text-gray-400 font-bold text-sm">
                                    {activeTab === 'ads' ? 'No ads found' :
                                        activeTab === 'marketplace' ? 'No reward items found' :
                                            activeTab === 'rewards' ? 'No reward applications found' :
                                                activeTab === 'reports' ? 'No reported posts' :
                                                    activeTab === 'users' ? 'No users found' :
                                                        'No messages found'}
                                </Text>
                            </View>
                        }
                    />
                )
            )}

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-end">
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View className="bg-white rounded-t-[36px] p-6 pb-10 border-t border-gray-200">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-zinc-900 text-xl font-black">{editingAd || editingProduct ? 'Edit Item' : activeTab === 'ads' ? 'New Ad Banner' : activeTab === 'media' ? 'Publish Fync Media' : 'New Reward Item'}</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={18} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    className={`w-full ${activeTab === 'marketplace' || activeTab === 'media' ? '' : 'h-40'} bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center mb-4 overflow-hidden`}
                                    style={activeTab === 'marketplace' || activeTab === 'media' ? { aspectRatio: 16 / 9 } : {}}
                                >
                                    {imageUri ? <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : imageUrl ? <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : (
                                        <View className="items-center">
                                            <Ionicons name="image-outline" size={36} color="#9ca3af" />
                                            <Text className="text-gray-400 font-medium text-sm mt-2">Pick {activeTab === 'marketplace' ? 'item' : activeTab === 'media' ? 'thumbnail' : 'banner'} image</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {activeTab === 'media' && (
                                    <TouchableOpacity
                                        onPress={pickVideo}
                                        className="w-full aspect-video bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center mb-4 overflow-hidden"
                                    >
                                        {videoUri ? (
                                            <View className="items-center">
                                                <Ionicons name="videocam" size={36} color="#6366f1" />
                                                <Text className="text-indigo-600 font-black text-xs mt-2 uppercase">Video Ready</Text>
                                            </View>
                                        ) : (
                                            <View className="items-center">
                                                <Ionicons name="videocam-outline" size={36} color="#9ca3af" />
                                                <Text className="text-gray-400 font-medium text-sm mt-2">Pick Video File</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}

                                <TextInput
                                    value={imageUrl}
                                    onChangeText={t => { setImageUrl(t); setImageUri(null); }}
                                    placeholder="Or paste image URL"
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4"
                                />
                                <TextInput
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder={activeTab === 'ads' ? "Ad Title" : activeTab === 'media' ? "Video Title" : "Product Name"}
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

                                {activeTab === 'media' && (
                                    <>
                                        <TextInput
                                            value={description}
                                            onChangeText={setDescription}
                                            placeholder="Video Description"
                                            multiline
                                            className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4 min-h-[100px]"
                                            textAlignVertical="top"
                                        />
                                        <TextInput
                                            value={tags}
                                            onChangeText={setTags}
                                            placeholder="Tags (comma separated)"
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

                                {activeTab !== 'media' && (
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
                                )}

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
        </View>
    );
};

export default AdminPortal;
