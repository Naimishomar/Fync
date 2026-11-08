import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Modal, StatusBar } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from "react-native-webview";
import axios from '../../context/axiosConfig';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

import { AppBar, Button, Card, IconTile, ListRow, SectionHeader } from '../ui/kit';
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
                            color: C.brand[500]
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
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar title="Fync Pro" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                    <Text className="font-sans text-sm text-ink-3 mb-4">
                        {user?.is_subscribed ? "Active — extend any time" : "Everything, unlocked"}
                    </Text>

                    {/* Intentionally dark: the pass is the one premium surface. */}
                    <View className="w-full bg-night border border-line p-5 overflow-hidden rounded-2xl">
                        <View className="flex-row justify-between items-start mb-4">
                            <View className="flex-1 pr-3">
                                <Text className="text-night-ink font-semibold text-base">Full access pass</Text>
                                <Text className="text-brand-400 font-semibold text-xs mt-1">Limited time offer</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-night-ink font-display" style={{ fontSize: 30, lineHeight: 34 }}>₹{subscriptionAmount}</Text>
                                <Text className="text-night-3 font-sans text-xs">/ month</Text>
                            </View>
                        </View>

                        <View className="h-px bg-night-ink/15 mb-4" />

                        <View className="mb-4">
                            {PERKS.map((item, index) => (
                                <View key={index} className="flex-row items-center mb-3">
                                    <View className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-night-ink/10">
                                        <Ionicons name={item.icon as any} size={16} color={C.brand[500]} />
                                    </View>
                                    <Text className="text-night-ink font-sans text-sm flex-1">{item.text}</Text>
                                </View>
                            ))}
                        </View>

                        <Button
                            title={user?.is_subscribed ? "Extend subscription" : "Unlock premium"}
                            icon="chevron-forward"
                            variant="primary"
                            block
                            loading={loading}
                            onPress={handleSubscribe}
                        />
                    </View>

                    <View className="mt-4 flex-row items-center justify-center">
                        <Ionicons name="shield-checkmark-outline" size={16} color={C.ink3} />
                        <Text className="font-sans text-xs text-ink-2 ml-2 text-center">Secure payment via Razorpay</Text>
                    </View>

                    {/* Account actions, kept well clear of the pay button so a
                        mis-tap cannot log someone out mid-purchase. */}
                    <SectionHeader title="Account" style={{ marginTop: 40, marginBottom: 12 }} />
                    <Card style={{ paddingHorizontal: 16 }}>
                        <ListRow
                            onPress={confirmLogout}
                            leading={<IconTile icon="log-out-outline" color={C.danger} />}
                            title="Log out"
                            subtitle={user?.email ?? "Sign out of this account"}
                            accessibilityLabel="Log out"
                        />
                    </Card>
                </ScrollView>
            </View>

            {/* Razorpay WebView Modal */}
            <Modal
                visible={showWebView}
                animationType="slide"
                transparent={false}
                onRequestClose={() => { setShowWebView(false); Alert.alert("Cancelled", "Payment was cancelled."); }}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: C.card }}>
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
