import React, { useState, useCallback, useRef, memo } from 'react';
import {View, Text, TouchableOpacity, FlatList, TextInput, ActivityIndicator, RefreshControl, StatusBar, Modal, KeyboardAvoidingView, Platform} from 'react-native'
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Button } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';

// Ids may arrive populated ({ _id }) or bare, depending on the endpoint.
const hasId = (arr: any[] | undefined, id?: string) => !!id && !!arr?.some((x: any) => (x?._id || x) === id);

const ClubCard = memo(({ item, isInvitation, onAccept, onPress, userId }: any) => {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => !isInvitation && onPress(item._id)}
            className="bg-card rounded-sheet mb-6 mx-gutter overflow-hidden border border-line shadow-hair"
        >
            <View className="p-6 flex-row items-center">
                <View className="relative">
                    <Image
                        source={item.logo ? { uri: item.logo } : undefined}
                        style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.paper2, borderWidth: 1, borderColor: C.line }}
                        cachePolicy="memory-disk"
                    />
                    {!isInvitation && (
                        <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full border-4 border-card shadow-hair" />
                    )}
                </View>

                <View className="flex-1 ml-6">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-ink text-lg font-display uppercase leading-tight flex-1 mr-2" numberOfLines={1}>
                            {item.name}
                        </Text>
                        <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 text-label font-display uppercase">Active</Text>
                        </View>
                    </View>

                    <Text className="text-ink-3 text-label font-medium leading-4 mb-3" numberOfLines={2}>
                        {isInvitation ? "You've been invited to join this community." : (item.description || "Establish your presence in the conversation...")}
                    </Text>

                    <View className="flex-row items-center gap-2">
                        {isInvitation ? (
                            <TouchableOpacity
                                onPress={() => onAccept(item._id)}
                                className="bg-ink px-2.5 py-1 rounded-full"
                            >
                                <Text className="text-paper text-label font-display uppercase">Accept Intel</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                    <Text className="text-accent-text text-label font-display uppercase">{item.category || 'HQ'}</Text>
                                </View>
                                {hasId(item.admins, userId) && (
                                    <View className="bg-ink px-2.5 py-1 rounded-full">
                                        <Text className="text-paper text-label font-display uppercase">Admin Access</Text>
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

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            
            {/* Background Protocol Gradient */}

            <View className="flex-1">
                <AppBar
                    title="College Clubs"
                    onBack={() => navigation.goBack()}
                    right={<IconBtn name="qr-code-outline" boxed onPress={() => setShowCodeModal(true)} />}
                />
                <FlatList keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={
                        <TouchableOpacity
                            onPress={() => navigation.navigate('CreateClub')}
                            className="mx-gutter my-6 bg-ink p-5 rounded-card flex-row items-center justify-between shadow-hair"
                        >
                            <View className="flex-row items-center">
                                <View className="w-14 h-14 bg-brand-600 rounded-card items-center justify-center">
                                    <Ionicons name="add" size={32} color={C.onBrand} />
                                </View>
                                <View className="ml-6">
                                    <Text className="text-paper font-display uppercase text-xs mb-1">Establish Hub</Text>
                                    <Text className="text-paper/40 text-label font-semibold uppercase italic">New Community Protocol</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={C.paper} opacity={0.3} />
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
                                <View className="px-gutter py-4 mt-4">
                                    <Text className="text-ink-3 font-display uppercase text-label">{item.title}</Text>
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
                    contentContainerStyle={{ paddingBottom: bottomInset }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
                    ListEmptyComponent={loading ? <ActivityIndicator color={C.brand[500]} className="mt-20" /> : loadError ? (
                        <View className="mt-20">
                            <Empty icon="cloud-offline-outline" title="Couldn't load clubs" action={<Button title="Try again" onPress={() => { setLoading(true); fetchClubs(); }} />} />
                        </View>
                    ) : (
                        <View className="items-center mt-32 px-gutter">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                <MaterialCommunityIcons name="shield-lock-outline" size={48} color={C.ink4} />
                            </View>
                            <Text className="font-semibold text-base text-ink text-center">Hub Empty</Text>
                            <Text className="font-sans text-sm text-ink-4 mt-2 text-center">
                                Your authorization space is empty.{"\n"}Establish a hub or wait for a clearance signal.
                            </Text>
                        </View>
                    )}
                />

                {/* Join Code Modal */}
                <Modal visible={showCodeModal} transparent animationType="slide" onRequestClose={() => setShowCodeModal(false)}>
                    <KeyboardAvoidingView className="flex-1 bg-black/50 justify-end" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View className="bg-paper rounded-t-sheet p-card-pad border border-line">
                            <View className="flex-row justify-between items-center mb-10">
                                <Text className="text-ink font-display uppercase text-h1">Enter Code</Text>
                                <TouchableOpacity
                                    onPress={() => setShowCodeModal(false)}
                                    className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line"
                                >
                                    <Ionicons name="close" size={24} color={C.ink} />
                                </TouchableOpacity>
                            </View>

                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-8 self-center">
                                <Feather name="hash" size={32} color={C.ink} />
                            </View>

                            <Text className="font-sans text-sm text-ink-2 text-center mb-8">
                                Input the 6-digit access code shared by HQ to authorise your deployment.
                            </Text>

                            <TextInput
                                placeholder="000000"
                                placeholderTextColor={C.ink4}
                                className="bg-card w-full p-card-pad rounded-card text-center text-4xl font-display text-ink border-2 border-ink"
                                style={{ letterSpacing: 12, shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 }}
                                keyboardType="number-pad"
                                maxLength={6}
                                value={joinCode}
                                onChangeText={setJoinCode}
                                autoFocus
                            />

                            <TouchableOpacity
                                onPress={handleJoinByCode}
                                disabled={verifying || joinCode.length !== 6}
                                className={`mt-10 w-full py-5 rounded-card items-center border-2 border-ink ${joinCode.length === 6 ? 'bg-brand-500' : 'bg-paper-2'}`}
                            >
                                {verifying ? <ActivityIndicator color={joinCode.length === 6 ? C.onBrand : C.ink} /> : (
                                    <Text className={`font-display uppercase ${joinCode.length === 6 ? 'text-on-brand' : 'text-ink-4'}`} style={{ fontSize: 14, letterSpacing: 0.3 }}>
                                        Join Club
                                    </Text>
                                )}
                            </TouchableOpacity>
                            <View className="h-10" />
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </View>
        </View>
    );
};

export default ClubListScreen;
