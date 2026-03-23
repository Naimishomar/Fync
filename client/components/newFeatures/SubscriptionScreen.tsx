import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from "react-native-webview";
import axios from '../../context/axiosConfig';
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import { useAuth } from '../../context/auth.context';

const SubscriptionScreen = ({ onSuccess }: { onSuccess: () => void }) => {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showWebView, setShowWebView] = useState(false);
    const [html, setHtml] = useState("");
    const [order, setOrder] = useState<any>(null);

    const SUBSCRIPTION_AMOUNT = 39;

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const res = await axios.post('/subscription/create-order', {
                amount: SUBSCRIPTION_AMOUNT
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
                        order_id: "${currentOrder.id}",
                        prefill: {
                            name: "${user?.name || ''}",
                            email: "${user?.email || ''}",
                            contact: "${user?.mobileNumber || ''}"
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
                        { text: "Continue", onPress: onSuccess }
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
                {/* Header */}
                <View className="items-center mt-10 mb-8">
                    <View className="bg-pink-900/30 p-4 rounded-full mb-4 border border-pink-500/30">
                        <Ionicons name="star" size={50} color="#ec4899" />
                    </View>
                    <Text className="text-white text-3xl font-bold tracking-tight">Get Premium Access</Text>
                    <Text className="text-gray-400 mt-2 text-center text-sm px-4">
                        Your subscription has expired or you haven't subscribed yet. Upgrade to continue using Fync.
                    </Text>
                </View>

                {/* Plan Card */}
                <View className="bg-gray-900 rounded-3xl p-6 border border-pink-600/50 mb-8">
                    <View className="flex-row justify-between items-center mb-6 border-b border-gray-800 pb-4">
                        <View>
                            <Text className="text-white text-xl font-bold">Monthly Plan</Text>
                            <Text className="text-pink-400 text-sm font-semibold mt-1">BEST VALUE</Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-white text-3xl font-bold">₹39</Text>
                            <Text className="text-gray-500 text-xs">/ month</Text>
                        </View>
                    </View>

                    {/* Features List */}
                    <View className="gap-y-4">
                        {[
                            { icon: "infinite-outline", text: "Access to all app services" },
                            { icon: "wifi-outline", text: "Smart WiFi Login Manager" },
                            { icon: "wallet-outline", text: "Split & Pay features" },
                            { icon: "sparkles-outline", text: "Exclusive future premium tools" },
                        ].map((item, index) => (
                            <View key={index} className="flex-row items-center">
                                <View className="bg-pink-500/20 p-1.5 rounded-full mr-3 border border-pink-500/30">
                                    <Ionicons name={item.icon as any} size={16} color="#ec4899" />
                                </View>
                                <Text className="text-gray-200 text-sm font-medium">{item.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Secure Badge */}
                <View className="flex-row items-center justify-center mb-6 gap-2 opacity-50">
                    <Ionicons name="lock-closed" size={12} color="white" />
                    <Text className="text-white text-xs font-semibold">SECURE PAYMENT PROCESSED BY RAZORPAY</Text>
                </View>

                {/* Subscribe Button */}
                <Pressable
                    onPress={handleSubscribe}
                    disabled={loading}
                    className="bg-pink-600 h-14 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/30 mb-4"
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Subscribe for ₹39</Text>
                    )}
                </Pressable>

                <Pressable onPress={logout} className="items-center py-2">
                    <Text className="text-gray-500 font-medium">Log out</Text>
                </Pressable>
            </ScrollView>

            {/* Razorpay WebView Modal */}
            <Modal visible={showWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                    <View className="flex-row items-center justify-between p-4 border-b border-gray-900 bg-black">
                        <Text className="text-white font-bold text-lg">Secure Checkout</Text>
                        <Pressable onPress={() => {
                            setShowWebView(false);
                            Alert.alert("Cancelled", "Payment was cancelled.");
                        }}>
                            <Ionicons name="close" size={24} color="white" />
                        </Pressable>
                    </View>
                    {html ? (
                        <WebView
                            source={{ html }}
                            originWhitelist={["*"]}
                            onMessage={handleWebViewMessage}
                            style={{ flex: 1, backgroundColor: '#000' }}
                        />
                    ) : (
                        <View className="flex-1 bg-black justify-center items-center">
                            <ActivityIndicator size="large" color="#ec4899" />
                        </View>
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

export default SubscriptionScreen;
