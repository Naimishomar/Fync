import React, { useState, useCallback, memo } from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator, RefreshControl, Dimensions, StatusBar, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

const ClubCard = memo(({ item, isInvitation, onAccept, onPress, userId }: any) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => !isInvitation && onPress(item._id)}
            className="bg-white rounded-4xl mb-6 mx-8 overflow-hidden border border-slate-100 shadow-sm shadow-black/5"
        >
            <View className="p-6 flex-row items-center">
                <View className="relative">
                    <Image
                        source={{ uri: item.logo || 'https://via.placeholder.com/150' }}
                        className="w-20 h-20 rounded-full bg-slate-50 border border-slate-100"
                    />
                    {!isInvitation && (
                        <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white shadow-sm" />
                    )}
                </View>

                <View className="flex-1 ml-6">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-slate-900 text-lg font-black uppercase tracking-tighter leading-tight flex-1 mr-2" numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View className="bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Active</Text>
                        </View>
                    </View>

                    <Text className="text-slate-500 text-2xs font-medium leading-4 mb-3" numberOfLines={2}>
                        {isInvitation ? "You've been invited to join this community." : (item.description || "Establish your presence in the conversation...")}
                    </Text>

                    <View className="flex-row items-center gap-2">
                        {isInvitation ? (
                            <TouchableOpacity
                                onPress={() => onAccept(item._id)}
                                className="bg-slate-900 px-6 py-2.5 rounded-2xl shadow-lg shadow-black/20"
                            >
                                <Text className="text-white text-2xs font-black uppercase tracking-wide">Accept Intel</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <View className="bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                                    <Text className="text-orange-600 text-2xs font-black uppercase tracking-wide">{item.category || 'HQ'}</Text>
                                </View>
                                {(item.admins?.includes(userId)) && (
                                    <View className="bg-slate-900 px-3 py-1.5 rounded-xl">
                                        <Text className="text-white text-2xs font-black uppercase tracking-wide">Admin Access</Text>
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
        <View className="flex-1 bg-[#FDFDFF]">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Protocol Gradient */}
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-8 pt-6 pb-2 flex-row justify-between items-center">
                    <View>
                        <Text className="text-slate-900 text-3xl font-black uppercase tracking-tighter leading-tight">
                            College <Text className="text-orange-500">Clubs</Text>
                        </Text>
                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Secure Community Network</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => setShowCodeModal(true)}
                        className="w-14 h-14 bg-white rounded-2xl items-center justify-center shadow-sm border border-slate-100"
                    >
                        <Ionicons name="qr-code-outline" size={24} color="#18181b" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    ListHeaderComponent={
                        <TouchableOpacity
                            onPress={() => navigation.navigate('CreateClub')}
                            className="mx-8 my-6 bg-slate-900 p-5 rounded-2xl flex-row items-center justify-between shadow-2xl shadow-black/30"
                        >
                            <View className="flex-row items-center">
                                <View className="w-14 h-14 bg-orange-600 rounded-2xl items-center justify-center">
                                    <Ionicons name="add" size={32} color="white" />
                                </View>
                                <View className="ml-6">
                                    <Text className="text-white font-black uppercase text-xs tracking-wide mb-1">Establish Hub</Text>
                                    <Text className="text-white/40 text-2xs font-bold uppercase tracking-wide italic">New Community Protocol</Text>
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
                                <View className="px-10 py-4 mt-4">
                                    <Text className="text-slate-500 font-black uppercase text-2xs tracking-wide">{item.title}</Text>
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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
                    ListEmptyComponent={!loading ? (
                        <View className="items-center mt-32 px-10">
                            <View className="w-24 h-24 bg-white rounded-4xl items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                <MaterialCommunityIcons name="shield-lock-outline" size={48} color="#cbd5e1" />
                            </View>
                            <Text className="text-slate-500 font-black uppercase text-xs tracking-wide text-center">Hub Empty</Text>
                            <Text className="text-slate-300 text-2xs font-bold uppercase mt-2 text-center leading-5">
                                Your authorization space is empty.{"\n"}Establish a hub or wait for a clearance signal.
                            </Text>
                        </View>
                    ) : <ActivityIndicator color="#f97316" className="mt-20" />}
                />

                {/* Join Code Modal */}
                <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => setShowCodeModal(false)}>
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-white rounded-t-5xl p-10 border border-slate-100">
                            <View className="flex-row justify-between items-center mb-10">
                                <Text className="text-slate-900 text-2xl font-black uppercase tracking-tighter">Enter Code</Text>
                                <TouchableOpacity
                                    onPress={() => setShowCodeModal(false)}
                                    className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100"
                                >
                                    <Ionicons name="close" size={24} color="#18181b" />
                                </TouchableOpacity>
                            </View>

                            <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-8 self-center border border-slate-100">
                                <Feather name="hash" size={32} color="#18181b" />
                            </View>

                            <Text className="text-slate-500 text-center mb-10 text-2xs font-bold uppercase tracking-wide leading-5">
                                Input the 6-digit access code share by HQ{"\n"}to authorize your deployment.
                            </Text>

                            <TextInput
                                placeholder="000000"
                                placeholderTextColor="#cbd5e1"
                                className="bg-slate-50 w-full p-8 rounded-4xl text-center text-4xl font-black tracking-[12px] text-slate-900 border border-slate-100"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={joinCode}
                                onChangeText={setJoinCode}
                                autoFocus
                            />

                            <TouchableOpacity
                                onPress={handleJoinByCode}
                                disabled={verifying || joinCode.length !== 6}
                                className={`mt-10 w-full py-6 rounded-2xl items-center shadow-xl ${joinCode.length === 6 ? 'bg-black shadow-black/20' : 'bg-black/80'}`}
                            >
                                {verifying ? <ActivityIndicator color="white" /> : (
                                    <Text className={`font-black uppercase tracking-[3px] text-xs ${joinCode.length === 6 ? 'text-white' : 'text-slate-300'}`}>
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
