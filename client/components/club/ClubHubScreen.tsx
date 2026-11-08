import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StatusBar, Share } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Button, Card, Divider, ListRow, SectionHeader, Tag, IconTile } from '../ui/kit';
import { Pop } from '../ui-extra/usePop';
import { HubBanner, RoomIcon } from '../community/shared';

import FyncRefreshControl from '../ui/FyncRefreshControl';
const ClubHubScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { clubId } = route.params ?? {};
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
            await Share.share({
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
        <View className="flex-1 bg-paper">
            <AppBar title="Club" onBack={() => navigation.goBack()} />
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator color={C.brand[500]} />
            </View>
        </View>
    );

    if (!club) return (
        <View className="flex-1 bg-paper">
            <AppBar title="Club" onBack={() => navigation.goBack()} />
            <Empty
                icon="cloud-offline-outline"
                title="Could not load club"
                action={<Button title="Try again" onPress={() => { setLoading(true); fetchClubDetails(); }} />}
            />
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
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="light-content" />
            <ScrollView keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClubDetails(); }} tintColor={C.brand[500]} />}
            >
                <HubBanner
                    banner={club.banner}
                    logo={club.logo}
                    name={club.name}
                    meta={`${club.members?.length || 0} members${hasAccess ? ' · You\'re a member' : ''}`}
                    onBack={() => navigation.goBack()}
                    right={<>
                        <IconBtn overlay name="share-social-outline" size={18} onPress={onShare} accessibilityLabel="Share club" />
                        {isAdmin && (
                            <IconBtn overlay name="settings-outline" size={18} onPress={() => navigation.navigate('ClubAdminPanel', { clubId })} accessibilityLabel="Club settings" />
                        )}
                        {hasAccess && (
                            <IconBtn overlay name="log-out-outline" size={18} color={C.danger} onPress={handleLeaveClub} accessibilityLabel="Leave club" />
                        )}
                    </>}
                />

                <View className="px-gutter pt-5">
                    <Text className="text-ink-2" style={{ fontSize: 15, lineHeight: 22 }}>
                        {club.description || 'No description yet.'}
                    </Text>
                </View>

                {hasAccess ? (
                    <View className="px-gutter">
                        <SectionHeader
                            title="Rooms"
                            right={isAdmin ? (
                                <Button small title="New room" icon="add" onPress={() => navigation.navigate('CreateSubGroup', { clubId: club._id })} />
                            ) : undefined}
                        />
                        {subGroups.length > 0 ? (
                            <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                                {subGroups.map((sub: any, i: number) => {
                                    // Members may come back populated or as bare ids, as everywhere else here.
                                    const isSubMember = sub.members?.some((m: any) => (m?._id || m) === user?._id);
                                    const isPendingJoin = sub.joinRequests?.some((j: any) => (j._id || j) === user?._id);
                                    return (
                                        <View key={sub._id}>
                                            {i > 0 ? <Divider /> : null}
                                            <ListRow
                                                leading={<RoomIcon uri={sub.isGeneral ? undefined : sub.logo} icon={sub.isGeneral ? 'megaphone-outline' : 'chatbubbles-outline'} />}
                                                title={sub.name}
                                                subtitle={sub.isGeneral ? 'Official channel' : sub.description || 'Room'}
                                                onPress={isSubMember ? () => navigation.navigate('SubGroupChat', { subGroupId: sub._id, subGroupName: sub.name, clubId: club._id }) : undefined}
                                                right={isSubMember ? undefined : (
                                                    <Pop on={!!isPendingJoin}>
                                                        {isPendingJoin ? (
                                                            <Tag label="Pending" />
                                                        ) : (
                                                            <Button small variant="primary" title="Join" loading={joining === sub._id} onPress={() => handleJoinSubGroup(sub._id)} />
                                                        )}
                                                    </Pop>
                                                )}
                                            />
                                        </View>
                                    );
                                })}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon="layers-outline" title="No rooms yet" hint={isAdmin ? 'Create the first room for your members.' : undefined} />
                            </Card>
                        )}
                    </View>
                ) : (
                    <View className="px-gutter mt-6">
                        <Card padded style={{ alignItems: 'center', gap: 8 }}>
                            <IconTile icon="lock-closed-outline" size={56} iconSize={24} />
                            <Text className="text-ink font-semibold text-center mt-2" style={{ fontSize: 17 }}>Members only</Text>
                            <Text className="text-ink-3 text-center mb-4" style={{ fontSize: 13, lineHeight: 18 }}>
                                Join this club to see its rooms and messages.
                            </Text>
                            {isPending ? (
                                <Tag icon="time-outline" label="Request pending" />
                            ) : isInvited ? (
                                <Button block variant="primary" title="Accept invitation" onPress={() => navigation.navigate('ClubList')} />
                            ) : (
                                <Button block variant="primary" title="Request to join" loading={requesting} onPress={handleRequestAccess} />
                            )}
                        </Card>
                    </View>
                )}

                <View className="h-40" />
            </ScrollView>
        </View>
    );
};

export default ClubHubScreen;
