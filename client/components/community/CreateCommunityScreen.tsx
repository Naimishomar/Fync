import React, { useState } from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions, StatusBar, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { WebView } from 'react-native-webview';
import { Alert } from '../ui/AlertModal';

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
                theme: { color: '#f97316' }
            };

            const triggerWebView = () => {
                const content = `
                <html>
                <body style="background-color: #fafafa; display: flex; justify-content: center; align-items: center; height: 100vh;">
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <script>
                    var options = {
                        key: "${RAZORPAY_KEY_ID}",
                        amount: "${orderRes.data.amount}",
                        currency: "INR",
                        name: "Fync Ecosystem",
                        description: "Ignite ${name}",
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

    const screenHeight = Dimensions.get('window').height;

    return (
        <KeyboardAvoidingView 
            behavior="padding"
            className="flex-1 bg-black/60"
        >
            <StatusBar barStyle="light-content" />
            
            {/* Touchable backdrop to go back */}
            <TouchableOpacity 
                activeOpacity={1} 
                onPress={() => navigation.goBack()} 
                className="flex-1" 
            />

            <View 
                className="w-full bg-[#F8FAFC] rounded-t-5xl overflow-hidden"
                style={{ height: screenHeight * 0.8 }}
            >
                <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mt-4 mb-2" />
                
                <View className="px-8 py-4 flex-row items-center justify-between">
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        className="w-11 h-11 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm"
                    >
                        <Ionicons name="close" size={20} color="#18181b" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-slate-900 text-xl font-black uppercase tracking-tight">Generate <Text className="text-orange-500">Hub</Text></Text>
                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Ecosystem Initiation Protocol</Text>
                    </View>
                    <View className="w-11" />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="px-8 flex-1">
                    <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4 mt-4">Visual Identity</Text>
                    <View className="flex-row gap-4 mb-10">
                        <TouchableOpacity 
                            onPress={() => pickImage(setBanner, true)}
                            className="flex-[2] h-40 bg-white rounded-4xl border border-dashed border-slate-200 items-center justify-center overflow-hidden shadow-sm shadow-black/5"
                        >
                            {banner ? (
                                <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <Feather name="image" size={24} color="#CBD5E1" />
                                    <Text className="text-slate-300 font-black uppercase text-2xs tracking-wide mt-2">Banner Asset</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => pickImage(setLogo, false)}
                            className="flex-1 h-40 bg-white rounded-4xl border border-dashed border-slate-200 items-center justify-center overflow-hidden shadow-sm shadow-black/5"
                        >
                            {logo ? (
                                <Image source={{ uri: logo }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <Feather name="camera" size={24} color="#CBD5E1" />
                                    <Text className="text-slate-300 font-black uppercase text-2xs tracking-wide mt-2">1:1 Logo</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Core Directives</Text>
                    <TextInput 
                        placeholder="Ecosystem Designation" 
                        placeholderTextColor="#CBD5E1"
                        className="bg-white p-5 rounded-3xl border border-slate-100 font-black text-xs mb-4 shadow-sm shadow-black/5 text-slate-900" 
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput 
                        placeholder="Describe the mission parameters of this hub..." 
                        placeholderTextColor="#CBD5E1"
                        multiline
                        className="bg-white p-5 rounded-3xl border border-slate-100 font-medium text-xs mb-10 h-32 text-slate-600 shadow-sm shadow-black/5" 
                        textAlignVertical="top"
                        value={desc}
                        onChangeText={setDesc}
                    />

                    <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">Activation Tier</Text>
                    <View className="flex-row gap-3 mb-10">
                        <TouchableOpacity 
                            onPress={() => setPlan('monthly')}
                            className={`flex-1 p-5 rounded-3xl border ${plan === 'monthly' ? 'bg-slate-900 border-slate-900 shadow-xl shadow-black/20' : 'bg-white border-slate-100 shadow-sm shadow-black/5'}`}
                        >
                            <Text className={`font-black uppercase text-2xs tracking-widest ${plan === 'monthly' ? 'text-white' : 'text-slate-900'}`}>Monthly</Text>
                            <Text className={`font-bold text-2xs mt-1 ${plan === 'monthly' ? 'text-white/60' : 'text-slate-500'}`}>₹99 / 30 Days</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setPlan('yearly')}
                            className={`flex-1 p-5 rounded-3xl border ${plan === 'yearly' ? 'bg-orange-500 border-orange-500 shadow-xl shadow-orange-500/20' : 'bg-white border-slate-100 shadow-sm shadow-black/5'}`}
                        >
                            <View className="flex-row justify-between items-center">
                                <Text className={`font-black uppercase text-2xs tracking-widest ${plan === 'yearly' ? 'text-white' : 'text-slate-900'}`}>Yearly</Text>
                                <View className="bg-white/20 px-2 py-0.5 rounded-full">
                                    <Text className="text-2xs text-white font-black uppercase">Elite</Text>
                                </View>
                            </View>
                            <Text className={`font-bold text-2xs mt-1 ${plan === 'yearly' ? 'text-white/90' : 'text-slate-500'}`}>₹999 / 365 Days</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide mb-4">External Links</Text>
                    <View className="bg-white p-6 rounded-4xl border border-slate-100 mb-10 shadow-sm shadow-black/5">
                        <View className="flex-row items-center gap-4 mb-6">
                            <FontAwesome5 name="youtube" size={16} color="#ef4444" />
                            <TextInput placeholder="YouTube Protocol" placeholderTextColor="#CBD5E1" value={youtube} onChangeText={setYoutube} className="flex-1 font-black text-2xs text-slate-900" />
                        </View>
                        <View className="flex-row items-center gap-4 mb-6">
                            <FontAwesome5 name="github" size={16} color="#1a1a1a" />
                            <TextInput placeholder="GitHub Repository" placeholderTextColor="#CBD5E1" value={github} onChangeText={setGithub} className="flex-1 font-black text-2xs text-slate-900" />
                        </View>
                        <View className="flex-row items-center gap-4">
                            <SimpleLineIcons name="globe" size={16} color="#f97316" />
                            <TextInput placeholder="Web Portal" placeholderTextColor="#CBD5E1" value={website} onChangeText={setWebsite} className="flex-1 font-black text-2xs text-slate-900" />
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleCreate}
                        disabled={loading}
                        className={`p-6 rounded-3xl items-center shadow-2xl mb-20 ${loading ? 'bg-slate-100' : 'bg-slate-900 shadow-black/40'}`}
                    >
                        {loading ? <ActivityIndicator color="#f97316" /> : (
                            <View className="flex-row items-center">
                                <Text className="text-white font-black uppercase tracking-wide text-xs mr-3">Deploy Ecosystem Hub</Text>
                                <Ionicons name="rocket" size={18} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <Modal visible={showWebView} animationType="slide">
                <SafeAreaView className="flex-1 bg-[#F8FAFC]">
                    <WebView
                        source={{ html: webViewHtml }}
                        onMessage={onWebViewMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        originWhitelist={['*']}
                        style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                    />
                </SafeAreaView>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default CreateCommunityScreen;
