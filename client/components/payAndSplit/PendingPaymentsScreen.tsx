import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const PendingPaymentsScreen = () => {
    const navigation = useNavigation<any>();
    const [pendingDebts, setPendingDebts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPendingDebts = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/split/pending');
            if (res.data.success) {
                setPendingDebts(res.data.pendingDebts);
            }
        } catch (error) {
            console.error("Error fetching pending debts", error);
            Toast.show({ type: 'error', text1: 'Error fetching pending debts' });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchPendingDebts();
        }, [])
    );

    const handlePayNow = async (item: any) => {
        const payerUpi = item.split.payer.upiId;
        if (!payerUpi) {
            Alert.alert("Missing UPI ID", `${item.split.payer.name} hasn't mapped their UPI ID yet. Remind them to add it!`);
            return;
        }

        const simulatedUPIUrl = `upi://pay?pa=${payerUpi}&pn=${item.split.payer.name}&am=${item.amount}&cu=INR`;

        try {
            const canOpen = await Linking.canOpenURL(simulatedUPIUrl);
            if (canOpen) {
                await Linking.openURL(simulatedUPIUrl);
            } else {
                Alert.alert("Simulating UPI App", `You paid ₹${item.amount} to ${item.split.payer.name}. Now marking it as Paid.`);
            }

            // Immediately mark it as paid or show a button "Already Paid"
            Alert.alert(
                "Payment Confirmation",
                "Did you complete the payment?",
                [
                    { text: "No", style: "cancel" },
                    { text: "Yes, Already Paid", onPress: () => markAsPaid(item) }
                ]
            );
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not open UPI app' });
        }
    };

    const markAsPaid = async (item: any) => {
        try {
            const res = await axios.post(`/split/mark-paid/${item._id}`, {
                paymentReference: `DEMO_REF_${Math.floor(Math.random() * 10000)}`
            });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Payment recorded!' });
                setPendingDebts(pendingDebts.filter(d => d._id !== item._id));
            }
        } catch (error) {
            console.error("Error marking as paid", error);
            Toast.show({ type: 'error', text1: 'Error recording payment' });
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700">
            <View className="flex-row justify-between items-start mb-3">
                <View>
                    <Text className="text-white font-bold text-lg">{item.split.description}</Text>
                    <Text className="text-gray-400 text-sm">Owed to: {item.split.payer.name}</Text>
                    {item.split.group && <Text className="text-green-400 text-xs mt-1">Group: {item.split.group.title}</Text>}
                </View>
                <Text className="text-red-400 font-bold text-xl">₹{item.amount}</Text>
            </View>
            <View className="flex-row gap-2">
                <TouchableOpacity
                    className="flex-1 bg-blue-600 p-3 justify-center items-center rounded-lg"
                    onPress={() => handlePayNow(item)}
                >
                    <Text className="text-white font-bold">Pay Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 border border-blue-600 p-3 justify-center items-center rounded-lg"
                    onPress={() => markAsPaid(item)}
                >
                    <Text className="text-blue-500 font-bold">Already Paid</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-row items-center p-4 border-b border-gray-800">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-white">Pending Payments</Text>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <ActivityIndicator size="large" color="#3b82f6" />
                ) : pendingDebts.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="checkmark-circle-outline" size={64} color="#34d399" className="mb-4" />
                        <Text className="text-gray-400 text-lg">You are all caught up!</Text>
                        <Text className="text-gray-500 text-sm">No pending debts to settle.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={pendingDebts}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default PendingPaymentsScreen;
