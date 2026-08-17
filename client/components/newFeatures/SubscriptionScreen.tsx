import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, Alert, Image, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from "react-native-webview";
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';

const SubscriptionScreen = ({ onSuccess }: any) => {
    const { user, logout } = useAuth();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(false);
    const [showWebView, setShowWebView] = useState(false);
    const [html, setHtml] = useState("");
    const [order, setOrder] = useState<any>(null);
    const [subscriptionAmount, setSubscriptionAmount] = useState<number>(39);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await axios.get('/subscription/config');
                if (res.data.success && res.data.price) {
                    setSubscriptionAmount(res.data.price);
                }
            } catch (err) {
                console.error("Failed to fetch subscription config", err);
            }
        };
        fetchConfig();
    }, []);

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const res = await axios.post('/subscription/create-order', {
                amount: subscriptionAmount
            });

            if (res.data.success) {
                const currentOrder = res.data.order;
                setOrder(currentOrder);

                const content = `
                <html>
                <body>
                    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                    <script>
                    var options = {
                        key: "${RAZORPAY_KEY_ID}",
                        amount: "${currentOrder.amount}",
                        currency: "INR",
                        name: "Fync Premium",
                        description: "Monthly Subscription",
                        image: "https://pub-f21d514d3e904051ac25997e6c3fef39.r2.dev/Fync.png",
                        order_id: "${currentOrder.id}",
                        prefill: {
                            name: "${user?.name || ''}",
                            email: "${user?.email || ''}",
                            contact: "${user?.mobileNumber || ''}"
                        },
                        theme: {
                            color: "#f97316"
                        },
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
                setHtml(content);
                setShowWebView(true);
            }
        } catch (error) {
            console.error("Error creating subscription:", error);
            Alert.alert("Error", "Could not start subscription process.");
        } finally {
            setLoading(false);
        }
    };

    const handleWebViewMessage = async (event: any) => {
        const msg = JSON.parse(event.nativeEvent.data);

        if (msg.event === "SUCCESS") {
            setShowWebView(false);
            setLoading(true);
            try {
                const verifyRes = await axios.post('/subscription/verify-payment', {
                    razorpay_order_id: msg.data.razorpay_order_id,
                    razorpay_payment_id: msg.data.razorpay_payment_id,
                    razorpay_signature: msg.data.razorpay_signature
                });

                if (verifyRes.data.success) {
                    Alert.alert("Success! 🎉", "Your premium subscription is now active.", [
                        { text: "Continue", onPress: () => {
                            if (onSuccess) onSuccess();
                            else if (navigation.canGoBack()) navigation.goBack();
                        }}
                    ]);
                } else {
                    Alert.alert("Error", "Payment verification failed.");
                }
            } catch (err) {
                console.error("Verification error:", err);
                Alert.alert("Error", "Payment verification failed.");
            } finally {
                setLoading(false);
            }
        } else {
            setShowWebView(false);
            Alert.alert("Cancelled", "Payment was cancelled.");
        }
    };

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <LinearGradient colors={['#f97316', 'transparent']} className="absolute top-0 w-full h-80 opacity-30" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-8 py-4 flex-row items-center justify-between">
                    {navigation.canGoBack() ? (
                        <Pressable onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center border border-slate-100">
                            <Ionicons name="arrow-back" size={20} color="#1e293b" />
                        </Pressable>
                    ) : (
                        <View className="w-10" />
                    )}
                    <Text className="text-slate-900 font-black uppercase text-2xs tracking-wide">Premium Plan</Text>
                    <View className='w-10'></View>
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingBottom: 50 }}>
                    <View className="items-center mt-8 mb-10">
                        <View className="w-24 h-24 bg-white rounded-5xl items-center justify-center shadow-2xl shadow-orange-500/20 border border-slate-100 mb-8">
                            <Ionicons name="flash" size={48} color="#f97316" />
                        </View>

                        <Text className="text-slate-900 text-4xl font-black uppercase tracking-tighter text-center">Fync<Text className="text-orange-500"> Pro</Text></Text>
                        <Text className="text-slate-500 text-center font-black uppercase text-2xs tracking-wide mt-4 leading-5 px-6">
                            {user?.is_subscribed ? "Your mission is active. Extend to maintain your elite status." : "Unlock the full potential of your campus experience."}
                        </Text>
                    </View>

                    {/* Plan Card */}
                    <View className="w-full bg-slate-900 p-8 rounded-5xl border border-slate-800 shadow-2xl shadow-black/20 overflow-hidden">
                        <View className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16" />
                        
                        <View className="flex-row justify-between items-start mb-10">
                            <View>
                                <Text className="text-white font-black uppercase text-xs tracking-tight">Full Access Pass</Text>
                                <Text className="text-orange-500 text-2xs font-black uppercase tracking-wide mt-1">Limited Time Offer</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-white font-black text-3xl tracking-tighter">₹{subscriptionAmount}</Text>
                                <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">/ Month</Text>
                            </View>
                        </View>

                        <View className="gap-y-5 mb-10">
                            {[
                                { icon: "infinite", text: "UNLIMITED APP SERVICES", color: "#f97316" },
                                { icon: "wifi", text: "SMART WIFI MANAGER", color: "#38bdf8" },
                                { icon: "wallet", text: "SPLIT & PAY ECOSYSTEM", color: "#4ade80" },
                                { icon: "rocket", text: "PRIORITY FEATURE ACCESS", color: "#f472b6" },
                            ].map((item, index) => (
                                <View key={index} className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-xl bg-white/5 items-center justify-center mr-4 border border-white/10">
                                        <Ionicons name={item.icon as any} size={16} color={item.color} />
                                    </View>
                                    <Text className="text-slate-300 font-black uppercase text-2xs tracking-wide">{item.text}</Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handleSubscribe}
                            disabled={loading}
                            activeOpacity={0.8}
                            className="bg-white py-5 rounded-2xl items-center"
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <View className="flex-row items-center">
                                    <Text className="text-slate-900 font-black uppercase tracking-wide text-2xs mr-2">
                                        {user?.is_subscribed ? "Extend Subscription" : "Unlock Premium Now"}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color="#000" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View className="mt-12 items-center flex-row justify-center gap-3">
                        <View className="w-8 h-8 rounded-xl bg-slate-50 items-center justify-center border border-slate-100">
                            <Ionicons name="shield-checkmark" size={16} color="#94a3b8" />
                        </View>
                        <Text className="text-slate-300 text-2xs font-black uppercase tracking-wide text-center leading-4 max-w-[200px]">
                            Secure 256-bit encrypted payment processed by Razorpay.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* Razorpay WebView Modal */}
            <Modal visible={showWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
                    {html ? (
                        <WebView
                            source={{ html }}
                            originWhitelist={["*"]}
                            onMessage={handleWebViewMessage}
                            style={{ flex: 1 }}
                        />
                    ) : (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#f97316" />
                        </View>
                    )}
                </SafeAreaView>
            </Modal>
        </View>
    );
};

export default SubscriptionScreen;
