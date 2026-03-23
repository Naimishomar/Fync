import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ScrollView, 
  Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions,
  StatusBar, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, SimpleLineIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { WebView } from 'react-native-webview';

const { width } = Dimensions.get('window');

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
            aspect: isBanner ? undefined : [1, 1],
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
            formData.append('plan', plan);

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
            // 1. Create Razorpay Order
            const amount = plan === 'monthly' ? 99 : 999;
            const orderRes = await axios.post('/payment/order', { 
                amount,
                notes: { type: 'community_creation', creatorEmail: user?.email, name }
            });

            if (!orderRes.data.id) throw new Error("Order generation failed");

            const options: any = {
                description: `Ignite ${name} (${plan})`,
                image: logo || 'https://i.imgur.com/39M8xXo.png',
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
                        description: "Ignite ${name}",
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
        const msg = JSON.parse(event.nativeEvent.data);
        setShowWebView(false);
        if (msg.event === 'SUCCESS') {
            handleCreateSuccess(msg.data);
        } else {
            setLoading(false);
            Alert.alert("Payment Cancelled", "Access to the ecosystem requires a valid Spark ignition.");
        }
    };

    return (
        <View className="flex-1 bg-[#FAFAFA]">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                    <ScrollView showsVerticalScrollIndicator={false} className="px-5">
                        <View className="flex-row items-center justify-between py-5 mb-4">
                            <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white rounded-xl items-center justify-center border border-zinc-100 shadow-sm">
                                <Ionicons name="close" size={20} color="black" />
                            </TouchableOpacity>
                            <View className="items-center">
                                <Text className="text-zinc-900 text-lg font-black uppercase tracking-tight">Generate Hub</Text>
                                <View className="flex-row items-center gap-1">
                                    <View className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    <Text className="text-indigo-600 font-bold text-[7px] uppercase tracking-widest">Resilient Ignition Live</Text>
                                </View>
                            </View>
                            <View className="w-10" />
                        </View>

                        {/* Visual Branding */}
                        <Text className="text-zinc-400 font-black uppercase text-[8px] tracking-[2px] mb-4">Atmospheric Assets</Text>
                        <View className="flex-row gap-3 mb-8">
                            <TouchableOpacity 
                                onPress={() => pickImage(setBanner, true)}
                                className="flex-[2] h-40 bg-zinc-100 rounded-[32px] border border-dashed border-zinc-300 items-center justify-center overflow-hidden"
                            >
                                {banner ? (
                                    <Image source={{ uri: banner }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center">
                                        <Feather name="image" size={24} color="#94a3b8" />
                                        <Text className="text-zinc-400 font-bold text-[7px] uppercase mt-2">Free Size Banner</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => pickImage(setLogo, false)}
                                className="flex-1 h-40 bg-zinc-100 rounded-[32px] border border-dashed border-zinc-300 items-center justify-center overflow-hidden"
                            >
                                {logo ? (
                                    <Image source={{ uri: logo }} className="w-full h-full" />
                                ) : (
                                    <View className="items-center">
                                        <Feather name="camera" size={24} color="#94a3b8" />
                                        <Text className="text-zinc-400 font-bold text-[7px] uppercase mt-2">1:1 Logo</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>

                        <Text className="text-zinc-400 font-black uppercase text-[8px] tracking-[2px] mb-4">Hub Identity</Text>
                        <TextInput 
                            placeholder="Ecosystem Name" 
                            className="bg-white p-5 rounded-2xl border border-zinc-100 font-bold mb-3 text-[12px]" 
                            value={name}
                            onChangeText={setName}
                        />
                        <TextInput 
                            placeholder="Describe the directive of this hub..." 
                            multiline
                            className="bg-white p-5 rounded-2xl border border-zinc-100 font-bold mb-8 h-32 text-[12px] textAlignVertical-top" 
                            value={desc}
                            onChangeText={setDesc}
                        />

                        {/* Activation Scrolscape */}
                        <Text className="text-zinc-400 font-black uppercase text-[8px] tracking-[2px] mb-4">Razorpay Activation Plan</Text>
                        <View className="flex-row gap-2 mb-8">
                            <TouchableOpacity 
                                onPress={() => setPlan('monthly')}
                                className={`flex-1 p-4 rounded-2xl border ${plan === 'monthly' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-100'}`}
                            >
                                <Text className={`font-black uppercase text-[8px] ${plan === 'monthly' ? 'text-white' : 'text-zinc-900'}`}>Monthly Spark</Text>
                                <Text className={`font-bold text-[7px] mt-1 ${plan === 'monthly' ? 'text-white/60' : 'text-zinc-400'}`}>₹99 / 30 Days</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setPlan('yearly')}
                                className={`flex-1 p-4 rounded-2xl border ${plan === 'yearly' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-100'}`}
                            >
                                <View className="flex-row justify-between items-center">
                                    <Text className={`font-black uppercase text-[8px] ${plan === 'yearly' ? 'text-white' : 'text-zinc-900'}`}>Yearly Eternal</Text>
                                    <View className="bg-blue-500 px-1.5 py-0.5 rounded-full">
                                        <Text className="text-[6px] text-white font-black uppercase">Save 15%</Text>
                                    </View>
                                </View>
                                <Text className={`font-bold text-[7px] mt-1 ${plan === 'yearly' ? 'text-white/60' : 'text-zinc-400'}`}>₹999 / 365 Days</Text>
                            </TouchableOpacity>
                        </View>

                        <Text className="text-zinc-400 font-black uppercase text-[8px] tracking-[2px] mb-4">Social Ecosystem</Text>
                        <View className="bg-white p-6 rounded-[32px] border border-zinc-100 mb-10">
                            <View className="flex-row items-center gap-4 mb-5">
                                <FontAwesome5 name="youtube" size={16} color="#ef4444" />
                                <TextInput placeholder="YouTube URL" value={youtube} onChangeText={setYoutube} className="flex-1 font-bold text-[10px]" />
                            </View>
                            <View className="flex-row items-center gap-4 mb-5">
                                <FontAwesome5 name="github" size={16} color="#1a1a1a" />
                                <TextInput placeholder="GitHub URL" value={github} onChangeText={setGithub} className="flex-1 font-bold text-[10px]" />
                            </View>
                            <View className="flex-row items-center gap-4">
                                <SimpleLineIcons name="globe" size={16} color="#6366f1" />
                                <TextInput placeholder="Website" value={website} onChangeText={setWebsite} className="flex-1 font-bold text-[10px]" />
                            </View>
                        </View>

                        <TouchableOpacity 
                            onPress={handleCreate}
                            disabled={loading}
                            className={`p-6 rounded-[32px] items-center shadow-xl shadow-black/10 mb-10 bg-indigo-600`}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest text-[11px]">Pay & Ignite Hub</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* WebView Fallback Modal */}
            <Modal visible={showWebView} animationType="slide">
                <SafeAreaView className="flex-1 bg-white">
                    <View className="flex-row items-center justify-between p-4 border-b border-zinc-100 bg-[#FAFAFA]">
                        <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-widest">Resilient Spark Processor</Text>
                        <TouchableOpacity onPress={() => { setShowWebView(false); setLoading(false); }}>
                            <Ionicons name="close" size={24} color="black" />
                        </TouchableOpacity>
                    </View>
                    <WebView
                        source={{ html: webViewHtml }}
                        onMessage={onWebViewMessage}
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

export default CreateCommunityScreen;
