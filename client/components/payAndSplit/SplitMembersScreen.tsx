import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator } from 'react-native';
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

        // Divide amount equally (including the payer, but backend will only add debts for others)
        const totalPeople = selectedMembers.length + 1; // 1 represents the payer
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
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-row items-center p-4">
                <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                    <Ionicons name="arrow-back" size={28} color="white" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-white">Split with friends</Text>
            </View>

            <View className="p-4">
                <Text className="text-gray-400 mb-2">Total Amount: <Text className="text-white font-bold">₹{amount}</Text></Text>

                <TextInput
                    className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white mb-4"
                    placeholder="What was this for? (e.g. Dinner)"
                    placeholderTextColor="#6b7280"
                    value={description}
                    onChangeText={setDescription}
                />

                <TextInput
                    className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-white mb-4"
                    placeholder="Search users to split with..."
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                {searchResults.length > 0 && (
                    <View className="bg-gray-800 rounded-xl max-h-40 mb-4 p-2">
                        <FlatList
                            data={searchResults}
                            keyExtractor={(item: any) => item._id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="flex-row items-center p-2 border-b border-gray-700"
                                    onPress={() => toggleMember(item)}
                                >
                                    <Image source={{ uri: item.avatar }} className="w-8 h-8 rounded-full mr-3" />
                                    <Text className="text-white">{item.name} (@{item.username})</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                <Text className="text-gray-400 font-semibold mb-2">Selected Members ({selectedMembers.length})</Text>
                <View className="flex-row flex-wrap mb-6">
                    {selectedMembers.map((member) => (
                        <View key={member._id} className="bg-blue-600/20 border border-blue-600 rounded-full px-4 py-2 mr-2 mb-2 flex-row items-center">
                            <Text className="text-blue-100 mr-2">{member.name}</Text>
                            <TouchableOpacity onPress={() => toggleMember(member)}>
                                <Ionicons name="close-circle" size={18} color="#93c5fd" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </View>

            <View className="absolute bottom-0 w-full p-4 bg-black border-t border-gray-900">
                <TouchableOpacity
                    className={`p-4 rounded-xl items-center ${selectedMembers.length > 0 && description ? 'bg-blue-600' : 'bg-gray-800'}`}
                    onPress={handleCreateSplit}
                    disabled={selectedMembers.length === 0 || !description || loading}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Split Amount</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default SplitMembersScreen;
