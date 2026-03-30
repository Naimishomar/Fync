import React, { useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image, TextInput,
    ActivityIndicator, RefreshControl, Dimensions, StatusBar, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

const ClubListScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [clubs, setClubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Join Code State
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    const fetchClubs = async () => {
        try {
            const res = await axios.get('/clubs/all', { params: { userId: user?._id } });
            if (res.data.success) {
                setClubs(res.data.clubs);
            }
        } catch (error) {
            console.log("Error fetching clubs", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchClubs();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchClubs();
    };

    const handleJoinByCode = async () => {
        if (joinCode.length !== 6) return;
        setVerifying(true);
        try {
            const res = await axios.post('/clubs/join-by-code', { code: joinCode });
            if (res.data.success) {
                setShowCodeModal(false);
                setJoinCode('');
                navigation.navigate('ClubHub', { clubId: res.data.clubId });
            }
        } catch (error: any) {
            Alert.alert("Invalid Code", error.response?.data?.message || "Club not found");
        } finally {
            setVerifying(false);
        }
    };

    const handleAcceptInvitation = async (clubId: string) => {
        try {
            const res = await axios.post('/clubs/accept-invitation', { clubId, userId: user?._id });
            if (res.data.success) {
                Alert.alert("Welcome!", "You are now a member of this club.");
                fetchClubs();
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Action failed");
        }
    };

    const myClubs = clubs.filter(c => c.members?.includes(user?._id) || c.admins?.includes(user?._id));
    const invitations = clubs.filter(c => c.invitations?.includes(user?._id));

    const renderClubItem = ({ item, isInvitation }: { item: any, isInvitation?: boolean }) => {
        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => !isInvitation && navigation.navigate('ClubHub', { clubId: item._id })}
                className="flex-row items-center px-5 py-4 border-b border-zinc-100 bg-white mb-4 mx-4 rounded-2xl"
            >
                <View className="relative">
                    <Image
                        source={{ uri: item.logo || 'https://via.placeholder.com/150' }}
                        className="w-14 h-14 rounded-xl"
                    />
                    {!isInvitation && <View className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />}
                </View>

                <View className="flex-1 ml-4">
                    <View className="flex-row justify-between items-center">
                        <Text className="text-zinc-900 text-base font-bold" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-zinc-400 text-[10px]">Active</Text>
                    </View>
                    <Text className="text-zinc-500 text-sm mt-0.5" numberOfLines={1}>
                        {isInvitation ? "You've been invited to join this club" : (item.description || "Join the conversation...")}
                    </Text>

                    {isInvitation ? (
                        <View className="flex-row mt-2">
                            <TouchableOpacity
                                onPress={() => handleAcceptInvitation(item._id)}
                                className="bg-black px-5 py-1.5 rounded-lg"
                            >
                                <Text className="text-white text-[10px] font-bold uppercase tracking-wider">Accept Invitation</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="flex-row mt-2">
                            <View className="bg-zinc-100 px-2.5 py-1 rounded-md">
                                <Text className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{item.category || 'General'}</Text>
                            </View>
                            {item.admins?.includes(user?._id) && (
                                <View className="ml-2 bg-indigo-100 px-2.5 py-1 rounded-md">
                                    <Text className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">Admin</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-zinc-50">
            <StatusBar barStyle="light-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 py-4 flex-row justify-between items-center border-b border-zinc-100 bg-white">
                    <View>
                        <Text className="text-zinc-900 text-2xl font-black">Clubs</Text>
                        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">Your Hubs Only</Text>
                    </View>
                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity onPress={() => setShowCodeModal(true)}>
                            <Ionicons name="qr-code-outline" size={20} color="#52525b" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Join Code Modal */}
                <Modal visible={showCodeModal} transparent animationType="fade">
                    <View className="flex-1 bg-black/60 items-center justify-center p-6">
                        <View className="bg-white w-full rounded-[40px] p-8 items-center border border-zinc-100">
                            <TouchableOpacity
                                onPress={() => setShowCodeModal(false)}
                                className="absolute top-6 right-6"
                            >
                                <Ionicons name="close" size={24} color="#71717a" />
                            </TouchableOpacity>

                            <View className="w-16 h-16 bg-zinc-50 rounded-3xl items-center justify-center mb-6">
                                <Feather name="hash" size={32} color="black" />
                            </View>

                            <Text className="text-zinc-900 text-xl font-black uppercase tracking-widest text-center">Enter Lobby Code</Text>
                            <Text className="text-zinc-400 text-center mt-2 mb-8 text-[10px] font-bold uppercase tracking-widest leading-4">
                                Enter the 6-digit code shared by an admin{"\n"}to discover their community.
                            </Text>

                            <TextInput
                                placeholder="000000"
                                className="bg-zinc-50 w-full p-6 rounded-2xl text-center text-2xl font-black tracking-[10px] text-zinc-900 border border-zinc-100"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={joinCode}
                                onChangeText={setJoinCode}
                                autoFocus
                            />

                            <TouchableOpacity
                                onPress={handleJoinByCode}
                                disabled={verifying || joinCode.length !== 6}
                                className={`mt-8 w-full py-5 rounded-[24px] items-center ${joinCode.length === 6 ? 'bg-black' : 'bg-zinc-100'}`}
                            >
                                {verifying ? <ActivityIndicator color="white" /> : (
                                    <Text className={`font-black uppercase tracking-widest text-xs ${joinCode.length === 6 ? 'text-white' : 'text-zinc-400'}`}>
                                        Search Community
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                <FlatList
                    ListHeaderComponent={
                        <TouchableOpacity
                            onPress={() => navigation.navigate('CreateClub')}
                            className="mx-5 my-4 bg-zinc-900 p-5 rounded-2xl flex-row items-center justify-between shadow-xl shadow-black/20"
                        >
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-blue-500 rounded-xl items-center justify-center">
                                    <Ionicons name="add" size={24} color="white" />
                                </View>
                                <View className="ml-4">
                                    <Text className="text-white font-black uppercase text-[10px] tracking-widest mb-0.5">Start Community</Text>
                                    <Text className="text-white/60 text-[8px] font-bold uppercase tracking-widest">Establish New Club</Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={18} color="white" />
                        </TouchableOpacity>
                    }
                    data={[
                        ...(invitations.length > 0 ? [{ type: 'header', title: 'Pending Invitations' }] : []),
                        ...invitations.map(i => ({ ...i, isInvitation: true })),
                        ...(myClubs.length > 0 ? [{ type: 'header', title: 'Joined Communities' }] : []),
                        ...myClubs
                    ]}
                    keyExtractor={(item: any) => item._id || item.title}
                    renderItem={({ item }: any) => {
                        if (item.type === 'header') {
                            return (
                                <View className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 mt-2">
                                    <Text className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">{item.title}</Text>
                                </View>
                            );
                        }
                        return renderClubItem({ item, isInvitation: item.isInvitation });
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View className="items-center mt-32 p-10">
                            <MaterialCommunityIcons name="shield-lock-outline" size={64} color="#e5e7eb" />
                            <Text className="mt-6 text-zinc-400 font-bold uppercase text-xs tracking-[4px] text-center leading-5">
                                Your space is empty.{"\n"}Wait for an invitation or start your own hub.
                            </Text>
                        </View>
                    }
                />
            </SafeAreaView>
        </View>
    );
};

export default ClubListScreen;
