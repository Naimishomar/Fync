import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, Linking, StatusBar } from 'react-native';
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
        <View className="bg-white p-5 rounded-2xl mb-4 border border-gray-100 shadow-sm">
            <View className="flex-row justify-between items-start mb-4">
                <View>
                    <Text className="text-zinc-900 font-bold text-[16px]">{item.split.description}</Text>
                    <Text className="text-gray-500 text-xs mt-1">Owed to: <Text className="font-bold text-zinc-900">{item.split.payer.name}</Text></Text>
                    {item.split.group && (
                        <View className="bg-emerald-50 self-start px-2 py-0.5 rounded-full mt-2 border border-emerald-100">
                             <Text className="text-emerald-600 text-[9px] font-black uppercase tracking-widest">Group: {item.split.group.title}</Text>
                        </View>
                    )}
                </View>
                <Text className="text-pink-600 font-black text-xl italic tracking-tighter">₹{item.amount}</Text>
            </View>
            <View className="flex-row gap-3">
                <TouchableOpacity
                    className="flex-1 bg-indigo-600 py-3.5 justify-center items-center rounded-xl shadow-lg shadow-indigo-600/20"
                    onPress={() => handlePayNow(item)}
                >
                    <Text className="text-white font-black italic tracking-tighter uppercase text-xs">Pay Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 bg-white border border-gray-100 py-3.5 justify-center items-center rounded-xl"
                    onPress={() => markAsPaid(item)}
                >
                    <Text className="text-gray-500 font-black italic tracking-tighter uppercase text-xs">Already Paid</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100 shadow-sm">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-gray-50 rounded-full">
                    <Ionicons name="arrow-back" size={24} color="#18181b" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-zinc-900 font-black italic tracking-tighter">Pending <Text className="text-pink-500">Payments</Text></Text>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
                ) : pendingDebts.length === 0 ? (
                    <View className="flex-1 justify-center items-center px-10">
                        <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-6 shadow-sm border border-gray-100">
                            <Ionicons name="checkmark-circle-outline" size={40} color="#10b981" />
                        </View>
                        <Text className="text-zinc-900 text-xl font-black italic tracking-tighter">All caught up!</Text>
                        <Text className="text-gray-500 text-sm mt-2 text-center font-medium">No pending debts to settle. You're doing great!</Text>
                    </View>
                ) : (
                    <FlatList
                        data={pendingDebts}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default PendingPaymentsScreen;
