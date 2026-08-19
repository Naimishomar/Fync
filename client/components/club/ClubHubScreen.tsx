import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Dimensions, RefreshControl, StatusBar, Share} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../ui/AlertModal';

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
            const shareUrl = `https://fync-api.duckdns.org/club?id=${club._id}`;
            const result = await Share.share({
                message: `Join our exclusive campus club: ${club.name} on Fync! \n\nLink: ${shareUrl} \n\nClub ID: ${club._id}`,
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
            <ActivityIndicator color="#f97316" />
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
        <View className="flex-1 bg-[#FDFDFF]">
            <StatusBar barStyle="light-content" />
            <ScrollView 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchClubDetails} tintColor="#f97316" />}
            >
                {/* Banner & Header */}
                <View className="h-80 w-full relative">
                    <Image 
                        source={{ uri: club.banner || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' }} 
                        className="w-full h-full"
                    />
                    <LinearGradient 
                        colors={['transparent', 'rgba(0,0,0,0.9)']} 
                        className="absolute inset-0"
                    />
                    
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()}
                        className="absolute top-12 left-8 w-12 h-12 rounded-2xl bg-black/40 items-center justify-center border border-white/20 backdrop-blur-md"
                    >
                        <Ionicons name="chevron-back" size={24} color="white" />
                    </TouchableOpacity>

                    <View className="absolute top-12 right-8 flex-row gap-3">
                        <TouchableOpacity 
                            onPress={onShare}
                            className="w-12 h-12 rounded-2xl bg-black/40 items-center justify-center border border-white/20 backdrop-blur-md"
                        >
                            <Feather name="share-2" size={18} color="white" />
                        </TouchableOpacity>
                        {isAdmin && (
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('ClubAdminPanel', { clubId })}
                                className="w-12 h-12 rounded-2xl bg-black/40 items-center justify-center border border-white/20 backdrop-blur-md"
                            >
                                <Feather name="settings" size={18} color="white" />
                            </TouchableOpacity>
                        )}
                        {hasAccess && (
                            <TouchableOpacity 
                                onPress={handleLeaveClub}
                                className="w-12 h-12 rounded-2xl bg-black/40 items-center justify-center border border-white/20 backdrop-blur-md"
                            >
                                <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View className="absolute bottom-10 left-8 flex-row items-center">
                        <View className="relative">
                            <Image 
                                source={{ uri: club.logo || 'https://via.placeholder.com/150' }} 
                                className="w-24 h-24 rounded-4xl border-4 border-white/20 bg-white"
                            />
                            {hasAccess && <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-black" />}
                        </View>
                        <View className="ml-6 flex-1 pr-4">
                            <Text className="text-white text-3xl font-black uppercase tracking-tighter leading-tight" numberOfLines={2}>{club.name}</Text>
                            <View className="flex-row items-center bg-white/10 px-4 py-2 rounded-2xl border border-white/20 mt-3 self-start backdrop-blur-sm">
                                <Feather name="users" size={12} color="white" />
                                <Text className="text-white text-2xs font-black uppercase tracking-wide ml-2">{club.members?.length || 0} Registered Personnel</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* About Section */}
                <View className="px-8 py-10 bg-white rounded-b-5xl shadow-sm">
                    <Text className="text-slate-400 font-black uppercase text-2xs tracking-wide mb-4">Briefing Details</Text>
                    <Text className="text-slate-600 leading-7 text-sm font-medium italic">
                        "{club.description || "The ultimate campus ecosystem for high-velocity growth and achievement."}"
                    </Text>
                </View>

                {hasAccess ? (
                    <>
                        {/* Sub-Groups / Rooms Section (Visible to Members) */}
                        <View className="px-8 py-10">
                            <View className="flex-row justify-between items-center mb-8">
                                <View>
                                    <Text className="text-slate-900 text-2xl font-black uppercase tracking-tighter">Secure <Text className="text-orange-500">Rooms</Text></Text>
                                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">Authorized Sub-Domains</Text>
                                </View>
                                {isAdmin && (
                                    <TouchableOpacity 
                                        onPress={() => navigation.navigate('CreateSubGroup', { clubId: club._id })} 
                                        className="w-12 h-12 bg-slate-900 rounded-2xl items-center justify-center shadow-lg shadow-black/20"
                                    >
                                        <Ionicons name="add" size={28} color="white" />
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
                                            className={`p-6 rounded-4xl border ${sub.isGeneral ? 'bg-slate-900 border-slate-800 shadow-xl shadow-black/20' : 'bg-white border-slate-100 shadow-sm'} mb-6 flex-row items-center`}
                                        >
                                            <View className={`w-16 h-16 rounded-2xl items-center justify-center ${sub.isGeneral ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100'}`}>
                                                {sub.isGeneral ? (
                                                    <MaterialCommunityIcons name="shield-check" size={28} color="#f97316" />
                                                ) : (
                                                    <Image source={{ uri: sub.logo || 'https://via.placeholder.com/150' }} className="w-full h-full rounded-2xl" />
                                                )}
                                            </View>
                                            
                                            <View className="flex-1 ml-5 pr-4">
                                                <Text className={`${sub.isGeneral ? 'text-white' : 'text-slate-900'} font-black text-lg uppercase tracking-tighter`}>
                                                    {sub.name}
                                                </Text>
                                                <Text className={`${sub.isGeneral ? 'text-slate-500' : 'text-slate-400'} text-2xs font-black uppercase tracking-widest mt-1`} numberOfLines={1}>
                                                    {sub.isGeneral ? "HQ / OFFICIAL CHANNEL" : sub.description || "SPECIALIZED SECTOR"}
                                                </Text>
                                            </View>

                                            {isSubMember ? (
                                                <Ionicons name="chevron-forward" size={20} color={sub.isGeneral ? "#3f3f46" : "#cbd5e1"} />
                                            ) : isPendingJoin ? (
                                                <View className="bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                                                    <Text className="text-slate-400 font-black text-2xs uppercase tracking-wide">Pending</Text>
                                                </View>
                                            ) : (
                                                <TouchableOpacity 
                                                    onPress={() => handleJoinSubGroup(sub._id)}
                                                    disabled={joining === sub._id}
                                                    className="bg-orange-600 px-5 py-3 rounded-2xl shadow-lg shadow-orange-600/30"
                                                >
                                                    {joining === sub._id ? <ActivityIndicator size="small" color="white" /> : (
                                                        <Text className="text-white font-black text-2xs uppercase tracking-wide">Join</Text>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View className="items-center p-12 bg-white rounded-5xl border border-dashed border-slate-200 mt-4">
                                    <Feather name="layers" size={48} color="#e5e7eb" />
                                    <Text className="mt-4 text-slate-300 font-black text-2xs uppercase tracking-wide text-center">No localized sub-domains established</Text>
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View className="px-8 py-12 mt-4">
                        <View className="bg-slate-900 p-10 rounded-5xl items-center shadow-2xl shadow-black/40">
                            <View className="w-20 h-20 bg-slate-800 rounded-4xl items-center justify-center mb-8 border border-slate-700">
                                <Feather name="lock" size={32} color="#f97316" />
                            </View>
                            <Text className="text-white text-2xl font-black uppercase tracking-tighter text-center">Protocol Restricted</Text>
                            <Text className="text-slate-500 text-center mt-4 mb-10 leading-6 font-medium text-sm">
                                This community hub is under tight security. Authorization clearance is required to view classified rooms and internal signals.
                            </Text>

                            {isPending ? (
                                <View className="bg-slate-800 py-5 px-10 rounded-3xl border border-slate-700">
                                    <Text className="text-orange-500 font-black uppercase tracking-wide text-2xs">Clearance Request Pending</Text>
                                </View>
                            ) : isInvited ? (
                                <TouchableOpacity 
                                    onPress={() => navigation.navigate('ClubList')}
                                    className="bg-orange-600 py-6 px-12 rounded-4xl w-full items-center shadow-xl shadow-orange-600/30"
                                >
                                    <Text className="text-white font-black uppercase tracking-wide text-xs">Accept Invitation</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity 
                                    onPress={handleRequestAccess}
                                    disabled={requesting}
                                    className="bg-white py-6 px-12 rounded-4xl w-full items-center shadow-xl shadow-black/20"
                                >
                                    {requesting ? <ActivityIndicator color="black" /> : (
                                        <Text className="text-black font-black uppercase tracking-wide text-xs">Request Clearance</Text>
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
