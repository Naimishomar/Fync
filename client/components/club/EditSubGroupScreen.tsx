import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, TextInput, Image, ScrollView, 
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';

const EditSubGroupScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { subGroupId } = route.params;
    const { user } = useAuth();
    
    const [subGroup, setSubGroup] = useState<any>(null);
    const [club, setClub] = useState<any>(null);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [onlyAdminsCanMessage, setOnlyAdminsCanMessage] = useState(false);
    const [logo, setLogo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const [members, setMembers] = useState<any[]>([]);
    const [joinRequests, setJoinRequests] = useState<any[]>([]);
    const [subAdmins, setSubAdmins] = useState<string[]>([]);
    const [memberLoading, setMemberLoading] = useState(false);

    const fetchSubGroupDetails = async () => {
        try {
            const res = await axios.get(`/clubs/messages/${subGroupId}`);
            if (res.data.success) {
                const sg = res.data.subGroup;
                setSubGroup(sg);
                setName(sg.name);
                setDescription(sg.description);
                setOnlyAdminsCanMessage(sg.onlyAdminsCanMessage);

                // Fetch Club for admin check
                const clubRes = await axios.get(`/clubs/${sg.clubId}`);
                if (clubRes.data.success) setClub(clubRes.data.club);
            }
        } catch (error) {
            console.log("Fetch Error", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        setMemberLoading(true);
        try {
            const res = await axios.get(`/clubs/subgroup/members/${subGroupId}`);
            if (res.data.success) {
                setMembers(res.data.members);
                setSubAdmins(res.data.admins.map((a: any) => a._id || a));
                if (res.data.joinRequests) setJoinRequests(res.data.joinRequests);
            }
        } catch (error) {
            console.log("Member fetch error", error);
        } finally {
            setMemberLoading(false);
        }
    };

    useEffect(() => {
        fetchSubGroupDetails();
        fetchMembers();
    }, [subGroupId]);

    const toggleAdminStatus = async (targetUserId: string) => {
        try {
            const res = await axios.post('/clubs/subgroup/toggle-admin', {
                subGroupId,
                targetUserId,
                adminId: user?._id
            });
            if (res.data.success) {
                Alert.alert("Success", res.data.message);
                fetchMembers();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Action failed");
        }
    };

    const pickLogo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setLogo(result.assets[0]);
        }
    };

    const handleUpdate = async () => {
        if (!name.trim()) {
            Alert.alert("Required", "Room name is mandatory");
            return;
        }

        setUpdating(true);
        try {
            const formData = new FormData();
            formData.append('subGroupId', subGroupId);
            formData.append('name', name);
            formData.append('description', description);
            formData.append('onlyAdminsCanMessage', onlyAdminsCanMessage.toString());
            formData.append('adminId', user?._id);

            if (logo) {
                const uriParts = logo.uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('logo', {
                    uri: logo.uri,
                    name: `logo.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            }

            const res = await axios.post('/clubs/subgroup/update', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                Alert.alert("Synchronized", "Room identity updated!");
                navigation.goBack();
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Update error");
        } finally {
            setUpdating(false);
        }
    };

    const handleRemoveFromRoom = async (targetUserId: string) => {
        Alert.alert(
            "Remove from Room?",
            "This user will lose access to this specific room and its history.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            const res = await axios.post('/clubs/subgroup/remove-member', {
                                subGroupId,
                                targetUserId,
                                adminId: user?._id
                            });
                            if (res.data.success) {
                                Alert.alert("Success", "User ejected from room.");
                                fetchMembers();
                            }
                        } catch (error: any) {
                            Alert.alert("Failed", error.response?.data?.message || "Something went wrong");
                        }
                    } 
                }
            ]
        );
    };

    const handleRequestAction = async (targetUserId: string, action: 'approve' | 'reject') => {
        try {
            const res = await axios.post('/clubs/subgroup/handle-request', {
                subGroupId,
                userId: targetUserId,
                action,
                adminId: user?._id
            });
            if (res.data.success) {
                fetchMembers(); // refresh
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Action failed");
        }
    };

    const handleDeleteRoom = async () => {
        Alert.alert(
            "Delete Room",
            "Are you sure you want to permanently delete this room? All messages and media will be erased. This action is irreversible.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete Forever", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            setUpdating(true);
                            const res = await axios.post('/clubs/subgroup/delete', {
                                subGroupId,
                                adminId: user?._id
                            });
                            if (res.data.success) {
                                Alert.alert("Deleted", "Room has been purged.");
                                navigation.navigate('ClubHub', { clubId: subGroup.clubId });
                            }
                        } catch (error: any) {
                            Alert.alert("Delete Failed", error.response?.data?.message || "Something went wrong");
                        } finally {
                            setUpdating(false);
                        }
                    } 
                }
            ]
        );
    };

    const isMainAdmin = club?.admins?.some((a: any) => (a._id || a) === user?._id);
    const isRoomLeader = subAdmins.includes(user?._id);
    const isSuperAdmin = club?.creator?._id === user?._id || club?.creator === user?._id;
    const canEditRoom = isMainAdmin || isRoomLeader || isSuperAdmin;
    const canDelete = canEditRoom && !subGroup?.isGeneral;

    if (loading) return <View className="flex-1 bg-white justify-center items-center"><ActivityIndicator color="#000" /></View>;

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 py-4 flex-row items-center justify-between border-b border-slate-100">
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={28} color="black" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-slate-900 text-lg font-black uppercase tracking-widest">Room Control</Text>
                        <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wide mt-0.5">Refining your community</Text>
                    </View>
                    <View className="w-8" />
                </View>

                <KeyboardAvoidingView behavior="padding" className="flex-1">
                    <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
                        
                        {/* Logo Picker */}
                        <View className="items-center mb-8 mt-4">
                            <TouchableOpacity onPress={canEditRoom ? pickLogo : undefined} activeOpacity={0.8} className="relative">
                                {logo ? (
                                    <Image source={{ uri: logo.uri }} className="w-24 h-24 rounded-4xl border-2 border-slate-100 bg-slate-50" />
                                ) : (
                                    <Image source={{ uri: subGroup?.logo || 'https://via.placeholder.com/150' }} className="w-24 h-24 rounded-4xl border-2 border-slate-100 bg-slate-50" />
                                )}
                                <View className="absolute -bottom-1 -right-1 bg-slate-900 w-8 h-8 rounded-full items-center justify-center border-4 border-white">
                                    <Feather name="edit-2" size={14} color="white" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <View className="mt-2">
                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-2 ml-1">Room Identity</Text>
                            <TextInput 
                                placeholder="New Room Name"
                                className={`bg-slate-50 p-5 rounded-2xl mb-4 font-bold border border-slate-100 ${subGroup?.isGeneral ? 'text-slate-500' : 'text-slate-900'}`}
                                value={name}
                                onChangeText={setName}
                                editable={canEditRoom && !subGroup?.isGeneral}
                            />
                            {subGroup?.isGeneral && (
                                <Text className="text-emerald-600 font-bold text-2xs uppercase tracking-wide mb-6 ml-1">
                                    * The 'General' Room hub name is fixed
                                </Text>
                            )}
                            
                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-2 ml-1">Scope & Mission</Text>
                            <TextInput 
                                placeholder="Refined scope..."
                                className="bg-slate-50 p-5 rounded-2xl mb-8 font-semibold border border-slate-100 text-slate-900"
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                            />

                            <View className="mb-10 bg-slate-50 p-6 rounded-3xl border border-slate-100 flex-row items-center justify-between">
                                <View className="flex-1 mr-4">
                                    <Text className="text-slate-900 font-black text-xs uppercase tracking-wide">Announcement Mode</Text>
                                    <Text className="text-slate-500 text-2xs font-bold uppercase tracking-wider mt-1">
                                        Only admins can send messages
                                    </Text>
                                </View>
                                <Switch 
                                    value={onlyAdminsCanMessage}
                                    onValueChange={setOnlyAdminsCanMessage}
                                    trackColor={{ false: "#e4e4e7", true: "#3b82f6" }}
                                    thumbColor="white"
                                    disabled={!canEditRoom}
                                />
                            </View>

                            {/* Pending Approvals Section */}
                            {(isMainAdmin || isRoomLeader) && joinRequests.length > 0 && (
                                <View className="mb-8">
                                    <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-4 ml-1">Pending Approvals ({joinRequests.length})</Text>
                                    <View className="bg-orange-50/50 rounded-3xl border border-orange-100 overflow-hidden p-2">
                                        {joinRequests.map((req: any) => (
                                            <View key={req._id} className="flex-row items-center justify-between p-3 bg-white rounded-2xl mb-2 border border-orange-50 shadow-sm shadow-orange-100/20">
                                                <View className="flex-row items-center">
                                                    <Image source={{ uri: req.avatar || 'https://via.placeholder.com/150' }} className="w-10 h-10 rounded-full" />
                                                    <View className="ml-3">
                                                        <Text className="text-slate-900 font-bold text-sm">{req.name}</Text>
                                                        <Text className="text-slate-500 font-bold text-2xs">@{req.username}</Text>
                                                    </View>
                                                </View>
                                                <View className="flex-row items-center gap-2">
                                                    <TouchableOpacity onPress={() => handleRequestAction(req._id, 'approve')} className="w-10 h-10 rounded-xl bg-emerald-500 items-center justify-center">
                                                        <Feather name="check" size={18} color="white" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleRequestAction(req._id, 'reject')} className="w-10 h-10 rounded-xl bg-red-100 items-center justify-center border border-red-200">
                                                        <Feather name="x" size={18} color="#ef4444" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Member Management Section */}
                            <View className="mb-10">
                                <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-4 ml-1">Room Members ({members.length})</Text>
                                {memberLoading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <View className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                                        {members.map((m: any) => {
                                            const isSubAdmin = subAdmins.includes(m._id);
                                            const isMainClubAdmin = club?.admins?.some((a: any) => (a._id || a) === m._id);
                                            const canPromote = isSuperAdmin || isMainAdmin;

                                            return (
                                                <View key={m._id} className="flex-row items-center justify-between p-4 border-b border-slate-100">
                                                    <View className="flex-row items-center">
                                                        <Image source={{ uri: m.avatar || 'https://via.placeholder.com/150' }} className="w-8 h-8 rounded-full" />
                                                        <View className="ml-3">
                                                            <Text className="text-slate-900 font-bold text-xs">{m.name}</Text>
                                                            {isMainClubAdmin && <Text className="text-blue-500 font-bold text-2xs uppercase tracking-tighter">Main Club Admin</Text>}
                                                        </View>
                                                    </View>
                                                    
                                                    {canPromote && !isMainClubAdmin && (
                                                        <TouchableOpacity 
                                                            onPress={() => toggleAdminStatus(m._id)}
                                                            className={`px-4 py-1.5 rounded-full ${isSubAdmin ? 'bg-red-50' : 'bg-blue-50'}`}
                                                        >
                                                            <Text className={`font-black text-2xs uppercase ${isSubAdmin ? 'text-red-500' : 'text-blue-600'}`}>
                                                                {isSubAdmin ? 'Revoke Leader' : 'Make Leader'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    )}

                                                    {canEditRoom && !isMainClubAdmin && (
                                                        <TouchableOpacity 
                                                            onPress={() => handleRemoveFromRoom(m._id)}
                                                            className="ml-2 w-8 h-8 bg-red-50 rounded-lg items-center justify-center border border-red-100"
                                                        >
                                                            <Ionicons name="trash-outline" size={12} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        </View>

                        {canEditRoom && (
                            <TouchableOpacity 
                                onPress={handleUpdate}
                                disabled={updating}
                                className="bg-black py-5 rounded-3xl items-center shadow-xl shadow-black/20"
                            >
                                {updating ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-black uppercase tracking-wide text-xs">Synchronize Room</Text>
                                )}
                            </TouchableOpacity>
                        )}

                        {canDelete && (
                            <TouchableOpacity 
                                onPress={handleDeleteRoom}
                                disabled={updating}
                                className="mt-4 border border-red-500/30 py-4 rounded-2xl flex-row items-center justify-center bg-red-50/50"
                            >
                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                <Text className="text-red-500 font-bold uppercase tracking-wide text-2xs ml-2">Delete Room Permanently</Text>
                            </TouchableOpacity>
                        )}
                        
                        <View className="h-20" />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default EditSubGroupScreen;
