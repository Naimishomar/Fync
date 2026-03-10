import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CrushSearchInput from './CrushSearchInput';
import axios from '../../context/axiosConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

interface User {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
}

interface Crush {
    _id: string;
    userId: string;
    crushUserId: {
        _id: string;
        name: string;
        username: string;
        avatar?: string;
    };
    isMutual: boolean;
}

const CrushInputModal = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
    const navigation = useNavigation<any>();
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [myCrushes, setMyCrushes] = useState<Crush[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fetchCrushes = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/crush/my-crushes');
            if (res.data.success) {
                setMyCrushes(res.data.crushes);
            }
        } catch (err) {
            console.error("Fetch crushes error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isVisible) {
            fetchCrushes();
        }
    }, [isVisible]);

    const handleAddCrush = async () => {
        if (!selectedUser) return;
        setSubmitting(true);
        try {
            const res = await axios.post('/crush/add', { crushUserId: selectedUser._id });
            if (res.data.success) {
                Alert.alert("Success ❤️", "Secret crush added successfully!");
                setSelectedUser(null);
                fetchCrushes();
            }
        } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Something went wrong");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemoveCrush = async (id: string) => {
        try {
            const res = await axios.delete(`/crush/remove/${id}`);
            if (res.data.success) {
                setMyCrushes(prev => prev.filter(c => c._id !== id));
            }
        } catch (err: any) {
            Alert.alert("Error", err.response?.data?.message || "Could not remove crush");
        }
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onDismiss={onClose}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 bg-black/80 justify-end"
            >
                <LinearGradient
                    colors={['#1a1a1a', '#000000']}
                    className="h-[85%] rounded-t-3xl border-t border-gray-800 p-6"
                >
                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-3xl font-bold text-white tracking-tighter italic">Secret Crush ❤️</Text>
                            <Text className="text-gray-400 text-sm">Add someone secretly. They won't know!</Text>
                        </View>
                        <Pressable onPress={onClose} className="bg-gray-800 p-2 rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {/* Search Input */}
                        <View className="z-50">
                            <CrushSearchInput onSelect={setSelectedUser} />
                        </View>

                        {/* Selected User Preview */}
                        {selectedUser && (
                            <View className="mt-8 bg-pink-900/20 border border-pink-500/30 rounded-2xl p-4 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className="relative">
                                        <Ionicons name="heart" size={20} color="#ff3b82" className="absolute -top-2 -left-2 z-10" />
                                        <Pressable className="bg-gray-800 p-4 rounded-2xl">
                                            <Text className="text-white font-bold ml-2">Selected: {selectedUser.name}</Text>
                                            <Text className="text-gray-400 text-xs ml-2">@{selectedUser.username}</Text>
                                        </Pressable>
                                    </View>
                                </View>
                                <Pressable
                                    onPress={handleAddCrush}
                                    disabled={submitting}
                                    className="bg-pink-600 px-6 py-3 rounded-xl active:bg-pink-700"
                                >
                                    {submitting ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Add Crush</Text>}
                                </Pressable>
                            </View>
                        )}

                        {/* List of My Crushes */}
                        <View className="mt-10">
                            <Text className="text-white text-lg font-bold mb-4">My Secret List ({myCrushes.length})</Text>
                            {loading ? (
                                <ActivityIndicator size="large" color="#ff3b82" className="mt-4" />
                            ) : myCrushes.length === 0 ? (
                                <View className="bg-gray-900/50 p-10 rounded-3xl border border-gray-800 border-dashed items-center mt-2">
                                    <Ionicons name="heart-dislike-outline" size={40} color="#444" />
                                    <Text className="text-gray-500 mt-2 font-semibold">Your list is empty.</Text>
                                </View>
                            ) : (
                                myCrushes.map((crush) => (
                                    <View key={crush._id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-row items-center justify-between mb-4">
                                        <Pressable
                                            className="flex-row items-center flex-1"
                                            onPress={() => {
                                                onClose();
                                                navigation.navigate('PublicProfile', { userId: crush.crushUserId?._id });
                                            }}
                                        >
                                            <Image
                                                source={{ uri: crush.crushUserId?.avatar || `https://ui-avatars.com/api/?name=${crush.crushUserId?.username}` }}
                                                className="w-12 h-12 rounded-full border border-gray-700 bg-gray-800"
                                            />
                                            <View className="ml-4">
                                                <Text className="text-white font-bold">{crush.crushUserId?.username || "Deleted User"}</Text>
                                                <Text className="text-gray-400 text-xs">{crush.crushUserId?.name}</Text>
                                                <Text className="text-pink-500 text-[10px] mt-1 font-bold uppercase tracking-widest">{crush.isMutual ? "Matched! ❤️" : "Waiting for match..."}</Text>
                                            </View>
                                        </Pressable>
                                        <Pressable onPress={() => handleRemoveCrush(crush._id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Ionicons name="trash-outline" size={20} color="gray" />
                                        </Pressable>
                                    </View>
                                ))
                            )}
                        </View>

                        <View className="h-20" />
                    </ScrollView>
                </LinearGradient>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default CrushInputModal;
