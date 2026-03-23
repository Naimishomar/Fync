import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, TextInput, StatusBar } from 'react-native';
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
                members: []
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
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-100 shadow-sm">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-gray-50 rounded-full">
                        <Ionicons name="arrow-back" size={24} color="#18181b" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-zinc-900 font-black italic tracking-tighter">My <Text className="text-pink-500">Groups</Text></Text>
                </View>
                <TouchableOpacity onPress={() => setIsCreating(!isCreating)} className={`p-2 rounded-full ${isCreating ? 'bg-red-50' : 'bg-pink-50'} border border-gray-100`}>
                    <Ionicons name={isCreating ? "close" : "add"} size={24} color={isCreating ? "#ef4444" : "#ec4899"} />
                </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View className="flex-row bg-white px-2 py-1 mx-4 mt-4 rounded-2xl border border-gray-100 shadow-sm shadow-black/5">
                <TouchableOpacity
                    className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'splits' ? 'bg-pink-500 shadow-sm shadow-pink-500/20' : ''}`}
                    onPress={() => setActiveTab('splits')}
                >
                    <Text className={`font-black italic tracking-tighter uppercase text-xs ${activeTab === 'splits' ? 'text-white' : 'text-gray-400'}`}>My Splits</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className={`flex-1 py-3 items-center rounded-xl ${activeTab === 'groups' ? 'bg-pink-500 shadow-sm shadow-pink-500/20' : ''}`}
                    onPress={() => setActiveTab('groups')}
                >
                    <Text className={`font-black italic tracking-tighter uppercase text-xs ${activeTab === 'groups' ? 'text-white' : 'text-gray-400'}`}>Squads</Text>
                </TouchableOpacity>
            </View>

            <View className="flex-1 p-4">
                {isCreating && (
                    <View className="bg-white p-5 rounded-2xl border border-gray-100 mb-6 shadow-xl">
                        <Text className="text-zinc-900 font-black uppercase tracking-widest text-[10px] mb-4 italic">Create New Group</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-zinc-900 mb-4 font-bold"
                            placeholder="Group Title (e.g. Goa Trip)"
                            placeholderTextColor="#9ca3af"
                            value={newGroupTitle}
                            onChangeText={setNewGroupTitle}
                        />
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-zinc-900 mb-6 font-medium"
                            placeholder="Description"
                            placeholderTextColor="#9ca3af"
                            value={newGroupDesc}
                            onChangeText={setNewGroupDesc}
                            multiline
                        />
                        <TouchableOpacity
                            className="bg-indigo-600 py-4 rounded-xl items-center shadow-lg shadow-indigo-600/30"
                            onPress={handleCreateGroup}
                        >
                            <Text className="text-white font-black italic tracking-tighter uppercase">Create Group</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
                ) : activeTab === 'splits' ? (
                    createdSplits.length === 0 ? (
                        <View className="flex-1 justify-center items-center px-10">
                            <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-6 shadow-sm border border-gray-100">
                                <Ionicons name="documents-outline" size={40} color="#cbd5e1" />
                            </View>
                            <Text className="text-zinc-900 text-xl font-black italic tracking-tighter">No splits yet</Text>
                            <Text className="text-gray-500 text-sm mt-2 text-center font-medium">You haven't split any payments yet. Start by splitting a bill!</Text>
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
                                    <View className="bg-white p-5 rounded-2xl mb-4 border border-gray-100 shadow-sm">
                                        <View className="flex-row justify-between items-start mb-4">
                                            <View>
                                                <Text className="text-zinc-900 font-bold text-[16px]">{item.description}</Text>
                                                <Text className="text-gray-500 text-xs mt-1">Amount Requested: <Text className="text-pink-600 font-black">₹{item.amount}</Text></Text>
                                            </View>
                                            <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                <Text className="text-emerald-700 text-[10px] font-black uppercase tracking-widest">{paidMembers} / {totalMembers} PAID</Text>
                                            </View>
                                        </View>

                                        <View className="mt-2 pt-4 border-t border-gray-50">
                                            <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3">Participation:</Text>
                                            {item.members.map((member: any) => (
                                                <View key={member._id} className="flex-row justify-between items-center mb-3">
                                                    <View className="flex-row items-center">
                                                        <View className={`w-2 h-2 rounded-full mr-2 ${member.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                        <Text className="text-zinc-900 text-sm font-medium">{member.debtor.name || member.debtor.username}</Text>
                                                    </View>
                                                    {member.status === 'paid' ? (
                                                        <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                                                            <Text className="text-emerald-600 text-[10px] font-bold">PAID</Text>
                                                        </View>
                                                    ) : (
                                                        <View className="flex-row items-center">
                                                            <TouchableOpacity
                                                                className="mr-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full flex-row items-center"
                                                                onPress={() => handleRemindMember(member._id)}
                                                            >
                                                                <Ionicons name="notifications" size={10} color="#4f46e5" className="mr-1" />
                                                                <Text className="text-indigo-600 text-[10px] font-black uppercase tracking-tighter">Remind</Text>
                                                            </TouchableOpacity>
                                                            <View className="bg-amber-50 px-2 py-0.5 rounded-full">
                                                                <Text className="text-amber-600 text-[10px] font-bold">PENDING</Text>
                                                            </View>
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
                    <View className="flex-1 justify-center items-center px-10">
                         <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-6 shadow-sm border border-gray-100">
                            <Ionicons name="people-outline" size={40} color="#cbd5e1" />
                        </View>
                        <Text className="text-zinc-900 text-xl font-black italic tracking-tighter">No squads yet</Text>
                        <Text className="text-gray-500 text-sm mt-2 text-center font-medium">Create a group to easily split bills with your regular crew!</Text>
                    </View>
                ) : (
                    <FlatList
                        data={groups}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity className="bg-white p-5 rounded-2xl mb-4 border border-gray-100 shadow-sm">
                                <View className="flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-zinc-900 font-bold text-lg">{item.title}</Text>
                                        {item.description && <Text className="text-gray-500 text-sm mt-1">{item.description}</Text>}
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                                </View>
                                <View className="mt-4 pt-4 border-t border-gray-50 flex-row items-center">
                                    <View className="bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                                        <Text className="text-pink-600 text-[10px] font-black uppercase tracking-widest">{item.members?.length || 0} MEMBERS</Text>
                                    </View>
                                </View>
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
