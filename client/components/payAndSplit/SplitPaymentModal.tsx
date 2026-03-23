import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Modal, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../../context/axiosConfig'; 
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
            const res = await axios.post('/user/update', formData as any);
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
            <View className="flex-1 justify-end bg-black/50">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="w-full h-[90%] bg-[#F5F7FA] rounded-t-[48px] border-t border-gray-100 overflow-hidden"
                >
                    <View className="flex-1 p-6">
                        {/* Drag Handle */}
                        <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-8" />
                        
                        {/* Header */}
                        <View className="flex-row justify-between items-center mb-8">
                            <View>
                                <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter">Split <Text className="text-pink-500">Bill</Text></Text>
                                <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Settle it fairly</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="p-2 bg-white rounded-full border border-gray-100 shadow-sm">
                                <Ionicons name="close" size={24} color="#18181b" />
                            </TouchableOpacity>
                        </View>

                        {!hasUpi ? (
                            <View className="flex-1 items-center justify-center -mt-10">
                                <View className="bg-pink-50 p-6 rounded-full border border-pink-100 mb-8">
                                    <View className="bg-white p-4 rounded-full shadow-sm">
                                        <Ionicons name="wallet-outline" size={60} color="#ec4899" />
                                    </View>
                                </View>
                                <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter text-center mb-3">Set Up Your UPI ID</Text>
                                <Text className="text-gray-500 text-center mb-10 font-medium px-6">We need your UPI ID so your friends can pay their share directly to you.</Text>

                                <View className="w-full bg-white border border-gray-100 rounded-2xl p-5 shadow-sm shadow-black/5 mb-8">
                                    <View className="flex-row items-center mb-2">
                                        <Ionicons name="at-circle" size={16} color="#9ca3af" />
                                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest ml-1">Universal Payment ID</Text>
                                    </View>
                                    <TextInput
                                        className="text-zinc-900 font-bold text-center text-xl py-2"
                                        placeholder="yourname@upi"
                                        placeholderTextColor="#d4d4d8"
                                        value={upiIdInput}
                                        onChangeText={setUpiIdInput}
                                        autoCapitalize="none"
                                    />
                                </View>

                                <TouchableOpacity
                                    className={`w-full p-5 rounded-2xl items-center flex-row justify-center shadow-lg ${!upiIdInput.includes('@') ? 'bg-gray-100 shadow-none' : 'bg-zinc-900 shadow-black/20'}`}
                                    disabled={savingUpi || !upiIdInput.includes('@')}
                                    onPress={handleSaveUpi}
                                >
                                    {savingUpi ? <ActivityIndicator color="white" /> : <Text className={`text-lg font-black italic uppercase tracking-tight ${!upiIdInput.includes('@') ? 'text-gray-400' : 'text-white'}`}>Save & Continue</Text>}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" className="flex-1">
                                    {/* Amount Card */}
                                    <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm shadow-black/5 mb-8 items-center">
                                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Bill Amount</Text>
                                        <Text className="text-zinc-900 text-4xl font-black italic tracking-tighter">₹{totalAmount}</Text>
                                    </View>

                                    <View className="mb-6">
                                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Expense Details</Text>
                                        <View className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm shadow-black/5">
                                            <TextInput
                                                className="text-zinc-900 font-bold text-base"
                                                placeholder="What was this for? (e.g. Dinner)"
                                                placeholderTextColor="#d4d4d8"
                                                value={description}
                                                onChangeText={setDescription}
                                            />
                                        </View>
                                    </View>

                                    <View className="mb-8">
                                        <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">Split Between</Text>
                                        <View className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm shadow-black/5">
                                            <View className="flex-row items-center">
                                                <TextInput
                                                    className="flex-1 text-zinc-900 font-bold text-base"
                                                    placeholder="Number of people excluding you"
                                                    placeholderTextColor="#d4d4d8"
                                                    keyboardType="numeric"
                                                    value={numPeople}
                                                    onChangeText={setNumPeople}
                                                />
                                                <View className="bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                                                     <Text className="text-gray-400 text-[10px] font-black">EXCLUDING YOU</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Search User Fields */}
                                    {requiredPeople > 0 && (
                                        <View className="mb-8">
                                            <View className="flex-row justify-between items-center mb-4 ml-1">
                                                <Text className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Select {requiredPeople} Members</Text>
                                                <Text className="text-pink-500 text-[10px] font-black uppercase tracking-widest">{selectedUsers.length} / {requiredPeople}</Text>
                                            </View>

                                            {/* Selected Users Chips */}
                                            <View className="flex-row flex-wrap mb-4">
                                                {selectedUsers.map((u) => (
                                                    <View key={u._id} className="bg-white border border-gray-100 flex-row items-center px-2 py-1.5 rounded-full mr-2 mb-2 shadow-sm">
                                                        <Image source={{ uri: u.avatar || `https://ui-avatars.com/api/?name=${u.username}` }} className="w-5 h-5 rounded-full mr-2" />
                                                        <Text className="text-zinc-900 text-xs font-bold mr-2">@{u.username}</Text>
                                                        <TouchableOpacity onPress={() => handleRemoveUser(u._id)} className="bg-gray-50 rounded-full p-0.5">
                                                            <Ionicons name="close" size={12} color="#f43f5e" />
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                            </View>

                                            {/* Input for Search */}
                                            {selectedUsers.length < requiredPeople && (
                                                <View>
                                                    <View className="flex-row items-center bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm shadow-black/5">
                                                        <Ionicons name="search" size={20} color="#ec4899" />
                                                        <TextInput
                                                            className="flex-1 text-zinc-900 font-bold ml-3 text-base"
                                                            placeholder={`Find member ${selectedUsers.length + 1}...`}
                                                            placeholderTextColor="#d4d4d8"
                                                            value={searchQuery}
                                                            onChangeText={setSearchQuery}
                                                        />
                                                        {searching && <ActivityIndicator size="small" color="#ec4899" />}
                                                    </View>

                                                    {/* Auto-suggest dropdown */}
                                                    {searchResults.length > 0 && (
                                                        <View className="bg-white mt-3 rounded-2xl border border-gray-100 shadow-xl overflow-hidden max-h-60">
                                                            <FlatList
                                                                data={searchResults}
                                                                keyExtractor={(item: any) => item._id}
                                                                keyboardShouldPersistTaps="handled"
                                                                renderItem={({ item }) => (
                                                                    <TouchableOpacity
                                                                        className="flex-row items-center p-4 border-b border-gray-50 last:border-0"
                                                                        onPress={() => handleSelectUser(item)}
                                                                    >
                                                                        <Image source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.username}` }} className="w-10 h-10 rounded-full mr-4 border border-gray-100" />
                                                                        <View className="flex-1">
                                                                            <Text className="text-zinc-900 font-bold">{item.username}</Text>
                                                                            <Text className="text-gray-400 text-xs">{item.name}</Text>
                                                                        </View>
                                                                        <View className="bg-pink-50 p-2 rounded-full">
                                                                             <Ionicons name="add" size={16} color="#ec4899" />
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
                                        <View className="bg-zinc-900 p-8 rounded-[32px] mb-12 items-center shadow-xl shadow-black/20">
                                            <View className="bg-white/10 p-2 rounded-full mb-4">
                                                <Ionicons name="stats-chart" size={24} color="#ec4899" />
                                            </View>
                                            <Text className="text-white text-3xl font-black italic tracking-tighter">₹{splitAmount}</Text>
                                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Per Person Share</Text>
                                            <View className="mt-6 pt-6 border-t border-white/5 w-full items-center">
                                                <Text className="text-gray-500 text-[11px] text-center font-medium leading-4">
                                                    Equally divided between you and {requiredPeople} friends. Total of {totalPeople} people.
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    <View className="h-20" />
                                </ScrollView>

                                {/* Bottom Action Button */}
                                <View className="absolute bottom-4 left-6 right-6">
                                    <TouchableOpacity
                                        className={`p-5 rounded-2xl flex-row justify-center items-center shadow-lg ${requiredPeople > 0 && selectedUsers.length === requiredPeople ? 'bg-pink-500 shadow-pink-500/30' : 'bg-gray-100'
                                            }`}
                                        disabled={requiredPeople === 0 || selectedUsers.length !== requiredPeople || loading}
                                        onPress={handleCreateSplit}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <>
                                                <Ionicons name="flash" size={20} color={requiredPeople > 0 && selectedUsers.length === requiredPeople ? "white" : "#9ca3af"} />
                                                <Text className={`font-black italic uppercase tracking-tight text-lg ml-2 ${requiredPeople > 0 && selectedUsers.length === requiredPeople ? 'text-white' : 'text-gray-400'}`}>Create Split Group</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
};

export default SplitPaymentModal;
