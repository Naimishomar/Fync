import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Modal, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig'; // assuming axios is imported from context
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/auth.context';

interface SplitPaymentModalProps {
    visible: boolean;
    onClose: () => void;
    totalAmount: number;
    paymentTransactionId: string;
    onSuccess: () => void;
}

const SplitPaymentModal: React.FC<SplitPaymentModalProps> = ({ visible, onClose, totalAmount, paymentTransactionId, onSuccess }) => {
    const { user } = useAuth();
    const [numPeople, setNumPeople] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [loading, setLoading] = useState(false);
    const [description, setDescription] = useState('Shared Expense');

    const [upiIdInput, setUpiIdInput] = useState('');
    const [savingUpi, setSavingUpi] = useState(false);

    // Maintain a local state to immediately clear the prompt upon saving
    const [localUpiSaved, setLocalUpiSaved] = useState(false);

    const hasUpi = !!user?.upiId || localUpiSaved;

    useEffect(() => {
        if (searchQuery.length > 1) {
            setSearching(true);
            const delayDebounceFn = setTimeout(() => {
                searchUsers(searchQuery);
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        } else {
            setSearchResults([]);
            setSearching(false);
        }
    }, [searchQuery]);

    const handleSaveUpi = async () => {
        if (!upiIdInput.includes('@')) {
            Toast.show({ type: 'error', text1: 'Enter a valid UPI ID (e.g. name@upi)' });
            return;
        }
        setSavingUpi(true);
        try {
            const formData = new FormData();
            formData.append('upiId', upiIdInput);
            const res = await axios.post('/user/update', formData as any, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                if (user) {
                    user.upiId = upiIdInput;
                }
                setLocalUpiSaved(true);
                Toast.show({ type: 'success', text1: 'UPI ID Saved!' });
            }
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Failed to save UPI ID' });
        } finally {
            setSavingUpi(false);
        }
    };

    const searchUsers = async (query: string) => {
        try {
            const res = await axios.post('/user/search', { name: query });
            if (res.data.success) {
                // Filter out already selected users
                const filtered = res.data.users.filter((u: any) => !selectedUsers.find(su => su._id === u._id));
                setSearchResults(filtered);
            }
        } catch (error) {
            console.error("Search error", error);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectUser = (user: any) => {
        const requiredPeople = parseInt(numPeople) || 0;
        if (selectedUsers.length >= requiredPeople) {
            Toast.show({ type: 'info', text1: `You only selected ${requiredPeople} people to split with.` });
            return;
        }
        setSelectedUsers([...selectedUsers, user]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveUser = (userId: string) => {
        setSelectedUsers(selectedUsers.filter(u => u._id !== userId));
    };

    const handleCreateSplit = async () => {
        const requiredPeople = parseInt(numPeople) || 0;
        if (selectedUsers.length === 0 || selectedUsers.length !== requiredPeople) {
            Toast.show({ type: 'error', text1: `Please select exactly ${requiredPeople} users.` });
            return;
        }

        if (!description.trim()) {
            Toast.show({ type: 'error', text1: 'Enter a valid description.' });
            return;
        }

        // Divide amount equally (including the payer, but backend only adds debts for the selected users)
        const totalPeople = selectedUsers.length + 1; // 1 represents the payer
        const perPersonAmount = (totalAmount / totalPeople).toFixed(2);

        const membersList = selectedUsers.map((m) => ({
            debtor: m._id,
            amount: Number(perPersonAmount)
        }));

        setLoading(true);
        try {
            const res = await axios.post('/split/create', {
                paymentTransactionId,
                amount: totalAmount,
                description,
                members: membersList
            });
            if (res.data.success) {
                Toast.show({ type: 'success', text1: 'Split group created successfully!' });
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error("Error creating split group", error);
            Toast.show({ type: 'error', text1: 'Error creating split group' });
        } finally {
            setLoading(false);
        }
    };

    // Calculate split calculation text
    const totalPeople = selectedUsers.length + 1;
    const splitAmount = (totalAmount / totalPeople).toFixed(2);
    const requiredPeople = parseInt(numPeople) || 0;

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 justify-end bg-black/80"
            >
                <View className="bg-gray-900 border-t border-gray-800 rounded-t-3xl p-6 shadow-xl h-[85%]">
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-xl font-bold text-white">Split with Friends</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close-circle" size={32} color="#4b5563" />
                        </TouchableOpacity>
                    </View>

                    {!hasUpi ? (
                        <View className="flex-1 justify-center items-center pb-10">
                            <Ionicons name="wallet-outline" size={64} color="#60a5fa" className="mb-4" />
                            <Text className="text-white text-xl font-bold mb-2">Set Up Your UPI ID</Text>
                            <Text className="text-gray-400 text-center mb-6">Please enter your UPI ID so others can pay you.</Text>

                            <TextInput
                                className="w-full bg-black border border-gray-800 rounded-xl p-4 text-white font-semibold mb-6 shadow-sm text-center"
                                placeholder="e.g. yourname@upi"
                                placeholderTextColor="#6b7280"
                                value={upiIdInput}
                                onChangeText={setUpiIdInput}
                                autoCapitalize="none"
                            />

                            <TouchableOpacity
                                className="bg-blue-600 w-full p-4 rounded-xl items-center flex-row justify-center"
                                disabled={savingUpi || !upiIdInput}
                                onPress={handleSaveUpi}
                            >
                                {savingUpi ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save & Continue</Text>}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                {/* Split Amount Info */}
                                <View className="bg-blue-600/20 border border-blue-600/50 p-4 rounded-xl items-center mb-6">
                                    <Text className="text-blue-200">Total Amount</Text>
                                    <Text className="text-blue-500 font-bold text-3xl mt-1">₹{totalAmount}</Text>
                                </View>

                                <Text className="text-gray-400 font-semibold mb-2">Description / Group Name</Text>
                                <TextInput
                                    className="bg-black border border-gray-800 rounded-xl p-4 text-white font-semibold mb-6 shadow-sm"
                                    placeholder="e.g. Dinner, Movie, Cab..."
                                    placeholderTextColor="#6b7280"
                                    value={description}
                                    onChangeText={setDescription}
                                />

                                {/* Input Number of People */}
                                <Text className="text-gray-400 font-semibold mb-2">How many people do you want to split this with?</Text>
                                <TextInput
                                    className="bg-black border border-gray-800 rounded-xl p-4 text-white font-semibold mb-6 shadow-sm"
                                    placeholder="Enter a number (e.g. 3)"
                                    placeholderTextColor="#6b7280"
                                    keyboardType="numeric"
                                    value={numPeople}
                                    onChangeText={setNumPeople}
                                />

                                {/* Search User Fields (Only show if a valid number is entered) */}
                                {requiredPeople > 0 && (
                                    <View className="mb-6">
                                        <Text className="text-gray-400 font-semibold mb-2">Select {requiredPeople} people</Text>

                                        {/* Selected Users Chips */}
                                        <View className="flex-row flex-wrap mb-3">
                                            {selectedUsers.map((u, index) => (
                                                <View key={u._id} className="bg-gray-800 border border-gray-700 flex-row items-center px-3 py-1.5 rounded-full mr-2 mb-2">
                                                    <Image source={{ uri: u.avatar || `https://ui-avatars.com/api/?name=${u.username}` }} className="w-6 h-6 rounded-full mr-2" />
                                                    <Text className="text-white text-sm mr-2">{u.username}</Text>
                                                    <TouchableOpacity onPress={() => handleRemoveUser(u._id)}>
                                                        <Ionicons name="close-circle" size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>

                                        {/* Input for Search */}
                                        {selectedUsers.length < requiredPeople && (
                                            <View>
                                                <View className="flex-row items-center bg-black border border-gray-800 rounded-xl px-4 py-3">
                                                    <Ionicons name="search" size={20} color="#6b7280" className="mr-2" />
                                                    <TextInput
                                                        className="flex-1 text-white font-semibold ml-2"
                                                        placeholder={`Search user ${selectedUsers.length + 1}...`}
                                                        placeholderTextColor="#6b7280"
                                                        value={searchQuery}
                                                        onChangeText={setSearchQuery}
                                                    />
                                                    {searching && <ActivityIndicator size="small" color="#3b82f6" />}
                                                </View>

                                                {/* Auto-suggest dropdown */}
                                                {searchResults.length > 0 && (
                                                    <View className="bg-gray-800 mt-2 rounded-xl max-h-48 border border-gray-700 overflow-hidden">
                                                        <FlatList
                                                            data={searchResults}
                                                            keyExtractor={(item: any) => item._id}
                                                            keyboardShouldPersistTaps="handled"
                                                            renderItem={({ item }) => (
                                                                <TouchableOpacity
                                                                    className="flex-row items-center p-3 border-b border-gray-700 last:border-0"
                                                                    onPress={() => handleSelectUser(item)}
                                                                >
                                                                    <Image source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}` }} className="w-10 h-10 rounded-full mr-3" />
                                                                    <View>
                                                                        <Text className="text-white font-bold">{item.name}</Text>
                                                                        <Text className="text-gray-400 text-xs">@{item.username}</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            )}
                                                        />
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Split Summary */}
                                {requiredPeople > 0 && selectedUsers.length === requiredPeople && (
                                    <View className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6 items-center">
                                        <Text className="text-gray-300 font-bold mb-1">Split Summary</Text>
                                        <Text className="text-gray-400 text-sm mb-2 text-center">
                                            Total ₹{totalAmount} split equally among {totalPeople} people (You + {requiredPeople} friends)
                                        </Text>
                                        <Text className="text-green-400 text-xl font-bold">Each Pays: ₹{splitAmount}</Text>
                                    </View>
                                )}

                                {/* Spacing for bottom button */}
                                <View className="h-20" />
                            </ScrollView>

                            {/* Bottom Action Button */}
                            <View className="absolute bottom-6 left-6 right-6">
                                <TouchableOpacity
                                    className={`p-4 rounded-xl flex-row justify-center items-center ${requiredPeople > 0 && selectedUsers.length === requiredPeople ? 'bg-blue-600' : 'bg-gray-700'
                                        }`}
                                    disabled={requiredPeople === 0 || selectedUsers.length !== requiredPeople || loading}
                                    onPress={handleCreateSplit}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle-outline" size={24} color="white" className="mr-2" />
                                            <Text className="text-white font-bold text-lg ml-2">Confirm & Notify Friends</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default SplitPaymentModal;
