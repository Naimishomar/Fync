import React, { useState, useCallback, useRef, memo } from 'react';
import { View, Text, Pressable, FlatList, TextInput, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Button, Sheet, ListRow, IconTile, SectionHeader, Tag, TagRow } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

// Ids may arrive populated ({ _id }) or bare, depending on the endpoint.
const hasId = (arr: any[] | undefined, id?: string) => !!id && !!arr?.some((x: any) => (x?._id || x) === id);

const ClubCard = memo(({ item, isInvitation, onAccept, onPress, userId }: any) => {
    const isAdmin = hasId(item.admins, userId);
    return (
        <Pressable
            onPress={() => !isInvitation && onPress(item._id)}
            disabled={isInvitation}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            className="bg-card rounded-2xl mb-3 mx-gutter border border-line p-4 flex-row active:opacity-70"
            style={{ gap: 16 }}
        >
            <Image
                source={item.logo ? { uri: item.logo } : undefined}
                style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: C.paper2 }}
                cachePolicy="memory-disk"
            />
            <View className="flex-1" style={{ minWidth: 0, gap: 4 }}>
                <Text className="text-ink font-semibold" style={{ fontSize: 16, lineHeight: 22 }} numberOfLines={1}>{item.name}</Text>
                <Text className="text-ink-3" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                    {isInvitation ? "You've been invited to join this club." : (item.description || 'No description yet.')}
                </Text>
                {isInvitation ? (
                    <View className="flex-row mt-2">
                        <Button small variant="primary" title="Accept invite" onPress={() => onAccept(item._id)} />
                    </View>
                ) : (
                    <TagRow style={{ marginTop: 8 }}>
                        <Tag label={item.category || 'Club'} />
                        {isAdmin ? <Tag icon="shield-checkmark-outline" label="Admin" /> : null}
                    </TagRow>
                )}
            </View>
        </Pressable>
    );
});

const ClubListScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [clubs, setClubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState(false);

    // Join Code State
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    const accepting = useRef(false);
    const bottomInset = useBottomInset();

    const fetchClubs = async () => {
        try {
            const res = await axios.get('/clubs/all', { params: { userId: user?._id } });
            if (res.data?.success) {
                setClubs(res.data.clubs || []);
            }
            setLoadError(false);
        } catch (error) {
            console.log("Error fetching clubs", error);
            setLoadError(true);
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
        if (accepting.current) return;
        accepting.current = true;
        try {
            const res = await axios.post('/clubs/accept-invitation', { clubId, userId: user?._id });
            if (res.data.success) {
                Alert.alert("Welcome!", "You are now a member of this club.");
                fetchClubs();
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Action failed");
        } finally {
            accepting.current = false;
        }
    };

    const myClubs = clubs.filter(c => hasId(c.members, user?._id) || hasId(c.admins, user?._id));
    const invitations = clubs.filter(c => hasId(c.invitations, user?._id));

    const data = [
        ...(invitations.length > 0 ? [{ type: 'header', title: 'Invitations' }] : []),
        ...invitations.map(i => ({ ...i, isInvitation: true })),
        ...(myClubs.length > 0 ? [{ type: 'header', title: 'Your clubs' }] : []),
        ...myClubs
    ];
    const openClub = useCallback((id: string) => navigation.navigate('ClubHub', { clubId: id }), [navigation]);
    const renderItem = ({ item }: any) => item.type === 'header'
        ? <SectionHeader title={item.title} style={{ paddingHorizontal: 20, marginTop: 16 }} />
        : <ClubCard item={item} isInvitation={item.isInvitation} onAccept={handleAcceptInvitation} onPress={openClub} userId={user?._id} />;

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <AppBar
                title="Clubs"
                onBack={() => navigation.goBack()}
                right={<IconBtn name="keypad-outline" boxed onPress={() => setShowCodeModal(true)} accessibilityLabel="Join with code" />}
            />
            <FlatList keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                    <View className="px-gutter pt-2">
                        <ListRow
                            leading={<IconTile icon="add" bg={C.brand[500]} color={C.onBrand} size={44} />}
                            title="Create a club"
                            subtitle="Start a space for your people"
                            onPress={() => navigation.navigate('CreateClub')}
                            style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingVertical: 12 }}
                        />
                    </View>
                }
                data={data}
                keyExtractor={(item: any) => item._id || item.title}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: bottomInset }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
                ListEmptyComponent={loading ? <ActivityIndicator color={C.brand[500]} className="mt-20" /> : loadError ? (
                    <View className="mt-20">
                        <Empty icon="cloud-offline-outline" title="Couldn't load clubs" action={<Button title="Try again" onPress={() => { setLoading(true); fetchClubs(); }} />} />
                    </View>
                ) : (
                    <View className="mt-16">
                        <Empty icon="people-outline" title="No clubs yet" hint="Create one, or join with a code from a club admin." />
                    </View>
                )}
            />

            <Sheet
                visible={showCodeModal}
                onClose={() => setShowCodeModal(false)}
                title="Join with code"
                subtitle="Enter the 6-digit code a club admin shared with you."
                footer={<Button title="Join club" variant="primary" block loading={verifying} disabled={joinCode.length !== 6} onPress={handleJoinByCode} />}
            >
                <TextInput
                    placeholder="000000"
                    placeholderTextColor={C.ink4}
                    className="bg-paper-2 rounded-2xl text-center font-display text-ink"
                    style={{ fontSize: 32, letterSpacing: 12, minHeight: 64, paddingVertical: 12 }}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    accessibilityLabel="Club code"
                    autoFocus
                />
            </Sheet>
        </View>
    );
};

export default ClubListScreen;
