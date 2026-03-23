import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Linking, Alert, ActivityIndicator, AppState, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import SplitPaymentModal from './SplitPaymentModal';

const EnterAmountScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { merchantUpiId, merchantName } = route.params || {};

    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    // State to show success UI and prompt for Splitting
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [isSplitModalVisible, setSplitModalVisible] = useState(false);

    // Tracking app state to show alert AFTER returning from UPI app
    const [waitingForPayment, setWaitingForPayment] = useState(false);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (waitingForPayment) {
                    setWaitingForPayment(false);
                    // User returned from UPI app, show verify alert!
                    setTimeout(() => showVerificationAlert(), 500);
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [waitingForPayment, amount, merchantName, merchantUpiId]);

    const showVerificationAlert = () => {
        Alert.alert(
            "Payment Verification",
            `Did you successfully pay ₹${amount} to ${merchantName || 'Merchant'}?`,
            [
                {
                    text: "No, Cancelled",
                    style: "cancel",
                    onPress: () => {
                        Toast.show({ type: 'info', text1: 'Payment aborted' });
                    }
                },
                {
                    text: "Yes, Payment Done",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const res = await axios.post('/split/pay', {
                                amount: Number(amount),
                                merchantUpiId,
                                merchantName,
                                status: 'success',
                                referenceId: `UPI${Math.floor(Math.random() * 1000000000)}`
                            });
                            setLoading(false);

                            if (res.data.success) {
                                setTransactionId(res.data.transaction._id);
                                setPaymentSuccess(true);
                            }
                        } catch (error) {
                            setLoading(false);
                            console.error("Payment Error", error);
                            Toast.show({ type: 'error', text1: 'Payment failed on server' });
                        }
                    }
                }
            ]
        );
    };

    const handlePay = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            Toast.show({ type: 'error', text1: 'Enter a valid amount' });
            return;
        }

        const upiUrl = `upi://pay?pa=${merchantUpiId}&pn=${merchantName || 'Merchant'}&am=${amount}&cu=INR&url=fync://`;

        try {
            const canOpen = await Linking.canOpenURL(upiUrl);

            if (canOpen) {
                setWaitingForPayment(true);
                await Linking.openURL(upiUrl);
            } else {
                // If NO UPI app is installed, show a warning
                Alert.alert(
                    "No UPI App Found",
                    "We couldn't find any UPI apps (like GPay, PhonePe, Paytm) on your device. Please install one to proceed with the payment.",
                    [{ text: "Okay" }]
                );
            }
        } catch (error) {
            console.error("Open URL Error", error);
            Toast.show({ type: 'error', text1: 'Could not launch payment app' });
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center p-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-white rounded-full border border-gray-100 shadow-sm">
                    <Ionicons name="close" size={24} color="#18181b" />
                </TouchableOpacity>
            </View>

            {paymentSuccess ? (
                <View className="flex-1 items-center justify-center p-6">
                    <View className="w-24 h-24 bg-emerald-50 rounded-full items-center justify-center mb-6 border border-emerald-100">
                        <Ionicons name="checkmark-circle" size={80} color="#10b981" />
                    </View>
                    <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter text-center">Payment <Text className="text-emerald-500">Successful!</Text></Text>
                    <Text className="text-gray-500 text-center mt-3 mb-10 font-medium px-4">You have successfully paid ₹{amount} to {merchantName || 'Merchant'}.</Text>

                    <TouchableOpacity
                        className="bg-zinc-900 w-full p-5 rounded-2xl items-center flex-row justify-center mb-4 shadow-lg shadow-black/20"
                        onPress={() => setSplitModalVisible(true)}
                    >
                        <Ionicons name="people" size={24} color="white" />
                        <Text className="text-white text-lg font-black italic tracking-tight uppercase ml-2">Split with Friends</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="bg-white border border-gray-100 w-full p-5 rounded-2xl items-center flex-row justify-center"
                        onPress={() => navigation.navigate("PayAndSplitHome")}
                    >
                        <Text className="text-gray-500 text-lg font-black italic tracking-tight uppercase">Done</Text>
                    </TouchableOpacity>

                    <SplitPaymentModal
                        visible={isSplitModalVisible}
                        onClose={() => setSplitModalVisible(false)}
                        totalAmount={Number(amount)}
                        paymentTransactionId={transactionId || ''}
                        onSuccess={() => navigation.navigate("PayAndSplitHome")}
                    />
                </View>
            ) : (
                <View className="flex-1 items-center justify-center p-6 -mt-10">
                    <View className="bg-white p-8 rounded-3xl items-center mb-10 w-full max-w-sm border border-gray-100 shadow-sm shadow-black/5">
                        <View className="bg-pink-50 p-4 rounded-full mb-4 border border-pink-100">
                            <Ionicons name="storefront-outline" size={36} color="#ec4899" />
                        </View>
                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Paying securely to</Text>
                        <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter mt-1 text-center">{merchantName || 'Merchant'}</Text>
                        <Text className="text-gray-500 text-[10px] mt-2 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 font-bold uppercase">{merchantUpiId}</Text>
                    </View>

                    <Text className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4">Enter Amount</Text>
                    <View className="flex-row items-center mb-10 border-b-4 border-pink-500/10 pb-2">
                        <Text className="text-zinc-900 text-5xl font-black italic tracking-tighter">₹</Text>
                        <TextInput
                            className="text-zinc-900 text-5xl font-black italic tracking-tighter min-w-[150px] text-center"
                            placeholder="0"
                            placeholderTextColor="#e4e4e7"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity
                        className={`w-full p-5 rounded-2xl items-center shadow-lg ${!amount || Number(amount) <= 0 ? 'bg-gray-100' : 'bg-pink-500 shadow-pink-500/30'}`}
                        onPress={handlePay}
                        disabled={loading || !amount || Number(amount) <= 0}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className={`text-lg font-black italic tracking-tight uppercase ${!amount || Number(amount) <= 0 ? 'text-gray-400' : 'text-white'}`}>Proceed to Pay</Text>
                        )}
                    </TouchableOpacity>
                    
                    <View className="mt-8 flex-row items-center opacity-40">
                        <Ionicons name="lock-closed" size={12} color="#9ca3af" />
                        <Text className="text-gray-500 text-[10px] font-bold uppercase ml-1 tracking-tighter">Secure UPI Encryption Active</Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

export default EnterAmountScreen;
