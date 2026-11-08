import React, { useState, useEffect } from 'react';
import { View, Pressable, Image, ScrollView, ActivityIndicator, StatusBar, KeyboardAvoidingView, Switch, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Empty, Button, Card, Divider, ListRow, SectionHeader, FormField, IconBtn } from '../ui/kit';
import { MemberRow, DecideButtons } from '../community/shared';

const EditSubGroupScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { subGroupId } = route.params ?? {};
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
    // One request decision in flight at a time, so a double tap cannot POST twice.
    const [actingId, setActingId] = useState<string | null>(null);

    const fetchSubGroupDetails = async () => {
        try {
            const res = await axios.get(`/clubs/messages/${subGroupId}`);
            const sg = res.data?.success ? res.data.subGroup : null;
            if (sg) {
                setSubGroup(sg);
                setName(sg.name || '');
                setDescription(sg.description || '');
                setOnlyAdminsCanMessage(!!sg.onlyAdminsCanMessage);

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
                setMembers(res.data.members ?? []);
                setSubAdmins((res.data.admins ?? []).map((a: any) => a._id || a));
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
        if (actingId) return;
        setActingId(targetUserId);
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
        } finally {
            setActingId(null);
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
                                navigation.navigate('ClubHub', { clubId: subGroup?.clubId });
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

    if (loading || !subGroup) return (
        <View className="flex-1 bg-paper">
            <AppBar title="Room settings" onBack={() => navigation.goBack()} />
            {loading ? (
                <View className="flex-1 justify-center items-center"><ActivityIndicator color={C.brand[500]} /></View>
            ) : (
                <Empty
                    icon="cloud-offline-outline"
                    title="Couldn't load this room"
                    action={<Button title="Try again" onPress={() => { setLoading(true); fetchSubGroupDetails(); fetchMembers(); }} />}
                />
            )}
        </View>
    );

    const canPromote = isSuperAdmin || isMainAdmin;
    const cardPad = { paddingHorizontal: 16, paddingVertical: 4 };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <AppBar title="Room settings" onBack={() => navigation.goBack()} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View className="items-center mb-6 mt-2">
                        <Pressable
                            onPress={canEditRoom ? pickLogo : undefined}
                            disabled={!canEditRoom}
                            accessibilityRole="button"
                            accessibilityLabel="Change room logo"
                            className="relative active:opacity-85"
                        >
                            <Image source={logo ? { uri: logo.uri } : subGroup?.logo ? { uri: subGroup.logo } : undefined} className="w-24 h-24 rounded-2xl border border-line bg-paper-2" />
                            {canEditRoom ? (
                                <View className="absolute -bottom-1 -right-1 bg-ink w-8 h-8 rounded-full items-center justify-center border-4 border-paper">
                                    <Feather name="edit-2" size={14} color={C.paper} />
                                </View>
                            ) : null}
                        </Pressable>
                    </View>

                    <View style={{ gap: 16 }}>
                        <FormField
                            label="Room name"
                            placeholder="Room name"
                            value={name}
                            onChangeText={setName}
                            editable={canEditRoom && !subGroup?.isGeneral}
                            hint={subGroup?.isGeneral ? "The General room's name can't be changed." : undefined}
                        />
                        <FormField label="About" placeholder="What happens in this room" multiline value={description} onChangeText={setDescription} editable={canEditRoom} />
                        <Card style={cardPad}>
                            <ListRow
                                title="Announcement mode"
                                subtitle="Only admins can send messages"
                                subtitleLines={2}
                                right={
                                    <Switch
                                        value={onlyAdminsCanMessage}
                                        onValueChange={setOnlyAdminsCanMessage}
                                        trackColor={{ false: C.line, true: C.brand[500] }}
                                        thumbColor="white"
                                        disabled={!canEditRoom}
                                        accessibilityLabel="Announcement mode"
                                    />
                                }
                            />
                        </Card>
                    </View>

                    {(isMainAdmin || isRoomLeader) && joinRequests.length > 0 && (
                        <>
                            <SectionHeader title="Requests" count={joinRequests.length} />
                            <Card style={cardPad}>
                                {joinRequests.map((req: any, i: number) => (
                                    <View key={req._id}>
                                        {i > 0 ? <Divider /> : null}
                                        <MemberRow
                                            person={req}
                                            right={<DecideButtons name={req.name} disabled={!!actingId} onApprove={() => handleRequestAction(req._id, 'approve')} onReject={() => handleRequestAction(req._id, 'reject')} />}
                                        />
                                    </View>
                                ))}
                            </Card>
                        </>
                    )}

                    <SectionHeader title="Members" count={members.length} />
                    {memberLoading ? (
                        <ActivityIndicator color={C.ink} />
                    ) : (
                        <Card style={cardPad}>
                            {members.map((m: any, i: number) => {
                                const isSubAdmin = subAdmins.includes(m._id);
                                const isMainClubAdmin = club?.admins?.some((a: any) => (a._id || a) === m._id);
                                return (
                                    <View key={m._id}>
                                        {i > 0 ? <Divider /> : null}
                                        <MemberRow
                                            person={m}
                                            size={40}
                                            subtitle={isMainClubAdmin ? 'Club admin' : isSubAdmin ? 'Room leader' : undefined}
                                            right={!isMainClubAdmin && (canPromote || canEditRoom) ? (
                                                <View className="flex-row items-center" style={{ gap: 4 }}>
                                                    {canPromote ? (
                                                        <Button small variant={isSubAdmin ? 'tertiary' : 'secondary'} title={isSubAdmin ? 'Remove leader' : 'Make leader'} onPress={() => toggleAdminStatus(m._id)} />
                                                    ) : null}
                                                    {canEditRoom ? (
                                                        <IconBtn name="trash-outline" size={18} color={C.danger} onPress={() => handleRemoveFromRoom(m._id)} accessibilityLabel={`Remove ${m.name} from room`} />
                                                    ) : null}
                                                </View>
                                            ) : undefined}
                                        />
                                    </View>
                                );
                            })}
                        </Card>
                    )}

                    {canEditRoom && (
                        <Button title="Save changes" variant="primary" block loading={updating} onPress={handleUpdate} style={{ marginTop: 24 }} />
                    )}
                    {canDelete && (
                        <Button title="Delete room" variant="danger" icon="trash-outline" block disabled={updating} onPress={handleDeleteRoom} style={{ marginTop: 12 }} />
                    )}
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

export default EditSubGroupScreen;
