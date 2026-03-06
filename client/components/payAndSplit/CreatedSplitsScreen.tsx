import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
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
            <View className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700">
                <View className="flex-row justify-between items-start mb-3">
                    <View>
                        <Text className="text-white font-bold text-lg">{item.description}</Text>
                        <Text className="text-gray-400 text-sm">Amount Required: <Text className="text-red-400 font-bold">₹{item.amount}</Text></Text>
                        {item.group && <Text className="text-green-400 text-xs mt-1">Group: {item.group.title}</Text>}
                    </View>
                    <View className="items-end">
                        <Text className="text-white text-sm font-semibold">{paidMembers} / {totalMembers} users paid</Text>
                    </View>
                </View>

                {/* List of Members */}
                <View className="mt-2 pt-2 border-t border-gray-700">
                    <Text className="text-gray-400 text-xs font-semibold mb-2 uppercase">Members:</Text>
                    {item.members.map((member: any) => (
                        <View key={member._id} className="flex-row justify-between items-center mb-2">
                            <Text className="text-white text-sm">{member.debtor.name}</Text>
                            {member.status === 'paid' ? (
                                <Text className="text-green-400 text-xs font-bold bg-green-900/40 px-2 py-0.5 rounded">Paid</Text>
                            ) : (
                                <Text className="text-yellow-400 text-xs font-bold bg-yellow-900/40 px-2 py-0.5 rounded">Pending</Text>
                            )}
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-row items-center p-4 border-b border-gray-800">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-white">My Split Groups</Text>
            </View>

            <View className="flex-1 p-4">
                {loading ? (
                    <ActivityIndicator size="large" color="#3b82f6" />
                ) : splits.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="documents-outline" size={64} color="#6b7280" className="mb-4" />
                        <Text className="text-gray-400 text-lg">No splits created.</Text>
                        <Text className="text-gray-500 text-sm">You haven't split any payments yet.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={splits}
                        keyExtractor={(item) => item._id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default CreatedSplitsScreen;
