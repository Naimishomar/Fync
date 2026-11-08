import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Share, StatusBar, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Button, Card, Divider, Empty, IconTile, Label, ListRow, SectionHeader, SegmentedTabs, Sheet, FormField } from '../ui/kit';
import { Pop } from '../ui-extra/usePop';
import { HubBanner, ImagePick, RoomIcon, PayWebView, PLANS, PLAN_LABELS } from './shared';

type RoomType = 'chat' | 'feed' | 'announcement';
const ROOM_TYPES = ['chat', 'feed', 'announcement'] as const;
const ROOM_LABEL: Record<RoomType, string> = { chat: 'Chat', feed: 'Feed', announcement: 'Announcements' };
const ROOM_ICON: Record<RoomType, any> = { chat: 'chatbubbles-outline', feed: 'trending-up-outline', announcement: 'megaphone-outline' };

// Module scope: defined inside the screen it was a new component type every
// render, so it remounted (and restarted its pulse) on each state change.
const CommunityHubSkeleton = () => {
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
    }, []);

    return (
        <Animated.View style={{ opacity: pulseAnim }} className="flex-1 bg-paper">
            <View className="h-72 bg-paper-2" />
            <View className="px-gutter pt-6">
                <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 h-12 bg-paper-2 rounded-full" />
                    <View className="w-12 h-12 bg-paper-2 rounded-full" />
                </View>
                <View className="h-4 bg-paper-2 rounded-full w-24 mb-4" />
                <View className="h-3 bg-paper-2 rounded-full w-full mb-2" />
                <View className="h-3 bg-paper-2 rounded-full w-4/5" />
            </View>
        </Animated.View>
    );
};

const CommunityHubScreen = ({ navigation, route }: any) => {
    const { communityId } = route.params ?? {};
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
            const message = `Connect with ${data.community.name} on Fync!\n\nJoin here: ${shareUrl}\n\nInvite: fync://community/hub/${communityId}`;
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
                theme: { color: C.brand[500] }
            };

            const triggerWebView = () => {
                const content = `
                <html>
                <body style="background-color: ${C.paper}; display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <script>
                    var options = {
                        key: ${JSON.stringify(RAZORPAY_KEY_ID)},
                        amount: ${JSON.stringify(String(orderRes.data.amount))},
                        currency: "INR",
                        name: "Fync Ecosystem",
                        description: ${JSON.stringify(`Restore Spark for ${data.community.name}`)},
                        order_id: ${JSON.stringify(orderRes.data.id)},
                        prefill: {
                            name: ${JSON.stringify(user?.username || '')},
                            email: ${JSON.stringify(user?.email || '')},
                            contact: ${JSON.stringify(user?.phone || '')}
                        },
                        theme: { color: "#F97316" },
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

    const cancelWebPayment = () => {
        setShowWebView(false);
        setRenewing(false);
    };

    const handleWebMsg = (event: any) => {
        let msg: any = null;
        try { msg = JSON.parse(event.nativeEvent.data); } catch { /* not ours */ }
        setShowWebView(false);
        if (msg?.event === 'SUCCESS') {
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

    if (loading) return <CommunityHubSkeleton />;
    if (!data) return (
        <View className="flex-1 bg-paper">
            <AppBar title="Community" onBack={() => navigation.goBack()} />
            <Empty icon="compass-outline" title="Community not found" action={<Button title="Try again" onPress={() => { setLoading(true); fetchDetails(); }} />} />
        </View>
    );

    const { community } = data;
    const subCommunities: any[] = data.subCommunities ?? [];
    const creatorOtherCommunities: any[] = data.creatorOtherCommunities ?? [];
    const isMember = community.members?.some((m: any) => (m?._id || m) === user?._id);
    const isCreator = community.creator?._id === user?._id;
    const isSuspended = community.subscription?.status === 'suspended';
    const socials = community.socialLinks || {};

    const expiryDate = new Date(community.subscription?.expiryDate || 0);
    const daysLeft = Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    const openSub = (sub: any) => {
        if (isSuspended) { Alert.alert("Community offline", "The owner needs to renew the plan."); return; }
        // A 'feed' room is a subreddit, not a chat channel.
        navigation.navigate(sub.type === 'feed' ? 'CommunityFeed' : 'SubCommunityChat', { subId: sub._id, subName: sub.name, communityId: community._id });
    };
    const editSub = (sub: any) => {
        setTargetSubId(sub._id);
        setSubName(sub.name);
        setSubDesc(sub.description || '');
        setSubLogo(sub.logo);
        setEditSubModal(true);
    };
    const roomSheetOpen = subModalVisible || editSubModal;
    const closeRoomSheet = () => { setSubModalVisible(false); setEditSubModal(false); };
    const socialLinks = [
        socials.youtube && { url: socials.youtube, icon: 'logo-youtube', label: 'YouTube' },
        socials.github && { url: socials.github, icon: 'logo-github', label: 'GitHub' },
        socials.website && { url: socials.website, icon: 'globe-outline', label: 'Website' },
    ].filter(Boolean) as { url: string; icon: any; label: string }[];
    const cardPad = { paddingHorizontal: 16, paddingVertical: 4 };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <HubBanner
                    banner={community.banner}
                    logo={community.logo}
                    name={community.name}
                    meta={`${community.members?.length ?? 0} members`}
                    onBack={() => navigation.goBack()}
                    right={isCreator ? (
                        <IconBtn overlay name="settings-outline" size={18} onPress={() => setEditHubModal(true)} accessibilityLabel="Community settings" />
                    ) : undefined}
                />

                <View className="px-gutter pt-5">
                    <View className="flex-row" style={{ gap: 12 }}>
                        <Pop on={!!isMember} style={{ flex: 1 }}>
                            {isCreator ? (
                                <Button block title="You own this community" icon="shield-checkmark-outline" disabled />
                            ) : isMember ? (
                                <Button block title="Leave" loading={leaving} onPress={handleLeave} />
                            ) : (
                                <Button block variant="primary" title="Join" loading={isJoining} onPress={handleJoin} />
                            )}
                        </Pop>
                        <IconBtn name="share-social-outline" boxed onPress={handleShare} accessibilityLabel="Share community" />
                    </View>

                    <Text className="text-ink-2 mt-5" style={{ fontSize: 15, lineHeight: 22 }}>
                        {community.description || 'No description yet.'}
                    </Text>

                    {socialLinks.length > 0 && (
                        <View className="flex-row mt-4" style={{ gap: 8 }}>
                            {socialLinks.map((l) => (
                                <IconBtn key={l.label} name={l.icon} boxed size={18} onPress={() => Linking.openURL(l.url)} accessibilityLabel={`Open ${l.label}`} />
                            ))}
                        </View>
                    )}

                    {isCreator && (
                        <Card style={[cardPad, { marginTop: 20 }]}>
                            <ListRow
                                leading={<View className={`w-2.5 h-2.5 rounded-full ${daysLeft > 7 ? 'bg-success' : 'bg-danger'}`} />}
                                title={daysLeft > 0 ? `${daysLeft} days left on your plan` : 'Plan expired'}
                                subtitle="Renew to keep the community online"
                                onPress={() => setIsPaymentExpanded(!isPaymentExpanded)}
                                right={<Ionicons name={isPaymentExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.ink3} />}
                                accessibilityLabel={isPaymentExpanded ? 'Hide renewal options' : 'Show renewal options'}
                            />
                            {isPaymentExpanded && (
                                <View style={{ gap: 12, paddingBottom: 12 }}>
                                    <SegmentedTabs items={PLANS} value={renewPlan} onChange={setRenewPlan} labels={PLAN_LABELS} />
                                    <Button block variant="primary" title="Renew plan" loading={renewing} onPress={handleRenew} />
                                </View>
                            )}
                        </Card>
                    )}

                    <SectionHeader
                        title="Rooms"
                        right={isCreator ? (
                            <Button small icon="add" title="New room" onPress={() => { setSubModalVisible(true); setTargetSubId(null); }} />
                        ) : undefined}
                    />
                    {subCommunities.length === 0 ? (
                        <Card><Empty icon="chatbubbles-outline" title="No rooms yet" hint={isCreator ? 'Add a room to get the conversation going.' : 'Rooms will appear here once they open.'} /></Card>
                    ) : (
                        <Card style={[cardPad, isSuspended && { opacity: 0.4 }]}>
                            {subCommunities.map((sub: any, i: number) => (
                                <View key={sub._id}>
                                    {i > 0 ? <Divider /> : null}
                                    <ListRow
                                        leading={<RoomIcon uri={sub.logo} icon={ROOM_ICON[sub.type as RoomType] ?? 'chatbubbles-outline'} />}
                                        title={sub.name}
                                        subtitle={ROOM_LABEL[sub.type as RoomType] ?? 'Chat'}
                                        onPress={() => openSub(sub)}
                                        chevron={!isCreator}
                                        right={isCreator ? (
                                            <View className="flex-row" style={{ gap: 4 }}>
                                                <IconBtn name="create-outline" size={18} onPress={() => editSub(sub)} accessibilityLabel={`Edit ${sub.name}`} />
                                                <IconBtn name="download-outline" size={18} onPress={() => handleExportHistory(sub._id, sub.name)} accessibilityLabel={`Export ${sub.name} history`} />
                                            </View>
                                        ) : undefined}
                                    />
                                </View>
                            ))}
                        </Card>
                    )}

                    {creatorOtherCommunities.length > 0 && (
                        <>
                            <SectionHeader title="More from this owner" />
                            <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                                {creatorOtherCommunities.map((c: any) => (
                                    <Pressable
                                        key={c._id}
                                        onPress={() => navigation.push('CommunityHub', { communityId: c._id })}
                                        accessibilityRole="button"
                                        accessibilityLabel={c.name}
                                        className="bg-card p-3 rounded-2xl border border-line items-center w-[30%] active:opacity-85"
                                    >
                                        <RoomIcon uri={c.logo} icon="people-outline" />
                                        <Text className="text-ink font-semibold text-center mt-2" style={{ fontSize: 12 }} numberOfLines={1}>{c.name}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    )}
                    <View className="h-20" />
                </View>
            </ScrollView>

            {isSuspended && (
                <View className="absolute inset-0 bg-paper items-center justify-center px-gutter z-[100]">
                    <IconTile icon="flash-off-outline" size={72} iconSize={32} color={C.danger} />
                    <Text className="text-ink font-display text-center mt-6" style={{ fontSize: 26, lineHeight: 32 }}>Community offline</Text>
                    <Text className="text-ink-3 text-center mt-2 mb-8" style={{ fontSize: 14, lineHeight: 20 }}>
                        {isCreator ? 'Your plan has run out. Renew it to bring the community back.' : 'The owner needs to renew the plan.'}
                    </Text>
                    {isCreator && (
                        <View className="w-full" style={{ gap: 12 }}>
                            <SegmentedTabs items={PLANS} value={renewPlan} onChange={setRenewPlan} labels={PLAN_LABELS} />
                            <Button block variant="primary" title="Renew plan" loading={renewing} onPress={handleRenew} />
                        </View>
                    )}
                    <Button variant="tertiary" title="Go back" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
                </View>
            )}

            {/* Create / edit a room: one sheet, two modes. */}
            <Sheet
                visible={roomSheetOpen}
                onClose={closeRoomSheet}
                title={editSubModal ? 'Edit room' : 'New room'}
                footer={editSubModal ? (
                    <View style={{ gap: 8 }}>
                        <Button block variant="primary" title="Save changes" loading={creatingSub} onPress={handleUpdateSubCommunity} />
                        <Button block variant="danger" title="Delete room" disabled={creatingSub} onPress={handleDeleteSubCommunity} />
                    </View>
                ) : (
                    <Button block variant="primary" title="Create room" loading={creatingSub} onPress={handleCreateSubCommunity} />
                )}
            >
                <View style={{ gap: 16 }}>
                    <ImagePick uri={subLogo} onPress={() => pickImage(setSubLogo, false)} label="Logo" icon="camera-outline" style={{ width: 96, height: 96, alignSelf: 'center' }} />
                    <FormField label="Name" placeholder="e.g. General" value={subName} onChangeText={setSubName} />
                    <FormField label="About" placeholder="What's this room for?" value={subDesc} onChangeText={setSubDesc} multiline />
                    {!editSubModal && (
                        <View style={{ gap: 6 }}>
                            <Label>Room type</Label>
                            <SegmentedTabs items={ROOM_TYPES} value={subType} onChange={setSubType} labels={ROOM_LABEL} />
                        </View>
                    )}
                </View>
            </Sheet>

            <Sheet
                visible={editHubModal}
                onClose={() => setEditHubModal(false)}
                title="Community settings"
                subtitle={`${daysLeft} days left on your plan`}
                footer={<Button block variant="primary" title="Save changes" loading={updatingHub} onPress={handleUpdateHub} />}
            >
                <View style={{ gap: 16 }}>
                    <View className="flex-row" style={{ gap: 12 }}>
                        <ImagePick uri={editBanner} onPress={() => pickImage(setEditBanner, true)} label="Banner" style={{ flex: 2, height: 112 }} />
                        <ImagePick uri={editLogo} onPress={() => pickImage(setEditLogo, false)} label="Logo" icon="camera-outline" style={{ flex: 1, height: 112 }} />
                    </View>
                    <FormField label="Name" placeholder="Community name" value={editName} onChangeText={setEditName} />
                    <FormField label="About" placeholder="What is this community for?" value={editDesc} onChangeText={setEditDesc} multiline />
                    <FormField label="YouTube" placeholder="https://youtube.com/…" value={yt} onChangeText={setYt} autoCapitalize="none" keyboardType="url" />
                    <FormField label="GitHub" placeholder="https://github.com/…" value={gh} onChangeText={setGh} autoCapitalize="none" keyboardType="url" />
                    <FormField label="Website" placeholder="https://…" value={ws} onChangeText={setWs} autoCapitalize="none" keyboardType="url" />
                    <Button block variant="danger" icon="trash-outline" title="Delete community" onPress={handleDeleteHub} style={{ marginTop: 8 }} />
                </View>
            </Sheet>

            <PayWebView visible={showWebView} html={webViewHtml} onMessage={handleWebMsg} onClose={cancelWebPayment} />
        </View>
    );
};

export default CommunityHubScreen;
