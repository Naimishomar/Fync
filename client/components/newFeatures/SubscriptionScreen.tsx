import React, { useState, useEffect } from 'react';
import {View, Text, ScrollView, ActivityIndicator, Modal, Image, StatusBar, TouchableOpacity} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from "react-native-webview";
import axios from '../../context/axiosConfig';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

import { AppBar, StampCard } from '../ui/kit';
import { C } from '../../constants/colors';
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
                            // JSON-encoded: a quote in a name used to break the whole script.
                            name: ${JSON.stringify(user?.name || '')},
                            email: ${JSON.stringify(user?.email || '')},
                            contact: ${JSON.stringify(String(user?.mobileNumber || ''))}
                        },
                        theme: {
                            color: "#F97316"
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
        let msg: any;
        try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

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
                    Alert.alert("Success!", "Your premium subscription is now active.", [
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

    const confirmLogout = () => {
        Alert.alert(
            "Log out",
            "You will need to sign in again to use Fync.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Log out", style: "destructive", onPress: () => logout() },
            ],
        );
    };

    const PERKS = [
        { icon: "infinite", text: "Unlimited app services" },
        { icon: "wifi", text: "Smart WiFi manager" },
        { icon: "wallet", text: "Split and pay ecosystem" },
        { icon: "rocket", text: "Priority feature access" },
    ];

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <View className="flex-1">
                <AppBar title="Fync Pro" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
                <View className="px-5 pt-2">
                    <Text className="font-display text-ink-3 uppercase mb-5" style={{ fontSize: 11, letterSpacing: 1.4 }}>
                        {user?.is_subscribed ? "Active — extend any time" : "Everything, unlocked"}
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <StampCard radius={20} style={{ width: '100%' }}>
                    <View className="w-full bg-ink p-5 overflow-hidden rounded-card">
                        <View className="flex-row justify-between items-start mb-6">
                            <View className="flex-1 pr-3">
                                {/* This heading was text-ink on bg-ink — a contrast ratio of
                                    1.00, meaning the same colour as its own background. It
                                    was not faint, it was invisible. */}
                                <Text className="text-white font-display uppercase" style={{ fontSize: 15 }}>Full Access Pass</Text>
                                <Text className="text-brand-400 font-display uppercase mt-1" style={{ fontSize: 10, letterSpacing: 1.2 }}>
                                    Limited time offer
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-white font-display" style={{ fontSize: 30 }}>₹{subscriptionAmount}</Text>
                                <Text className="text-night-3 font-display uppercase" style={{ fontSize: 10 }}>/ month</Text>
                            </View>
                        </View>

                        <View className="h-[2px] bg-white/15 mb-5" />

                        <View className="mb-6">
                            {PERKS.map((item, index) => (
                                <View key={index} className="flex-row items-center mb-3">
                                    {/* One accent, not four. The old list used cyan, green
                                        and pink alongside brand — none of them from the
                                        palette, and none carrying any meaning. */}
                                    <View className="w-8 h-8 rounded-xl items-center justify-center mr-3 border-2 border-brand-500">
                                        <Ionicons name={item.icon as any} size={15} color={C.brand[500]} />
                                    </View>
                                    <Text className="text-white font-sans flex-1" style={{ fontSize: 13 }}>{item.text}</Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handleSubscribe}
                            disabled={loading}
                            activeOpacity={0.85}
                            className="bg-brand-500 py-4 rounded-xl items-center border-2 border-brand-500"
                            style={{ minHeight: 52, justifyContent: 'center' }}
                            accessibilityRole="button"
                            accessibilityLabel={user?.is_subscribed ? "Extend subscription" : "Unlock premium"}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color={C.ink} />
                            ) : (
                                <View className="flex-row items-center">
                                    {/* Ink on brand-500 measures 6.77:1; white on it is 2.80
                                        and would fail, which is why this is not white. */}
                                    <Text className="text-ink font-display uppercase mr-2" style={{ fontSize: 13 }}>
                                        {user?.is_subscribed ? "Extend subscription" : "Unlock premium"}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={15} color={C.ink} />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                    </StampCard>

                    <View className="mt-6 flex-row items-center justify-center">
                        <Ionicons name="shield-checkmark" size={15} color={C.ink3} />
                        <Text className="font-sans text-ink-2 ml-2 text-center" style={{ fontSize: 12 }}>
                            Secure payment via Razorpay
                        </Text>
                    </View>

                    {/* Account actions, kept well clear of the pay button so a
                        mis-tap cannot log someone out mid-purchase. */}
                    <View className="mt-12">
                        <Text className="font-display text-ink uppercase mb-1" style={{ fontSize: 12 }}>Account</Text>
                        <View className="h-[2px] bg-ink mb-3" style={{ width: 36 }} />

                        <TouchableOpacity
                            onPress={confirmLogout}
                            className="flex-row items-center bg-white border-2 border-ink rounded-card px-4 py-3"
                            style={{ minHeight: 56 }}
                            accessibilityRole="button"
                            accessibilityLabel="Log out"
                        >
                            <View
                                className="items-center justify-center rounded-xl border-2 border-ink"
                                style={{ width: 40, height: 40, backgroundColor: '#FEE2E2' }}
                            >
                                <Ionicons name="log-out-outline" size={20} color={C.danger} />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text className="font-display text-danger" style={{ fontSize: 15 }}>Log out</Text>
                                <Text className="font-sans text-ink-2 mt-[2px]" style={{ fontSize: 11 }}>
                                    {user?.email ?? "Sign out of this account"}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={C.ink3} />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* Razorpay WebView Modal */}
            <Modal
                visible={showWebView}
                animationType="slide"
                transparent={false}
                onRequestClose={() => { setShowWebView(false); Alert.alert("Cancelled", "Payment was cancelled."); }}
            >
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
                            <ActivityIndicator size="large" color={C.brand[500]} />
                        </View>
                    )}
                </SafeAreaView>
            </Modal>
        </View>
    );
};

export default SubscriptionScreen;
