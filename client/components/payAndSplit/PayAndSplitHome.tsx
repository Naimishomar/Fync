import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PayAndSplitHome'>;

const PayAndSplitHome = () => {
    const navigation = useNavigation<NavigationProp>();

    return (
        <SafeAreaView className="flex-1 bg-black">
            {/* Header */}
            <View className="flex-row items-center p-4 border-b border-gray-800">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-white">Pay & Split</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                {/* Pay via QR Code */}
                <TouchableOpacity
                    className="bg-blue-600 rounded-xl p-6 mb-4 flex-row items-center"
                    onPress={() => navigation.navigate('QRScannerScreen' as any)}
                >
                    <View className="bg-white/20 p-3 rounded-full mr-4">
                        <Ionicons name="qr-code-outline" size={32} color="white" />
                    </View>
                    <View>
                        <Text className="text-white text-lg font-bold">Pay & Split Bill</Text>
                        <Text className="text-blue-100 text-sm">Scan UPI QR to pay and split</Text>
                    </View>
                </TouchableOpacity>

                <View className="flex-row flex-wrap justify-between">
                    {/* Pending Payments */}
                    <TouchableOpacity
                        className="bg-gray-800 rounded-xl p-4 w-[48%] mb-4 items-center"
                        onPress={() => navigation.navigate('PendingPaymentsScreen' as any)}
                    >
                        <Ionicons name="wallet-outline" size={32} color="#facc15" className="mb-2" />
                        <Text className="text-white font-semibold mt-2">Pending</Text>
                        <Text className="text-gray-400 text-xs">Settle Debts</Text>
                    </TouchableOpacity>

                    {/* Groups */}
                    <TouchableOpacity
                        className="bg-gray-800 rounded-xl p-4 w-[48%] mb-4 items-center"
                        onPress={() => navigation.navigate('GroupManagementScreen' as any)}
                    >
                        <Ionicons name="people-outline" size={32} color="#34d399" className="mb-2" />
                        <Text className="text-white font-semibold mt-2">Groups</Text>
                        <Text className="text-gray-400 text-xs">Manage Squads</Text>
                    </TouchableOpacity>

                    {/* Analytics */}
                    <TouchableOpacity
                        className="bg-gray-800 rounded-xl p-4 w-[48%] mb-4 items-center"
                        onPress={() => navigation.navigate('MonthlyAnalyticsScreen' as any)}
                    >
                        <Ionicons name="bar-chart-outline" size={32} color="#a78bfa" className="mb-2" />
                        <Text className="text-white font-semibold mt-2">Activity</Text>
                        <Text className="text-gray-400 text-xs">Monthly Stats</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
};

export default PayAndSplitHome;
