import React, { useState, useCallback, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, Image, TextInput, 
  ActivityIndicator, RefreshControl, Dimensions, Alert, 
  StatusBar, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const CommunityItem = ({ item, userId, handleJoin, navigation }: any) => {
    const isMember = item.members?.includes(userId);
    const isCreator = item.creator?._id === userId;
    const isSuspended = item.subscription?.status === 'suspended';

    return (
        <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CommunityHub', { communityId: item._id })}
            className={`mx-8 mb-6 bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm shadow-black/5 ${isSuspended ? 'opacity-50' : ''}`}
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
                    <View className="absolute top-4 right-4 bg-rose-500 px-3 py-1 rounded-full border border-rose-400">
                        <Text className="text-white font-black uppercase text-[7px] tracking-widest">Suspended</Text>
                    </View>
                )}

                <View className="absolute bottom-4 left-6 flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-2xl border-2 border-white overflow-hidden bg-zinc-900 shadow-xl">
                        <Image 
                            source={{ uri: item.logo || 'https://via.placeholder.com/150' }} 
                            className="w-full h-full"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-white text-lg font-black uppercase tracking-tighter leading-tight" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-white/60 text-[8px] uppercase font-black tracking-widest">By {item.creator?.username || item.creator?.name}</Text>
                    </View>
                </View>
            </View>

            {/* Content Area */}
            <View className="p-6">
                <Text className="text-slate-500 text-[10px] font-medium leading-4 mb-4" numberOfLines={2}>
                    {item.description || "The ultimate creator ecosystem built for high-velocity growth and achievement."}
                </Text>

                <View className="flex-row justify-between items-center pt-4 border-t border-slate-50">
                    <View className="flex-row items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                        <Ionicons name="people" size={12} color="#94a3b8" />
                        <Text className="text-slate-400 font-black text-[9px] uppercase tracking-tighter">{item.members?.length || 0} Sparks</Text>
                    </View>

                    {isCreator ? (
                        <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-zinc-900 rounded-xl">
                            <Feather name="shield" size={10} color="white" />
                            <Text className="text-white font-black uppercase text-[7px] tracking-widest">Guardian</Text>
                        </View>
                    ) : isMember ? (
                        <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-orange-50 rounded-xl border border-orange-100">
                            <Feather name="check" size={10} color="#f97316" />
                            <Text className="text-orange-600 font-black uppercase text-[7px] tracking-widest">Subscribed</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            onPress={() => handleJoin(item._id)}
                            className="bg-orange-500 px-6 py-2.5 rounded-2xl shadow-lg shadow-orange-500/20"
                        >
                            <Text className="text-white font-black uppercase text-[7px] tracking-widest">Subscribe</Text>
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
            <Animated.View style={{ opacity: pulseAnim }} className="mx-8 mb-6 bg-white rounded-[32px] border border-slate-100 h-64 shadow-sm" />
        );
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-8 pt-6 pb-2 flex-row justify-between items-center">
                    <View>
                        <Text className="text-zinc-900 text-3xl font-black uppercase tracking-tighter leading-tight">
                            Community <Text className="text-orange-500">Hub</Text>
                        </Text>
                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">High-Velocity Network</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('CreateCommunity')}
                        className="w-14 h-14 bg-zinc-900 rounded-[24px] items-center justify-center shadow-2xl shadow-black/40"
                    >
                        <Ionicons name="add" size={28} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Tabs & Search */}
                <View className="px-8 mt-6">
                    <View className="flex-row bg-white p-1.5 rounded-[22px] mb-6 border border-slate-100 shadow-sm">
                        <TouchableOpacity
                            onPress={() => setFilter('all')}
                            className={`flex-1 py-3.5 items-center rounded-[18px] ${filter === 'all' ? 'bg-zinc-900' : 'bg-transparent'}`}
                        >
                            <Text className={`font-black tracking-widest text-[10px] uppercase ${filter === 'all' ? 'text-white' : 'text-slate-400'}`}>All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFilter('joined')}
                            className={`flex-1 py-3.5 items-center rounded-[18px] ${filter === 'joined' ? 'bg-orange-500' : 'bg-transparent'}`}
                        >
                            <Text className={`font-black tracking-widest text-[10px] uppercase ${filter === 'joined' ? 'text-white' : 'text-slate-400'}`}>Joined</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setFilter('created')}
                            className={`flex-1 py-3.5 items-center rounded-[18px] ${filter === 'created' ? 'bg-black' : 'bg-transparent'}`}
                        >
                            <Text className={`font-black tracking-widest text-[10px] uppercase ${filter === 'created' ? 'text-white' : 'text-slate-400'}`}>Created</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="bg-white rounded-[18px] px-5 h-12 flex-row items-center border border-slate-100 shadow-sm mb-6">
                        <Feather name="search" size={16} color="#94a3b8" />
                        <TextInput 
                            placeholder="Find a specialized hub..." 
                            placeholderTextColor="#94a3b8"
                            className="flex-1 ml-4 font-black uppercase text-[10px] text-zinc-900"
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
                        renderItem={({ item }) => (
                            <CommunityItem 
                                item={item} 
                                userId={user?._id} 
                                handleJoin={handleJoin}
                                navigation={navigation}
                            />
                        )}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 150 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-10">
                                <View className="w-24 h-24 bg-white rounded-[40px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                    <Feather name="compass" size={48} color="#cbd5e1" />
                                </View>
                                <Text className="text-zinc-400 font-black uppercase text-xs tracking-widest text-center">No Active Signals</Text>
                                <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center leading-5">
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
