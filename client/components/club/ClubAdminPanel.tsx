import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StatusBar, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Empty, Meta, Button, Card, Divider, ListRow, SectionHeader, SearchField, FormField, IconBtn, Tag, Tabs } from '../ui/kit';
import { MemberRow, DecideButtons, ImagePick, RoomIcon } from '../community/shared';

type TabKey = 'requests' | 'recruit' | 'members' | 'settings';
const TAB_LABEL: Record<TabKey, string> = { requests: 'Requests', recruit: 'Invite', members: 'Members', settings: 'Settings' };
const TAB_KEY = Object.fromEntries(Object.entries(TAB_LABEL).map(([k, v]) => [v, k])) as Record<string, TabKey>;
const TAB_LABELS = Object.values(TAB_LABEL);

const ClubAdminPanel = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { clubId } = route.params ?? {};
    const { user } = useAuth();
    
    const [club, setClub] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('requests');
    
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
    // One action in flight at a time, so a double tap cannot POST twice.
    const [actingId, setActingId] = useState<string | null>(null);
    const latestQuery = useRef('');

    const fetchClubDetails = async () => {
        try {
            const res = await axios.get(`/clubs/${clubId}`);
            if (res.data.success) {
                const c = res.data.club;
                setClub(c);
                setEditName(c.name || '');
                setEditDesc(c.description || '');
                setEditCategory(c.category || '');
                setIsJoinCodeEnabled(c.isJoinCodeEnabled ?? true);
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
        latestQuery.current = query;
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await axios.get('/clubs/search-users', { params: { query } });
            if (query !== latestQuery.current) return;
            if (res.data.success) {
                setSearchResults(res.data.users || []);
            }
        } catch (error) {
            console.log("Search error", error);
        } finally {
            setSearching(false);
        }
    };

    const handleInvite = async (targetUserId: string) => {
        if (actingId) return;
        setActingId(targetUserId);
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
        } finally {
            setActingId(null);
        }
    };

    const handleRequestAction = async (userId: string, action: 'approve' | 'reject') => {
        if (actingId) return;
        setActingId(userId);
        try {
            const res = await axios.post('/clubs/handle-request', { clubId, userId, action, adminId: user?._id });
            if (res.data.success) {
                Alert.alert("Handled", `Member request ${action}ed.`);
                fetchClubDetails();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Action failed");
        } finally {
            setActingId(null);
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

    if (loading) return (
        <View className="flex-1 bg-paper">
            <AppBar title="Manage club" onBack={() => navigation.goBack()} />
            <View className="flex-1 justify-center items-center"><ActivityIndicator color={C.brand[500]} /></View>
        </View>
    );

    if (!club) {
        return (
            <View className="flex-1 bg-paper">
                <AppBar title="Manage club" onBack={() => navigation.goBack()} />
                <Empty
                    icon="cloud-offline-outline"
                    title="Could not load club"
                    action={<Button title="Try again" onPress={() => { setLoading(true); fetchClubDetails(); }} />}
                />
            </View>
        );
    }

    const isCreator = club.creator?._id === user?._id || club.creator === user?._id;
    const cardPad = { paddingHorizontal: 16, paddingVertical: 4 };
    const rows = (list: any[] | undefined, render: (x: any) => React.ReactNode) => (
        <Card style={cardPad}>
            {(list ?? []).map((x: any, i: number) => (
                <View key={x._id}>
                    {i > 0 ? <Divider /> : null}
                    {render(x)}
                </View>
            ))}
        </Card>
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <AppBar title="Manage club" onBack={() => navigation.goBack()} />
            <Meta style={{ paddingHorizontal: 20, paddingBottom: 4 }} numberOfLines={1}>{club.name}</Meta>
            <Tabs fill items={TAB_LABELS} value={TAB_LABEL[activeTab]} onChange={(l) => setActiveTab(TAB_KEY[l])} />

            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
                {activeTab === 'requests' && (
                    <View>
                        <SectionHeader title="Join requests" count={club.joinRequests?.length || 0} />
                        {club.joinRequests?.length ? rows(club.joinRequests, (req) => (
                            <MemberRow
                                person={req}
                                right={<DecideButtons name={req.name} disabled={!!actingId} onApprove={() => handleRequestAction(req._id, 'approve')} onReject={() => handleRequestAction(req._id, 'reject')} />}
                            />
                        )) : (
                            <Empty icon="mail-open-outline" title="No pending requests" />
                        )}
                    </View>
                )}

                {activeTab === 'recruit' && (
                    <View>
                        <SectionHeader title="Invite members" />
                        <SearchField
                            placeholder="Search by username"
                            value={searchQuery}
                            onChangeText={handleSearch}
                            onClear={() => handleSearch('')}
                        />
                        {searching ? <ActivityIndicator size="small" color={C.ink} style={{ marginTop: 12 }} /> : null}

                        {searchResults.length > 0 && (
                            <>
                                <SectionHeader title="Results" />
                                {rows(searchResults, (u) => (
                                    <MemberRow
                                        person={u}
                                        size={40}
                                        right={<Button small variant="primary" title="Invite" disabled={!!actingId} onPress={() => handleInvite(u._id)} />}
                                    />
                                ))}
                            </>
                        )}

                        <SectionHeader title="Pending invites" count={club.invitations?.length || 0} />
                        {club.invitations?.length ? rows(club.invitations, (inv) => (
                            <MemberRow person={inv} dim right={<Tag label="Sent" />} />
                        )) : null}
                    </View>
                )}

                {activeTab === 'members' && (
                    <View>
                        <SectionHeader title="Members" count={club.members?.length || 0} />
                        {rows(club.members, (member) => {
                            const isCurrentAdmin = (club.admins ?? []).some((a: any) => (a._id || a) === member._id);
                            return (
                                <MemberRow
                                    person={member}
                                    right={
                                        <View className="flex-row items-center" style={{ gap: 4 }}>
                                            {isCurrentAdmin ? (
                                                <>
                                                    <Tag icon="shield-checkmark-outline" label="Admin" />
                                                    {/* Only the creator can demote an admin. */}
                                                    {isCreator && member._id !== user?._id && (
                                                        <Button small variant="tertiary" title="Revoke" onPress={() => handleToggleAdmin(member._id, true)} />
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Button small title="Promote" onPress={() => handleToggleAdmin(member._id, false)} />
                                                    <IconBtn name="trash-outline" size={18} color={C.danger} onPress={() => handleRemoveMember(member._id)} accessibilityLabel={`Remove ${member.name}`} />
                                                </>
                                            )}
                                        </View>
                                    }
                                />
                            );
                        })}
                    </View>
                )}

                {activeTab === 'settings' && (
                    <View>
                        <SectionHeader title="Join code" />
                        <Card style={cardPad}>
                            <ListRow
                                title={club.joinCode || '000000'}
                                subtitle="Share this code to let people join"
                                right={<IconBtn name="copy-outline" boxed onPress={copyJoinCode} accessibilityLabel="Copy join code" />}
                            />
                            <Divider />
                            <ListRow
                                title="Allow joining by code"
                                subtitle="Students can find the club with the code"
                                subtitleLines={2}
                                right={
                                    <Switch
                                        value={isJoinCodeEnabled}
                                        onValueChange={setIsJoinCodeEnabled}
                                        trackColor={{ false: C.line, true: C.brand[500] }}
                                        thumbColor="white"
                                        accessibilityLabel="Allow joining by code"
                                    />
                                }
                            />
                        </Card>

                        <SectionHeader title="Club profile" />
                        <Card padded style={{ gap: 16 }}>
                            <View className="flex-row" style={{ gap: 12 }}>
                                <ImagePick uri={newLogo?.uri || club.logo} onPress={() => pickImage('logo')} label="Logo" icon="camera-outline" style={{ width: 72, height: 72 }} />
                                <ImagePick uri={newBanner?.uri || club.banner} onPress={() => pickImage('banner')} label="Banner" style={{ flex: 1, height: 72 }} />
                            </View>
                            <FormField label="Club name" placeholder="Club name" value={editName} onChangeText={setEditName} />
                            <FormField label="Category" placeholder="Category" value={editCategory} onChangeText={setEditCategory} />
                            <FormField label="About" placeholder="Describe the club" value={editDesc} onChangeText={setEditDesc} multiline />
                            <Button title="Save profile" variant="primary" block loading={updating} onPress={handleUpdateClub} />
                        </Card>

                        <SectionHeader title="Rooms" count={club.subGroups?.length || 0} />
                        {rows(club.subGroups, (sub) => (
                            <ListRow
                                leading={<RoomIcon uri={sub.logo} />}
                                title={sub.name}
                                subtitle={`${sub.members?.length || 0} members`}
                                onPress={() => navigation.navigate('EditSubGroup', { subGroupId: sub._id })}
                                accessibilityLabel={`Edit ${sub.name}`}
                            />
                        ))}

                        <SectionHeader title="Danger zone" />
                        <Card padded style={{ gap: 12 }}>
                            <Text className="text-ink-2" style={{ fontSize: 13, lineHeight: 18 }}>
                                Deleting the club removes all its rooms and messages. This can't be undone.
                            </Text>
                            <Button title="Delete club" variant="danger" icon="trash-outline" block loading={updating} onPress={handleDeleteClub} />
                        </Card>
                    </View>
                )}
                <View className="h-40" />
            </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

export default ClubAdminPanel;
