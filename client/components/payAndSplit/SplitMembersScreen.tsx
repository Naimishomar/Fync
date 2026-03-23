import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator, StatusBar } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

const SplitMembersScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { amount, paymentTransactionId } = route.params || {};

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (searchQuery.length > 2) {
            const delayDebounceFn = setTimeout(() => searchUsers(), 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const searchUsers = async () => {
        try {
            const res = await axios.post('/user/search', { name: searchQuery });
            if (res.data.success) {
                setSearchResults(res.data.users);
            }
        } catch (error) {
            console.error("Search error", error);
        }
    };

    const toggleMember = (user: any) => {
        if (selectedMembers.find((m) => m._id === user._id)) {
            setSelectedMembers(selectedMembers.filter((m) => m._id !== user._id));
        } else {
            setSelectedMembers([...selectedMembers, user]);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleCreateSplit = async () => {
        if (!description) {
            Toast.show({ type: 'error', text1: 'Enter a description' });
            return;
        }

        if (selectedMembers.length === 0) {
            Toast.show({ type: 'error', text1: 'Select at least one member' });
            return;
        }

        const totalPeople = selectedMembers.length + 1;
        const perPersonAmount = (amount / totalPeople).toFixed(2);

        const membersList = selectedMembers.map((m) => ({
            debtor: m._id,
            amount: Number(perPersonAmount)
        }));

        setLoading(true);
        try {
            const res = await axios.post('/split/create', {
                paymentTransactionId,
                amount,
                description,
                members: membersList
            });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Split created successfully!' });
                navigation.navigate('PayAndSplitHome');
            }
        } catch (error) {
            console.error("Error creating split", error);
            Toast.show({ type: 'error', text1: 'Error creating split' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F5F7FA]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100 shadow-sm">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 p-2 bg-gray-50 rounded-full">
                    <Ionicons name="arrow-back" size={24} color="#18181b" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-zinc-900">Split with friends</Text>
            </View>

            <View className="p-4">
                <Text className="text-gray-500 mb-4 text-base font-medium">Total Amount: <Text className="text-pink-500 font-bold">₹{amount}</Text></Text>

                <TextInput
                    className="bg-white border border-gray-100 rounded-xl p-4 text-zinc-900 mb-4 shadow-sm"
                    placeholder="What was this for? (e.g. Dinner)"
                    placeholderTextColor="#9ca3af"
                    value={description}
                    onChangeText={setDescription}
                />

                <TextInput
                    className="bg-white border border-gray-100 rounded-xl p-4 text-zinc-900 mb-4 shadow-sm"
                    placeholder="Search users to split with..."
                    placeholderTextColor="#9ca3af"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                {searchResults.length > 0 && (
                    <View className="bg-white rounded-xl max-h-40 mb-4 p-2 border border-gray-100 shadow-lg">
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item: any) => item._id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="flex-row items-center p-3 border-b border-gray-50"
                                    onPress={() => toggleMember(item)}
                                >
                                    <Image source={{ uri: item.avatar }} className="w-10 h-10 rounded-full mr-3 border border-gray-100" />
                                    <View>
                                        <Text className="text-zinc-900 font-bold">{item.name}</Text>
                                        <Text className="text-gray-500 text-xs">@{item.username}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                <Text className="text-zinc-900 font-black italic tracking-tighter mb-4 uppercase text-xs">Selected Members ({selectedMembers.length})</Text>
                <View className="flex-row flex-wrap mb-6">
                    {selectedMembers.map((member) => (
                        <View key={member._id} className="bg-pink-50 border border-pink-100 rounded-full px-4 py-2 mr-2 mb-2 flex-row items-center shadow-sm">
                            <Text className="text-pink-600 font-bold mr-2 text-xs">{member.name}</Text>
                            <TouchableOpacity onPress={() => toggleMember(member)}>
                                <Ionicons name="close-circle" size={18} color="#ec4899" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>

            <View className="absolute bottom-10 w-full p-4">
                <TouchableOpacity
                    className={`p-4 rounded-2xl items-center shadow-lg ${selectedMembers.length > 0 && description ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    onPress={handleCreateSplit}
                    disabled={selectedMembers.length === 0 || !description || loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-lg italic tracking-tighter uppercase">Split Amount</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default SplitMembersScreen;
