import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PayAndSplitHome'>;

const PayAndSplitHome = () => {
    const navigation = useNavigation<NavigationProp>();

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            {/* Header */}
            <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shadow-sm">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-2 bg-gray-50 rounded-full">
                        <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-zinc-900 italic tracking-tighter">Pay <Text className="text-pink-500">&</Text> Split</Text>
                </View>
            </View>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                {/* Pay via QR Code - Featured Card */}
                <TouchableOpacity
                    className="bg-gray-50 rounded-3xl p-8 mb-8 shadow-xl shadow-zinc-900/20 overflow-hidden"
                    onPress={() => navigation.navigate('QRScannerScreen' as any)}
                >
                    <View className="flex-row items-center justify-between">
                        <View className="bg-white/10 p-4 rounded-2xl">
                            <Ionicons name="scan-outline" size={40} color="#ec4899" />
                        </View>
                        <Ionicons name="chevron-forward" size={24} color="#555" />
                    </View>
                    <View>
                        <Text className="text-pink-500 text-2xl font-black italic tracking-tighter">Quick Scan <Text className="text-pink-500">&</Text> Pay</Text>
                        <Text className="text-gray-400 text-sm mt-1 font-bold">Scan any UPI QR to settle bills instantly</Text>
                    </View>
                </TouchableOpacity>

                <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-4 ml-1">Tools & Management</Text>

                <View className="flex-row flex-wrap justify-between">
                    {/* Pending Payments */}
                    <TouchableOpacity
                        className="bg-white rounded-3xl p-6 w-[47%] mb-6 shadow-sm border border-gray-100 items-center"
                        onPress={() => navigation.navigate('PendingPaymentsScreen' as any)}
                    >
                        <View className="w-14 h-14 bg-yellow-50 rounded-2xl items-center justify-center mb-3">
                            <Ionicons name="wallet-outline" size={32} color="#f59e0b" />
                        </View>
                        <Text className="text-zinc-900 font-black text-base italic tracking-tight">Pending</Text>
                        <Text className="text-gray-400 text-[10px] font-bold uppercase mt-1">Settle Debts</Text>
                    </TouchableOpacity>

                    {/* Groups */}
                    <TouchableOpacity
                        className="bg-white rounded-3xl p-6 w-[47%] mb-6 shadow-sm border border-gray-100 flex-col items-center"
                        onPress={() => navigation.navigate('GroupManagementScreen' as any)}
                    >
                        <View className="w-14 h-14 bg-emerald-50 rounded-2xl items-center justify-center mb-3">
                            <Ionicons name="people-outline" size={32} color="#10b981" />
                        </View>
                        <Text className="text-zinc-900 font-black text-base italic tracking-tight">Groups</Text>
                        <Text className="text-gray-400 text-[10px] font-bold uppercase mt-1">Manage Squads</Text>
                    </TouchableOpacity>

                    {/* Analytics */}
                    <TouchableOpacity
                        className="bg-white rounded-3xl p-6 w-[100%] mb-6 shadow-sm border border-gray-100 flex-row items-center justify-between"
                        onPress={() => navigation.navigate('MonthlyAnalyticsScreen' as any)}
                    >
                        <View className="flex-row items-center">
                            <View className="w-14 h-14 bg-indigo-50 rounded-2xl items-center justify-center">
                                <Ionicons name="bar-chart-outline" size={32} color="#6366f1" />
                            </View>
                            <View className="ml-4">
                                <Text className="text-zinc-900 font-black text-lg italic tracking-tight">Spend Insights</Text>
                                <Text className="text-gray-400 text-[10px] font-bold uppercase">View Monthly Analytics</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                </View>

                {/* Info Card */}
                <View className="bg-pink-50 p-6 rounded-3xl border border-pink-100 mt-2">
                    <Text className="text-pink-600 font-bold text-xs uppercase tracking-widest mb-1">Fee-Free Payments</Text>
                    <Text className="text-pink-800 text-sm font-medium">Split any bill with your friends using BHIM UPI. No extra charges, just seamless sharing.</Text>
                </View>

                <View className="h-20" />
            </ScrollView>
        </SafeAreaView>
    );
};

export default PayAndSplitHome;
