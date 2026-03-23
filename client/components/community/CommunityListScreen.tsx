import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, Image, TextInput, 
  ActivityIndicator, RefreshControl, Dimensions, Alert, 
  StatusBar, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

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
                Alert.alert("Success", "Welcome to the hub!");
                fetchCommunities();
            }
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.message || "Join failed");
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

    const renderCommunityItem = ({ item }: { item: any }) => {
        const isMember = item.members?.includes(user?._id);
        const isCreator = item.creator?._id === user?._id;
        const isSuspended = item.subscription?.status === 'suspended';

        return (
            <TouchableOpacity 
                activeOpacity={0.97}
                onPress={() => navigation.navigate('CommunityHub', { communityId: item._id })}
                className={`mb-4 bg-white rounded-[28px] shadow-sm border border-zinc-100 overflow-hidden ${isSuspended ? 'opacity-50' : ''}`}
            >
                {/* Cinematic Expansion Banner */}
                <View className="h-44 w-full relative">
                    <Image 
                        source={{ uri: item.banner || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070' }} 
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                    <LinearGradient 
                        colors={['transparent', 'rgba(0,0,0,0.6)']} 
                        className="absolute inset-0"
                    />
                    
                    {isSuspended && (
                        <View className="absolute top-3 right-3 bg-red-500 px-3 py-1 rounded-full">
                            <Text className="text-white font-black uppercase text-[7px] tracking-widest">Suspended</Text>
                        </View>
                    )}

                    <View className="absolute bottom-3 left-4 flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-xl border-2 border-white overflow-hidden bg-zinc-900 shadow-md">
                            <Image 
                                source={{ uri: item.logo || 'https://via.placeholder.com/150' }} 
                                className="w-full h-full"
                            />
                        </View>
                        <View>
                            <Text className="text-white text-md font-black uppercase tracking-tighter" numberOfLines={1}>{item.name}</Text>
                            <View className="flex-row items-center gap-1">
                                <Text className="text-white/60 text-[7px] uppercase font-bold tracking-widest">By {item.creator?.username || item.creator?.name}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Content Area - Tighter Padding */}
                <View className="p-4">
                    <Text className="text-zinc-500 text-[10px] font-medium leading-[16px] mb-4" numberOfLines={2}>
                        {item.description || "The ultimate creator ecosystem built for high-velocity collaboration."}
                    </Text>

                    <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center gap-2">
                            <View className="flex-row items-center gap-1.5 px-2.5 py-1 bg-zinc-50 rounded-lg border border-zinc-100">
                                <Ionicons name="people" size={10} color="#94a3b8" />
                                <Text className="text-zinc-400 font-bold text-[8px] uppercase">{item.members?.length || 0}</Text>
                            </View>
                        </View>

                        {isCreator ? (
                            <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                <Feather name="shield" size={10} color="#6366f1" />
                                <Text className="text-indigo-600 font-black uppercase text-[8px] tracking-widest">Guardian Creator</Text>
                            </View>
                        ) : isMember ? (
                            <View className="flex-row items-center gap-1.5 py-1.5 px-3 bg-[#F0FDFA] rounded-xl border border-[#CCFBF1]">
                                <Feather name="check" size={10} color="#0D9488" />
                                <Text className="text-[#0D9488] font-black uppercase text-[8px] tracking-widest">Subscribed</Text>
                            </View>
                        ) : (
                            <TouchableOpacity 
                                onPress={() => handleJoin(item._id)}
                                className="bg-blue-600 px-5 py-2 rounded-xl"
                            >
                                <Text className="text-white font-black uppercase text-[8px] tracking-widest">Subscribe</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-[#FAFAFA]">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Responsive Modern Header - Tighter Padding */}
                <View className="px-5 pt-4">
                    <View className="flex-row justify-between items-center mb-5">
                        <View className="flex-1 mr-4">
                            <Text className="text-zinc-900 text-xl font-black uppercase tracking-tight">Ecosystem Directory</Text>
                            <Text className="text-zinc-400 text-[8px] font-bold uppercase tracking-[2px] mt-0.5">Explore Communities</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <TouchableOpacity 
                                onPress={() => setFilter(filter === 'joined' ? 'all' : 'joined')}
                                className={`w-9 h-9 rounded-xl items-center justify-center border ${filter === 'joined' ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-zinc-100'}`}
                            >
                                <Feather name="layers" size={15} color={filter === 'joined' ? 'white' : '#94a3b8'} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => setFilter(filter === 'created' ? 'all' : 'created')}
                                className={`w-9 h-9 rounded-xl items-center justify-center border ${filter === 'created' ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-zinc-100'}`}
                            >
                                <Feather name="anchor" size={15} color={filter === 'created' ? 'white' : '#94a3b8'} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('CreateCommunity')}
                                className="w-9 h-9 bg-zinc-900 rounded-xl items-center justify-center shadow-md shadow-black/10 ml-1"
                            >
                                <Ionicons name="add" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Compact Search Bar */}
                    <View className="bg-white rounded-[16px] px-4 h-11 flex-row items-center border border-zinc-100 shadow-sm mb-5">
                        <Feather name="search" size={14} color="#94a3b8" />
                        <TextInput 
                            placeholder="Find a hub..." 
                            placeholderTextColor="#94a3b8"
                            className="flex-1 ml-3 font-semibold text-zinc-800 text-[11px]"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {loading ? (
                        <View className="mt-20 items-center"><ActivityIndicator size="small" color="#1a1a1a" /></View>
                    ) : (
                        <FlatList 
                            data={filtered}
                            keyExtractor={(item) => item._id}
                            renderItem={renderCommunityItem}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 150 }}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a1a1a" />}
                            ListEmptyComponent={
                                <View className="items-center mt-20 p-10 bg-white rounded-[32px] border border-dashed border-zinc-200">
                                    <Feather name="compass" size={48} color="#F1F5F9" />
                                    <Text className="mt-6 text-zinc-400 font-black text-center uppercase tracking-widest text-[8px]">
                                        {filter === 'joined' ? "No joined hubs found" : filter === 'created' ? "You haven't generated any hubs yet" : "No communities found"}
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
};

export default CommunityListScreen;
