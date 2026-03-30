import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Image, 
  ActivityIndicator, Dimensions, Alert, Modal, TextInput, Linking, Share,
  StatusBar, Platform
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

const { width } = Dimensions.get('window');

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
            if (res.data.success) { Alert.alert("Subscribed", "Welcome to the ecosystem!"); fetchDetails(); }
        } catch (error: any) { Alert.alert("Error", error.response?.data?.message || "Subscription failed"); }
        finally { setIsJoining(false); }
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
            const message = `🚀 Connect with ${data.community.name} on Fync!\nInvite: fync://community/hub/${communityId}`;
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
                amount: renewPlan === 'monthly' ? 99 : 999
            });
            
            if (res.data.success) { 
                Alert.alert("Ignited!", `${renewPlan === 'yearly' ? 'Yearly eternal' : 'Monthly spark'} activated via Razorpay.`); 
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
            // 1. Create Razorpay Order
            const amount = renewPlan === 'monthly' ? 99 : 999;
            const orderRes = await axios.post('/payment/order', { 
                amount,
                notes: { type: 'community_spark', communityId, plan: renewPlan, userId: user?._id }
            });

            if (!orderRes.data.id) throw new Error("Order generation failed");

            // 2. Open Razorpay Checkout
            const options = {
                description: `Restore Spark for ${data.community.name}`,
                image: data.community.logo || 'https://i.imgur.com/39M8xXo.png',
                currency: 'INR',
                key: RAZORPAY_KEY_ID, 
                amount: amount * 100,
                name: 'Fync Ecosystem',
                order_id: orderRes.data.id,
                prefill: {
                    email: user?.email,
                    contact: user?.phone || '',
                    name: user?.username || user?.name
                },
                theme: { color: '#4f46e5' }
            };

            const triggerWebView = () => {
                const content = `
                <html>
                <body style="background-color: #fafafa; display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <script>
                    var options = {
                        key: "${RAZORPAY_KEY_ID}",
                        amount: "${amount * 100}",
                        currency: "INR",
                        name: "Fync Ecosystem",
                        description: "Restore Spark for ${data.community.name}",
                        order_id: "${orderRes.data.id}",
                        prefill: {
                            name: "${user?.username || ''}",
                            email: "${user?.email || ''}",
                            contact: "${user?.phone || ''}"
                        },
                        theme: { color: "#4f46e5" },
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
            aspect: isBanner ? undefined : [1, 1],
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
        Alert.alert("Decommission Hub", "Warning: Permanent purging of all rooms and messages.", [
            { text: "Abort", style: "cancel" },
            { text: "Decommission", style: "destructive", onPress: async () => {
                try {
                    const res = await axios.delete('/communities/delete', { data: { communityId, userId: user?._id } });
                    if (res.data.success) navigation.navigate('CommunityList');
                } catch (e) { Alert.alert("Error", "Decommissioning failed"); }
            }}
        ]);
    };

    if (loading) return <View className="flex-1 items-center justify-center bg-white"><ActivityIndicator size="small" color="#1a1a1a" /></View>;
    if (!data) return <View className="flex-1 items-center justify-center bg-white"><Text>Not Found</Text></View>;

    const { community, subCommunities, creatorOtherCommunities } = data;
    const isMember = community.members?.includes(user?._id);
    const isCreator = community.creator?._id === user?._id;
    const isSuspended = community.subscription?.status === 'suspended';
    const socials = community.socialLinks || {};

    const expiryDate = new Date(community.subscription?.expiryDate || 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Cinematic Expanded Header */}
                <View className="w-full">
                    <View className="h-60 w-full relative">
                        <Image source={{ uri: community.banner || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' }} className="w-full h-full" resizeMode="cover" />
                        <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.85)']} className="absolute inset-0" />
                        
                        <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 flex-row justify-between px-4 pt-1">
                            <TouchableOpacity onPress={() => navigation.goBack()} className="w-8 h-8 bg-black/20 rounded-lg items-center justify-center backdrop-blur-md">
                                <Ionicons name="chevron-back" size={16} color="white" />
                            </TouchableOpacity>
                            <View className="flex-row gap-2">
                                {isCreator && (
                                    <TouchableOpacity onPress={() => setEditHubModal(true)} className="w-8 h-8 bg-black/20 rounded-lg items-center justify-center backdrop-blur-md">
                                        <Feather name="settings" size={14} color="white" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </SafeAreaView>

                        <View className="absolute bottom-5 left-5 right-5 flex-row items-end gap-4">
                            <View className="w-16 h-16 rounded-[24px] border-2 border-white shadow-xl overflow-hidden bg-zinc-900">
                                <Image source={{ uri: community.logo || 'https://via.placeholder.com/150' }} className="w-full h-full" />
                            </View>
                            <View className="flex-1 pb-1.5">
                                <Text className="text-white text-2xl font-black uppercase tracking-tight" numberOfLines={1}>{community.name}</Text>
                                <View className="flex-row items-center gap-2">
                                    <View className="w-2 h-2 rounded-full bg-teal-400" />
                                    <Text className="text-white/60 text-[9px] font-black uppercase tracking-widest">{community.members?.length} Sparks</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Content Realm */}
                <View className="px-4 pt-5 pb-20">
                    <View className="flex-row gap-2 mb-6">
                        {isMember ? (
                            <TouchableOpacity 
                                onPress={isCreator ? undefined : handleLeave} 
                                className={`flex-1 h-11 rounded-xl items-center justify-center ${isCreator ? 'bg-zinc-50 border border-zinc-100' : 'bg-red-600'}`}
                            >
                                <Text className={`font-black uppercase text-[8px] tracking-widest ${isCreator ? 'text-zinc-400' : 'text-white'}`}>
                                    {isCreator ? "Guardian Admin" : "Unsubscribe"}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={handleJoin} disabled={isJoining} className="flex-1 h-11 bg-blue-600 rounded-xl items-center justify-center shadow-sm">
                                {isJoining ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-black uppercase text-[8px] tracking-widest">Subscribe</Text>}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleShare} className="w-11 h-11 border border-gray-300 rounded-lg items-center justify-center backdrop-blur-md">
                            <Ionicons name="share-social-outline" size={14} color="black" />
                        </TouchableOpacity>
                    </View>

                    <View className="mb-8">
                        <Text className="text-zinc-400 font-black uppercase text-[7px] tracking-[2px] mb-2">Hub Directive</Text>
                        <Text className="text-zinc-800 font-semibold leading-[16px] text-[11px] mb-5">
                            {community.description || "The definitive ecosystem for creator networking and collaborative expansion."}
                        </Text>
                        
                        {/* Dropdown Activation Trigger */}
                        {isCreator && (
                            <View className="mb-6">
                                <TouchableOpacity 
                                    onPress={() => setIsPaymentExpanded(!isPaymentExpanded)}
                                    className="flex-row items-center justify-between bg-zinc-50 p-4 rounded-2xl border border-zinc-100"
                                >
                                    <View className="flex-row items-center gap-3">
                                        <View className={`w-2 h-2 rounded-full ${daysLeft > 7 ? 'bg-teal-500 shadow-sm shadow-teal-500/50' : 'bg-rose-500 shadow-sm shadow-rose-500/50'}`} />
                                        <View>
                                            <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-tight">{daysLeft > 0 ? `${daysLeft} Activation Days Left` : 'Spark Exhausted'}</Text>
                                            <Text className="text-zinc-400 font-bold text-[7px] uppercase mt-0.5 tracking-widest">{daysLeft > 7 ? 'Ecosystem Stable' : 'Restore Required'}</Text>
                                        </View>
                                    </View>
                                    <View className="w-8 h-8 rounded-xl bg-white border border-zinc-100 items-center justify-center">
                                        <Feather name={isPaymentExpanded ? "chevron-up" : "chevron-down"} size={14} color="#1a1a1a" />
                                    </View>
                                </TouchableOpacity>

                                {isPaymentExpanded && (
                                    <View className="mt-2 bg-white p-5 rounded-3xl border border-zinc-100 shadow-xl shadow-black/5">
                                        <Text className="text-zinc-400 font-black uppercase text-[7px] tracking-widest mb-4">Extend Hub Vitality</Text>
                                        <View className="flex-row gap-2 mb-4">
                                            <TouchableOpacity 
                                                onPress={() => setRenewPlan('monthly')} 
                                                className={`flex-1 p-3.5 rounded-2xl border ${renewPlan === 'monthly' ? 'bg-zinc-900 border-zinc-900 shadow-lg' : 'bg-white border-zinc-100'}`}
                                            >
                                                <Text className={`font-black uppercase text-[8px] text-center ${renewPlan === 'monthly' ? 'text-white' : 'text-zinc-500'}`}>Monthly (₹99)</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity 
                                                onPress={() => setRenewPlan('yearly')} 
                                                className={`flex-1 p-3.5 rounded-2xl border ${renewPlan === 'yearly' ? 'bg-zinc-900 border-zinc-900 shadow-lg' : 'bg-white border-zinc-100'}`}
                                            >
                                                <Text className={`font-black uppercase text-[8px] text-center ${renewPlan === 'yearly' ? 'text-white' : 'text-zinc-500'}`}>Yearly (₹999)</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity 
                                            onPress={handleRenew} 
                                            disabled={renewing} 
                                            className="bg-indigo-600 w-full py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/30"
                                        >
                                            {renewing ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-black uppercase text-[9px] tracking-[4px]">Pay now</Text>}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                        
                        {(socials.youtube || socials.github || socials.linkedin || socials.twitter || socials.website) && (
                            <View className="flex-row gap-2">
                                {socials.youtube && (
                                    <TouchableOpacity onPress={() => Linking.openURL(socials.youtube)} className="w-8 h-8 bg-zinc-50 rounded-lg items-center justify-center border border-zinc-100">
                                        <Feather name="youtube" size={12} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                                {socials.github && (
                                    <TouchableOpacity onPress={() => Linking.openURL(socials.github)} className="w-8 h-8 bg-zinc-50 rounded-lg items-center justify-center border border-zinc-100">
                                        <Feather name="github" size={12} color="#1a1a1a" />
                                    </TouchableOpacity>
                                )}
                                {socials.linkedin && (
                                    <TouchableOpacity onPress={() => Linking.openURL(socials.linkedin)} className="w-8 h-8 bg-zinc-50 rounded-lg items-center justify-center border border-zinc-100">
                                        <Feather name="linkedin" size={12} color="#0077b5" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Channel Directory */}
                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-zinc-900 text-lg font-black uppercase tracking-tight text-[14px]">Active Channels</Text>
                            {isCreator && (
                                <TouchableOpacity onPress={() => { setSubModalVisible(true); setTargetSubId(null); }} className="w-8 h-8 bg-zinc-900 rounded-lg items-center justify-center shadow-lg">
                                    <Ionicons name="add" size={18} color="white" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {subCommunities.map((sub: any) => (
                            <TouchableOpacity 
                                key={sub._id} 
                                onPress={() => {
                                    if (isSuspended) { Alert.alert("Hub Suspended", "Activation required."); return; }
                                    if (navigation) {
                                        navigation.navigate('SubCommunityChat', { subId: sub._id, subName: sub.name, communityId: community._id });
                                    }
                                }}
                                className={`bg-white p-3 rounded-2xl border border-zinc-50 flex-row items-center gap-3 mb-2 shadow-sm shadow-black/5 ${isSuspended ? 'opacity-30' : ''}`}
                            >
                                <View className="w-8 h-8 bg-zinc-50 rounded-xl items-center justify-center overflow-hidden border border-zinc-100">
                                    {sub.logo ? <Image source={{ uri: sub.logo }} className="w-full h-full" /> : <Text className="text-zinc-300 font-bold text-sm">#</Text>}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-zinc-900 font-black uppercase text-[9px] tracking-tight">{sub.name}</Text>
                                    <Text className="text-zinc-400 font-bold text-[6px] uppercase mt-0.5 tracking-widest">Frequency Live</Text>
                                </View>
                                {isCreator && (
                                    <View className="flex-row gap-1">
                                        <TouchableOpacity 
                                            onPress={(e: any) => { 
                                                e.stopPropagation(); 
                                                setTargetSubId(sub._id); 
                                                setSubName(sub.name); 
                                                setSubDesc(sub.description || ''); 
                                                setSubLogo(sub.logo); 
                                                setEditSubModal(true); 
                                            }}
                                            className="w-7 h-7 bg-zinc-50 rounded-lg items-center justify-center border border-zinc-100"
                                        >
                                            <Feather name="edit-3" size={10} color="#6366f1" />
                                        </TouchableOpacity>
                                        <TouchableOpacity 
                                            onPress={(e: any) => { e.stopPropagation(); handleExportHistory(sub._id, sub.name); }}
                                            className="w-7 h-7 bg-zinc-50 rounded-lg items-center justify-center border border-zinc-100"
                                        >
                                            <Feather name="download" size={10} color="#10b981" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <Ionicons name="chevron-forward" size={12} color="#F1F5F9" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Linked Ecosystems Grid */}
                    {creatorOtherCommunities.length > 0 && (
                        <View>
                            <Text className="text-zinc-400 font-black uppercase text-[7px] tracking-[2px] mb-3">Linked Realms</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {creatorOtherCommunities.map((c: any) => (
                                    <TouchableOpacity 
                                        key={c._id} 
                                        onPress={() => navigation.push('CommunityHub', { communityId: c._id })}
                                        className="bg-white p-2.5 rounded-2xl border border-zinc-100 items-center w-[31%] shadow-sm"
                                    >
                                        <View className="w-9 h-9 rounded-xl overflow-hidden mb-1.5 border border-zinc-100">
                                            <Image source={{ uri: c.logo || 'https://via.placeholder.com/150' }} className="w-full h-full" />
                                        </View>
                                        <Text className="text-zinc-900 font-black uppercase text-[6.5px] text-center" numberOfLines={1}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Suspended Guard */}
            {isSuspended && (
                <View className="absolute inset-0 bg-white items-center justify-center p-6 z-[100]">
                    <Feather name="zap-off" size={40} color="#ef4444" />
                    <Text className="text-zinc-900 text-xl font-black uppercase text-center mt-4 tracking-tighter">Spark Exhausted</Text>
                    <Text className="text-zinc-500 font-semibold text-center text-[10px] leading-4 mt-3 mb-8 px-4">
                        Hub is offline. {isCreator ? "Re-ignite for ₹99 via Razorpay." : "Awaiting activation."}
                    </Text>
                    {isCreator && (
                        <View className="w-full px-5">
                            <View className="flex-row gap-2 mb-4">
                                <TouchableOpacity onPress={() => setRenewPlan('monthly')} className={`flex-1 p-3 rounded-xl border ${renewPlan === 'monthly' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-100'}`}>
                                    <Text className={`font-black uppercase text-[7px] text-center ${renewPlan === 'monthly' ? 'text-white' : 'text-zinc-400'}`}>Monthly (₹99)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setRenewPlan('yearly')} className={`flex-1 p-3 rounded-xl border ${renewPlan === 'yearly' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-100'}`}>
                                    <Text className={`font-black uppercase text-[7px] text-center ${renewPlan === 'yearly' ? 'text-white' : 'text-zinc-400'}`}>Yearly (₹999)</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleRenew} disabled={renewing} className="bg-indigo-600 w-full py-4 rounded-xl items-center shadow-lg">
                                {renewing ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-black uppercase text-[9px] tracking-widest">Pay & Ignite Hub</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mt-8">
                        <Text className="text-zinc-400 font-black uppercase text-[7px] tracking-widest">Back to Directory</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Sub-Community Creation Modal */}
            <Modal visible={subModalVisible} transparent animationType="slide">
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-white rounded-t-[32px] p-6 pb-10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-zinc-900 text-xl font-black uppercase tracking-tight">Expand Realm</Text>
                            <TouchableOpacity onPress={() => setSubModalVisible(false)} className="w-9 h-9 bg-zinc-50 rounded-xl items-center justify-center">
                                <Ionicons name="close" size={22} color="black" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            onPress={() => pickImage(setSubLogo, false)}
                            className="w-24 h-24 bg-zinc-50 rounded-[24px] border border-dashed border-zinc-200 items-center justify-center overflow-hidden self-center mb-6"
                        >
                            {subLogo ? <Image source={{ uri: subLogo || undefined }} className="w-full h-full" /> : <Feather name="camera" size={20} color="#E2E8F0" />}
                        </TouchableOpacity>

                        <TextInput placeholder="Channel Name (e.g. Brainstorming)" value={subName} onChangeText={setSubName} className="bg-zinc-50 p-4 rounded-xl mb-3 border border-zinc-100 font-bold text-[10px]" />
                        <TextInput placeholder="Description" value={subDesc} onChangeText={setSubDesc} multiline className="bg-zinc-50 p-4 rounded-xl mb-6 border border-zinc-100 font-bold h-20 text-[10px]" />

                        <TouchableOpacity 
                            onPress={handleCreateSubCommunity} 
                            disabled={creatingSub}
                            className={`p-4 rounded-xl items-center mb-3 ${creatingSub ? 'bg-zinc-100' : 'bg-zinc-900 shadow-xl shadow-black/20'}`}
                        >
                            {creatingSub ? (
                                <ActivityIndicator size="small" color="#1a1a1a" />
                            ) : (
                                <Text className="text-white font-black uppercase text-[9px] tracking-widest">Ignite Room</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Sub-Community Update Modal */}
            <Modal visible={editSubModal} transparent animationType="slide">
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-white rounded-t-[32px] p-6 pb-10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-zinc-900 text-xl font-black uppercase tracking-tight">Refine Room</Text>
                            <TouchableOpacity onPress={() => setEditSubModal(false)} className="w-9 h-9 bg-zinc-50 rounded-xl items-center justify-center">
                                <Ionicons name="close" size={22} color="black" />
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity 
                            onPress={() => pickImage(setSubLogo, false)}
                            className="w-24 h-24 bg-zinc-50 rounded-[24px] border border-dashed border-zinc-200 items-center justify-center overflow-hidden self-center mb-6"
                        >
                            {subLogo ? <Image source={{ uri: subLogo || undefined }} className="w-full h-full" /> : <Feather name="camera" size={20} color="#E2E8F0" />}
                        </TouchableOpacity>

                        <TextInput placeholder="Channel Label" value={subName} onChangeText={setSubName} className="bg-zinc-50 p-4 rounded-xl mb-3 border border-zinc-100 font-bold text-[10px]" />
                        <TextInput placeholder="Directive" value={subDesc} onChangeText={setSubDesc} multiline className="bg-zinc-50 p-4 rounded-xl mb-6 border border-zinc-100 font-bold h-20 text-[10px]" />

                        <TouchableOpacity 
                            onPress={handleUpdateSubCommunity} 
                            disabled={creatingSub}
                            className={`p-4 rounded-xl items-center mb-3 ${creatingSub ? 'bg-zinc-100' : 'bg-indigo-600 shadow-xl shadow-indigo-600/20'}`}
                        >
                            {creatingSub ? (
                                <ActivityIndicator size="small" color="#1a1a1a" />
                            ) : (
                                <Text className="text-white font-black uppercase text-[9px] tracking-widest">Sync Specs</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={handleDeleteSubCommunity}
                            className="p-4 rounded-xl items-center border border-red-50"
                        >
                            <Text className="text-red-500 font-black uppercase text-[7px] tracking-widest">Dissolve Room</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Configuration Suite */}
            <Modal visible={editHubModal} transparent animationType="slide">
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-white rounded-t-[32px] p-6 pb-10">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-zinc-900 text-xl font-black uppercase tracking-tight">Configuration</Text>
                            <TouchableOpacity onPress={() => setEditHubModal(false)} className="w-9 h-9 bg-zinc-50 rounded-xl items-center justify-center">
                                <Ionicons name="close" size={22} color="black" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="max-h-[85%]">
                            <Text className="text-zinc-400 font-black uppercase text-[7px] mb-3">Ecosystem Authority</Text>
                            <View className="bg-zinc-50 p-4 rounded-2xl mb-8 border border-zinc-100 flex-row justify-between items-center">
                                <View>
                                    <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-tight">{daysLeft} Days Remaining</Text>
                                    <Text className="text-zinc-400 font-bold text-[7px] uppercase mt-0.5 tracking-widest">Licensed Period</Text>
                                </View>
                                <View className="px-3 py-1.5 bg-zinc-900 rounded-xl">
                                    <Text className="text-white font-black uppercase text-[8px]">Guardian</Text>
                                </View>
                            </View>

                            <Text className="text-zinc-400 font-black uppercase text-[7px] mb-4">Atmospheric Branding</Text>
                            <View className="flex-row gap-3 mb-8">
                                <TouchableOpacity 
                                    onPress={() => pickImage(setEditBanner, true)}
                                    className="flex-1 h-32 bg-zinc-50 rounded-[24px] border border-dashed border-zinc-200 items-center justify-center overflow-hidden"
                                >
                                    {editBanner ? <Image source={{ uri: editBanner || undefined }} className="w-full h-full" /> : <Feather name="image" size={20} color="#E2E8F0" />}
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => pickImage(setEditLogo, false)}
                                    className="w-32 h-32 bg-zinc-50 rounded-[24px] border border-dashed border-zinc-200 items-center justify-center overflow-hidden"
                                >
                                    {editLogo ? <Image source={{ uri: editLogo || undefined }} className="w-full h-full" /> : <Feather name="camera" size={20} color="#E2E8F0" />}
                                </TouchableOpacity>
                            </View>

                            <Text className="text-zinc-400 font-black uppercase text-[7px] mb-3">Hub Narrative</Text>
                            <TextInput placeholder="Hub Title" value={editName} onChangeText={setEditName} className="bg-zinc-50 p-4 rounded-xl mb-3 border border-zinc-100 font-bold text-[10px]" />
                            <TextInput placeholder="Directive" value={editDesc} onChangeText={setEditDesc} multiline className="bg-zinc-50 p-4 rounded-xl mb-6 border border-zinc-100 font-bold h-20 text-[10px]" />

                            <Text className="text-zinc-400 font-black uppercase text-[7px] mb-3">Social Handles</Text>
                            <View className="bg-zinc-50 p-5 rounded-2xl mb-8 border border-zinc-100">
                                <View className="flex-row items-center gap-3 mb-4">
                                    <FontAwesome5 name="youtube" size={14} color="#ef4444" />
                                    <TextInput placeholder="YouTube URL" value={yt} onChangeText={setYt} className="flex-1 font-bold text-[9px]" />
                                </View>
                                <View className="flex-row items-center gap-3 mb-4">
                                    <FontAwesome5 name="github" size={14} color="#1a1a1a" />
                                    <TextInput placeholder="GitHub URL" value={gh} onChangeText={setGh} className="flex-1 font-bold text-[9px]" />
                                </View>
                                <View className="flex-row items-center gap-3">
                                    <SimpleLineIcons name="globe" size={14} color="#6366f1" />
                                    <TextInput placeholder="Website" value={ws} onChangeText={setWs} className="flex-1 font-bold text-[9px]" />
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={handleUpdateHub} 
                                disabled={updatingHub}
                                className={`p-4 rounded-xl items-center mb-3 ${updatingHub ? 'bg-zinc-100' : 'bg-indigo-600'}`}
                            >
                                {updatingHub ? (
                                    <ActivityIndicator size="small" color="#6366f1" />
                                ) : (
                                    <Text className="text-white font-black uppercase text-[9px] tracking-widest">Apply Specs</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleDeleteHub} className="p-4 rounded-xl items-center border border-red-50">
                                <Text className="text-red-500 font-black uppercase text-[7px] tracking-widest">Dissolve Hub</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* WebView Fallback Modal */}
            <Modal visible={showWebView} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between p-4 border-b border-zinc-100 bg-[#FAFAFA]">
                        <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-widest">Resilient Restoration Bridge</Text>
                        <TouchableOpacity onPress={() => { setShowWebView(false); setRenewing(false); }}>
                            <Ionicons name="close" size={24} color="black" />
                        </TouchableOpacity>
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
