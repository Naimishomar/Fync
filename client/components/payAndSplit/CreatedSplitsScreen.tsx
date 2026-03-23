import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const CreatedSplitsScreen = () => {
    const navigation = useNavigation<any>();
    const [splits, setSplits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchCreatedSplits = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/split/created');
            if (res.data.success) {
                setSplits(res.data.splits);
            }
        } catch (error) {
            console.error("Error fetching created splits", error);
            Toast.show({ type: 'error', text1: 'Error fetching splits' });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchCreatedSplits();
        }, [])
    );

    const renderItem = ({ item }: { item: any }) => {
        const totalMembers = item.members.length;
        const paidMembers = item.members.filter((m: any) => m.status === 'paid').length;

        return (
            <View className="bg-white p-5 rounded-2xl mb-4 border border-gray-100 shadow-sm shadow-black/5">
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-1">
                        <Text className="text-zinc-900 font-bold text-[16px]">{item.description}</Text>
                        <Text className="text-gray-500 text-xs mt-1">Total Bill: <Text className="text-zinc-900 font-bold">₹{item.amount}</Text></Text>
                        {item.group && (
                             <View className="bg-emerald-50 self-start px-2 py-0.5 rounded-full mt-2 border border-emerald-100">
                                 <Text className="text-emerald-600 text-[9px] font-black uppercase tracking-widest">Group: {item.group.title}</Text>
                             </View>
                        )}
                    </View>
                    <View className="items-end">
                        <View className="bg-pink-50 px-3 py-1.5 rounded-full border border-pink-100">
                            <Text className="text-pink-600 text-[10px] font-black uppercase tracking-tighter">{paidMembers} / {totalMembers} PAID</Text>
                        </View>
                    </View>
                </View>

                {/* List of Members */}
                <View className="mt-2 pt-4 border-t border-gray-50">
                    <Text className="text-gray-400 text-[9px] font-black uppercase tracking-widest mb-3">Split Details</Text>
                    {item.members.map((member: any) => (
                        <View key={member._id} className="flex-row justify-between items-center mb-3">
                            <View className="flex-row items-center">
                                <View className="w-1.5 h-1.5 rounded-full bg-gray-200 mr-2" />
                                <Text className="text-zinc-600 text-sm font-medium">{member.debtor.name}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Text className="text-zinc-900 font-bold text-xs mr-3">₹{member.amount}</Text>
                                {member.status === 'paid' ? (
                                    <View className="bg-emerald-100 px-2 py-0.5 rounded-md">
                                        <Text className="text-emerald-700 text-[9px] font-black uppercase">PAID</Text>
                                    </View>
                                ) : (
                                    <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                                        <Text className="text-amber-700 text-[9px] font-black uppercase">PENDING</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100 shadow-sm">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-gray-50 rounded-full">
                    <Ionicons name="arrow-back" size={24} color="#18181b" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-zinc-900 font-black italic tracking-tighter">Created <Text className="text-pink-500">Splits</Text></Text>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
                ) : splits.length === 0 ? (
                    <View className="flex-1 justify-center items-center px-10">
                        <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-6 shadow-sm border border-gray-100">
                            <Ionicons name="receipt-outline" size={36} color="#9ca3af" />
                        </View>
                        <Text className="text-zinc-900 text-xl font-black italic tracking-tighter">No splits yet!</Text>
                        <Text className="text-gray-500 text-sm mt-2 text-center font-medium">Any bills you split with others will appear here. Start splitting!</Text>
                    </View>
                ) : (
                    <FlatList
                        data={splits}
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

export default CreatedSplitsScreen;
