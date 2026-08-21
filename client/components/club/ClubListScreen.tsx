import React, { useState, useCallback, memo } from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator, RefreshControl, Dimensions, StatusBar, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

const ClubCard = memo(({ item, isInvitation, onAccept, onPress, userId }: any) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => !isInvitation && onPress(item._id)}
            className="bg-card rounded-sheet mb-6 mx-gutter overflow-hidden border border-line shadow-hair"
        >
            <View className="p-6 flex-row items-center">
                <View className="relative">
                    <Image
                        source={{ uri: item.logo || 'https://via.placeholder.com/150' }}
                        className="w-20 h-20 rounded-full bg-paper-2 border border-line"
                    />
                    {!isInvitation && (
                        <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full border-4 border-white shadow-hair" />
                    )}
                </View>

                <View className="flex-1 ml-6">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-ink text-lg font-display uppercase leading-tight flex-1 mr-2" numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 text-label font-display uppercase">Active</Text>
                        </View>
                    </View>

                    <Text className="text-ink-3 text-label font-medium leading-4 mb-3" numberOfLines={2}>
                        {isInvitation ? "You've been invited to join this community." : (item.description || "Establish your presence in the conversation...")}
                    </Text>

                    <View className="flex-row items-center gap-2">
                        {isInvitation ? (
                            <TouchableOpacity
                                onPress={() => onAccept(item._id)}
                                className="bg-ink px-2.5 py-1 rounded-full"
                            >
                                <Text className="text-white text-label font-display uppercase">Accept Intel</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                    <Text className="text-accent-text text-label font-display uppercase">{item.category || 'HQ'}</Text>
                                </View>
                                {(item.admins?.includes(userId)) && (
                                    <View className="bg-ink px-2.5 py-1 rounded-full">
                                        <Text className="text-white text-label font-display uppercase">Admin Access</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});

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

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Protocol Gradient */}

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-gutter pt-6 pb-2 flex-row justify-between items-center">
                    <View>
                        <Text className="text-ink text-3xl font-display uppercase leading-tight">
                            College <Text className="text-accent-text">Clubs</Text>
                        </Text>
                        <Text className="text-ink-3 text-label font-display uppercase">Secure Community Network</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowCodeModal(true)}
                        className="w-14 h-14 bg-card rounded-card items-center justify-center shadow-hair border border-line"
                    >
                        <Ionicons name="qr-code-outline" size={24} color="#12100E" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ListHeaderComponent={
                        <TouchableOpacity
                            onPress={() => navigation.navigate('CreateClub')}
                            className="mx-gutter my-6 bg-ink p-5 rounded-card flex-row items-center justify-between shadow-hair"
                        >
                            <View className="flex-row items-center">
                                <View className="w-14 h-14 bg-brand-600 rounded-card items-center justify-center">
                                    <Ionicons name="add" size={32} color="white" />
                                </View>
                                <View className="ml-6">
                                    <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                                      <Text className="text-white font-display uppercase text-xs">Establish Hub</Text>
                                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                    </View>
                                    <Text className="text-white/40 text-label font-semibold uppercase italic">New Community Protocol</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color="white" opacity={0.3} />
                        </TouchableOpacity>
                    }
                    data={[
                        ...(invitations.length > 0 ? [{ type: 'header', title: 'Pending Authorizations' }] : []),
                        ...invitations.map(i => ({ ...i, isInvitation: true })),
                        ...(myClubs.length > 0 ? [{ type: 'header', title: 'Active Deployments' }] : []),
                        ...myClubs
                    ]}
                    keyExtractor={(item: any) => item._id || item.title}
                    renderItem={({ item }: any) => {
                        if (item.type === 'header') {
                            return (
                                <View className="px-gutter py-4 mt-4">
                                    <Text className="text-ink-3 font-display uppercase text-label">{item.title}</Text>
                                </View>
                            );
                        }
                        return (
                            <ClubCard 
                                item={item} 
                                isInvitation={item.isInvitation} 
                                onAccept={handleAcceptInvitation}
                                onPress={(id: string) => navigation.navigate('ClubHub', { clubId: id })}
                                userId={user?._id}
                            />
                        );
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
                    ListEmptyComponent={!loading ? (
                        <View className="items-center mt-32 px-gutter">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                <MaterialCommunityIcons name="shield-lock-outline" size={48} color="#C4BEB6" />
                            </View>
                            <Text className="font-semibold text-base text-ink text-center">Hub Empty</Text>
                            <Text className="font-sans text-sm text-ink-4 mt-2 text-center">
                                Your authorization space is empty.{"\n"}Establish a hub or wait for a clearance signal.
                            </Text>
                        </View>
                    ) : <ActivityIndicator color="#F97316" className="mt-20" />}
                />

                {/* Join Code Modal */}
                <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => setShowCodeModal(false)}>
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-paper rounded-t-sheet p-card-pad border border-line">
                            <View className="flex-row justify-between items-center mb-10">
                                <Text className="text-ink font-display uppercase text-h1">Enter Code</Text>
                                <TouchableOpacity
                                    onPress={() => setShowCodeModal(false)}
                                    className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line"
                                >
                                    <Ionicons name="close" size={24} color="#12100E" />
                                </TouchableOpacity>
                            </View>

                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-8 self-center">
                                <Feather name="hash" size={32} color="#12100E" />
                            </View>

                            <Text className="font-sans text-sm text-ink-2 text-center mb-8">
                                Input the 6-digit access code shared by HQ to authorise your deployment.
                            </Text>

                            <TextInput
                                placeholder="000000"
                                placeholderTextColor="#C4BEB6"
                                className="bg-card w-full p-card-pad rounded-card text-center text-4xl font-display text-ink border-2 border-ink"
                                style={{ letterSpacing: 12, shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 }}
                                keyboardType="number-pad"
                                maxLength={6}
                                value={joinCode}
                                onChangeText={setJoinCode}
                                autoFocus
                            />

                            <TouchableOpacity
                                onPress={handleJoinByCode}
                                disabled={verifying || joinCode.length !== 6}
                                className={`mt-10 w-full py-5 rounded-card items-center border-2 border-ink ${joinCode.length === 6 ? 'bg-brand-500' : 'bg-paper-2'}`}
                            >
                                {verifying ? <ActivityIndicator color="#12100E" /> : (
                                    <Text className={`font-display uppercase ${joinCode.length === 6 ? 'text-ink' : 'text-ink-4'}`} style={{ fontSize: 14, letterSpacing: 0.3 }}>
                                        Join Club
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <View className="h-10" />
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </View>
    );
};

export default ClubListScreen;
