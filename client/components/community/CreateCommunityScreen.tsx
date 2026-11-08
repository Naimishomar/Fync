import React, { useState } from 'react';
import { View, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { Button, Sheet, FormField, SectionHeader, SegmentedTabs } from '../ui/kit';
import { ImagePick, PayWebView, PLANS, PLAN_LABELS } from './shared';


const CreateCommunityScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [logo, setLogo] = useState<string | null>(null);
    const [banner, setBanner] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');

    // Social Ecosystem
    const [youtube, setYoutube] = useState('');
    const [github, setGithub] = useState('');
    const [website, setWebsite] = useState('');

    // WebView Fallback
    const [showWebView, setShowWebView] = useState(false);
    const [webViewHtml, setWebViewHtml] = useState('');

    const pickImage = async (setter: (uri: string) => void, isBanner: boolean = false) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: isBanner ? [16, 9] : [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) setter(result.assets[0].uri);
    };

    const handleCreateSuccess = async (paymentData: any) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', desc);
            formData.append('creatorId', user?._id);
            formData.append('plan', plan);
            formData.append('paymentId', paymentData.razorpay_payment_id);
            formData.append('orderId', paymentData.razorpay_order_id);
            formData.append('signature', paymentData.razorpay_signature);

            const socialLinks = { youtube, github, website };
            formData.append('socialLinks', JSON.stringify(socialLinks));

            if (logo) {
                const filename = logo.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('logo', { uri: logo, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }

            if (banner) {
                const filename = banner.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                formData.append('banner', { uri: banner, name: filename, type: match ? `image/${match[1]}` : 'image' } as any);
            }

            const createRes = await axios.post('/communities/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (createRes.data.success) {
                Alert.alert("Hub Activated!", `Your ecosystem is live with a ${plan} plan.`);
                navigation.replace('CommunityHub', { communityId: createRes.data.community._id });
            }
        } catch (error: any) {
            Alert.alert("Ignition Failed", error.response?.data?.message || "Ecosystem data sync error");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!name.trim() || !desc.trim()) {
            Alert.alert("Error", "Your ecosystem requires a name and directive.");
            return;
        }

        setLoading(true);
        try {
            const orderRes = await axios.post('/payment/order', {
                purpose: 'community_creation',
                plan,
                name,
            });

            if (!orderRes.data.id) throw new Error("Order generation failed");

            const options: any = {
                description: `Ignite ${name} (${plan})`,
                image: logo || 'https://i.imgur.com/39M8xXo.png',
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
                        key: "${RAZORPAY_KEY_ID}",
                        amount: "${orderRes.data.amount}",
                        currency: "INR",
                        name: "Fync Ecosystem",
                        description: ${JSON.stringify(`Ignite ${name}`)},
                        order_id: "${orderRes.data.id}",
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
                    RazorpayCheckout.open(options).then(handleCreateSuccess).catch((error: any) => {
                        if (error?.description?.includes('null') || !error?.code || error?.description?.includes('bridge')) {
                            triggerWebView();
                        } else {
                            Alert.alert(`Ecosystem Ignition Locked`, error.description || "Razorpay transaction aborted");
                            setLoading(false);
                        }
                    });
                } catch (e) {
                    triggerWebView();
                }
            } else {
                triggerWebView();
            }

        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Order creation failed");
            setLoading(false);
        }
    };

    const onWebViewMessage = (event: any) => {
        let msg: any = {};
        try { msg = JSON.parse(event.nativeEvent.data); } catch { /* treated as cancel */ }
        setShowWebView(false);
        if (msg.event === 'SUCCESS') {
            handleCreateSuccess(msg.data);
        } else {
            setLoading(false);
            Alert.alert("Payment Cancelled", "Access to the ecosystem requires a valid Spark ignition.");
        }
    };

    return (
        <View className="flex-1">
            <StatusBar barStyle="light-content" />
            <Sheet
                visible
                onClose={() => navigation.goBack()}
                title="Create community"
                subtitle="A paid space with rooms, feeds and announcements"
                height="88%"
                footer={<Button title={`Pay and create · ${plan === 'yearly' ? '₹999' : '₹99'}`} variant="primary" block loading={loading} onPress={handleCreate} />}
            >
                <View style={{ gap: 16 }}>
                    <View className="flex-row" style={{ gap: 12 }}>
                        <ImagePick uri={banner} onPress={() => pickImage(setBanner, true)} label="Banner" style={{ flex: 2, height: 128 }} />
                        <ImagePick uri={logo} onPress={() => pickImage(setLogo, false)} label="Logo" icon="camera-outline" style={{ flex: 1, height: 128 }} />
                    </View>
                    <FormField label="Name" placeholder="Community name" value={name} onChangeText={setName} />
                    <FormField label="About" placeholder="What is this community for?" multiline value={desc} onChangeText={setDesc} />

                    <SectionHeader title="Plan" style={{ marginTop: 8, marginBottom: 0 }} />
                    <SegmentedTabs items={PLANS} value={plan} onChange={setPlan} labels={PLAN_LABELS} />

                    <SectionHeader title="Links" style={{ marginTop: 8, marginBottom: 0 }} />
                    <FormField label="YouTube" placeholder="https://youtube.com/…" value={youtube} onChangeText={setYoutube} autoCapitalize="none" keyboardType="url" />
                    <FormField label="GitHub" placeholder="https://github.com/…" value={github} onChangeText={setGithub} autoCapitalize="none" keyboardType="url" />
                    <FormField label="Website" placeholder="https://…" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" />
                </View>
            </Sheet>

            <PayWebView
                visible={showWebView}
                html={webViewHtml}
                onMessage={onWebViewMessage}
                onClose={() => { setShowWebView(false); setLoading(false); }}
            />
        </View>
    );
};

export default CreateCommunityScreen;
