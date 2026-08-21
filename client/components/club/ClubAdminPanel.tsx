import React, { useState, useEffect } from 'react';
import {View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, FlatList, TextInput, StatusBar, Switch, Share} from 'react-native'
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

    if (loading) return <View className="flex-1 bg-paper justify-center items-center"><ActivityIndicator color="#12100E" /></View>;

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 py-4 border-b border-line bg-card flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                    <View className="ml-4">
                        <Text className="text-ink text-lg font-display uppercase">Control Panel</Text>
                        <Text className="text-ink-3 text-label font-semibold uppercase">{club.name}</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View className="flex-row bg-card border-b border-line">
                    {['requests', 'recruit', 'members', 'settings'].map((tab: any) => (
                        <TouchableOpacity 
                            key={tab}
                            onPress={() => setActiveTab(tab as any)}
                            className={`flex-1 py-4 items-center border-b-2 ${activeTab === tab ? 'border-ink' : 'border-transparent'}`}
                        >
                            <Text className={`text-label font-display uppercase ${activeTab === tab ? 'text-ink' : 'text-ink-3'}`}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView className="flex-1 p-5">
                    {activeTab === 'requests' && (
                        <View>
                            <Text className="text-ink-3 font-semibold uppercase text-label mb-4">Incoming Requests ({club.joinRequests?.length || 0})</Text>
                            {club.joinRequests?.map((req: any) => (
                                <View key={req._id} className="bg-card p-4 rounded-card border border-line mb-3 flex-row items-center">
                                    <Image source={{ uri: req.avatar || 'https://via.placeholder.com/150' }} className="w-12 h-12 rounded-full" />
                                    <View className="flex-1 ml-4">
                                        <Text className="text-ink font-semibold text-sm">{req.name}</Text>
                                        <Text className="text-ink-3 text-xs">@{req.username}</Text>
                                    </View>
                                    <View className="flex-row gap-2">
                                        <TouchableOpacity onPress={() => handleRequestAction(req._id, 'approve')} className="w-9 h-9 bg-success rounded-xl items-center justify-center">
                                            <Feather name="check" size={18} color="white" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleRequestAction(req._id, 'reject')} className="w-9 h-9 bg-paper-2 rounded-xl items-center justify-center">
                                            <Feather name="x" size={18} color="#57534E" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                            {club.joinRequests?.length === 0 && (
                                <View className="items-center mt-20">
                                    <Feather name="inbox" size={32} color="#E3DDD3" />
                                    <Text className="font-sans text-sm text-center text-ink-4 mt-4">No pending requests</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'recruit' && (
                        <View>
                            <Text className="text-ink-3 font-semibold uppercase text-label mb-4">Recruit Members</Text>
                            <View className="bg-card p-4 border-2 border-ink mb-6 flex-row items-center rounded-md">
                                <Feather name="search" size={18} color="#8B857E" />
                                <TextInput 
                                    placeholder="Search by username..."
                                    className="flex-1 ml-3 font-semibold text-ink"
                                    value={searchQuery}
                                    onChangeText={handleSearch}
                                />
                                {searching && <ActivityIndicator size="small" color="#12100E" />}
                            </View>

                            {searchResults.length > 0 && (
                                <View className="mb-8">
                                    <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                                      <Text className="text-ink-3 font-semibold uppercase text-label">Search Results</Text>
                                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                                    </View>
                                    {searchResults.map((u: any) => (
                                        <View key={u._id} className="bg-card p-4 rounded-card border border-line mb-2 flex-row items-center">
                                            <Image source={{ uri: u.avatar || 'https://via.placeholder.com/150' }} className="w-10 h-10 rounded-full" />
                                            <Text className="flex-1 ml-3 text-ink font-semibold">{u.username}</Text>
                                            <TouchableOpacity 
                                                onPress={() => handleInvite(u._id)}
                                                className="bg-ink px-2.5 py-1 rounded-full"
                                            >
                                                <Text className="text-white font-semibold text-label uppercase">Invite</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text className="text-ink-3 font-semibold uppercase text-label mb-4">Pending Invitations ({club.invitations?.length || 0})</Text>
                            {club.invitations?.map((inv: any) => (
                                <View key={inv._id} className="bg-card p-4 rounded-card border border-line mb-3 flex-row items-center opacity-60">
                                    <Image source={{ uri: inv.avatar || 'https://via.placeholder.com/150' }} className="w-12 h-12 rounded-full" />
                                    <View className="flex-1 ml-4">
                                        <Text className="text-ink font-semibold text-sm">{inv.name}</Text>
                                        <Text className="text-ink-3 text-xs">@{inv.username}</Text>
                                    </View>
                                    <View className="bg-paper-2 px-2.5 py-1 rounded-full">
                                        <Text className="text-ink-3 font-display text-label uppercase">Sent</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {activeTab === 'members' && (
                        <View>
                            <Text className="text-ink-3 font-semibold uppercase text-label mb-4">Active Members ({club.members?.length || 0})</Text>
                            {club.members?.map((member: any) => {
                                const isCurrentAdmin = club.admins.some((a: any) => (a._id || a) === member._id);
                                return (
                                    <View key={member._id} className="bg-card p-4 rounded-card border border-line mb-3 flex-row items-center">
                                        <Image source={{ uri: member.avatar || 'https://via.placeholder.com/150' }} className="w-12 h-12 rounded-full" />
                                        <View className="flex-1 ml-4">
                                            <Text className="text-ink font-semibold text-sm">{member.name}</Text>
                                            <Text className="text-ink-3 text-xs">@{member.username}</Text>
                                        </View>
                                        {isCurrentAdmin ? (
                                            <View className="flex-row items-center gap-2">
                                                <View className="bg-paper-2 px-2.5 py-1 rounded-full">
                                                    <Text className="text-ink-3 font-display text-label uppercase">Admin</Text>
                                                </View>
                                                {/* Super Admin (Creator) Demotion Logic */}
                                                {(club.creator?._id === user?._id || club.creator === user?._id) && member._id !== user?._id && (
                                                    <TouchableOpacity 
                                                        onPress={() => handleToggleAdmin(member._id, true)} 
                                                        className="bg-danger/10 border border-danger/20 px-2.5 py-1 rounded-full"
                                                    >
                                                        <Text className="text-danger font-display text-label uppercase">Revoke</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ) : (
                                            <TouchableOpacity onPress={() => handleToggleAdmin(member._id, false)} className="bg-fam-career px-2.5 py-1 rounded-full">
                                                <Text className="text-white font-display text-label uppercase">Promote</Text>
                                            </TouchableOpacity>
                                        )}
                                        {!isCurrentAdmin && (
                                            <TouchableOpacity 
                                                onPress={() => handleRemoveMember(member._id)}
                                                className="ml-2 w-8 h-8 bg-danger/10 rounded-lg items-center justify-center border border-danger/15"
                                            >
                                                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {activeTab === 'settings' && (
                        <View>
                            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                              <Text className="text-ink-3 font-semibold uppercase text-label">Lobby & Privacy</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <View className="bg-card p-6 rounded-sheet border border-line mb-6 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-ink font-display text-2xl">{club.joinCode || '000000'}</Text>
                                    <Text className="text-ink-3 text-label font-semibold uppercase mt-1">Unique Lobby Code</Text>
                                </View>
                                <View className="flex-row gap-3">
                                    <TouchableOpacity 
                                        onPress={copyJoinCode}
                                        className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center border border-line"
                                     hitSlop={2}>
                                        <Feather name="copy" size={16} color="black" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="bg-card p-6 rounded-sheet border border-line mb-10 flex-row items-center justify-between">
                                <View className="flex-1 mr-4">
                                    <Text className="font-semibold text-base text-ink">Enable Code Entry</Text>
                                    <Text className="text-ink-3 text-label font-semibold uppercase mt-1">Allow students to discover club via code</Text>
                                </View>
                                <Switch 
                                    value={isJoinCodeEnabled}
                                    onValueChange={setIsJoinCodeEnabled}
                                    trackColor={{ false: "#E3DDD3", true: "#047857" }}
                                    thumbColor="white"
                                />
                            </View>

                            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                              <Text className="text-ink-3 font-semibold uppercase text-label">Edit Club Profile</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <View className="bg-card p-6 rounded-sheet border border-line mb-10">
                                <View className="flex-row mb-8">
                                    <TouchableOpacity onPress={() => pickImage('logo')} className="relative">
                                        <Image source={{ uri: newLogo?.uri || club.logo || 'https://via.placeholder.com/150' }} className="w-16 h-16 rounded-card bg-paper-2 border border-line" />
                                        <View className="absolute -bottom-1 -right-1 bg-ink w-6 h-6 rounded-full items-center justify-center border-2 border-white">
                                            <Feather name="camera" size={10} color="white" />
                                        </View>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 ml-4 relative">
                                        <Image source={{ uri: newBanner?.uri || club.banner || 'https://via.placeholder.com/150' }} className="w-full h-16 rounded-card bg-paper-2 border border-line" />
                                        <View className="absolute -bottom-1 -right-1 bg-ink w-6 h-6 rounded-full items-center justify-center border-2 border-white">
                                            <Feather name="image" size={10} color="white" />
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <TextInput 
                                    placeholder="Club Name"
                                    className="bg-card p-4 mb-4 font-semibold border-[1.5px] border-ink rounded-md"
                                    value={editName}
                                    onChangeText={setEditName}
                                />
                                <TextInput 
                                    placeholder="Category"
                                    className="bg-card p-4 mb-4 font-semibold border-[1.5px] border-ink rounded-md"
                                    value={editCategory}
                                    onChangeText={setEditCategory}
                                />
                                <TextInput 
                                    placeholder="Mission Statement"
                                    className="bg-card p-4 mb-6 font-semibold border-[1.5px] border-ink rounded-md"
                                    value={editDesc}
                                    onChangeText={setEditDesc}
                                    multiline
                                />
                                <TouchableOpacity 
                                    onPress={handleUpdateClub}
                                    disabled={updating}
                                    className="bg-ink py-4 items-center border-2 border-ink rounded-md"
                                >
                                    {updating ? <ActivityIndicator color="white" /> : (
                                        <Text className="text-white font-display uppercase text-xs">Synchronize Profile</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                              <Text className="text-ink-3 font-semibold uppercase text-label">Room Management</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            {club.subGroups?.map((sub: any) => (
                                <View key={sub._id} className="bg-card p-4 rounded-card border border-line mb-3 flex-row items-center">
                                    <Image source={{ uri: sub.logo || 'https://via.placeholder.com/150' }} className="w-10 h-10 rounded-xl bg-paper-2" />
                                    <View className="flex-1 ml-4">
                                        <Text className="text-ink font-semibold text-sm">{sub.name}</Text>
                                        <Text className="text-ink-3 text-label font-semibold uppercase">{sub.members?.length || 0} Members</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => navigation.navigate('EditSubGroup', { subGroupId: sub._id })}
                                        className="w-8 h-8 bg-paper-2 rounded-lg items-center justify-center border border-line"
                                    >
                                        <Feather name="edit-3" size={14} color="#57534E" />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* Danger Zone */}
                            <View className="mt-12 bg-danger/10 p-6 rounded-sheet border border-danger/15 mb-5">
                                <View className="flex-row items-center mb-2">
                                    <Ionicons name="warning-outline" size={16} color="#DC2626" />
                                    <Text className="text-danger font-display text-label uppercase ml-2">Danger Zone</Text>
                                </View>
                                <Text className="text-danger text-label font-semibold uppercase mb-5">
                                    Once you delete a club, there is no going back. Please be certain.
                                </Text>
                                <TouchableOpacity 
                                    onPress={handleDeleteClub}
                                    disabled={updating}
                                    className="bg-danger py-4 rounded-card items-center shadow-hair"
                                >
                                    {updating ? <ActivityIndicator color="white" /> : (
                                        <Text className="text-white font-display uppercase text-label">Terminate Club Group</Text>
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
