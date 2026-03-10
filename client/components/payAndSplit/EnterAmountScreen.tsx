import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Linking, Alert, ActivityIndicator, AppState } from 'react-native';
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
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-row items-center p-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {paymentSuccess ? (
                <View className="flex-1 items-center justify-center p-6 bg-black">
                    <Ionicons name="checkmark-circle" size={100} color="#34d399" />
                    <Text className="text-white text-2xl font-bold mt-6 mb-2">Payment Successful!</Text>
                    <Text className="text-gray-400 text-center mb-10">You have paid ₹{amount} to {merchantName || 'Merchant'}.</Text>

                    <TouchableOpacity
                        className="bg-blue-600 w-full p-4 rounded-xl items-center flex-row justify-center mb-4"
                        onPress={() => setSplitModalVisible(true)}
                    >
                        <Ionicons name="people" size={24} color="white" className="mr-2" />
                        <Text className="text-white text-lg font-bold ml-2">Split with Friends</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="border border-gray-700 w-full p-4 rounded-xl items-center flex-row justify-center bg-gray-900"
                        onPress={() => navigation.navigate("PayAndSplitHome")}
                    >
                        <Text className="text-gray-300 text-lg font-bold">Done</Text>
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
                <View className="flex-1 items-center justify-center p-6">
                    <View className="bg-gray-800 p-6 rounded-2xl items-center mb-10 w-full max-w-sm border border-gray-700">
                        <View className="bg-white/10 p-3 rounded-full mb-3">
                            <Ionicons name="storefront-outline" size={32} color="white" />
                        </View>
                        <Text className="text-gray-400 text-sm">Paying securely to</Text>
                        <Text className="text-white text-2xl font-bold mt-1 text-center">{merchantName || 'Merchant'}</Text>
                        <Text className="text-gray-500 text-xs mt-1 bg-black/50 px-2 py-1 rounded-md">{merchantUpiId}</Text>
                    </View>

                    <Text className="text-gray-400 mb-2 font-semibold">Enter Amount</Text>
                    <View className="flex-row items-center mb-8 border-b-2 border-gray-700 pb-2">
                        <Text className="text-white text-5xl mr-2 font-light">₹</Text>
                        <TextInput
                            className="text-white text-6xl font-bold min-w-[120px] text-center"
                            placeholder="0"
                            placeholderTextColor="#4b5563"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={setAmount}
                            autoFocus
                        />
                    </View>

                    <TouchableOpacity
                        className={`w-full p-4 rounded-xl items-center mt-4 ${!amount || Number(amount) <= 0 ? 'bg-gray-800' : 'bg-blue-600'}`}
                        onPress={handlePay}
                        disabled={loading || !amount || Number(amount) <= 0}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className={`text-lg font-bold ${!amount || Number(amount) <= 0 ? 'text-gray-500' : 'text-white'}`}>Proceed to Pay</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
};

export default EnterAmountScreen;
