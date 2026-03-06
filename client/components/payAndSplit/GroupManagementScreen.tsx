import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const GroupManagementScreen = () => {
    const navigation = useNavigation<any>();
    const [groups, setGroups] = useState<any[]>([]);
    const [createdSplits, setCreatedSplits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'groups' | 'splits'>('splits');
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupTitle, setNewGroupTitle] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [groupsRes, splitsRes] = await Promise.all([
                axios.get('/split/groups'),
                axios.get('/split/created')
            ]);

            if (groupsRes.data.success) {
                setGroups(groupsRes.data.groups);
            }
            if (splitsRes.data.success) {
                setCreatedSplits(splitsRes.data.splits);
            }
        } catch (error) {
            console.error("Error fetching data", error);
            Toast.show({ type: 'error', text1: 'Error fetching groups data' });
        } finally {
            setLoading(false);
        }
    };

    const handleRemindMember = async (memberId: string) => {
        try {
            const res = await axios.post(`/split/remind/${memberId}`);
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Reminder Sent!' });
            }
        } catch (error) {
            console.error("Error sending reminder", error);
            Toast.show({ type: 'error', text1: 'Failed to send reminder' });
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const handleCreateGroup = async () => {
        if (!newGroupTitle) return Toast.show({ type: 'error', text1: 'Enter group title' });

        try {
            const res = await axios.post('/split/groups', {
                title: newGroupTitle,
                description: newGroupDesc,
                members: [] // A complete feature would have user selection here similar to split members
            });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Group Created' });
                setIsCreating(false);
                fetchData();
            }
        } catch (error) {
            console.error("Error creating group", error);
            Toast.show({ type: 'error', text1: 'Failed to create group' });
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                        <Ionicons name="arrow-back" size={28} color="white" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-white">My Groups</Text>
                </View>
                <TouchableOpacity onPress={() => setIsCreating(!isCreating)}>
                    <Ionicons name={isCreating ? "close" : "add"} size={28} color="#3b82f6" />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="flex-row border-b border-gray-800">
                <TouchableOpacity
                    className={`flex-1 py-4 items-center ${activeTab === 'splits' ? 'border-b-2 border-blue-500' : ''}`}
                    onPress={() => setActiveTab('splits')}
                >
                    <Text className={`font-bold ${activeTab === 'splits' ? 'text-blue-500' : 'text-gray-400'}`}>My Splits</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className={`flex-1 py-4 items-center ${activeTab === 'groups' ? 'border-b-2 border-blue-500' : ''}`}
                    onPress={() => setActiveTab('groups')}
                >
                    <Text className={`font-bold ${activeTab === 'groups' ? 'text-blue-500' : 'text-gray-400'}`}>Squads</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-1 p-4">
                {isCreating && (
                    <View className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6">
                        <Text className="text-white font-bold mb-2">Create New Group</Text>
                        <TextInput
                            className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white mb-3"
                            placeholder="Group Title (e.g. Goa Trip)"
                            placeholderTextColor="#6b7280"
                            value={newGroupTitle}
                            onChangeText={setNewGroupTitle}
                        />
                        <TextInput
                            className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white mb-3"
                            placeholder="Description"
                            placeholderTextColor="#6b7280"
                            value={newGroupDesc}
                            onChangeText={setNewGroupDesc}
                        />
                        <TouchableOpacity
                            className="bg-blue-600 p-3 rounded-lg items-center"
                            onPress={handleCreateGroup}
                        >
                            <Text className="text-white font-bold">Create</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator size="large" color="#3b82f6" />
                ) : activeTab === 'splits' ? (
                    createdSplits.length === 0 ? (
                        <View className="flex-1 justify-center items-center">
                            <Ionicons name="documents-outline" size={64} color="#6b7280" className="mb-4" />
                            <Text className="text-gray-400 text-lg">No splits created.</Text>
                            <Text className="text-gray-500 text-sm mt-1">You haven't split any payments yet.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={createdSplits}
                            keyExtractor={(item) => item._id}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => {
                                const totalMembers = item.members.length;
                                const paidMembers = item.members.filter((m: any) => m.status === 'paid').length;

                                return (
                                    <View className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700">
                                        <View className="flex-row justify-between items-start mb-3">
                                            <View>
                                                <Text className="text-white font-bold text-lg">{item.description}</Text>
                                                <Text className="text-gray-400 text-sm">Amount Requested: <Text className="text-blue-400 font-bold">₹{item.amount}</Text></Text>
                                            </View>
                                            <View className="items-end bg-black/40 px-2 py-1 rounded">
                                                <Text className="text-white text-xs font-semibold">{paidMembers} / {totalMembers} users paid</Text>
                                            </View>
                                        </View>

                                        {/* List of Members inside this group/split */}
                                        <View className="mt-2 pt-2 border-t border-gray-700">
                                            <Text className="text-gray-400 text-xs font-semibold mb-2 uppercase">Members:</Text>
                                            {item.members.map((member: any) => (
                                                <View key={member._id} className="flex-row justify-between items-center mb-2">
                                                    <View className="flex-row items-center">
                                                        <View className={`w-2 h-2 rounded-full mr-2 ${member.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                        <Text className="text-white text-sm">{member.debtor.name || member.debtor.username}</Text>
                                                    </View>
                                                    {member.status === 'paid' ? (
                                                        <Text className="text-green-400 text-xs font-bold px-2 py-0.5 border border-green-400/30 rounded">Paid</Text>
                                                    ) : (
                                                        <View className="flex-row items-center">
                                                            <TouchableOpacity
                                                                className="mr-2 px-3 py-1 bg-blue-600/20 border border-blue-500/50 rounded flex-row items-center"
                                                                onPress={() => handleRemindMember(member._id)}
                                                            >
                                                                <Ionicons name="notifications" size={12} color="#60a5fa" className="mr-1" />
                                                                <Text className="text-blue-400 text-xs font-bold">Notify</Text>
                                                            </TouchableOpacity>
                                                            <Text className="text-yellow-400 text-xs font-bold px-2 py-0.5 border border-yellow-400/30 rounded">Pending</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                );
                            }}
                        />
                    )
                ) : groups.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="people-outline" size={64} color="#6b7280" className="mb-4" />
                        <Text className="text-gray-400 text-lg">No squads yet.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={groups}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity className="bg-gray-800 p-4 rounded-xl mb-4 border border-gray-700">
                                <Text className="text-white font-bold text-lg">{item.title}</Text>
                                {item.description && <Text className="text-gray-400 text-sm mt-1">{item.description}</Text>}
                                <Text className="text-gray-500 text-xs mt-3">{item.members?.length || 0} members</Text>
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default GroupManagementScreen;
