import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Image, 
  ActivityIndicator, Dimensions, Alert, Modal, TextInput, Linking, Share,
  StatusBar, Platform, Animated,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome5, SimpleLineIcons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { WebView } from 'react-native-webview';

const { width, height: screenHeight } = Dimensions.get('window');

const CommunityHubScreen = ({ navigation, route }: any) => {
    const { communityId } = route.params;
    const { user } = useAuth();
    
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [leaving, setLeaving] = useState(false);

    // Modals & State
    const [subModalVisible, setSubModalVisible] = useState(false);
    const [subName, setSubName] = useState('');
    const [subDesc, setSubDesc] = useState('');
    const [subType, setSubType] = useState<'chat' | 'announcement' | 'feed'>('chat');
    const [subLogo, setSubLogo] = useState<string | null>(null);
    const [creatingSub, setCreatingSub] = useState(false);
    const [editHubModal, setEditHubModal] = useState(false);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editLogo, setEditLogo] = useState<string | null>(null);
    const [editBanner, setEditBanner] = useState<string | null>(null);
    const [updatingHub, setUpdatingHub] = useState(false);
    const [renewPlan, setRenewPlan] = useState<'monthly' | 'yearly'>('monthly');
    const [renewing, setRenewing] = useState(false);
    const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);
    
    // Social Handle State
    const [yt, setYt] = useState('');
    const [gh, setGh] = useState('');
    const [li, setLi] = useState('');
    const [tw, setTw] = useState('');
    const [ws, setWs] = useState('');

    const [editSubModal, setEditSubModal] = useState(false);
    const [targetSubId, setTargetSubId] = useState<string | null>(null);

    // WebView Fallback
    const [showWebView, setShowWebView] = useState(false);
    const [webViewHtml, setWebViewHtml] = useState('');

    const fetchDetails = async () => {
        try {
            const res = await axios.get(`/communities/details/${communityId}`);
            if (res.data.success) {
                setData(res.data);
                const comm = res.data.community;
                setEditName(comm.name);
                setEditDesc(comm.description);
                setEditLogo(comm.logo);
                setEditBanner(comm.banner);
                if (comm.socialLinks) {
                    setYt(comm.socialLinks.youtube || '');
                    setGh(comm.socialLinks.github || '');
                    setLi(comm.socialLinks.linkedin || '');
                    setTw(comm.socialLinks.twitter || '');
                    setWs(comm.socialLinks.website || '');
                }
            }
        } catch (error) { console.log("Fetch error", error); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchDetails(); }, [communityId]);

    const handleJoin = async () => {
        if (isJoining) return;
        setIsJoining(true);
        try {
            const res = await axios.post(`/communities/join/${communityId}`, { userId: user?._id });
            if (res.data.success) { 
                Alert.alert("Subscribed", "Welcome to the ecosystem!"); 
                fetchDetails(); 
            }
        } catch (error: any) { 
            Alert.alert("Error", error.response?.data?.message || "Subscription failed"); 
        } finally { 
            setIsJoining(false); 
        }
    };

    const handleLeave = () => {
        Alert.alert("Unsubscribe", "Unsubscribe from this hub?", [
            { text: "Stay", style: "cancel" },
            { text: "Unsubscribe", style: "destructive", onPress: async () => {
                setLeaving(true);
                try {
                    const res = await axios.post(`/communities/leave/${communityId}`, { userId: user?._id });
                    if (res.data.success) navigation.navigate('CommunityList');
                } catch (e: any) { Alert.alert("Error", "Unsubscription failed"); }
                finally { setLeaving(false); }
            }}
        ]);
    };

    const handleShare = async () => {
        try {
            const shareUrl = `https://fync-api.duckdns.org/community?id=${communityId}`;
            const message = `🚀 Connect with ${data.community.name} on Fync!\n\nJoin here: ${shareUrl}\n\nInvite: fync://community/hub/${communityId}`;
            await Share.share({ message });
        } catch (e) { Alert.alert("Error", "Sharing failed"); }
    };

    const handleRestoreSuccess = async (paymentData: any) => {
        setRenewing(true);
        try {
            const res = await axios.post('/payment/verify', { 
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
            });
            
            if (res.data.success) { 
                Alert.alert("Ignited!", `${renewPlan === 'yearly' ? 'Yearly eternal' : 'Monthly spark'} activated.`); 
                fetchDetails(); 
            }
        } catch (e: any) {
            Alert.alert("Restoration Failed", "Communication breakdown during verifiication protocol.");
        } finally {
            setRenewing(false);
        }
    };

    const handleExportHistory = async (subId: string, subName: string) => {
        try {
            const url = `${axios.defaults.baseURL}/communities/sub/export/${subId}`;
            await Linking.openURL(url);
            Alert.alert("Exporting", "Your realm's frequency history is being generated.");
        } catch (e) { Alert.alert("Export Error", "Communication breakdown."); }
    };

    const handleCreateSubCommunity = async () => {
        if (!subName.trim()) { Alert.alert("Error", "Channel name required."); return; }
        setCreatingSub(true);
        try {
            const formData = new FormData();
            formData.append('communityId', communityId);
            formData.append('name', subName);
            formData.append('description', subDesc);
            formData.append('type', subType);
            if (subLogo && !subLogo.startsWith('http')) {
                const filename = subLogo.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('logo', { uri: subLogo, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }

            const res = await axios.post('/communities/sub/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setSubModalVisible(false);
                setSubName('');
                setSubDesc('');
                setSubType('chat');
                setSubLogo(null);
                fetchDetails();
                Alert.alert("Success", "Ecosystem room expanded.");
            }
        } catch (e) { Alert.alert("Error", "Room expansion failed"); }
        finally { setCreatingSub(false); }
    };

    const handleUpdateSubCommunity = async () => {
        if (!targetSubId) return;
        if (!subName.trim()) { Alert.alert("Error", "Channel name required."); return; }
        setCreatingSub(true);
        try {
            const formData = new FormData();
            formData.append('subId', targetSubId);
            formData.append('name', subName);
            formData.append('description', subDesc);
            formData.append('userId', user?._id);
            if (subLogo && !subLogo.startsWith('http')) {
                const filename = subLogo.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('logo', { uri: subLogo, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }

            const res = await axios.put('/communities/sub/update', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setEditSubModal(false);
                setSubName('');
                setSubDesc('');
                setSubType('chat');
                setSubLogo(null);
                fetchDetails();
                Alert.alert("Updated", "Ecosystem room re-synchronized.");
            }
        } catch (e) { Alert.alert("Error", "Refinement failed"); }
        finally { setCreatingSub(false); }
    };

    const handleDeleteSubCommunity = async () => {
        if (!targetSubId) return;
        Alert.alert("Dissolve Room", "Permanent purging of all messages in this room frequency.", [
            { text: "Abort", style: "cancel" },
            { text: "Dissolve", style: "destructive", onPress: async () => {
                setCreatingSub(true);
                try {
                    const res = await axios.delete('/communities/sub/delete', { 
                        data: { subId: targetSubId, userId: user?._id } 
                    });
                    if (res.data.success) {
                        setEditSubModal(false);
                        fetchDetails();
                        Alert.alert("Dissolved", "Channel spectral signature purged.");
                    }
                } catch (e) { Alert.alert("Error", "Dissolution failed"); }
                finally { setCreatingSub(false); }
            }}
        ]);
    };

    const handleRenew = async () => {
        if (renewing) return;
        setRenewing(true);
        try {
            const orderRes = await axios.post('/payment/order', {
                purpose: 'community_spark',
                plan: renewPlan,
                communityId,
            });

            if (!orderRes.data.id) throw new Error("Order generation failed");

            const options = {
                description: `Restore Spark for ${data.community.name}`,
                image: data.community.logo || 'https://i.imgur.com/39M8xXo.png',
                currency: 'INR',
                key: RAZORPAY_KEY_ID, 
                amount: orderRes.data.amount,
                name: 'Fync Ecosystem',
                order_id: orderRes.data.id,
                prefill: {
                    email: user?.email,
                    contact: user?.phone || '',
                    name: user?.username || user?.name
                },
                theme: { color: '#f97316' }
            };

            const triggerWebView = () => {
                const content = `
                <html>
                <body style="background-color: #F8FAFC; display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <script>
                    var options = {
                        key: "${RAZORPAY_KEY_ID}",
                        amount: "${orderRes.data.amount}",
                        currency: "INR",
                        name: "Fync Ecosystem",
                        description: "Restore Spark for ${data.community.name}",
                        order_id: "${orderRes.data.id}",
                        prefill: {
                            name: "${user?.username || ''}",
                            email: "${user?.email || ''}",
                            contact: "${user?.phone || ''}"
                        },
                        theme: { color: "#f97316" },
                        handler: function (response) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                event: "SUCCESS",
                                data: response
                            }));
                        },
                        modal: {
                            ondismiss: function () {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                    event: "FAILED"
                                }));
                            }
                        }
                    };
                    var rzp1 = new Razorpay(options);
                    rzp1.open();
                    </script>
                </body>
                </html>
            `;
            setWebViewHtml(content);
            setShowWebView(true);
            };

            if (RazorpayCheckout && typeof RazorpayCheckout.open === 'function') {
                try {
                    RazorpayCheckout.open(options).then(handleRestoreSuccess).catch((error: any) => {
                        if (error?.description?.includes('null') || !error?.code || error?.description?.includes('bridge')) {
                            triggerWebView();
                        } else {
                            Alert.alert(`Ignition Error`, error.description || "Ecosystem restoration aborted");
                            setRenewing(false);
                        }
                    });
                } catch (e) {
                    triggerWebView();
                }
            } else {
                triggerWebView();
            }
        } catch (e: any) { 
            Alert.alert("Error", e.response?.data?.message || "Renewal failed"); 
            setRenewing(false); 
        }
    };

    const handleWebMsg = (event: any) => {
        const msg = JSON.parse(event.nativeEvent.data);
        setShowWebView(false);
        if (msg.event === 'SUCCESS') {
            handleRestoreSuccess(msg.data);
        } else {
            setRenewing(false);
            Alert.alert("Payment Cancelled", "Restoration protocol requires a valid Spark ignition.");
        }
    };

    const pickImage = async (setter: (uri: string) => void, isBanner: boolean = false) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: isBanner ? [16, 9] : [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) setter(result.assets[0].uri);
    };

    const handleUpdateHub = async () => {
        if (updatingHub) return;
        setUpdatingHub(true);
        try {
            const formData = new FormData();
            formData.append('communityId', communityId);
            formData.append('userId', user?._id);
            formData.append('name', editName);
            formData.append('description', editDesc);
            const socialLinks = { youtube: yt, github: gh, linkedin: li, twitter: tw, website: ws };
            formData.append('socialLinks', JSON.stringify(socialLinks));

            if (editLogo && !editLogo.startsWith('http')) {
                const filename = editLogo.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('logo', { uri: editLogo, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }
            if (editBanner && !editBanner.startsWith('http')) {
                const filename = editBanner.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('banner', { uri: editBanner, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }

            const res = await axios.put('/communities/update', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) { setEditHubModal(false); fetchDetails(); }
        } catch (e) { Alert.alert("Error", "Update failed"); }
        finally { setUpdatingHub(false); }
    };

    const handleDeleteHub = () => {
        Alert.alert("Are you sure to delete this community?", "Permanent deletion of all rooms and messages will happen.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    const res = await axios.delete('/communities/delete', { data: { communityId, userId: user?._id } });
                    if (res.data.success) navigation.navigate('CommunityList');
                } catch (e) { Alert.alert("Error", "Deletion failed"); }
            }}
        ]);
    };

    const CommunityHubSkeleton = () => {
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
            <Animated.View style={{ opacity: pulseAnim }} className="flex-1 bg-[#F8FAFC]">
                <View className="h-64 bg-slate-200" />
                <View className="px-8 pt-10">
                    <View className="flex-row gap-4 mb-8">
                        <View className="flex-1 h-14 bg-slate-100 rounded-2xl" />
                        <View className="w-14 h-14 bg-slate-100 rounded-2xl" />
                    </View>
                    <View className="h-4 bg-slate-100 rounded-full w-24 mb-4" />
                    <View className="h-3 bg-slate-50 rounded-full w-full mb-2" />
                    <View className="h-3 bg-slate-50 rounded-full w-4/5" />
                </View>
            </Animated.View>
        );
    };

    if (loading) return <CommunityHubSkeleton />;
    if (!data) return <View className="flex-1 items-center justify-center bg-[#F8FAFC]"><Text className="font-black uppercase text-xs text-slate-500">Hub Not Found</Text></View>;

    const { community, subCommunities, creatorOtherCommunities } = data;
    const isMember = community.members?.includes(user?._id);
    const isCreator = community.creator?._id === user?._id;
    const isSuspended = community.subscription?.status === 'suspended';
    const socials = community.socialLinks || {};

    const expiryDate = new Date(community.subscription?.expiryDate || 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Cinematic Header */}
                <View className="h-72 w-full relative">
                    <Image source={{ uri: community.banner || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' }} className="w-full h-full" resizeMode="cover" />
                    <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.9)']} className="absolute inset-0" />
                    
                    <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 flex-row justify-between px-6 pt-4">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 bg-black/20 rounded-2xl items-center justify-center backdrop-blur-md border border-white/10">
                            <Ionicons name="chevron-back" size={20} color="white" />
                        </TouchableOpacity>
                        {isCreator && (
                            <TouchableOpacity onPress={() => setEditHubModal(true)} className="w-11 h-11 bg-black/20 rounded-2xl items-center justify-center backdrop-blur-md border border-white/10">
                                <Feather name="settings" size={18} color="white" />
                            </TouchableOpacity>
                        )}
                    </SafeAreaView>

                    <View className="absolute bottom-8 left-8 right-8 flex-row items-end gap-6">
                        <View className="w-20 h-20 rounded-full border-4 border-white/20 shadow-2xl overflow-hidden bg-slate-900">
                            <Image source={{ uri: community.logo || 'https://via.placeholder.com/150' }} className="w-full h-full" />
                        </View>
                        <View className="flex-1 pb-1">
                            <Text className="text-white text-3xl font-black uppercase tracking-tighter leading-tight" numberOfLines={1}>{community.name}</Text>
                            <View className="flex-row items-center gap-2 mt-1">
                                <View className="w-2 h-2 rounded-full bg-orange-500 shadow-lg shadow-orange-500/50" />
                                <Text className="text-white/60 text-2xs font-black uppercase tracking-wide">{community.members?.length} Sparks Active</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Primary Actions */}
                <View className="px-8 pt-8">
                    <View className="flex-row gap-4 mb-10">
                        {isMember ? (
                            <TouchableOpacity 
                                onPress={isCreator ? undefined : handleLeave} 
                                className={`flex-1 h-14 rounded-2xl items-center justify-center ${isCreator ? 'bg-white border border-slate-100 shadow-sm' : 'bg-rose-50 border border-rose-100'}`}
                            >
                                <Text className={`font-black uppercase text-2xs tracking-widest ${isCreator ? 'text-slate-500' : 'text-rose-600'}`}>
                                     {isCreator ? "Guardian Access" : "Leave Sector"}
                                 </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={handleJoin} disabled={isJoining} className="flex-1 h-14 bg-orange-500 rounded-2xl items-center justify-center shadow-xl shadow-orange-500/30">
                                {isJoining ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-black uppercase text-2xs tracking-wide">Join Frequency</Text>}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleShare} className="w-14 h-14 bg-white border border-slate-100 rounded-2xl items-center justify-center shadow-sm">
                            <Ionicons name="share-social-outline" size={20} color="#18181b" />
                        </TouchableOpacity>
                    </View>

                    <View className="mb-10">
                        <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Hub Directive</Text>
                        <Text className="text-slate-700 font-medium leading-[22px] text-xs mb-6">
                            {community.description || "The definitive ecosystem for creator networking and collaborative expansion."}
                        </Text>
                        
                        {isCreator && (
                            <View className="mb-8">
                                <TouchableOpacity 
                                    onPress={() => setIsPaymentExpanded(!isPaymentExpanded)}
                                    className="flex-row items-center justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm"
                                >
                                    <View className="flex-row items-center gap-4">
                                        <View className={`w-3 h-3 rounded-full ${daysLeft > 7 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <View>
                                            <Text className="text-slate-900 font-black uppercase text-2xs tracking-tight">{daysLeft > 0 ? `${daysLeft} Activation Days` : 'Spark Exhausted'}</Text>
                                            <Text className="text-slate-500 font-bold text-2xs uppercase mt-0.5 tracking-wide">Stability Protocol</Text>
                                        </View>
                                    </View>
                                    <Feather name={isPaymentExpanded ? "chevron-up" : "chevron-down"} size={18} color="#CBD5E1" />
                                </TouchableOpacity>

                                {isPaymentExpanded && (
                                    <View className="mt-3 bg-white p-6 rounded-4xl border border-slate-100 shadow-xl shadow-black/5">
                                        <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Maintenance Ignition</Text>
                                        <View className="flex-row gap-3 mb-6">
                                            <TouchableOpacity 
                                                onPress={() => setRenewPlan('monthly')} 
                                                className={`flex-1 p-4 rounded-2xl border ${renewPlan === 'monthly' ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-100'}`}
                                            >
                                                <Text className={`font-black uppercase text-2xs text-center ${renewPlan === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Spark (₹99)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => setRenewPlan('yearly')} 
                                                className={`flex-1 p-4 rounded-2xl border ${renewPlan === 'yearly' ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-100'}`}
                                            >
                                                <Text className={`font-black uppercase text-2xs text-center ${renewPlan === 'yearly' ? 'text-white' : 'text-slate-500'}`}>Eternal (₹999)</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={handleRenew} 
                                            disabled={renewing} 
                                            className="bg-orange-500 w-full py-5 rounded-2xl items-center shadow-xl shadow-orange-500/40"
                                        >
                                            {renewing ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-black uppercase text-2xs tracking-wide">Initiate Payment</Text>}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                        
                        <View className="flex-row gap-3">
                            {socials.youtube && (
                                <TouchableOpacity onPress={() => Linking.openURL(socials.youtube)} className="w-11 h-11 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm">
                                    <Feather name="youtube" size={16} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                            {socials.github && (
                                <TouchableOpacity onPress={() => Linking.openURL(socials.github)} className="w-11 h-11 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm">
                                    <Feather name="github" size={16} color="#18181b" />
                                </TouchableOpacity>
                            )}
                            {socials.website && (
                                <TouchableOpacity onPress={() => Linking.openURL(socials.website)} className="w-11 h-11 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm">
                                    <Feather name="globe" size={16} color="#f97316" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Channels */}
                    <View className="mb-12">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-slate-900 text-xl font-black uppercase tracking-tight">Access Points</Text>
                            {isCreator && (
                                <TouchableOpacity onPress={() => { setSubModalVisible(true); setTargetSubId(null); }} className="w-10 h-10 bg-slate-900 rounded-xl items-center justify-center shadow-lg shadow-black/20">
                                    <Ionicons name="add" size={24} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {subCommunities.length === 0 ? (
                            <View className="bg-slate-50 p-10 rounded-4xl items-center border border-slate-100 border-dashed">
                                <Feather name="radio" size={32} color="#CBD5E1" />
                                <Text className="text-slate-500 font-black uppercase text-2xs mt-4 tracking-wide text-center">No Frequencies Established</Text>
                            </View>
                        ) : subCommunities.map((sub: any) => (
                            <TouchableOpacity 
                                key={sub._id} 
                                onPress={() => {
                                    if (isSuspended) { Alert.alert("Sector Offline", "Activation required."); return; }
                                    // A 'feed' room is a subreddit, not a chat channel.
                                    if (sub.type === 'feed') {
                                        navigation.navigate('CommunityFeed', { subId: sub._id, subName: sub.name, communityId: community._id });
                                    } else {
                                        navigation.navigate('SubCommunityChat', { subId: sub._id, subName: sub.name, communityId: community._id });
                                    }
                                }}
                                className={`bg-white p-5 rounded-3xl border border-slate-100 flex-row items-center gap-5 mb-3 shadow-sm shadow-black/5 ${isSuspended ? 'opacity-30' : ''}`}
                            >
                                <View className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center overflow-hidden border border-slate-100">
                                    {sub.logo
                                        ? <Image source={{ uri: sub.logo }} className="w-full h-full" />
                                        : <Feather name={sub.type === 'feed' ? 'trending-up' : 'hash'} size={20} color="#CBD5E1" />}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-900 font-black uppercase text-2xs tracking-tight">{sub.name}</Text>
                                    <Text className="text-slate-500 font-bold text-2xs uppercase mt-0.5 tracking-wide">
                                        {sub.type === 'feed' ? 'Post Feed' : sub.type === 'announcement' ? 'Announcements' : 'Active Link'}
                                    </Text>
                                </View>
                                {isCreator && (
                                    <View className="flex-row gap-2">
                                        <TouchableOpacity 
                                            onPress={(e: any) => { 
                                                e.stopPropagation(); 
                                                setTargetSubId(sub._id); 
                                                setSubName(sub.name); 
                                                setSubDesc(sub.description || ''); 
                                                setSubLogo(sub.logo); 
                                                setEditSubModal(true); 
                                            }}
                                            className="w-9 h-9 bg-slate-50 rounded-xl items-center justify-center border border-slate-100"
                                        >
                                            <Feather name="edit-3" size={14} color="#f97316" />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={(e: any) => { e.stopPropagation(); handleExportHistory(sub._id, sub.name); }}
                                            className="w-9 h-9 bg-slate-50 rounded-xl items-center justify-center border border-slate-100"
                                        >
                                            <Feather name="download" size={14} color="#10b981" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Other Realms */}
                    {creatorOtherCommunities.length > 0 && (
                        <View className="mb-20">
                            <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-6">Linked Sectors</Text>
                            <View className="flex-row flex-wrap gap-4">
                                {creatorOtherCommunities.map((c: any) => (
                                    <TouchableOpacity 
                                        key={c._id} 
                                        onPress={() => navigation.push('CommunityHub', { communityId: c._id })}
                                        className="bg-white p-4 rounded-3xl border border-slate-100 items-center w-[29%] shadow-sm"
                                    >
                                        <View className="w-11 h-11 rounded-2xl overflow-hidden mb-3 border border-slate-100 bg-slate-50">
                                            <Image source={{ uri: c.logo || 'https://via.placeholder.com/150' }} className="w-full h-full" />
                                        </View>
                                        <Text className="text-slate-900 font-black uppercase text-2xs text-center tracking-tighter" numberOfLines={1}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Suspended Guard */}
            {isSuspended && (
                <View className="absolute inset-0 bg-[#F8FAFC] items-center justify-center p-8 z-[100]">
                    <View className="w-24 h-24 bg-rose-50 rounded-4xl items-center justify-center mb-8 border border-rose-100 shadow-sm">
                        <Feather name="zap-off" size={40} color="#ef4444" />
                    </View>
                    <Text className="text-slate-900 text-3xl font-black uppercase text-center tracking-tighter leading-tight">Spark<Text className="text-rose-500">\n</Text>Exhausted</Text>
                    <Text className="text-slate-500 font-bold text-center text-2xs leading-5 mt-4 mb-12 px-10 uppercase tracking-wide">
                        Sector frequency is offline. {isCreator ? "Re-ignite the ecosystem spark to restore connectivity." : "Awaiting guardian activation protocol."}
                    </Text>
                    {isCreator && (
                        <View className="w-full">
                            <View className="flex-row gap-3 mb-4">
                                <TouchableOpacity onPress={() => setRenewPlan('monthly')} className={`flex-1 p-5 rounded-3xl border ${renewPlan === 'monthly' ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-slate-100 shadow-sm'}`}>
                                    <Text className={`font-black uppercase text-2xs text-center tracking-widest ${renewPlan === 'monthly' ? 'text-white' : 'text-slate-500'}`}>Monthly</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setRenewPlan('yearly')} className={`flex-1 p-5 rounded-3xl border ${renewPlan === 'yearly' ? 'bg-slate-900 border-slate-900 shadow-xl' : 'bg-white border-slate-100 shadow-sm'}`}>
                                    <Text className={`font-black uppercase text-2xs text-center tracking-widest ${renewPlan === 'yearly' ? 'text-white' : 'text-slate-500'}`}>Yearly</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleRenew} disabled={renewing} className="bg-orange-500 w-full py-6 rounded-3xl items-center shadow-2xl shadow-orange-500/40">
                                {renewing ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-black uppercase text-2xs tracking-wide">Restore Hub Signal</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mt-12">
                        <Text className="text-slate-300 font-black uppercase text-2xs tracking-wide">Back to Directory</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Sub-Community Creation Modal */}
            <Modal visible={subModalVisible} transparent animationType="slide">
                <View className="flex-1 bg-black/60">
                    <TouchableOpacity activeOpacity={1} onPress={() => setSubModalVisible(false)} className="flex-1" />
                    <KeyboardAvoidingView 
                        behavior="padding"
                        className="w-full bg-white rounded-t-5xl overflow-hidden"
                        style={{ height: screenHeight * 0.8 }}
                    >
                        <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mt-4 mb-2" />
                        <View className="p-8 pb-12 flex-1">
                            <View className="flex-row justify-between items-center mb-8">
                                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tight">Expand <Text className="text-orange-500">Realm</Text></Text>
                                <TouchableOpacity onPress={() => setSubModalVisible(false)} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                    <Ionicons name="close" size={20} color="#18181b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <TouchableOpacity 
                                    onPress={() => pickImage(setSubLogo, false)}
                                    className="w-28 h-28 bg-slate-50 rounded-4xl border border-dashed border-slate-200 items-center justify-center overflow-hidden self-center mb-8 shadow-sm"
                                >
                                    {subLogo ? <Image source={{ uri: subLogo || undefined }} className="w-full h-full" /> : <Feather name="camera" size={24} color="#CBD5E1" />}
                                </TouchableOpacity>

                                <TextInput placeholder="Channel Label (e.g. Protocol)" placeholderTextColor="#CBD5E1" value={subName} onChangeText={setSubName} className="bg-slate-50 p-5 rounded-3xl mb-4 border border-slate-100 font-black uppercase text-xs text-slate-900" />
                                <TextInput placeholder="Directive parameters..." placeholderTextColor="#252d36ff" value={subDesc} onChangeText={setSubDesc} multiline className="bg-slate-50 p-5 rounded-3xl mb-4 border border-slate-100 font-medium h-24 text-xs text-slate-600" textAlignVertical="top" />

                                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-3 ml-1">Room Type</Text>
                                <View className="flex-row gap-2 mb-8">
                                    {([
                                        { key: 'chat', label: 'Chat', icon: 'hash' },
                                        { key: 'feed', label: 'Feed', icon: 'trending-up' },
                                        { key: 'announcement', label: 'Announce', icon: 'volume-2' },
                                    ] as const).map((option) => (
                                        <TouchableOpacity
                                            key={option.key}
                                            onPress={() => setSubType(option.key)}
                                            className={`flex-1 h-14 rounded-3xl items-center justify-center border ${subType === option.key ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-100'}`}
                                        >
                                            <Feather name={option.icon} size={15} color={subType === option.key ? '#fff' : '#94a3b8'} />
                                            <Text className={`font-black uppercase text-2xs tracking-wide mt-1 ${subType === option.key ? 'text-white' : 'text-slate-500'}`}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity 
                                    onPress={handleCreateSubCommunity} 
                                    disabled={creatingSub}
                                    className={`p-6 rounded-3xl items-center mb-20 shadow-xl ${creatingSub ? 'bg-slate-100' : 'bg-slate-900 shadow-black/20'}`}
                                >
                                    {creatingSub ? (
                                        <ActivityIndicator size="small" color="#18181b" />
                                    ) : (
                                        <Text className="text-white font-black uppercase text-2xs tracking-wide">Initiate Room</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Sub-Community Update Modal */}
            <Modal visible={editSubModal} transparent animationType="slide">
                <View className="flex-1 bg-black/60">
                    <TouchableOpacity activeOpacity={1} onPress={() => setEditSubModal(false)} className="flex-1" />
                    <KeyboardAvoidingView 
                        behavior="padding"
                        className="w-full bg-white rounded-t-5xl overflow-hidden"
                        style={{ height: screenHeight * 0.8 }}
                    >
                        <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mt-4 mb-2" />
                        <View className="p-8 pb-12 flex-1">
                            <View className="flex-row justify-between items-center mb-8">
                                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tight">Refine <Text className="text-orange-500">Room</Text></Text>
                                <TouchableOpacity onPress={() => setEditSubModal(false)} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                    <Ionicons name="close" size={20} color="#18181b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                <TouchableOpacity 
                                    onPress={() => pickImage(setSubLogo, false)}
                                    className="w-28 h-28 bg-slate-50 rounded-4xl border border-dashed border-slate-200 items-center justify-center overflow-hidden self-center mb-8 shadow-sm"
                                >
                                    {subLogo ? <Image source={{ uri: subLogo || undefined }} className="w-full h-full" /> : <Feather name="camera" size={24} color="#CBD5E1" />}
                                </TouchableOpacity>

                                <TextInput placeholder="Channel Label" placeholderTextColor="#CBD5E1" value={subName} onChangeText={setSubName} className="bg-slate-50 p-5 rounded-3xl mb-4 border border-slate-100 font-black uppercase text-xs text-slate-900" />
                                <TextInput placeholder="Directive" placeholderTextColor="#CBD5E1" value={subDesc} onChangeText={setSubDesc} multiline className="bg-slate-50 p-5 rounded-3xl mb-8 border border-slate-100 font-medium h-24 text-xs text-slate-600" textAlignVertical="top" />

                                <TouchableOpacity 
                                    onPress={handleUpdateSubCommunity} 
                                    disabled={creatingSub}
                                    className={`p-6 rounded-3xl items-center mb-3 shadow-xl ${creatingSub ? 'bg-slate-100' : 'bg-orange-500 shadow-orange-500/30'}`}
                                >
                                    {creatingSub ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <Text className="text-white font-black uppercase text-2xs tracking-wide">Apply Specs</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={handleDeleteSubCommunity}
                                    className="p-5 rounded-2xl items-center border border-rose-50 mb-20"
                                >
                                    <Text className="text-rose-500 font-black uppercase text-2xs tracking-wide">Dissolve Room</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Configuration Suite */}
            <Modal visible={editHubModal} transparent animationType="slide">
                <View className="flex-1 bg-black/60">
                    <TouchableOpacity activeOpacity={1} onPress={() => setEditHubModal(false)} className="flex-1" />
                    <KeyboardAvoidingView 
                        behavior="padding"
                        className="w-full bg-white rounded-t-5xl overflow-hidden"
                        style={{ height: screenHeight * 0.8 }}
                    >
                        <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mt-4 mb-2" />
                        <View className="p-8 pb-12 flex-1">
                            <View className="flex-row justify-between items-center mb-8">
                                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tight">Update <Text className="text-orange-500">Community</Text></Text>
                                <TouchableOpacity onPress={() => setEditHubModal(false)} className="w-11 h-11 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                                    <Ionicons name="close" size={20} color="#18181b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Authority Specs</Text>
                                <View className="bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100 flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-slate-900 font-black uppercase text-2xs tracking-tight">{daysLeft} Days Remaining</Text>
                                        <Text className="text-slate-500 font-bold text-2xs uppercase mt-0.5 tracking-wide">Active License</Text>
                                    </View>
                                    <View className="px-4 py-2 bg-slate-900 rounded-xl">
                                        <Text className="text-white font-black uppercase text-2xs">Guardian</Text>
                                    </View>
                                </View>

                                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Atmospheric Assets</Text>
                                <View className="flex-row gap-4 mb-8">
                                    <TouchableOpacity 
                                        onPress={() => pickImage(setEditBanner, true)}
                                        className="flex-1 h-36 bg-slate-50 rounded-4xl border border-dashed border-slate-200 items-center justify-center overflow-hidden"
                                    >
                                        {editBanner ? <Image source={{ uri: editBanner || undefined }} className="w-full h-full" /> : <Feather name="image" size={24} color="#CBD5E1" />}
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        onPress={() => pickImage(setEditLogo, false)}
                                        className="w-36 h-36 bg-slate-50 rounded-4xl border border-dashed border-slate-200 items-center justify-center overflow-hidden"
                                    >
                                        {editLogo ? <Image source={{ uri: editLogo || undefined }} className="w-full h-full" /> : <Feather name="camera" size={24} color="#CBD5E1" />}
                                    </TouchableOpacity>
                                </View>

                                <TextInput placeholder="Hub Designation" placeholderTextColor="#CBD5E1" value={editName} onChangeText={setEditName} className="bg-slate-50 p-5 rounded-3xl mb-4 border border-slate-100 font-black text-xs text-slate-900" />
                                <TextInput placeholder="Directive" placeholderTextColor="#CBD5E1" value={editDesc} onChangeText={setEditDesc} multiline className="bg-slate-50 p-5 rounded-3xl mb-8 border border-slate-100 font-medium h-24 text-xs text-slate-600" textAlignVertical="top" />

                                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Social Frequencies</Text>
                                <View className="bg-slate-50 p-6 rounded-4xl border border-slate-100 mb-10">
                                    <View className="flex-row items-center gap-4 mb-6">
                                        <FontAwesome5 name="youtube" size={16} color="#ef4444" />
                                        <TextInput placeholder="YouTube" placeholderTextColor="#CBD5E1" value={yt} onChangeText={setYt} className="flex-1 font-black text-2xs text-slate-900" />
                                    </View>
                                    <View className="flex-row items-center gap-4 mb-6">
                                        <FontAwesome5 name="github" size={16} color="#18181b" />
                                        <TextInput placeholder="GitHub" placeholderTextColor="#CBD5E1" value={gh} onChangeText={setGh} className="flex-1 font-black text-2xs text-slate-900" />
                                    </View>
                                    <View className="flex-row items-center gap-4">
                                        <Feather name="globe" size={16} color="#f97316" />
                                        <TextInput placeholder="Portal" placeholderTextColor="#CBD5E1" value={ws} onChangeText={setWs} className="flex-1 font-black text-2xs text-slate-900" />
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    onPress={handleUpdateHub} 
                                    disabled={updatingHub}
                                    className={`p-6 rounded-3xl items-center mb-3 shadow-xl ${updatingHub ? 'bg-slate-100' : 'bg-orange-500 shadow-orange-500/30'}`}
                                >
                                    {updatingHub ? <ActivityIndicator size="small" color="#18181b" /> : <Text className="text-white font-black uppercase text-2xs tracking-wide">Update Community</Text>}
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={handleDeleteHub}
                                    className="p-6 rounded-3xl bg-red-500 items-center mb-20"
                                >
                                    <Text className="text-white font-black uppercase text-2xs tracking-wide">Delete Community</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            <Modal visible={showWebView} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-center p-6 border-b border-slate-100 bg-[#FAFAFA]">
                        <Text className="text-slate-900 font-black uppercase text-2xs tracking-wide">Secure Signal Processor</Text>
                    </View>
                    <WebView
                        source={{ html: webViewHtml }}
                        onMessage={handleWebMsg}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        originWhitelist={['*']}
                        style={{ flex: 1 }}
                    />
                </SafeAreaView>
            </Modal>
        </View>
    );
};

export default CommunityHubScreen;
