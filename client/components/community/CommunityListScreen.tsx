import React, { useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, FlatList, StatusBar, Animated } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Button, Tag, Empty, SegmentedTabs, SearchField } from '../ui/kit';
import { Pop } from '../ui-extra/usePop';
import { FALLBACK_BANNER } from './shared';
import { useBottomInset } from '../../constants/layout';

import FyncRefreshControl from '../ui/FyncRefreshControl';
// Defined at module level: declared inside the screen it was a new component type
// on every keystroke in search, remounting (and restarting) every pulse.
const CommunitySkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    React.useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    return (
        <Animated.View style={{ opacity: pulseAnim }} className="mx-gutter mb-3 bg-card rounded-2xl border border-line h-72" />
    );
};

const CommunityItem = React.memo(({ item, userId, handleJoin, onOpen }: any) => {
    const isMember = item.members?.includes(userId);
    const isCreator = item.creator?._id === userId;
    const isSuspended = item.subscription?.status === 'suspended';

    return (
        <Pressable
            onPress={() => onOpen(item._id)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            className={`mx-gutter mb-3 bg-card rounded-2xl overflow-hidden border border-line active:opacity-85 ${isSuspended ? 'opacity-50' : ''}`}
        >
            <View className="h-40 w-full">
                <Image
                    source={{ uri: item.banner || FALLBACK_BANNER }}
                    style={{ width: '100%', height: '100%', backgroundColor: C.paper2 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} className="absolute inset-0" />
                {isSuspended && (
                    <View className="absolute top-3 right-3 bg-danger px-3 py-1 rounded-full">
                        <Text className="text-paper font-semibold" style={{ fontSize: 12 }}>Suspended</Text>
                    </View>
                )}
                <View className="absolute bottom-3 left-4 right-4 flex-row items-center" style={{ gap: 12 }}>
                    <View className="w-12 h-12 rounded-xl overflow-hidden bg-paper-2" style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}>
                        <Image source={{ uri: item.logo }} style={{ width: '100%', height: '100%' }} cachePolicy="memory-disk" />
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                        <Text className="text-white font-semibold text-lg" numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>By {item.creator?.username || item.creator?.name}</Text>
                    </View>
                </View>
            </View>

            <View className="p-4">
                <Text className="text-ink-2 mb-3" style={{ fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                    {item.description || 'No description yet.'}
                </Text>
                <View className="flex-row justify-between items-center">
                    <Tag icon="people-outline" label={`${item.members?.length || 0} members`} />
                    {isCreator ? (
                        <Tag icon="shield-checkmark-outline" label="Owner" />
                    ) : (
                        <Pop on={!!isMember}>
                            {isMember ? (
                                <Tag icon="checkmark" label="Joined" />
                            ) : (
                                <Button small variant="primary" title="Join" onPress={() => handleJoin(item._id)} />
                            )}
                        </Pop>
                    )}
                </View>
            </View>
        </Pressable>
    );
});

const FILTERS = ['all', 'joined', 'created'] as const;
const FILTER_LABELS = { all: 'All', joined: 'Joined', created: 'Created' };

const CommunityListScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [communities, setCommunities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'joined' | 'created'>('all');
    const joining = useRef<string | null>(null);
    const bottomInset = useBottomInset();

    const fetchCommunities = async () => {
        try {
            const res = await axios.get('/communities/all');
            if (res.data.success) {
                setCommunities(res.data.communities);
            }
        } catch (error) {
            console.log("Error fetching communities", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchCommunities();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchCommunities();
    };

    const handleJoin = useCallback(async (id: string) => {
        if (joining.current) return;
        joining.current = id;
        try {
            const res = await axios.post(`/communities/join/${id}`, { userId: user?._id });
            if (res.data.success) {
                Alert.alert("Welcome!", "You have successfully subscribed to this hub.");
                fetchCommunities();
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Join failed");
        } finally {
            joining.current = null;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?._id]);

    const q = searchQuery.toLowerCase();
    const filtered = communities.filter(c => {
        const matchesSearch = (c.name || '').toLowerCase().includes(q) ||
                             c.description?.toLowerCase().includes(q);
        
        let matchesFilter = true;
        if (filter === 'joined') matchesFilter = c.members?.includes(user?._id);
        else if (filter === 'created') matchesFilter = c.creator?._id === user?._id;
        
        return matchesSearch && matchesFilter;
    });

    const openHub = useCallback((id: string) => navigation.navigate('CommunityHub', { communityId: id }), [navigation]);
    const renderItem = ({ item }: any) => (
        <CommunityItem item={item} userId={user?._id} handleJoin={handleJoin} onOpen={openHub} />
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <AppBar
                title="Communities"
                onBack={() => navigation.goBack()}
                right={<IconBtn name="add" boxed onPress={() => navigation.navigate('CreateCommunity')} accessibilityLabel="Create community" />}
            />
            <View className="px-gutter pt-2 pb-4" style={{ gap: 12 }}>
                <SegmentedTabs items={FILTERS} value={filter} onChange={setFilter} labels={FILTER_LABELS} />
                <SearchField placeholder="Search communities" value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            {loading && !refreshing ? (
                <View>{[1, 2, 3].map(i => <CommunitySkeleton key={i} />)}</View>
            ) : (
                <FlatList keyboardShouldPersistTaps="handled"
                    data={filtered}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: bottomInset }}
                    refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
                    ListEmptyComponent={
                        <View className="mt-16">
                            <Empty icon="compass-outline" title="No communities found" hint="Try another search or filter." />
                        </View>
                    }
                />
            )}
        </View>
    );
};

export default CommunityListScreen;
