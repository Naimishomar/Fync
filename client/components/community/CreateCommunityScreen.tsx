import React, { useState } from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, KeyboardAvoidingView, Dimensions, StatusBar, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
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
                theme: { color: '#F97316' }
            };

            const triggerWebView = () => {
                const content = `
                <html>
                <body style="background-color: #F5F2EC; display: flex; justify-content: center; align-items: center; height: 100vh;">
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
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="flex-1" 
            />

            <View 
                className="w-full bg-paper rounded-t-sheet overflow-hidden"
                style={{ height: screenHeight * 0.8 }}
            >
                <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mt-4 mb-2" />
                
                <View className="px-gutter py-4 flex-row items-center justify-between">
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        className="w-11 h-11 items-center justify-center rounded-xl"
                    
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                        <Ionicons name="close" size={20} color="#12100E" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-ink text-xl font-display uppercase">Generate <Text className="text-accent-text">Hub</Text></Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Ecosystem Initiation Protocol</Text>
                    </View>
                    <View className="w-11" />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} className="px-gutter flex-1">
                    <View className="flex-row items-center mt-4 mb-4" style={{ gap: 12 }}>
                      <Text className="text-ink-3 font-display uppercase text-label">Visual Identity</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    <View className="flex-row gap-4 mb-10">
                        <TouchableOpacity 
                            onPress={() => pickImage(setBanner, true)}
                            className="flex-[2] h-40 bg-card rounded-sheet border border-dashed border-line items-center justify-center overflow-hidden shadow-hair"
                        >
                            {banner ? (
                                <Image source={{ uri: banner }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <Feather name="image" size={24} color="#C4BEB6" />
                                    <Text className="text-ink-4 font-display uppercase text-label mt-2">Banner Asset</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => pickImage(setLogo, false)}
                            className="flex-1 h-40 bg-card rounded-sheet border border-dashed border-line items-center justify-center overflow-hidden shadow-hair"
                        >
                            {logo ? (
                                <Image source={{ uri: logo }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <View className="items-center">
                                    <Feather name="camera" size={24} color="#C4BEB6" />
                                    <Text className="text-ink-4 font-display uppercase text-label mt-2">1:1 Logo</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text className="text-ink-3 font-display uppercase text-label mb-4">Core Directives</Text>
                    <TextInput 
                        placeholder="Ecosystem Designation" 
                        placeholderTextColor="#C4BEB6"
                        className="bg-card p-5 border-[1.5px] border-ink font-display text-xs mb-4 shadow-hair text-ink rounded-md" 
                        value={name}
                        onChangeText={setName}
                    />
                    <TextInput 
                        placeholder="Describe the mission parameters of this hub..." 
                        placeholderTextColor="#C4BEB6"
                        multiline
                        className="bg-card p-5 border-[1.5px] border-ink font-medium text-xs mb-10 h-32 text-ink-2 shadow-hair rounded-md" 
                        textAlignVertical="top"
                        value={desc}
                        onChangeText={setDesc}
                    />

                    <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                      <Text className="text-ink-3 font-display uppercase text-label">Activation Tier</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    <View className="flex-row gap-3 mb-10">
                        <TouchableOpacity 
                            onPress={() => setPlan('monthly')}
                            className={`flex-1 p-5 rounded-card border ${plan === 'monthly' ? 'bg-ink border-ink shadow-hair ' : 'bg-card border-line shadow-hair '}`}
                        >
                            <Text className={`font-display uppercase text-label ${plan === 'monthly' ? 'text-white' : 'text-ink'}`}>Monthly</Text>
                            <Text className={`font-semibold text-label mt-1 ${plan === 'monthly' ? 'text-white/60' : 'text-ink-3'}`}>₹99 / 30 Days</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setPlan('yearly')}
                            className={`flex-1 p-5 rounded-card border ${plan === 'yearly' ? 'bg-brand-500 border-brand-500 shadow-hair ' : 'bg-card border-line shadow-hair '}`}
                        >
                            <View className="flex-row justify-between items-center">
                                <Text className={`font-display uppercase text-label ${plan === 'yearly' ? 'text-ink' : 'text-ink'}`}>Yearly</Text>
                                <View className="bg-card/20 px-2.5 py-1 rounded-full">
                                    <Text className="text-label text-ink font-display uppercase">Elite</Text>
                                </View>
                            </View>
                            <Text className={`font-semibold text-label mt-1 ${plan === 'yearly' ? 'text-white/90' : 'text-ink-3'}`}>₹999 / 365 Days</Text>
                        </TouchableOpacity>
                    </View>

                    <Text className="text-ink-3 font-display uppercase text-label mb-4">External Links</Text>
                    <View className="bg-card p-6 rounded-sheet border border-line mb-10 shadow-hair">
                        <View className="flex-row items-center gap-4 mb-6">
                            <FontAwesome5 name="youtube" size={16} color="#DC2626" />
                            <TextInput placeholder="YouTube Protocol" placeholderTextColor="#C4BEB6" value={youtube} onChangeText={setYoutube} className="flex-1 font-display text-label text-ink" />
                        </View>
                        <View className="flex-row items-center gap-4 mb-6">
                            <FontAwesome5 name="github" size={16} color="#12100E" />
                            <TextInput placeholder="GitHub Repository" placeholderTextColor="#C4BEB6" value={github} onChangeText={setGithub} className="flex-1 font-display text-label text-ink" />
                        </View>
                        <View className="flex-row items-center gap-4">
                            <SimpleLineIcons name="globe" size={16} color="#F97316" />
                            <TextInput placeholder="Web Portal" placeholderTextColor="#C4BEB6" value={website} onChangeText={setWebsite} className="flex-1 font-display text-label text-ink" />
                        </View>
                    </View>

                    <TouchableOpacity 
                        onPress={handleCreate}
                        disabled={loading}
                        className={`p-6 rounded-card items-center shadow-hair mb-20 ${loading ? 'bg-paper-2' : 'bg-ink '}`}
                    >
                        {loading ? <ActivityIndicator color="#F97316" /> : (
                            <View className="flex-row items-center">
                                <Text className="text-white font-display uppercase text-xs mr-3">Deploy Ecosystem Hub</Text>
                                <Ionicons name="rocket" size={18} color="white" />
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>

            <Modal visible={showWebView} animationType="slide">
                <SafeAreaView className="flex-1 bg-paper">
                    <WebView
                        source={{ html: webViewHtml }}
                        onMessage={onWebViewMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        originWhitelist={['*']}
                        style={{ flex: 1, backgroundColor: '#F5F2EC' }}
                    />
                </SafeAreaView>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default CreateCommunityScreen;
