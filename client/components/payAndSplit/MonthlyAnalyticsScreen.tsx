import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const MonthlyAnalyticsScreen = () => {
    const navigation = useNavigation<any>();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/split/stats');
            if (res.data.success) {
                setStats(res.data.stats);
            }
        } catch (error) {
            console.error("Error fetching stats", error);
            Toast.show({ type: 'error', text1: 'Error fetching stats' });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchStats();
        }, [])
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100 shadow-sm">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-gray-50 rounded-full">
                    <Ionicons name="arrow-back" size={24} color="#18181b" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-zinc-900 font-black italic tracking-tighter">Monthly <Text className="text-pink-500">Analytics</Text></Text>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
                ) : (
                    <View>
                        <View className="bg-white p-8 rounded-3xl border border-gray-100 items-center justify-center mb-6 shadow-xl">
                            <View className="bg-pink-50 px-4 py-1.5 rounded-full mb-4 border border-pink-100">
                                <Text className="text-pink-600 font-black uppercase tracking-widest text-[10px]">Month: {stats?.month || 'Current'}</Text>
                            </View>
                            
                            <Text className="text-zinc-400 text-sm font-medium mb-1">Financial Performance</Text>
                            <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter mb-8 italic">OVERVIEW</Text>

                            <View className="w-full flex-row justify-between items-center mb-5 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <View className="flex-row items-center">
                                    <View className="p-2 bg-indigo-50 rounded-full mr-3">
                                        <Ionicons name="wallet-outline" size={18} color="#4f46e5" />
                                    </View>
                                    <Text className="text-zinc-600 font-bold">Total Spent</Text>
                                </View>
                                <Text className="text-zinc-900 font-black text-lg italic tracking-tighter">₹{stats?.totalPaid || 0}</Text>
                            </View>

                            <View className="w-full flex-row justify-between items-center mb-5 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                                <View className="flex-row items-center">
                                    <View className="p-2 bg-emerald-100 rounded-full mr-3">
                                        <Ionicons name="arrow-down-outline" size={18} color="#059669" />
                                    </View>
                                    <Text className="text-zinc-600 font-bold">Total Received</Text>
                                </View>
                                <Text className="text-emerald-600 font-black text-lg italic tracking-tighter">₹{(stats?.totalReceived || 0).toFixed(2)}</Text>
                            </View>

                            <View className="w-full flex-row justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <View className="flex-row items-center">
                                    <View className="p-2 bg-pink-50 rounded-full mr-3">
                                        <Ionicons name="swap-horizontal-outline" size={18} color="#ec4899" />
                                    </View>
                                    <Text className="text-zinc-600 font-bold">Net Owed</Text>
                                </View>
                                <Text className={`${stats?.totalOwed < 0 ? 'text-emerald-600' : stats?.totalOwed > 0 ? 'text-rose-600' : 'text-gray-400'} font-black text-lg italic tracking-tighter`}>
                                    {stats?.totalOwed < 0 ? '+' : ''}{-(stats?.totalOwed || 0).toFixed(2)}
                                </Text>
                            </View>

                            <View className="mt-6 px-4 py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <Text className="text-gray-400 text-[10px] text-center font-bold italic">
                                    Positive (+) means people owe you{"\n"}Negative (-) means you owe people
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

export default MonthlyAnalyticsScreen;
