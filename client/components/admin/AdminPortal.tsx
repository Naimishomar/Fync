import React, { useState, useEffect, useCallback, useRef } from 'react';
import {View, Text, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, Image, ScrollView, Switch, Platform, KeyboardAvoidingView, Linking, BackHandler, StatusBar} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import axios from '../../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import { AdItem, RedemptionItem, MarketPlaceItem, ReportItem, ContactMessageItem, UserItem, MediaItem, PaymentItem } from './AdminComponents';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

const TAB_TITLES: Record<string, string> = {
    ads: 'Banner Ads', users: 'User Management', media: 'Fync Media', reports: 'Reported Content',
    marketplace: 'Reward Items', rewards: 'Redemptions', messages: 'Contact Messages',
    broadcast: 'Global Broadcast', payments: 'Payments', subscription: 'Subscription Pricing',
};

// Using a stable key for navigation to ensure it survives re-renders
const HubButton = ({ title, tab, icon, color, description, onOpen }: { title: string, tab: any, icon: any, color: string, description: string, onOpen: (tab: any) => void }) => (
    <TouchableOpacity
        onPress={() => onOpen(tab)}
        className="mb-4 rounded-sheet overflow-hidden border border-line shadow-hair bg-card"
        activeOpacity={0.9}
    >
        <View className="flex-1 flex-row items-center p-6" style={{ backgroundColor: `${color}10` }}>
            <View className="w-14 h-14 rounded-card items-center justify-center mr-4" style={{ backgroundColor: `${color}20` }}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View className="flex-1">
                <Text className="text-sm font-display text-ink uppercase mb-1">{title}</Text>
                <Text className="text-label text-ink-3 leading-[14px] font-medium">{description}</Text>
            </View>
            <View className="w-8 h-8 rounded-xl bg-paper justify-center items-center ml-2 border border-line">
                <Ionicons name="chevron-forward" size={16} color={C.ink3} />
            </View>
        </View>
    </TouchableOpacity>
);

const PUBLIC_PROFILE_SCREEN = 'PublicProfile';


const AdminPortal = ({ navigation }: any) => {
    const { user } = useAuth();

    useEffect(() => {
        if (user && user.user_access !== 'admin') {
            Alert.alert("Access Denied", "You do not have permission to view this screen.");
            navigation.goBack();
        }
    }, [user]);

    const [activeTab, setActiveTab] = useState<'ads' | 'rewards' | 'marketplace' | 'messages' | 'media' | 'reports' | 'users' | 'subscription' | 'broadcast' | 'payments'>('ads');
    const [view, setView] = useState<'hub' | 'feature'>('hub');
    const [subscriptionPrice, setSubscriptionPrice] = useState<string>('39');
    const [currentSubscriptionPrice, setCurrentSubscriptionPrice] = useState<string>('...');
    const [isSubscriptionEnabled, setIsSubscriptionEnabled] = useState<boolean>(true);
    const [currentIsSubscriptionEnabled, setCurrentIsSubscriptionEnabled] = useState<boolean>(true);
    const [ads, setAds] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [fyncMedia, setFyncMedia] = useState<any[]>([]);
    const [reports, setReports] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Payments arrive while an admin scrolls, so the ledger is keyset-paged:
    // the cursor is the last row we showed, not an offset that shifts.
    const [payments, setPayments] = useState<any[]>([]);
    const [paymentCursor, setPaymentCursor] = useState<string | null>(null);
    const [paymentsLoadingMore, setPaymentsLoadingMore] = useState(false);
    const [paymentFilter, setPaymentFilter] = useState<'' | 'paid' | 'created' | 'failed'>('');
    const [paymentStats, setPaymentStats] = useState<any>(null);
    const [userStats, setUserStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingAd, setEditingAd] = useState<any>(null);
    const [editingProduct, setEditingProduct] = useState<any>(null);

    const [subConfirmModalVisible, setSubConfirmModalVisible] = useState(false);
    const [subConfirmPassword, setSubConfirmPassword] = useState('');
    const [submittingPrice, setSubmittingPrice] = useState(false);

    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [verifyingPassword, setVerifyingPassword] = useState(false);
    // Search-as-you-type: only the newest request may write the list.
    const userSearchSeq = useRef(0);

    const handleVerifyPassword = async () => {
        if (!adminPassword.trim()) return Alert.alert("Required", "Please enter the admin password");
        setVerifyingPassword(true);
        try {
            const res = await axios.post('/user/admin/verify-password', { password: adminPassword });
            if (res.data.success) {
                setIsAuthenticated(true);
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                Toast.show({ type: 'error', text1: 'Incorrect Master Password', text2: 'Authorization denied' });
            } else {
                console.error("Password verify error:", error);
                Toast.show({ type: 'error', text1: 'System Error', text2: 'Failed to verify protocol' });
            }
        } finally {
            setVerifyingPassword(false);
        }
    };

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
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastBody, setBroadcastBody] = useState('');
    const [broadcastImage, setBroadcastImage] = useState('');
    // A broadcast answers 202 whether it reached ten thousand phones or none,
    // so the admin is shown the device count before sending.
    const [reach, setReach] = useState<{ devices: number; users: number; totalUsers: number } | null>(null);
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

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
        const seq = ++userSearchSeq.current;
        try {
            setLoading(true);
            const res = await axios.get(`/user/admin/users?search=${encodeURIComponent(search)}`);
            if (seq === userSearchSeq.current && res.data.success) {
                setUsers(res.data.users);
            }
        } catch (e) {
            console.error(e);
            if (seq === userSearchSeq.current) Toast.show({ type: 'error', text1: 'Failed to fetch users' });
        } finally {
            if (seq === userSearchSeq.current) setLoading(false);
        }
    };

    /**
     * The payment ledger.
     *
     * `reset` starts from the top; otherwise it continues from the cursor the
     * server handed back. A ref-free guard on `paymentsLoadingMore` keeps a
     * fast scroll from firing the same page twice.
     */
    const fetchPayments = useCallback(async (opts: { reset?: boolean; status?: string; search?: string } = {}) => {
        const { reset = false } = opts;
        const status = opts.status ?? paymentFilter;

        if (reset) setLoading(true);
        else setPaymentsLoadingMore(true);

        try {
            const params = new URLSearchParams({ limit: '10' });
            if (status) params.set('status', status);
            if (opts.search) params.set('search', opts.search);
            if (!reset && paymentCursor) params.set('cursor', paymentCursor);

            const res = await axios.get(`/payment/admin/orders?${params.toString()}`);
            if (res.data.success) {
                setPayments((prev) => (reset ? res.data.orders : [...prev, ...res.data.orders]));
                setPaymentCursor(res.data.nextCursor);
            }
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Failed to fetch payments' });
        } finally {
            setLoading(false);
            setPaymentsLoadingMore(false);
        }
    }, [paymentCursor, paymentFilter]);

    const loadMorePayments = useCallback(() => {
        // No cursor means the server already served the last page.
        if (!paymentCursor || paymentsLoadingMore || loading) return;
        fetchPayments();
    }, [paymentCursor, paymentsLoadingMore, loading, fetchPayments]);

    const fetchPaymentStats = async () => {
        try {
            const res = await axios.get('/payment/admin/stats');
            if (res.data.success) setPaymentStats(res.data.stats);
        } catch (e) {
            console.error(e);
        }
    };

    /** Headline user numbers for the hub. */
    const fetchUserStats = async () => {
        try {
            const res = await axios.get('/user/admin/stats');
            if (res.data.success) setUserStats(res.data.stats);
        } catch (e) {
            console.error(e);
        }
    };

    const copyReference = useCallback(async (value: string) => {
        await Clipboard.setStringAsync(value);
        Toast.show({ type: 'success', text1: 'Copied', text2: value });
    }, []);

    const fetchSubscriptionConfig = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/subscription/config');
            if (res.data.success && res.data.price !== undefined) {
                setSubscriptionPrice(res.data.price.toString());
                setCurrentSubscriptionPrice(res.data.price.toString());
                
                if (res.data.isSubscriptionEnabled !== undefined) {
                    setIsSubscriptionEnabled(res.data.isSubscriptionEnabled);
                    setCurrentIsSubscriptionEnabled(res.data.isSubscriptionEnabled);
                }
            }
        } catch (e) {
            console.error("Fetch Config Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateSubscription = () => {
        if (!subscriptionPrice || isNaN(Number(subscriptionPrice)) || Number(subscriptionPrice) < 1) {
            return Alert.alert("Error", "Please enter a valid price");
        }
        setSubConfirmPassword('');
        setSubConfirmModalVisible(true);
    };

    const confirmAndDeploySubscriptionPrice = async () => {
        if (!subConfirmPassword.trim()) {
            return Alert.alert("Required", "Please enter the admin password to confirm.");
        }
        setSubmittingPrice(true);
        try {
            // First verify password
            const verifyRes = await axios.post('/user/admin/verify-password', { password: subConfirmPassword });
            if (verifyRes.data.success) {
                // If verified, deploy new price
                const res = await axios.put('/subscription/admin/config', { 
                    price: subscriptionPrice,
                    isSubscriptionEnabled: isSubscriptionEnabled 
                });
                if (res.data.success) {
                    setCurrentSubscriptionPrice(subscriptionPrice);
                    setCurrentIsSubscriptionEnabled(isSubscriptionEnabled);
                    Toast.show({ type: 'success', text1: 'Subscription Config Updated' });
                    setSubConfirmModalVisible(false);
                }
            }
        } catch (error: any) {
            if (error.response?.status === 401) {
                Toast.show({ type: 'error', text1: 'Authentication Failed', text2: 'Incorrect master password' });
            } else {
                console.error("Subscription update error:", error);
                Toast.show({ type: 'error', text1: 'Failed to update price' });
            }
        } finally {
            setSubmittingPrice(false);
        }
    };

    const loadReach = async () => {
        try {
            const res = await axios.get('/notifications/broadcast/reach');
            if (res.data.success) setReach(res.data);
        } catch { setReach(null); }
    };

    useEffect(() => {
        if (activeTab === 'broadcast') loadReach();
    }, [activeTab]);

    // Hub headline numbers. Loaded once the password check passes, not per tab.
    useEffect(() => {
        if (!isAuthenticated) return;
        fetchUserStats();
        fetchPaymentStats();
    }, [isAuthenticated]);

    const sendBroadcast = async () => {
        setSendingBroadcast(true);
        try {
            const res = await axios.post('/notifications/broadcast', {
                title: broadcastTitle.trim(),
                body: broadcastBody.trim(),
                imageUrl: broadcastImage.trim() || undefined,
            });
            if (res.data.success) {
                Toast.show({
                    type: 'success',
                    text1: 'Broadcast started',
                    text2: reach ? `Delivering to ${reach.devices} device${reach.devices === 1 ? '' : 's'}.` : res.data.message,
                });
                setBroadcastTitle('');
                setBroadcastBody('');
                setBroadcastImage('');
            }
        } catch (error: any) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'Broadcast failed', text2: error.response?.data?.message || 'Server error' });
        } finally {
            setSendingBroadcast(false);
        }
    };

    const handleBroadcast = () => {
        if (!broadcastTitle.trim() || !broadcastBody.trim()) {
            return Alert.alert("Required", "Please fill in both title and message.");
        }
        // This reaches every phone with the app installed and cannot be recalled.
        Alert.alert(
            "Send to everyone?",
            `"${broadcastTitle.trim()}" will be pushed to every Fync user's phone and added to their Updates Center. This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Send Now", style: "destructive", onPress: sendBroadcast },
            ]
        );
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
        switch(activeTab) {
            case 'ads':
                fetchAds();
                break;
            case 'rewards':
                fetchRedemptions();
                break;
            case 'marketplace':
                fetchProducts();
                break;
            case 'media':
                fetchFyncMedia();
                break;
            case 'reports':
                fetchReports();
                break;
            case 'subscription':
                fetchSubscriptionConfig();
                break;
            case 'payments':
                // Fresh from the top each time the tab opens; the cursor from a
                // previous visit points into a list that has since moved.
                setPaymentCursor(null);
                setPayments([]);
                fetchPayments({ reset: true });
                fetchPaymentStats();
                break;
            case 'users':
                if (userSearch.trim()) {
                    fetchAdminUsers(userSearch);
                } else {
                    setUsers([]);
                }
                break;
            default:
                fetchContactMessages();
                break;
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
            type === 'ad' ? 'Delete Ad?' : type === 'product' ? 'Delete Item?' : type === 'report' ? 'Delete Post?' : type === 'media' ? 'Delete Media?' : 'Delete Message?', 
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


    const openHub = (tab: any) => { setActiveTab(tab); setView('feature'); };



    const HubView = () => (
        <ScrollView keyboardShouldPersistTaps="handled" 
            className="flex-1 px-gutter pt-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <View className="flex-row items-center mt-6 mb-6" style={{ gap: 12 }}>
              <Text className="text-ink-3 text-label font-display uppercase">Management Systems</Text>
              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            </View>
            
            <TouchableOpacity
                onPress={() => navigation.navigate('ArenaAdminScreen')}
                className="mb-4 rounded-sheet overflow-hidden border border-line shadow-hair bg-card"
                activeOpacity={0.9}
            >
                <View className="flex-1 flex-row items-center p-6" style={{ backgroundColor: '#EA580C10' }}>
                    <View className="w-14 h-14 rounded-card items-center justify-center mr-4" style={{ backgroundColor: '#EA580C20' }}>
                        <Ionicons name="code-slash" size={24} color={C.brand[600]} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-display text-ink uppercase mb-1">Problem Bank</Text>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">Import coding problems and their test cases for contests and battles.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-paper justify-center items-center ml-2 border border-line">
                        <Ionicons name="chevron-forward" size={16} color={C.ink2} />
                    </View>
                </View>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => navigation.navigate('AffiliateAdminScreen')}
                className="mb-4 rounded-sheet overflow-hidden border border-line shadow-hair bg-card"
                activeOpacity={0.9}
            >
                <View className="flex-1 flex-row items-center p-6" style={{ backgroundColor: '#EA580C10' }}>
                    <View className="w-14 h-14 rounded-card items-center justify-center mr-4" style={{ backgroundColor: '#EA580C20' }}>
                        <Ionicons name="pricetags" size={24} color={C.brand[600]} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-sm font-display text-ink uppercase mb-1">Fync Store</Text>
                        <Text className="text-label text-ink-3 leading-[14px] font-medium">List affiliate products and track the commission each one earns.</Text>
                    </View>
                    <View className="w-8 h-8 rounded-xl bg-paper justify-center items-center ml-2 border border-line">
                        <Ionicons name="chevron-forward" size={16} color={C.ink2} />
                    </View>
                </View>
            </TouchableOpacity>
            <HubButton 
                title="Banner Ads" 
                tab="ads" 
                icon="megaphone" 
                color={C.brand[500]} 
                description="Manage campus-wide banner advertisements and promotion campaigns." onOpen={openHub} />
            <HubButton 
                title="User Management" 
                tab="users"  
                icon="people" 
                color={C.success} 
                description="Oversee student profiles, moderation status, and account access." onOpen={openHub} />
            <HubButton 
                title="Fync Media" 
                tab="media" 
                icon="play-circle" 
                color={C.fam.social} 
                description="Manage educational content, campus videos, and digital media." onOpen={openHub} />
            <HubButton 
                title="Reported Content" 
                tab="reports" 
                icon="flag" 
                color={C.danger} 
                description="Review flagged posts and enforce community safety protocols." onOpen={openHub} />
            <HubButton 
                title="Reward Items" 
                tab="marketplace" 
                icon="cart" 
                color={C.recruiter} 
                description="Update the Fync store inventory and redemption items." onOpen={openHub} />
            <HubButton 
                title="Redemptions" 
                tab="rewards" 
                icon="gift" 
                color={C.fam.study} 
                description="Process student reward claims and inventory payouts." onOpen={openHub} />
            <HubButton 
                title="Contact Messages" 
                tab="messages" 
                icon="mail" 
                color={C.ink3} 
                description="Review and respond to official support and inquiry messages." onOpen={openHub} />
            <HubButton 
                title="Global Broadcast" 
                tab="broadcast" 
                icon="notifications" 
                color={C.fam.social} 
                description="Send an instant push notification to all users." onOpen={openHub} />
            <HubButton 
                title="Payments" 
                tab="payments" 
                icon="card" 
                color={C.success} 
                description="Every transaction with its reference id, payer and outcome — for answering student queries." onOpen={openHub} />
            <HubButton 
                title="Subscription Pricing" 
                tab="subscription" 
                icon="pricetag" 
                color={C.warning} 
                description="Dynamically adjust the platform's premium subscription fee." onOpen={openHub} />

            <View className="mt-8 p-6 bg-ink rounded-sheet shadow-hair">
                <View className="flex-row items-center mb-4">
                    <Ionicons name="stats-chart" size={18} color={C.brand[500]} />
                    <Text className="text-white font-display text-label uppercase ml-3">System Health</Text>
                </View>
                <View className="flex-row justify-between">
                    <View>
                        <Text className="text-ink-3 text-label font-display uppercase">Total Users</Text>
                        <Text className="text-white text-2xl font-display mt-1">
                            {userStats ? (userStats.total ?? 0).toLocaleString('en-IN') : '—'}
                        </Text>
                        {userStats ? (
                            <Text className="text-ink-3 text-label font-semibold mt-0.5">
                                +{userStats.newThisWeek} this week
                            </Text>
                        ) : null}
                    </View>
                    <View className="items-end">
                        <Text className="text-ink-3 text-label font-display uppercase">Collected</Text>
                        <Text className="text-white text-2xl font-display mt-1">
                            {paymentStats ? `₹${Math.round((paymentStats.grossCollected ?? 0) / 100).toLocaleString('en-IN')}` : '—'}
                        </Text>
                        {paymentStats ? (
                            <Text className="text-ink-3 text-label font-semibold mt-0.5">
                                {paymentStats.successful} payments
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* The breakdown an admin actually asks for: who is on the app,
                    and what is still unresolved. */}
                {userStats ? (
                    <View className="flex-row flex-wrap mt-5 pt-5 border-t border-white/10" style={{ gap: 10 }}>
                        {[
                            ['Students', userStats.students],
                            ['Alumni', userStats.alumni],
                            ['Recruiters', userStats.recruiters],
                            ['Pending payments', paymentStats?.pending ?? 0],
                            ['Reports', reports.length],
                        ].map(([label, value]: any) => (
                            <View key={label} className="bg-white/5 rounded-card px-3 py-2">
                                <Text className="text-ink-3 text-label font-display uppercase">{label}</Text>
                                <Text className="text-white text-sm font-display mt-0.5">{value}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </ScrollView>
    );

    if (!isAuthenticated) {
        return (
            <View className="flex-1 bg-paper">
                <StatusBar barStyle="dark-content" />
                
                <AppBar title="Admin Access" onBack={() => navigation.goBack()} />
                <SafeAreaView className="flex-1 justify-center px-gutter" edges={['bottom']}>
                    <View className="bg-card p-card-pad rounded-sheet border border-line shadow-hair">
                        <View className="w-16 h-16 bg-paper-2 rounded-card items-center justify-center mb-6 border border-line">
                            <Ionicons name="shield-checkmark" size={32} color={C.brand[500]} />
                        </View>
                        
                        <View className="mb-8">
                            <Text className="text-ink-3 text-label font-display uppercase mt-1 leading-4">
                                Admin protocol password required to access operational core.
                            </Text>
                        </View>
                        
                        <TextInput
                            value={adminPassword}
                            onChangeText={setAdminPassword}
                            placeholder="Enter admin password"
                            placeholderTextColor={C.ink3}
                            secureTextEntry
                            className="bg-card border-2 border-ink rounded-card px-5 text-ink font-sans text-base mb-6"
                            style={{
                              minHeight: 50,
                              shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0,
                              shadowOffset: { width: 4, height: 4 }, elevation: 0,
                            }}
                            onSubmitEditing={handleVerifyPassword}
                        />
                        
                        <TouchableOpacity 
                            onPress={handleVerifyPassword}
                            disabled={verifyingPassword}
                            className="bg-ink h-14 items-center justify-center flex-row border-2 border-ink rounded-md"
                        >
                            {verifyingPassword ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Ionicons name="key" size={16} color="white" />
                                    <Text className="text-white font-display text-label uppercase ml-3">Authorize Access</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl mt-6"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                            <Text className="text-ink-3 font-display text-label uppercase">Cancel Initialization</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            

            <View className="flex-1">
                <AppBar
                    title={view === 'hub' ? 'Admin Portal' : TAB_TITLES[activeTab]}
                    onBack={() => (view === 'feature' ? setView('hub') : navigation.goBack())}
                    right={view === 'feature' && activeTab !== 'rewards' && activeTab !== 'messages' && activeTab !== 'reports' && activeTab !== 'users' && activeTab !== 'subscription' && activeTab !== 'payments' ? (
                        <IconBtn name="add" boxed onPress={() => { resetForm(); setModalVisible(true); }} />
                    ) : undefined}
                />
                <View className="px-gutter">
                    {view === 'feature' && activeTab === 'users' && (
                        <View className="flex-row items-center bg-card p-1.5 mt-2 mb-8 border-2 border-ink shadow-hair rounded-md">
                            <View className="flex-row items-center flex-1 px-4 py-2.5">
                                <Ionicons name="search" size={18} color={C.ink3} />
                                <TextInput 
                                    className="flex-1 ml-3 text-xs font-display text-ink uppercase"
                                    placeholder="Search student signals..."
                                    placeholderTextColor={C.ink4}
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
                                        <Ionicons name="close-circle" size={18} color={C.ink3} />
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    if (userSearch.trim()) fetchAdminUsers(userSearch);
                                    else setUsers([]);
                                }}
                                className="bg-ink ml-2 px-2.5 py-1 rounded-full"
                            >
                                <Text className="text-white font-display text-label uppercase">Search</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {activeTab === 'subscription' && view === 'feature' && (
                    <View className="bg-card p-6 rounded-card mx-gutter border border-line shadow-hair mt-4">
                        <View className="flex-row items-center mb-6">
                            <View className="w-12 h-12 bg-warning/15 rounded-card items-center justify-center mr-4">
                                <Ionicons name="pricetag" size={24} color={C.warning} />
                            </View>
                            <View>
                                <Text className="text-ink text-lg font-display uppercase">Global Price Engine</Text>
                                <Text className="text-ink-3 text-label font-semibold uppercase mt-0.5">Live Active Rate: ₹{currentSubscriptionPrice}/mo</Text>
                                <Text className="text-ink-3 text-label font-semibold uppercase mt-0.5">Status: {currentIsSubscriptionEnabled ? 'Enabled' : 'Disabled'}</Text>
                            </View>
                        </View>
                        
                        <View className="flex-row justify-between items-center bg-paper-2 p-4 rounded-card border border-line mb-4">
                            <View className="flex-1">
                                <Text className="text-ink font-semibold text-sm">Enable Subscriptions</Text>
                                <Text className="text-ink-3 text-label mt-1">If disabled, the app is free and all users instantly bypass the paywall.</Text>
                            </View>
                            <Switch
                                value={isSubscriptionEnabled}
                                onValueChange={setIsSubscriptionEnabled}
                                trackColor={{ false: "#E3DDD3", true: "#EDE8E0" }}
                                thumbColor={isSubscriptionEnabled ? "#F97316" : "#8B857E"}
                            />
                        </View>
                        
                        <View className="bg-paper-2 p-4 rounded-card border border-line mb-6">
                            <Text className="text-ink-3 text-label font-display uppercase mb-2">Configure New Rate (INR)</Text>
                            <View className="flex-row items-center">
                                <Text className="text-ink text-2xl font-display mr-2">₹</Text>
                                <TextInput 
                                    className="flex-1 text-3xl font-display text-ink"
                                    value={subscriptionPrice}
                                    onChangeText={setSubscriptionPrice}
                                    keyboardType="numeric"
                                    placeholder="39"
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                            onPress={handleUpdateSubscription}
                            disabled={submitting}
                            className="bg-ink h-14 items-center justify-center flex-row border-2 border-ink rounded-md"
                        >
                            {submitting ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Ionicons name="save" size={18} color="white" />
                                    <Text className="text-white font-display text-xs uppercase ml-2">Deploy New Pricing</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

            {view === 'hub' ? (
                // Called, not mounted: a component defined in render is a new type
                // every render, so the hub remounted (and lost scroll) on each update.
                HubView()
            ) : activeTab === 'subscription' ? (
                // Subscription view is rendered above, so we render nothing here to prevent the FlatList fallback
                null
            ) : activeTab === 'broadcast' ? (
                // Taller than a phone once the preview shows; without a scroller the
                // Send button sat off-screen / under the keyboard.
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View className="bg-card p-6 rounded-card mx-gutter border border-line shadow-hair mt-4">
                    <View className="flex-row items-center mb-6">
                        <View className="w-12 h-12 bg-fam-social/15 rounded-card items-center justify-center mr-4">
                            <Ionicons name="notifications" size={24} color={C.fam.social} />
                        </View>
                        <View>
                            <Text className="text-ink text-lg font-display uppercase">Global Broadcast</Text>
                            <Text className="text-ink-3 text-label font-semibold uppercase mt-0.5">Send alert to all users</Text>
                        </View>
                    </View>

                    {/* Zero devices is the usual reason a broadcast appears to do
                        nothing, and it is invisible without this. */}
                    <View className={`flex-row items-center p-4 rounded-card border mb-4 ${reach && reach.devices === 0 ? 'bg-danger/10 border-danger/30' : 'bg-paper-2 border-line'}`}>
                        <Ionicons
                            name={reach && reach.devices === 0 ? 'warning-outline' : 'phone-portrait-outline'}
                            size={18}
                            color={reach && reach.devices === 0 ? '#DC2626' : '#57534E'}
                        />
                        <Text className="text-ink-2 text-sm ml-3 flex-1">
                            {reach === null
                                ? 'Checking how many devices are registered…'
                                : reach.devices === 0
                                    ? 'No devices are registered. Nobody will receive a push notification.'
                                    : `Will reach ${reach.devices} device${reach.devices === 1 ? '' : 's'} across ${reach.users} of ${reach.totalUsers} users.`}
                        </Text>
                    </View>

                    <View className="bg-paper-2 p-4 rounded-card border border-line mb-4">
                        <Text className="text-ink-3 text-label font-display uppercase mb-2">Notification Title</Text>
                        <TextInput 
                            className="bg-card border-[1.5px] border-ink px-4 py-3 text-ink font-semibold rounded-md"
                            value={broadcastTitle}
                            onChangeText={setBroadcastTitle}
                            placeholder="e.g., Server Maintenance"
                        />
                    </View>

                    <View className="bg-paper-2 p-4 rounded-card border border-line mb-6">
                        <Text className="text-ink-3 text-label font-display uppercase mb-2">Message Body</Text>
                        <TextInput 
                            className="bg-card border-[1.5px] border-ink px-4 py-3 text-ink min-h-[100px] rounded-md"
                            value={broadcastBody}
                            onChangeText={setBroadcastBody}
                            placeholder="Enter the broadcast message here..."
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    <View className="bg-paper-2 p-4 rounded-card border border-line mb-6">
                        <Text className="text-ink-3 text-label font-display uppercase mb-2">Image URL (optional)</Text>
                        <TextInput
                            className="bg-card border-[1.5px] border-ink px-4 py-3 text-ink font-semibold rounded-md"
                            value={broadcastImage}
                            onChangeText={setBroadcastImage}
                            placeholder="https://..."
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                        <Text className="text-ink-3 text-label font-semibold mt-2">Shown as the expandable picture in the phone notification.</Text>
                    </View>

                    {/* What the notification will actually look like on a phone. */}
                    <View className="flex-row items-center mt-6 mb-2" style={{ gap: 12 }}>
                      <Text className="text-ink-3 text-label font-display uppercase">Preview</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    <View className="bg-card rounded-card border border-line p-3 mb-6 shadow-hair">
                        <View className="flex-row items-center mb-2">
                            <Image source={require('../../assets/Fync.png')} className="w-5 h-5 rounded" />
                            <Text className="text-ink-3 text-label font-display uppercase ml-2">Fync</Text>
                            <Text className="text-ink-4 text-label font-semibold ml-2">now</Text>
                        </View>
                        <Text className="text-ink font-display text-sm" numberOfLines={1}>
                            {broadcastTitle.trim() || 'Notification title'}
                        </Text>
                        <Text className="text-ink-2 text-xs font-semibold mt-0.5" numberOfLines={3}>
                            {broadcastBody.trim() || 'Your message will appear here.'}
                        </Text>
                        {!!broadcastImage.trim() && (
                            <Image
                                source={{ uri: broadcastImage.trim() }}
                                className="w-full h-32 rounded-xl mt-2 bg-paper-2"
                                resizeMode="cover"
                            />
                        )}
                    </View>

                    <TouchableOpacity 
                        onPress={handleBroadcast}
                        disabled={sendingBroadcast}
                        className="bg-ink h-14 items-center justify-center flex-row border-2 border-ink rounded-md"
                    >
                        {sendingBroadcast ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="white" />
                                <Text className="text-white font-display text-xs uppercase ml-2">Send Broadcast</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
                </ScrollView>
            ) : (
                loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator color={C.brand[500]} size="large" />
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={
                            activeTab === 'ads' ? ads : 
                            activeTab === 'marketplace' ? products : 
                            activeTab === 'rewards' ? redemptions : 
                            activeTab === 'reports' ? reports :
                            activeTab === 'users' ? users :
                            activeTab === 'payments' ? payments :
                            activeTab === 'media' ? fyncMedia :
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
                                                    activeTab === 'payments' ?
                                                        <PaymentItem item={item} onCopy={copyReference} /> :
                                                        <ContactMessageItem item={item} onDelete={handleDelete} onToggleRead={handleToggleMessageReadStatus} />
                        }
                        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        onEndReached={activeTab === 'payments' ? loadMorePayments : undefined}
                        onEndReachedThreshold={0.5}
                        ListHeaderComponent={
                            activeTab === 'payments' ? (
                                <View className="mb-4">
                                    {/* Totals first — the question is usually
                                        "how much came in", then a lookup. */}
                                    {paymentStats ? (
                                        <View className="flex-row mb-3" style={{ gap: 8 }}>
                                            {[
                                                ['Successful', paymentStats.successful, 'text-success'],
                                                ['Pending', paymentStats.pending, 'text-warning'],
                                                ['Failed', paymentStats.failed, 'text-danger'],
                                            ].map(([label, value, tone]: any) => (
                                                <View key={label} className="flex-1 bg-card border border-line rounded-card p-3">
                                                    <Text className="text-ink-3 text-label font-display uppercase">{label}</Text>
                                                    <Text className={`text-lg font-display mt-0.5 ${tone}`}>{value}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    <View className="flex-row" style={{ gap: 8 }}>
                                        {[
                                            { label: 'All', value: '' },
                                            { label: 'Successful', value: 'paid' },
                                            { label: 'Pending', value: 'created' },
                                            { label: 'Failed', value: 'failed' },
                                        ].map((f) => {
                                            const on = paymentFilter === f.value;
                                            return (
                                                <TouchableOpacity
                                                    key={f.value || 'all'}
                                                    onPress={() => {
                                                        setPaymentFilter(f.value as any);
                                                        setPaymentCursor(null);
                                                        setPayments([]);
                                                        fetchPayments({ reset: true, status: f.value });
                                                    }}
                                                    className={`px-3 py-2 rounded-md border ${on ? 'bg-ink border-ink' : 'bg-card border-line'}`}
                                                    accessibilityRole="button"
                                                    accessibilityState={{ selected: on }}
                                                >
                                                    <Text className={`text-label font-semibold ${on ? 'text-white' : 'text-ink-2'}`}>{f.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null
                        }
                        ListFooterComponent={
                            activeTab === 'payments' ? (
                                paymentsLoadingMore ? (
                                    <View className="py-6 items-center">
                                        <ActivityIndicator size="small" color={C.brand[500]} />
                                    </View>
                                ) : payments.length && !paymentCursor ? (
                                    <View className="py-6 items-center">
                                        <Text className="text-ink-3 text-label font-semibold">That is every payment</Text>
                                    </View>
                                ) : null
                            ) : null
                        }
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center py-20">
                                <Text className="text-ink-3 font-semibold text-sm">
                                    {activeTab === 'ads' ? 'No ads found' :
                                        activeTab === 'marketplace' ? 'No reward items found' :
                                            activeTab === 'rewards' ? 'No reward applications found' :
                                                activeTab === 'reports' ? 'No reported posts' :
                                                    activeTab === 'users' ? 'No users found' :
                                                        activeTab === 'payments' ? 'No payments yet' :
                                                            activeTab === 'media' ? 'No media found' :
                                                            'No messages found'}
                                </Text>
                            </View>
                        }
                    />
                )
            )}

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => { setModalVisible(false); resetForm(); }}>
                <View className="flex-1 bg-black/50 justify-end">
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View className="bg-paper rounded-t-sheet p-6 pb-10 border-t border-line">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-ink font-display text-h1">{editingAd || editingProduct ? 'Edit Item' : activeTab === 'ads' ? 'New Ad Banner' : activeTab === 'media' ? 'Publish Fync Media' : 'New Reward Item'}</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} hitSlop={8} className="w-8 h-8 bg-paper-2 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={18} color={C.ink} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <TouchableOpacity
                                    onPress={pickImage}
                                    className={`w-full ${activeTab === 'marketplace' || activeTab === 'media' ? '' : 'h-40'} bg-paper-2 rounded-card border-2 border-dashed border-line items-center justify-center mb-4 overflow-hidden`}
                                    style={activeTab === 'marketplace' || activeTab === 'media' ? { aspectRatio: 16 / 9 } : {}}
                                >
                                    {imageUri ? <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : imageUrl ? <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : (
                                        <View className="items-center">
                                            <Ionicons name="image-outline" size={36} color={C.ink4} />
                                            <Text className="text-ink-3 font-medium text-sm mt-2">Pick {activeTab === 'marketplace' ? 'item' : activeTab === 'media' ? 'thumbnail' : 'banner'} image</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {activeTab === 'media' && (
                                    <TouchableOpacity
                                        onPress={pickVideo}
                                        className="w-full aspect-video bg-paper-2 border-2 border-dashed border-line items-center justify-center mb-4 overflow-hidden rounded-md"
                                    >
                                        {videoUri ? (
                                            <View className="items-center">
                                                <Ionicons name="videocam" size={36} color={C.recruiter} />
                                                <Text className="text-recruiter font-display text-xs mt-2 uppercase">Video Ready</Text>
                                            </View>
                                        ) : (
                                            <View className="items-center">
                                                <Ionicons name="videocam-outline" size={36} color={C.ink4} />
                                                <Text className="text-ink-3 font-medium text-sm mt-2">Pick Video File</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}

                                <TextInput
                                    value={imageUrl}
                                    onChangeText={t => { setImageUrl(t); setImageUri(null); }}
                                    placeholder="Or paste image URL"
                                    className="bg-paper-2 border border-line rounded-xl px-4 py-3 mb-4"
                                />
                                <TextInput
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder={activeTab === 'ads' ? "Ad Title" : activeTab === 'media' ? "Video Title" : "Product Name"}
                                    className="bg-card border-[1.5px] border-ink px-4 py-3 mb-4 rounded-md"
                                />

                                {activeTab === 'marketplace' && (
                                    <>
                                        <TextInput
                                            value={description}
                                            onChangeText={setDescription}
                                            placeholder="Product Description"
                                            multiline
                                            className="bg-card border-[1.5px] border-ink px-4 py-3 mb-4 min-h-[100px] rounded-md"
                                            textAlignVertical="top"
                                        />
                                        <TextInput
                                            value={coins}
                                            onChangeText={setCoins}
                                            placeholder="Coins Required"
                                            keyboardType="numeric"
                                            className="bg-card border-[1.5px] border-ink px-4 py-3 mb-4 rounded-md"
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
                                            className="bg-card border-[1.5px] border-ink px-4 py-3 mb-4 min-h-[100px] rounded-md"
                                            textAlignVertical="top"
                                        />
                                        <TextInput
                                            value={tags}
                                            onChangeText={setTags}
                                            placeholder="Tags (comma separated)"
                                            className="bg-card border-[1.5px] border-ink px-4 py-3 mb-4 rounded-md"
                                        />
                                    </>
                                )}

                                {activeTab === 'ads' && (
                                    <TextInput
                                        value={linkUrl}
                                        onChangeText={setLinkUrl}
                                        placeholder="Link URL"
                                        className="bg-card border-[1.5px] border-ink px-4 py-3 mb-4 rounded-md"
                                    />
                                )}

                                {activeTab !== 'media' && (
                                    <View className="flex-row justify-between items-center bg-paper-2 p-4 rounded-xl mb-6">
                                        <View>
                                            <Text className="text-ink font-semibold text-sm">{activeTab === 'ads' ? 'Ad Visible' : 'Item Available'}</Text>
                                            <Text className="text-ink-3 text-label">Toggling this will hide/show the item</Text>
                                        </View>
                                        <Switch
                                            value={isActive}
                                            onValueChange={setIsActive}
                                            trackColor={{ false: "#E3DDD3", true: "#EDE8E0" }}
                                            thumbColor={isActive ? "#F97316" : "#8B857E"}
                                        />
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    className={`py-4 rounded-xl items-center flex-row justify-center ${submitting ? 'bg-brand-300' : 'bg-brand-500'}`}
                                >
                                    {submitting ? <ActivityIndicator color={C.ink} /> : <Text className="text-ink font-display uppercase text-sm">{editingAd || editingProduct ? 'Save Changes' : activeTab === 'ads' ? 'Publish Ad' : 'Add to Store'}</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
            </View>
            {/* Subscription Confirmation Modal */}
            <Modal visible={subConfirmModalVisible} animationType="fade" transparent onRequestClose={() => !submittingPrice && setSubConfirmModalVisible(false)}>
                <View className="flex-1 bg-ink/80 justify-center px-6">
                    <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={() => setSubConfirmModalVisible(false)} />
                    <View className="bg-card rounded-sheet p-card-pad shadow-hair overflow-hidden border border-line">
                        <View className="w-16 h-16 bg-danger/10 rounded-card items-center justify-center mb-6 border border-danger/15">
                            <Ionicons name="warning" size={32} color={C.danger} />
                        </View>
                        
                        <View className="mb-8">
                            <Text className="text-ink text-2xl font-display uppercase leading-tight">
                                CONFIRM <Text className="text-danger">CHANGE</Text>
                            </Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-2 leading-4">
                                You are about to change the global subscription price to ₹{subscriptionPrice}. Please re-authenticate.
                            </Text>
                        </View>

                        <TextInput
                            value={subConfirmPassword}
                            onChangeText={setSubConfirmPassword}
                            placeholder="ENTER MASTER PASSWORD"
                            placeholderTextColor={C.ink3}
                            secureTextEntry
                            className="bg-card border-[1.5px] border-ink px-6 py-5 text-ink font-display text-label shadow-hair mb-6 rounded-md"
                            onSubmitEditing={confirmAndDeploySubscriptionPrice}
                        />

                        <View className="flex-row gap-3">
                            <TouchableOpacity 
                                onPress={() => setSubConfirmModalVisible(false)}
                                disabled={submittingPrice}
                                className="flex-1 bg-paper-2 h-14 items-center justify-center border border-line rounded-md"
                            >
                                <Text className="text-ink-3 font-display text-label uppercase">Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={confirmAndDeploySubscriptionPrice}
                                disabled={submittingPrice}
                                className="flex-1 bg-danger h-14 rounded-card items-center justify-center shadow-hair"
                            >
                                {submittingPrice ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-display text-label uppercase">Deploy Price</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default AdminPortal;
