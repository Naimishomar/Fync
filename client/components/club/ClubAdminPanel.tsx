import React, { useState, useEffect } from 'react';
import {View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, FlatList, TextInput, StatusBar, Platform, Switch, Share} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../ui/AlertModal';

const ClubAdminPanel = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { clubId } = route.params;
    const { user } = useAuth();
    
    const [club, setClub] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'requests' | 'recruit' | 'members' | 'settings'>('requests');
    
    // Edit Form State
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [isJoinCodeEnabled, setIsJoinCodeEnabled] = useState(true);
    const [newLogo, setNewLogo] = useState<any>(null);
    const [newBanner, setNewBanner] = useState<any>(null);
    const [updating, setUpdating] = useState(false);

    // Recruitment State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const fetchClubDetails = async () => {
        try {
            const res = await axios.get(`/clubs/${clubId}`);
            if (res.data.success) {
                const c = res.data.club;
                setClub(c);
                setEditName(c.name);
                setEditDesc(c.description);
                setEditCategory(c.category);
                setIsJoinCodeEnabled(c.isJoinCodeEnabled);
            }
        } catch (error) {
            console.log("Admin Panel fetch error", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClubDetails();
    }, [clubId]);

    const copyJoinCode = async () => {
        if (!club?.joinCode) return;
        await Clipboard.setStringAsync(club.joinCode);
        Alert.alert("Copied", "Lobby code copied to clipboard.");
    };

    const pickImage = async (type: 'logo' | 'banner') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'logo' ? [1, 1] : [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            if (type === 'logo') setNewLogo(result.assets[0]);
            else setNewBanner(result.assets[0]);
        }
    };

    const handleUpdateClub = async () => {
        setUpdating(true);
        try {
            const formData = new FormData();
            formData.append('clubId', clubId);
            formData.append('name', editName);
            formData.append('description', editDesc);
            formData.append('category', editCategory);
            formData.append('isJoinCodeEnabled', isJoinCodeEnabled.toString());
            formData.append('adminId', user?._id);

            if (newLogo) {
                const uriParts = newLogo.uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('logo', {
                    uri: newLogo.uri,
                    name: `logo.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            }

            if (newBanner) {
                const uriParts = newBanner.uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('banner', {
                    uri: newBanner.uri,
                    name: `banner.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            }

            const res = await axios.post('/clubs/update', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                Alert.alert("Success", "Club profile updated!");
                setNewLogo(null);
                setNewBanner(null);
                fetchClubDetails();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Update failed");
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteClub = async () => {
        Alert.alert(
            "Terminate Club Ecosystem?",
            "This will permanently delete the entire club, all its rooms, and all messages. This action is absolute and irreversible.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "PURGE EVERYTHING", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            setUpdating(true);
                            const res = await axios.post('/clubs/delete', {
                                clubId,
                                adminId: user?._id
                            });
                            if (res.data.success) {
                                Alert.alert("Success", "Club ecosystem has been wiped.");
                                navigation.navigate('ClubList');
                            }
                        } catch (error: any) {
                            Alert.alert("Purge Failed", error.response?.data?.message || "Something went wrong");
                        } finally {
                            setUpdating(false);
                        }
                    } 
                }
            ]
        );
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await axios.get('/clubs/search-users', { params: { query } });
            if (res.data.success) {
                setSearchResults(res.data.users);
            }
        } catch (error) {
            console.log("Search error", error);
        } finally {
            setSearching(false);
        }
    };

    const handleInvite = async (targetUserId: string) => {
        try {
            const res = await axios.post('/clubs/invite', { clubId, targetUserId, adminId: user?._id });
            if (res.data.success) {
                Alert.alert("Success", "Invitation dispatched!");
                fetchClubDetails();
                setSearchQuery('');
                setSearchResults([]);
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Invitation failed");
        }
    };

    const handleRequestAction = async (userId: string, action: 'approve' | 'reject') => {
        try {
            const res = await axios.post('/clubs/handle-request', { clubId, userId, action, adminId: user?._id });
            if (res.data.success) {
                Alert.alert("Handled", `Member request ${action}ed.`);
                fetchClubDetails();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Action failed");
        }
    };

    const handleToggleAdmin = async (targetUserId: string, currentStatus: boolean) => {
        const action = currentStatus ? "Revoke Admin Status" : "Promote to Admin";
        const message = currentStatus 
            ? "Are you sure you want to strip this user of their administrative privileges?" 
            : "This user will gain full management powers over the club. Continue?";

        Alert.alert(
            action,
            message,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: currentStatus ? "Revoke" : "Promote", 
                    style: currentStatus ? "destructive" : "default",
                    onPress: async () => {
                        try {
                            const res = await axios.post('/clubs/toggle-admin', { 
                                clubId, 
                                targetUserId, 
                                adminId: user?._id 
                            });
                            if (res.data.success) {
                                Alert.alert("Success", res.data.message);
                                fetchClubDetails();
                            }
                        } catch (error: any) {
                            Alert.alert("Error", error.response?.data?.message || "Action failed");
                        }
                    } 
                }
            ]
        );
    };

    const handleRemoveMember = async (targetUserId: string) => {
        Alert.alert(
            "Remove Member?",
            "This user will be immediately ejected from all rooms and the club. This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const res = await axios.post('/clubs/remove-member', {
                                clubId,
                                targetUserId,
                                adminId: user?._id
                            });
                            if (res.data.success) {
                                Alert.alert("Success", "Ejection complete.");
                                fetchClubDetails();
                            }
                        } catch (error: any) {
                            Alert.alert("Failed", error.response?.data?.message || "Something went wrong");
                        }
                    } 
                }
            ]
        );
    };

    if (loading) return <View className="flex-1 bg-white justify-center items-center"><ActivityIndicator color="#000" /></View>;

    return (
        <View className="flex-1 bg-slate-50">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 py-4 border-b border-slate-100 bg-white flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                    <View className="ml-4">
                        <Text className="text-slate-900 text-lg font-black uppercase tracking-widest">Control Panel</Text>
                        <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wide">{club.name}</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View className="flex-row bg-white border-b border-slate-100">
                    {['requests', 'recruit', 'members', 'settings'].map((tab: any) => (
                        <TouchableOpacity 
                            key={tab}
                            onPress={() => setActiveTab(tab as any)}
                            className={`flex-1 py-4 items-center border-b-2 ${activeTab === tab ? 'border-slate-900' : 'border-transparent'}`}
                        >
                            <Text className={`text-2xs font-black uppercase tracking-widest ${activeTab === tab ? 'text-slate-900' : 'text-slate-500'}`}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView className="flex-1 p-5">
                    {activeTab === 'requests' && (
                        <View>
                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Incoming Requests ({club.joinRequests?.length || 0})</Text>
                            {club.joinRequests?.map((req: any) => (
                                <View key={req._id} className="bg-white p-4 rounded-3xl border border-slate-100 mb-3 flex-row items-center">
                                    <Image source={{ uri: req.avatar || 'https://via.placeholder.com/150' }} className="w-12 h-12 rounded-full" />
                                    <View className="flex-1 ml-4">
                                        <Text className="text-slate-900 font-bold text-sm">{req.name}</Text>
                                        <Text className="text-slate-500 text-xs text-black">@{req.username}</Text>
                                    </View>
                                    <View className="flex-row gap-2">
                                        <TouchableOpacity onPress={() => handleRequestAction(req._id, 'approve')} className="w-9 h-9 bg-emerald-500 rounded-xl items-center justify-center">
                                            <Feather name="check" size={18} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleRequestAction(req._id, 'reject')} className="w-9 h-9 bg-slate-100 rounded-xl items-center justify-center">
                                            <Feather name="x" size={18} color="#71717a" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            {club.joinRequests?.length === 0 && (
                                <View className="items-center mt-20">
                                    <Feather name="inbox" size={32} color="#e5e7eb" />
                                    <Text className="text-center text-slate-300 mt-4 text-2xs font-bold uppercase tracking-wide">No pending requests</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'recruit' && (
                        <View>
                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Recruit Members</Text>
                            <View className="bg-white p-4 rounded-3xl border border-slate-100 mb-6 flex-row items-center">
                                <Feather name="search" size={18} color="#a1a1aa" />
                                <TextInput 
                                    placeholder="Search by username..."
                                    className="flex-1 ml-3 font-bold text-slate-900"
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                />
                                {searching && <ActivityIndicator size="small" color="#000" />}
                            </View>

                            {searchResults.length > 0 && (
                                <View className="mb-8">
                                    <Text className="text-slate-500 font-bold uppercase text-2xs mb-3 ml-1">Search Results</Text>
                                    {searchResults.map((u: any) => (
                                        <View key={u._id} className="bg-white p-4 rounded-3xl border border-slate-100 mb-2 flex-row items-center">
                                            <Image source={{ uri: u.avatar || 'https://via.placeholder.com/150' }} className="w-10 h-10 rounded-full" />
                                            <Text className="flex-1 ml-3 text-slate-900 font-bold">{u.username}</Text>
                                            <TouchableOpacity 
                                                onPress={() => handleInvite(u._id)}
                                                className="bg-black px-4 py-2 rounded-xl"
                                            >
                                                <Text className="text-white font-bold text-2xs uppercase">Invite</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Pending Invitations ({club.invitations?.length || 0})</Text>
                            {club.invitations?.map((inv: any) => (
                                <View key={inv._id} className="bg-white p-4 rounded-3xl border border-slate-100 mb-3 flex-row items-center opacity-60">
                                    <Image source={{ uri: inv.avatar || 'https://via.placeholder.com/150' }} className="w-12 h-12 rounded-full" />
                                    <View className="flex-1 ml-4">
                                        <Text className="text-slate-900 font-bold text-sm">{inv.name}</Text>
                                        <Text className="text-slate-500 text-xs text-black">@{inv.username}</Text>
                                    </View>
                                    <View className="bg-slate-100 px-3 py-1.5 rounded-full">
                                        <Text className="text-slate-500 font-black text-2xs uppercase">Sent</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {activeTab === 'members' && (
                        <View>
                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Active Members ({club.members?.length || 0})</Text>
                            {club.members?.map((member: any) => {
                                const isCurrentAdmin = club.admins.some((a: any) => (a._id || a) === member._id);
                                return (
                                    <View key={member._id} className="bg-white p-4 rounded-3xl border border-slate-100 mb-3 flex-row items-center">
                                        <Image source={{ uri: member.avatar || 'https://via.placeholder.com/150' }} className="w-12 h-12 rounded-full" />
                                        <View className="flex-1 ml-4">
                                            <Text className="text-slate-900 font-bold text-sm">{member.name}</Text>
                                            <Text className="text-slate-500 text-xs text-black">@{member.username}</Text>
                                        </View>
                                        {isCurrentAdmin ? (
                                            <View className="flex-row items-center gap-2">
                                                <View className="bg-slate-100 px-3 py-1.5 rounded-full">
                                                    <Text className="text-slate-500 font-black text-2xs uppercase">Admin</Text>
                                                </View>
                                                {/* Super Admin (Creator) Demotion Logic */}
                                                {(club.creator?._id === user?._id || club.creator === user?._id) && member._id !== user?._id && (
                                                    <TouchableOpacity 
                                                        onPress={() => handleToggleAdmin(member._id, true)} 
                                                        className="bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20"
                                                    >
                                                        <Text className="text-red-500 font-black text-2xs uppercase">Revoke</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ) : (
                                            <TouchableOpacity onPress={() => handleToggleAdmin(member._id, false)} className="bg-blue-600 px-3 py-1.5 rounded-full">
                                                <Text className="text-white font-black text-2xs uppercase">Promote</Text>
                                            </TouchableOpacity>
                                        )}
                                        {!isCurrentAdmin && (
                                            <TouchableOpacity 
                                                onPress={() => handleRemoveMember(member._id)}
                                                className="ml-2 w-8 h-8 bg-red-50 rounded-lg items-center justify-center border border-red-100"
                                            >
                                                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {activeTab === 'settings' && (
                        <View>
                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Lobby & Privacy</Text>
                            <View className="bg-white p-6 rounded-4xl border border-slate-100 mb-6 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-slate-900 font-black text-2xl tracking-widest">{club.joinCode || '000000'}</Text>
                                    <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wide mt-1">Unique Lobby Code</Text>
                                </View>
                                <View className="flex-row gap-3">
                                    <TouchableOpacity 
                                        onPress={copyJoinCode}
                                        className="w-10 h-10 bg-slate-50 rounded-xl items-center justify-center border border-slate-100"
                                    >
                                        <Feather name="copy" size={16} color="black" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="bg-white p-6 rounded-4xl border border-slate-100 mb-10 flex-row items-center justify-between">
                                <View className="flex-1 mr-4">
                                    <Text className="text-slate-900 font-black text-xs uppercase tracking-wide">Enable Code Entry</Text>
                                    <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wider mt-1">Allow students to discover club via code</Text>
                                </View>
                                <Switch 
                                    value={isJoinCodeEnabled}
                                    onValueChange={setIsJoinCodeEnabled}
                                    trackColor={{ false: "#e4e4e7", true: "#10b981" }}
                                    thumbColor="white"
                                />
                            </View>

                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Edit Club Profile</Text>
                            <View className="bg-white p-6 rounded-4xl border border-slate-100 mb-10">
                                <View className="flex-row mb-8">
                                    <TouchableOpacity onPress={() => pickImage('logo')} className="relative">
                                        <Image source={{ uri: newLogo?.uri || club.logo || 'https://via.placeholder.com/150' }} className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100" />
                                        <View className="absolute -bottom-1 -right-1 bg-black w-6 h-6 rounded-full items-center justify-center border-2 border-white">
                                            <Feather name="camera" size={10} color="white" />
                                        </View>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 ml-4 relative">
                                        <Image source={{ uri: newBanner?.uri || club.banner || 'https://via.placeholder.com/150' }} className="w-full h-16 rounded-2xl bg-slate-50 border border-slate-100" />
                                        <View className="absolute -bottom-1 -right-1 bg-black w-6 h-6 rounded-full items-center justify-center border-2 border-white">
                                            <Feather name="image" size={10} color="white" />
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <TextInput 
                                    placeholder="Club Name"
                                    className="bg-slate-50 p-4 rounded-2xl mb-4 font-bold border border-slate-100"
                                    value={editName}
                                    onChangeText={setEditName}
                                />
                                <TextInput 
                                    placeholder="Category"
                                    className="bg-slate-50 p-4 rounded-2xl mb-4 font-bold border border-slate-100"
                                    value={editCategory}
                                    onChangeText={setEditCategory}
                                />
                                <TextInput 
                                    placeholder="Mission Statement"
                                    className="bg-slate-50 p-4 rounded-2xl mb-6 font-semibold border border-slate-100"
                                    value={editDesc}
                                    onChangeText={setEditDesc}
                                    multiline
                                />
                                <TouchableOpacity 
                                    onPress={handleUpdateClub}
                                    disabled={updating}
                                    className="bg-slate-900 py-4 rounded-2xl items-center"
                                >
                                    {updating ? <ActivityIndicator color="white" /> : (
                                        <Text className="text-white font-black uppercase tracking-wide text-xs">Synchronize Profile</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <Text className="text-slate-500 font-bold uppercase text-2xs mb-4 tracking-wide">Room Management</Text>
                            {club.subGroups?.map((sub: any) => (
                                <View key={sub._id} className="bg-white p-4 rounded-3xl border border-slate-100 mb-3 flex-row items-center">
                                    <Image source={{ uri: sub.logo || 'https://via.placeholder.com/150' }} className="w-10 h-10 rounded-xl bg-slate-50" />
                                    <View className="flex-1 ml-4">
                                        <Text className="text-slate-900 font-bold text-sm tracking-tight">{sub.name}</Text>
                                        <Text className="text-slate-500 text-2xs font-bold uppercase">{sub.members?.length || 0} Members</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => navigation.navigate('EditSubGroup', { subGroupId: sub._id })}
                                        className="w-8 h-8 bg-slate-50 rounded-lg items-center justify-center border border-slate-100"
                                    >
                                        <Feather name="edit-3" size={14} color="#52525b" />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* Danger Zone */}
                            <View className="mt-12 bg-red-50 p-6 rounded-4xl border border-red-100 mb-5">
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="warning-outline" size={16} color="#ef4444" />
                                    <Text className="text-red-600 font-black text-2xs uppercase tracking-wide ml-2">Danger Zone</Text>
                                </View>
                                <Text className="text-red-400 text-2xs font-bold uppercase tracking-wider mb-5">
                                    Once you delete a club, there is no going back. Please be certain.
                                </Text>
                                <TouchableOpacity 
                                    onPress={handleDeleteClub}
                                    disabled={updating}
                                    className="bg-red-500 py-4 rounded-2xl items-center shadow-lg shadow-red-500/20"
                                >
                                    {updating ? <ActivityIndicator color="white" /> : (
                                        <Text className="text-white font-black uppercase tracking-wide text-2xs">Terminate Club Group</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    <View className="h-40" />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default ClubAdminPanel;
