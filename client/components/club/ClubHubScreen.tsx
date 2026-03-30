import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, 
  Dimensions, RefreshControl, StatusBar, Share, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const ClubHubScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { clubId } = route.params;
    const { user } = useAuth();
    
    const [club, setClub] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [joining, setJoining] = useState<string | null>(null);

    const fetchClubDetails = async () => {
        try {
            const res = await axios.get(`/clubs/${clubId}`);
            if (res.data.success) {
                setClub(res.data.club);
            }
        } catch (error) {
            console.log("Error fetching club details", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchClubDetails();
        }, [])
    );

    const onShare = async () => {
        try {
            const result = await Share.share({
                message: `Join our exclusive campus club: ${club.name} on Fync! \nClub ID: ${club._id}`,
            });
        } catch (error: any) {
            Alert.alert(error.message);
        }
    };

    const handleJoinSubGroup = async (subGroupId: string) => {
        setJoining(subGroupId);
        try {
            const res = await axios.post('/clubs/subgroup/join', { subGroupId, userId: user?._id });
            if (res.data.success) {
                Alert.alert("Success", res.data.message || "Request sent!");
                fetchClubDetails();
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Join failed");
        } finally {
            setJoining(null);
        }
    };

    const handleRequestAccess = async () => {
        setRequesting(true);
        try {
            const res = await axios.post('/clubs/join-request', { clubId, userId: user?._id });
            if (res.data.success) {
                Alert.alert("Success", "Access request sent to Admins.");
                fetchClubDetails();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Request failed");
        } finally {
            setRequesting(false);
        }
    };

    const handleLeaveClub = async () => {
        Alert.alert(
            "Leave Community?",
            "You will lose access to all rooms and messages in this club. You can join again if the club is public or via code.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Confirm Exit", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const res = await axios.post('/clubs/leave', {
                                clubId,
                                userId: user?._id
                            });
                            if (res.data.success) {
                                Alert.alert("Exit Successful", "You have left the club.");
                                navigation.navigate('ClubList');
                            }
                        } catch (error: any) {
                            Alert.alert("Exit Failed", error.response?.data?.message || "Something went wrong");
                        }
                    } 
                }
            ]
        );
    };

    if (loading) return (
        <View className="flex-1 bg-white justify-center items-center">
            <ActivityIndicator color="#000" />
        </View>
    );

    const isAdmin = club?.admins?.some((a: any) => (a._id || a) === user?._id);
    const isMember = club?.members?.some((m: any) => (m._id || m) === user?._id);
    const isInvited = club?.invitations?.some((i: any) => (i._id || i) === user?._id);
    const isPending = club?.joinRequests?.some((j: any) => (j._id || j) === user?._id);

    const hasAccess = isAdmin || isMember;

    // Sort: General First
    const subGroups = club?.subGroups ? [...club.subGroups].sort((a, b) => (b.isGeneral ? 1 : 0) - (a.isGeneral ? 1 : 0)) : [];

    return (
        <View className="flex-1 bg-zinc-50">
            <StatusBar barStyle="light-content" />
            <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchClubDetails} />}
            >
                {/* Banner & Header */}
                <View className="h-64 w-full relative">
                    <Image 
                        source={{ uri: club.banner || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' }} 
                        className="w-full h-full"
                    />
                    <LinearGradient 
                        colors={['transparent', 'rgba(0,0,0,0.8)']} 
                        className="absolute inset-0"
                    />
                    
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()}
                        className="absolute top-12 left-5 w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                    >
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>

                    <View className="absolute top-12 right-5 flex-row gap-3">
                        <TouchableOpacity 
                            onPress={onShare}
                            className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                        >
                            <Feather name="share-2" size={18} color="white" />
                        </TouchableOpacity>
                        {isAdmin && (
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('ClubAdminPanel', { clubId })}
                                className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                            >
                                <Feather name="settings" size={18} color="white" />
                            </TouchableOpacity>
                        )}
                        {hasAccess && (
                            <TouchableOpacity 
                                onPress={handleLeaveClub}
                                className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
                            >
                                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="absolute bottom-6 left-5 flex-row items-center">
                        <Image 
                            source={{ uri: club.logo || 'https://via.placeholder.com/150' }} 
                            className="w-20 h-20 rounded-2xl border-2 border-white bg-white"
                        />
                        <View className="ml-4">
                            <Text className="text-white text-2xl font-black uppercase tracking-tight">{club.name}</Text>
                            <View className="flex-row items-center bg-black/40 px-3 py-1 rounded-full border border-white/20 mt-1 self-start">
                                <Feather name="users" size={10} color="white" />
                                <Text className="text-white text-[9px] font-black uppercase tracking-widest ml-2">{club.members?.length || 0} Members</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* About Section */}
                <View className="px-5 py-6 bg-white border-b border-zinc-100">
                    <Text className="text-zinc-900 text-lg font-black uppercase tracking-widest mb-2">About the Hub</Text>
                    <Text className="text-zinc-500 leading-6 text-sm">
                        {club.description || "The ultimate campus ecosystem for high-velocity growth and achievement."}
                    </Text>
                </View>

                {hasAccess ? (
                    <>
                        {/* Sub-Groups / Rooms Section (Visible to Members) */}
                        <View className="px-5 py-6">
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-zinc-900 text-lg font-black uppercase tracking-widest">Sub-Domain Groups</Text>
                                {isAdmin && (
                                    <TouchableOpacity onPress={() => navigation.navigate('CreateSubGroup', { clubId: club._id })} className="bg-blue-500 px-4 py-2 rounded-full">
                                        <Text className="text-white font-black text-[9px] uppercase">+ Create</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {subGroups.length > 0 ? (
                                subGroups.map((sub: any) => {
                                    const isSubMember = sub.members?.includes(user?._id);
                                    const isPendingJoin = sub.joinRequests?.some((j: any) => (j._id || j) === user?._id);
                                    
                                    return (
                                        <TouchableOpacity 
                                            key={sub._id}
                                            activeOpacity={0.8}
                                            disabled={!isSubMember}
                                            onPress={() => isSubMember && navigation.navigate('SubGroupChat', { subGroupId: sub._id, subGroupName: sub.name, clubId: club._id })}
                                            className={`p-5 rounded-xl border ${sub.isGeneral ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-100'} mb-5 shadow-sm flex-row items-center`}
                                        >
                                            <View className={`w-14 h-14 rounded-2xl items-center justify-center ${sub.isGeneral ? 'bg-zinc-800' : 'bg-zinc-50'}`}>
                                                {sub.isGeneral ? (
                                                    <MaterialCommunityIcons name="shield-check" size={28} color="#10b981" />
                                                ) : (
                                                    <Image source={{ uri: sub.logo || 'https://via.placeholder.com/150' }} className="w-full h-full rounded-2xl" />
                                                )}
                                            </View>
                                            
                                            <View className="flex-1 ml-4 pr-4">
                                                <Text className={`${sub.isGeneral ? 'text-white' : 'text-zinc-900'} font-black text-base uppercase tracking-tight`}>
                                                    {sub.name}
                                                </Text>
                                                <Text className={`${sub.isGeneral ? 'text-zinc-500' : 'text-zinc-400'} text-[10px] font-bold uppercase mt-1`} numberOfLines={1}>
                                                    {sub.isGeneral ? "Official Community Hub" : sub.description || "Specialized Discussion"}
                                                </Text>
                                            </View>

                                            {isSubMember ? (
                                                <Ionicons name="chevron-forward" size={20} color={sub.isGeneral ? "#52525b" : "#d1d5db"} />
                                            ) : isPendingJoin ? (
                                                <View className="bg-zinc-100 px-4 py-2 rounded-xl border border-zinc-200">
                                                    <Text className="text-zinc-500 font-black text-[9px] uppercase">Requested</Text>
                                                </View>
                                            ) : (
                                                <TouchableOpacity 
                                                    onPress={() => handleJoinSubGroup(sub._id)}
                                                    disabled={joining === sub._id}
                                                    className="bg-emerald-500 px-4 py-2 rounded-xl"
                                                >
                                                    {joining === sub._id ? <ActivityIndicator size="small" color="black" /> : (
                                                        <Text className="text-black font-black text-[9px] uppercase">Join</Text>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View className="items-center p-10 bg-white rounded-3xl border border-dashed border-zinc-200">
                                    <Feather name="layers" size={40} color="#e5e7eb" />
                                    <Text className="mt-4 text-zinc-400 font-bold text-xs uppercase text-center">No specialized rooms created yet</Text>
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View className="p-5 mt-4">
                        <View className="bg-zinc-900 p-8 rounded-[40px] items-center border border-zinc-800">
                            <View className="w-16 h-16 bg-zinc-800 rounded-3xl items-center justify-center mb-6">
                                <Feather name="lock" size={32} color="#10b981" />
                            </View>
                            <Text className="text-white text-xl font-black uppercase tracking-widest text-center">Private Community</Text>
                            <Text className="text-zinc-500 text-center mt-3 mb-8 leading-5 font-medium">
                                This club is exclusive. Join request approval or direct invitation is required to access rooms and messaging.
                            </Text>

                            {isPending ? (
                                <View className="bg-zinc-800 py-4 px-8 rounded-2xl border border-zinc-700">
                                    <Text className="text-emerald-500 font-black uppercase tracking-widest text-[10px]">Access Request Pending</Text>
                                </View>
                            ) : isInvited ? (
                                <TouchableOpacity 
                                    onPress={() => navigation.navigate('ClubList')}
                                    className="bg-emerald-500 py-4 px-10 rounded-2xl"
                                >
                                    <Text className="text-black font-black uppercase tracking-widest text-[10px]">Accept Invitation</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    onPress={handleRequestAccess}
                                    disabled={requesting}
                                    className="bg-white py-5 px-10 rounded-3xl w-full items-center active:bg-zinc-200"
                                >
                                    {requesting ? <ActivityIndicator color="black" /> : (
                                        <Text className="text-black font-black uppercase tracking-widest text-xs">Request Access</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                <View className="h-40" />
            </ScrollView>
        </View>
    );
};

export default ClubHubScreen;
