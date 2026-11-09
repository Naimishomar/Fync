import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Image, ScrollView, Switch, Platform, BackHandler, StatusBar } from 'react-native';
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
import { isFeatureOn } from '../../constants/features';
import { AppBar, IconBtn, Button, Card, Chip, Divider, Empty, FormField, IconTile, Label, ListRow, Num, SearchField, SectionHeader, Sheet } from '../ui/kit';
import GiftAdmin from '../gifts/GiftAdmin';

const TAB_TITLES: Record<string, string> = {
    ads: 'Banner Ads', users: 'User Management', media: 'Fync Media', reports: 'Reported Content',
    marketplace: 'Reward Items', rewards: 'Redemptions', messages: 'Contact Messages',
    broadcast: 'Global Broadcast', payments: 'Payments', subscription: 'Subscription Pricing',
    gifts: 'Gift Shop',
};

// Hub entries. `screen` pushes a route; `tab` opens a feature view in place.
type HubEntry = { title: string; icon: any; description: string; tab?: string; screen?: string; flag?: 'contests' | 'storeAdmin' };
const HUB: HubEntry[] = [
    { title: 'Problem Bank', screen: 'ArenaAdminScreen', flag: 'contests', icon: 'code-slash-outline', description: 'Import coding problems and their test cases for contests and battles.' },
    { title: 'Fync Store', screen: 'AffiliateAdminScreen', flag: 'storeAdmin', icon: 'pricetags-outline', description: 'List affiliate products and track the commission each one earns.' },
    { title: 'Banner ads', tab: 'ads', icon: 'megaphone-outline', description: 'Manage campus-wide banner advertisements and promotion campaigns.' },
    { title: 'User management', tab: 'users', icon: 'people-outline', description: 'Oversee student profiles, moderation status, and account access.' },
    { title: 'Fync Media', tab: 'media', icon: 'play-circle-outline', description: 'Manage educational content, campus videos, and digital media.' },
    { title: 'Reported content', tab: 'reports', icon: 'flag-outline', description: 'Review flagged posts and enforce community safety protocols.' },
    { title: 'Reward items', tab: 'marketplace', icon: 'cart-outline', description: 'Update the Fync store inventory and redemption items.' },
    { title: 'Redemptions', tab: 'rewards', icon: 'gift-outline', description: 'Process student reward claims and inventory payouts.' },
    { title: 'Contact messages', tab: 'messages', icon: 'mail-outline', description: 'Review and respond to official support and inquiry messages.' },
    { title: 'Global broadcast', tab: 'broadcast', icon: 'notifications-outline', description: 'Send an instant push notification to all users.' },
    { title: 'Payments', tab: 'payments', icon: 'card-outline', description: 'Every transaction with its reference id, payer and outcome — for answering student queries.' },
    { title: 'Gift Shop', tab: 'gifts', icon: 'gift-outline', description: 'Fync Gifts: edit products and prices, ship paid orders and update tracking.' },
    { title: 'Subscription pricing', tab: 'subscription', icon: 'pricetag-outline', description: "Dynamically adjust the platform's premium subscription fee." },
];

const HUB_ROW = { paddingHorizontal: 16, paddingVertical: 12 };

const PUBLIC_PROFILE_SCREEN = 'PublicProfile';


const AdminPortal = ({ navigation }: any) => {
    const { user } = useAuth();

    useEffect(() => {
        if (user && user.user_access !== 'admin') {
            Alert.alert("Access Denied", "You do not have permission to view this screen.");
            navigation.goBack();
        }
    }, [user]);

    const [activeTab, setActiveTab] = useState<'ads' | 'rewards' | 'marketplace' | 'messages' | 'media' | 'reports' | 'users' | 'subscription' | 'broadcast' | 'payments' | 'gifts'>('ads');
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

    // Ref, not state: onEndReached can fire twice before the re-render that
    // would flip paymentsLoadingMore, appending the same page twice (dup keys).
    const paymentsPaging = useRef(false);
    const loadMorePayments = useCallback(() => {
        // No cursor means the server already served the last page.
        if (!paymentCursor || paymentsLoadingMore || loading || paymentsPaging.current) return;
        paymentsPaging.current = true;
        fetchPayments().finally(() => { paymentsPaging.current = false; });
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
            case 'gifts':
                // GiftAdmin loads its own data.
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
            allowsEditing: Platform.OS === 'ios'
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

    // Only pending reports are listed, so a resolved/dismissed one leaves the list.
    const handleResolveReport = async (id: string, status: 'resolved' | 'dismissed') => {
        try {
            await axios.patch(`/post/admin/reports/${id}`, { status });
            setReports(prev => prev.filter(r => r._id !== id));
            Toast.show({ type: 'success', text1: status === 'resolved' ? 'Report resolved' : 'Report dismissed' });
        } catch (e: any) {
            Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Failed to update report' });
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
            className="flex-1 px-gutter"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <SectionHeader title="Management" style={{ marginTop: 8 }} />
            <Card>
                {HUB.filter((h) => !h.flag || isFeatureOn(h.flag)).map((h, i) => (
                    <React.Fragment key={h.title}>
                        {i > 0 ? <Divider style={{ marginLeft: 72 }} /> : null}
                        <ListRow
                            icon={h.icon}
                            title={h.title}
                            subtitle={h.description}
                            subtitleLines={2}
                            onPress={() => (h.screen ? navigation.navigate(h.screen) : openHub(h.tab))}
                            style={HUB_ROW}
                        />
                    </React.Fragment>
                ))}
            </Card>

            <SectionHeader title="System health" />
            <Card padded>
                <View className="flex-row justify-between">
                    <View>
                        <Label>Total users</Label>
                        <Num style={{ fontSize: 24, marginTop: 4 }}>
                            {userStats ? (userStats.total ?? 0).toLocaleString('en-IN') : '—'}
                        </Num>
                        {userStats ? (
                            <Text className="text-ink-3 text-xs mt-0.5">+{userStats.newThisWeek} this week</Text>
                        ) : null}
                    </View>
                    <View className="items-end">
                        <Label>Collected</Label>
                        <Num style={{ fontSize: 24, marginTop: 4 }}>
                            {paymentStats ? `₹${Math.round((paymentStats.grossCollected ?? 0) / 100).toLocaleString('en-IN')}` : '—'}
                        </Num>
                        {paymentStats ? (
                            <Text className="text-ink-3 text-xs mt-0.5">{paymentStats.successful} payments</Text>
                        ) : null}
                    </View>
                </View>

                {/* The breakdown an admin actually asks for: who is on the app,
                    and what is still unresolved. */}
                {userStats ? (
                    <View className="flex-row flex-wrap mt-4 pt-4 border-t border-line" style={{ gap: 8 }}>
                        {[
                            ['Students', userStats.students],
                            ['Alumni', userStats.alumni],
                            ['Recruiters', userStats.recruiters],
                            ['Pending payments', paymentStats?.pending ?? 0],
                            ['Reports', reports.length],
                        ].map(([label, value]: any) => (
                            <View key={label} className="bg-paper-2 rounded-2xl px-3 py-2">
                                <Label>{label}</Label>
                                <Num style={{ fontSize: 15, marginTop: 2 }}>{value}</Num>
                            </View>
                        ))}
                    </View>
                ) : null}
            </Card>
        </ScrollView>
    );

    if (!isAuthenticated) {
        return (
            <View className="flex-1 bg-paper">
                <StatusBar barStyle={C.barStyle} />
                
                <AppBar title="Admin Access" onBack={() => navigation.goBack()} />
                <SafeAreaView className="flex-1 justify-center px-gutter" edges={['bottom']}>
                    <Card padded>
                        <IconTile icon="shield-checkmark-outline" size={56} style={{ marginBottom: 16 }} />
                        <Text className="text-ink-2 text-sm mb-6">
                            Enter the admin password to open the admin portal.
                        </Text>

                        <FormField
                            label="Admin password"
                            value={adminPassword}
                            onChangeText={setAdminPassword}
                            placeholder="Enter admin password"
                            secureTextEntry
                            onSubmitEditing={handleVerifyPassword}
                            containerStyle={{ marginBottom: 16 }}
                        />

                        <Button title="Unlock" icon="key-outline" variant="solid" block loading={verifyingPassword} onPress={handleVerifyPassword} />
                        <Button title="Cancel" variant="tertiary" block onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
                    </Card>
                </SafeAreaView>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            

            <View className="flex-1">
                <AppBar
                    title={view === 'hub' ? 'Admin Portal' : TAB_TITLES[activeTab]}
                    onBack={() => (view === 'feature' ? setView('hub') : navigation.goBack())}
                    right={view === 'feature' && activeTab !== 'rewards' && activeTab !== 'messages' && activeTab !== 'reports' && activeTab !== 'users' && activeTab !== 'subscription' && activeTab !== 'payments' && activeTab !== 'gifts' ? (
                        <IconBtn name="add" boxed accessibilityLabel="Add new" onPress={() => { resetForm(); setModalVisible(true); }} />
                    ) : undefined}
                />
                <View className="px-gutter">
                    {view === 'feature' && activeTab === 'users' && (
                        <View className="flex-row items-center mt-2 mb-2" style={{ gap: 8 }}>
                            <SearchField
                                containerStyle={{ flex: 1 }}
                                placeholder="Search users"
                                value={userSearch}
                                onChangeText={setUserSearch}
                                onClear={() => setUsers([])}
                                onSubmitEditing={() => {
                                    if (userSearch.trim()) fetchAdminUsers(userSearch);
                                    else setUsers([]);
                                }}
                            />
                            <Button
                                title="Search"
                                small
                                variant="solid"
                                onPress={() => {
                                    if (userSearch.trim()) fetchAdminUsers(userSearch);
                                    else setUsers([]);
                                }}
                            />
                        </View>
                    )}
                </View>

                {activeTab === 'subscription' && view === 'feature' && (
                    <Card padded style={{ marginHorizontal: 20, marginTop: 16 }}>
                        <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
                            <IconTile icon="pricetag-outline" size={44} />
                            <View className="flex-1">
                                <Text className="text-ink font-semibold text-base">Subscription price</Text>
                                <Text className="text-ink-3 text-xs mt-0.5">Live rate ₹{currentSubscriptionPrice}/mo · {currentIsSubscriptionEnabled ? 'Enabled' : 'Disabled'}</Text>
                            </View>
                        </View>

                        <View className="flex-row justify-between items-center bg-paper-2 p-4 rounded-2xl mb-4">
                            <View className="flex-1 mr-3">
                                <Text className="text-ink font-semibold text-sm">Enable subscriptions</Text>
                                <Text className="text-ink-3 text-xs mt-1">If disabled, the app is free and all users instantly bypass the paywall.</Text>
                            </View>
                            <Switch
                                value={isSubscriptionEnabled}
                                onValueChange={setIsSubscriptionEnabled}
                                trackColor={{ false: C.line, true: C.paper2 }}
                                thumbColor={isSubscriptionEnabled ? C.brand[500] : C.ink3}
                                accessibilityLabel="Enable subscriptions"
                            />
                        </View>

                        <FormField
                            label="New monthly rate (INR)"
                            value={subscriptionPrice}
                            onChangeText={setSubscriptionPrice}
                            keyboardType="numeric"
                            placeholder="39"
                            right={<Text className="text-ink-3 text-sm">/mo</Text>}
                            containerStyle={{ marginBottom: 16 }}
                        />

                        <Button title="Save pricing" icon="save-outline" variant="solid" block loading={submitting} onPress={handleUpdateSubscription} />
                    </Card>
                )}

            {view === 'hub' ? (
                // Called, not mounted: a component defined in render is a new type
                // every render, so the hub remounted (and lost scroll) on each update.
                HubView()
            ) : activeTab === 'gifts' ? (
                <GiftAdmin />
            ) : activeTab === 'subscription' ? (
                // Subscription view is rendered above, so we render nothing here to prevent the FlatList fallback
                null
            ) : activeTab === 'broadcast' ? (
                // Taller than a phone once the preview shows; without a scroller the
                // Send button sat off-screen / under the keyboard.
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Card padded style={{ marginHorizontal: 20, marginTop: 16 }}>
                    <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
                        <IconTile icon="notifications-outline" size={44} />
                        <View className="flex-1">
                            <Text className="text-ink font-semibold text-base">Global broadcast</Text>
                            <Text className="text-ink-3 text-xs mt-0.5">Send an alert to all users</Text>
                        </View>
                    </View>

                    {/* Zero devices is the usual reason a broadcast appears to do
                        nothing, and it is invisible without this. */}
                    <View className={`flex-row items-center p-4 rounded-2xl border mb-4 ${reach && reach.devices === 0 ? 'bg-danger/10 border-danger/30' : 'bg-paper-2 border-line'}`}>
                        <Ionicons
                            name={reach && reach.devices === 0 ? 'warning-outline' : 'phone-portrait-outline'}
                            size={18}
                            color={reach && reach.devices === 0 ? C.danger : C.ink2}
                        />
                        <Text className="text-ink-2 text-sm ml-3 flex-1">
                            {reach === null
                                ? 'Checking how many devices are registered…'
                                : reach.devices === 0
                                    ? 'No devices are registered. Nobody will receive a push notification.'
                                    : `Will reach ${reach.devices} device${reach.devices === 1 ? '' : 's'} across ${reach.users} of ${reach.totalUsers} users.`}
                        </Text>
                    </View>

                    <View style={{ gap: 16 }}>
                        <FormField
                            label="Notification title"
                            value={broadcastTitle}
                            onChangeText={setBroadcastTitle}
                            placeholder="e.g., Server maintenance"
                        />
                        <FormField
                            label="Message"
                            value={broadcastBody}
                            onChangeText={setBroadcastBody}
                            placeholder="Enter the broadcast message here..."
                            multiline
                        />
                        <FormField
                            label="Image URL (optional)"
                            hint="Shown as the expandable picture in the phone notification."
                            value={broadcastImage}
                            onChangeText={setBroadcastImage}
                            placeholder="https://..."
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                    </View>

                    {/* What the notification will actually look like on a phone. */}
                    <Label style={{ marginTop: 24, marginBottom: 8 }}>Preview</Label>
                    <View className="bg-paper-2 rounded-2xl p-3 mb-6">
                        <View className="flex-row items-center mb-2">
                            <Image source={require('../../assets/Fync.png')} className="w-5 h-5 rounded" />
                            <Text className="text-ink-3 text-xs font-semibold ml-2">Fync</Text>
                            <Text className="text-ink-3 text-xs ml-2">now</Text>
                        </View>
                        <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
                            {broadcastTitle.trim() || 'Notification title'}
                        </Text>
                        <Text className="text-ink-2 text-xs mt-0.5" numberOfLines={3}>
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

                    <Button title="Send broadcast" icon="send-outline" variant="solid" block loading={sendingBroadcast} onPress={handleBroadcast} />
                </Card>
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
                                                <ReportItem item={item} onDelete={handleDelete} onResolve={handleResolveReport} /> :
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
                                                ['Successful', paymentStats.successful, C.success],
                                                ['Pending', paymentStats.pending, C.warning],
                                                ['Failed', paymentStats.failed, C.danger],
                                            ].map(([label, value, tone]: any) => (
                                                <View key={label} className="flex-1 bg-card border border-line rounded-2xl p-3">
                                                    <Label>{label}</Label>
                                                    <Num style={{ fontSize: 19, marginTop: 2, color: tone }}>{value}</Num>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}

                                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                        {[
                                            { label: 'All', value: '' },
                                            { label: 'Successful', value: 'paid' },
                                            { label: 'Pending', value: 'created' },
                                            { label: 'Failed', value: 'failed' },
                                        ].map((f) => {
                                            const on = paymentFilter === f.value;
                                            return (
                                                <Chip
                                                    key={f.value || 'all'}
                                                    label={f.label}
                                                    active={on}
                                                    onPress={() => {
                                                        setPaymentFilter(f.value as any);
                                                        setPaymentCursor(null);
                                                        setPayments([]);
                                                        fetchPayments({ reset: true, status: f.value });
                                                    }}
                                                />
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
                                        <Text className="text-ink-3 text-xs">That is every payment</Text>
                                    </View>
                                ) : null
                            ) : null
                        }
                        ListEmptyComponent={
                            <Empty
                                icon="file-tray-outline"
                                title={activeTab === 'ads' ? 'No ads found' :
                                    activeTab === 'marketplace' ? 'No reward items found' :
                                        activeTab === 'rewards' ? 'No reward applications found' :
                                            activeTab === 'reports' ? 'No reported posts' :
                                                activeTab === 'users' ? 'No users found' :
                                                    activeTab === 'payments' ? 'No payments yet' :
                                                        activeTab === 'media' ? 'No media found' :
                                                        'No messages found'}
                            />
                        }
                    />
                )
            )}

            <Sheet
                visible={modalVisible}
                onClose={() => { setModalVisible(false); resetForm(); }}
                title={editingAd || editingProduct ? 'Edit item' : activeTab === 'ads' ? 'New ad banner' : activeTab === 'media' ? 'Publish Fync Media' : 'New reward item'}
                footer={
                    <Button
                        title={editingAd || editingProduct ? 'Save changes' : activeTab === 'ads' ? 'Publish ad' : activeTab === 'media' ? 'Publish media' : 'Add to store'}
                        variant="primary"
                        block
                        loading={submitting}
                        onPress={handleSubmit}
                    />
                }
            >
                <Pressable
                    onPress={pickImage}
                    className={`w-full ${activeTab === 'marketplace' || activeTab === 'media' ? '' : 'h-40'} bg-paper-2 rounded-2xl border border-dashed border-line items-center justify-center mb-4 overflow-hidden active:opacity-85`}
                    style={activeTab === 'marketplace' || activeTab === 'media' ? { aspectRatio: 16 / 9 } : undefined}
                    accessibilityRole="button"
                    accessibilityLabel="Pick image"
                >
                    {imageUri ? <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : imageUrl ? <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode={activeTab === 'marketplace' ? "contain" : "cover"} /> : (
                        <View className="items-center">
                            <Ionicons name="image-outline" size={36} color={C.ink3} />
                            <Text className="text-ink-3 font-medium text-sm mt-2">Pick {activeTab === 'marketplace' ? 'item' : activeTab === 'media' ? 'thumbnail' : 'banner'} image</Text>
                        </View>
                    )}
                </Pressable>

                {activeTab === 'media' && (
                    <Pressable
                        onPress={pickVideo}
                        className="w-full aspect-video bg-paper-2 border border-dashed border-line items-center justify-center mb-4 overflow-hidden rounded-2xl active:opacity-85"
                        accessibilityRole="button"
                        accessibilityLabel={videoUri ? 'Video ready. Pick a different video' : 'Pick video file'}
                    >
                        {videoUri ? (
                            <View className="items-center">
                                <Ionicons name="videocam" size={36} color={C.recruiter} />
                                <Text className="text-recruiter font-semibold text-sm mt-2">Video ready</Text>
                            </View>
                        ) : (
                            <View className="items-center">
                                <Ionicons name="videocam-outline" size={36} color={C.ink3} />
                                <Text className="text-ink-3 font-medium text-sm mt-2">Pick video file</Text>
                            </View>
                        )}
                    </Pressable>
                )}

                <View style={{ gap: 12 }}>
                    <FormField
                        value={imageUrl}
                        onChangeText={t => { setImageUrl(t); setImageUri(null); }}
                        placeholder="Or paste image URL"
                        accessibilityLabel="Image URL"
                        autoCapitalize="none"
                    />
                    <FormField
                        value={title}
                        onChangeText={setTitle}
                        placeholder={activeTab === 'ads' ? "Ad title" : activeTab === 'media' ? "Video title" : "Product name"}
                        accessibilityLabel="Title"
                    />

                    {activeTab === 'marketplace' && (
                        <>
                            <FormField
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Product description"
                                accessibilityLabel="Product description"
                                multiline
                            />
                            <FormField
                                value={coins}
                                onChangeText={setCoins}
                                placeholder="Coins required"
                                accessibilityLabel="Coins required"
                                keyboardType="numeric"
                            />
                        </>
                    )}

                    {activeTab === 'media' && (
                        <>
                            <FormField
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Video description"
                                accessibilityLabel="Video description"
                                multiline
                            />
                            <FormField
                                value={tags}
                                onChangeText={setTags}
                                placeholder="Tags (comma separated)"
                                accessibilityLabel="Tags"
                            />
                        </>
                    )}

                    {activeTab === 'ads' && (
                        <FormField
                            value={linkUrl}
                            onChangeText={setLinkUrl}
                            placeholder="Link URL"
                            accessibilityLabel="Link URL"
                            autoCapitalize="none"
                        />
                    )}

                    {activeTab !== 'media' && (
                        <View className="flex-row justify-between items-center bg-paper-2 p-4 rounded-2xl">
                            <View className="flex-1 mr-3">
                                <Text className="text-ink font-semibold text-sm">{activeTab === 'ads' ? 'Ad visible' : 'Item available'}</Text>
                                <Text className="text-ink-3 text-xs">Toggling this will hide/show the item</Text>
                            </View>
                            <Switch
                                value={isActive}
                                onValueChange={setIsActive}
                                trackColor={{ false: C.line, true: C.paper2 }}
                                thumbColor={isActive ? C.brand[500] : C.ink3}
                                accessibilityLabel={activeTab === 'ads' ? 'Ad visible' : 'Item available'}
                            />
                        </View>
                    )}
                </View>
            </Sheet>
            </View>
            {/* Subscription confirmation */}
            <Sheet
                visible={subConfirmModalVisible}
                onClose={() => setSubConfirmModalVisible(false)}
                dismissable={!submittingPrice}
                title="Confirm price change"
                subtitle={`You are about to change the global subscription price to ₹${subscriptionPrice}. Re-enter the admin password to confirm.`}
                footer={
                    <View className="flex-row" style={{ gap: 12 }}>
                        <Button title="Cancel" variant="tertiary" disabled={submittingPrice} onPress={() => setSubConfirmModalVisible(false)} style={{ flex: 1 }} />
                        <Button title="Update price" variant="danger" loading={submittingPrice} onPress={confirmAndDeploySubscriptionPrice} style={{ flex: 1 }} />
                    </View>
                }
            >
                <FormField
                    label="Admin password"
                    value={subConfirmPassword}
                    onChangeText={setSubConfirmPassword}
                    placeholder="Enter admin password"
                    secureTextEntry
                    onSubmitEditing={confirmAndDeploySubscriptionPrice}
                />
            </Sheet>
        </View>
    );
};

export default AdminPortal;
