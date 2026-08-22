import React, { useState, useCallback, useRef } from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, TextInput, ActivityIndicator, RefreshControl, Dimensions, StatusBar, Animated} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../ui/AlertModal';

const { width } = Dimensions.get('window');

const CommunityItem = ({ item, userId, handleJoin, navigation, stamped }: any) => {
    const isMember = item.members?.includes(userId);
    const isCreator = item.creator?._id === userId;
    const isSuspended = item.subscription?.status === 'suspended';

    return (
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CommunityHub', { communityId: item._id })}
            className={`mx-gutter mb-6 bg-card rounded-card overflow-hidden ${stamped ? 'border-2 border-ink' : 'border border-line'} ${isSuspended ? 'opacity-50' : ''}`}
            style={stamped ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
        >
            {/* Cinematic Expansion Banner */}
            <View className="h-44 w-full relative">
                <Image 
                    source={{ uri: item.banner || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' }} 
                    className="w-full h-full"
                    resizeMode="cover"
                />
                <LinearGradient 
                    colors={['transparent', 'rgba(0,0,0,0.7)']} 
                    className="absolute inset-0"
                />
                
                {isSuspended && (
                    <View className="absolute top-4 right-4 bg-danger px-3 py-1 rounded-full border border-danger">
                        <Text className="text-white font-display uppercase text-label">Suspended</Text>
                    </View>
                )}

                <View className="absolute bottom-4 left-6 flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-card border-2 border-white overflow-hidden bg-ink shadow-hair">
                        <Image 
                            source={{ uri: item.logo || 'https://via.placeholder.com/150' }} 
                            className="w-full h-full"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white text-lg font-display uppercase leading-tight" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-white/60 text-label uppercase font-display">By {item.creator?.username || item.creator?.name}</Text>
                    </View>
                </View>
            </View>

            {/* Content Area */}
            <View className="p-6">
                <Text className="text-ink-3 text-label font-medium leading-4 mb-4" numberOfLines={2}>
                    {item.description || "The ultimate creator ecosystem built for high-velocity growth and achievement."}
                </Text>

                <View className="flex-row justify-between items-center pt-4 border-t border-line">
                    <View className="flex-row items-center gap-1.5 px-3 py-1.5 bg-paper-2 rounded-card border border-line">
                        <Ionicons name="people" size={12} color="#8B857E" />
                        <Text className="text-ink-3 font-display text-label uppercase">{item.members?.length || 0} Sparks</Text>
                    </View>

                    {isCreator ? (
                        <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-ink rounded-xl">
                            <Feather name="shield" size={10} color="white" />
                            <Text className="text-white font-display uppercase text-label">Guardian</Text>
                        </View>
                    ) : isMember ? (
                        <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-paper-2 rounded-xl border border-line">
                            <Feather name="check" size={10} color="#F97316" />
                            <Text className="text-accent-text font-display uppercase text-label">Subscribed</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => handleJoin(item._id)}
                            className="bg-brand-500 px-2.5 py-1 rounded-full"
                        >
                            <Text className="text-ink font-display uppercase text-label">Subscribe</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const CommunityListScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [communities, setCommunities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'joined' | 'created'>('all');

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

    const handleJoin = async (id: string) => {
        try {
            const res = await axios.post(`/communities/join/${id}`, { userId: user?._id });
            if (res.data.success) {
                Alert.alert("Welcome!", "You have successfully subscribed to this hub.");
                fetchCommunities();
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Join failed");
        }
    };

    const filtered = communities.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             c.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchesFilter = true;
        if (filter === 'joined') matchesFilter = c.members?.includes(user?._id);
        else if (filter === 'created') matchesFilter = c.creator?._id === user?._id;
        
        return matchesSearch && matchesFilter;
    });

    const CommunitySkeleton = () => {
        const pulseAnim = useRef(new Animated.Value(0.3)).current;
        React.useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View style={{ opacity: pulseAnim }} className="mx-gutter mb-6 bg-card rounded-sheet border border-line h-64 shadow-hair" />
        );
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-gutter pt-6 pb-2 flex-row justify-between items-center">
                    <View>
                        <TouchableOpacity
                          onPress={() => navigation.goBack()}
                          className="w-11 h-11 items-center justify-center rounded-xl"
                          accessibilityRole="button"
                          accessibilityLabel="Go back"
                          style={{ marginLeft: -11 }}
                        >
                          <Ionicons name="arrow-back" size={24} color="#12100E" />
                        </TouchableOpacity>
                        <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Community</Text>
                        <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Hub</Text>
                        <Text className="text-ink-3 text-label font-display uppercase">High-Velocity Network</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('CreateCommunity')}
                        className="w-14 h-14 bg-ink rounded-card items-center justify-center shadow-hair"
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tabs & Search */}
                <View className="px-gutter mt-6">
                    <View className="flex-row bg-card p-1.5 rounded-card mb-6 border border-line shadow-hair">
                        <TouchableOpacity
                            onPress={() => setFilter('all')}
                            className={`flex-1 py-3.5 items-center rounded-xl ${filter === 'all' ? 'bg-ink' : 'bg-transparent'}`}
                        >
                            <Text className={`font-display text-label uppercase ${filter === 'all' ? 'text-white' : 'text-ink-3'}`}>All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFilter('joined')}
                            className={`flex-1 py-3.5 items-center rounded-xl ${filter === 'joined' ? 'bg-brand-500' : 'bg-transparent'}`}
                        >
                            <Text className={`font-display text-label uppercase ${filter === 'joined' ? 'text-ink' : 'text-ink-3'}`}>Joined</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFilter('created')}
                            className={`flex-1 py-3.5 items-center rounded-xl ${filter === 'created' ? 'bg-ink' : 'bg-transparent'}`}
                        >
                            <Text className={`font-display text-label uppercase ${filter === 'created' ? 'text-white' : 'text-ink-3'}`}>Created</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="bg-card px-5 h-12 flex-row items-center border-2 border-ink shadow-hair mb-6 rounded-md">
                        <Feather name="search" size={16} color="#8B857E" />
                        <TextInput 
                            placeholder="Find a specialized hub..." 
                            placeholderTextColor="#8B857E"
                            className="flex-1 ml-4 font-display uppercase text-label text-ink"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View>{[1, 2, 3].map(i => <CommunitySkeleton key={i} />)}</View>
                ) : (
                    <FlatList 
                        data={filtered}
                        keyExtractor={(item) => item._id}
                        renderItem={({ item, index }) => (
                            <CommunityItem 
                                item={item} 
                                stamped={index === 0}
                                
                                userId={user?._id} 
                                handleJoin={handleJoin}
                                navigation={navigation}
                            />
                        )}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 150 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Feather name="compass" size={48} color="#C4BEB6" />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">No Active Signals</Text>
                                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">
                                    Scanning the ecosystem...{"\n"}No communities found in this sector.
                                </Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

export default CommunityListScreen;
