import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
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
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-row items-center p-4 border-b border-gray-800">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-white">Monthly Analytics</Text>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <ActivityIndicator size="large" color="#3b82f6" />
                ) : (
                    <View>
                        <View className="bg-gray-800 p-6 rounded-2xl border border-gray-700 items-center justify-center mb-6">
                            <Text className="text-gray-400 mb-2">Month: {stats?.month || 'Current'}</Text>
                            <Text className="text-white text-3xl font-bold mb-4">Financial Overview</Text>

                            <View className="w-full flex-row justify-between mb-4 border-b border-gray-700 pb-4">
                                <Text className="text-gray-300">Total Spent / Paid</Text>
                                <Text className="text-white font-bold text-lg">₹{stats?.totalPaid || 0}</Text>
                            </View>

                            <View className="w-full flex-row justify-between mb-4 border-b border-gray-700 pb-4">
                                <Text className="text-gray-300">Total Received</Text>
                                <Text className="text-green-400 font-bold text-lg">₹{(stats?.totalReceived || 0).toFixed(2)}</Text>
                            </View>

                            <View className="w-full flex-row justify-between">
                                <Text className="text-gray-300">Net Owed (To You / By You)</Text>
                                <Text className={`${stats?.totalOwed < 0 ? 'text-green-400' : stats?.totalOwed > 0 ? 'text-red-400' : 'text-gray-400'} font-bold text-lg`}>
                                    {stats?.totalOwed < 0 ? '+' : ''}{-(stats?.totalOwed || 0).toFixed(2)}
                                </Text>
                            </View>
                            <Text className="text-gray-500 text-xs text-center mt-2">(Positive means people owe you, Negative means you owe people)</Text>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
};

export default MonthlyAnalyticsScreen;
