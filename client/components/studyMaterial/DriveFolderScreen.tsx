import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Animated, StatusBar, TextInput } from 'react-native';
import { fetchDriveData } from '../../utils/handleDrive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const FOLDER_IMG = 'https://cdn-icons-png.flaticon.com/512/716/716784.png';
const PDF_IMG = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';

const DriveFolderScreen = ({ route, navigation }: any) => {
    const { folderId, title } = route.params;
    const [items, setItems] = useState<any[]>([]);
    const [filteredItems, setFilteredItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<'all' | 'folders' | 'files'>('all');

    useEffect(() => {
        navigation.setOptions({ title: title || "Resources" });
        loadData();
    }, [folderId]);

    useEffect(() => {
        filterData();
    }, [search, items, activeFilter]);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchDriveData(folderId);
        setItems(data || []);
        setLoading(false);
    };

    const filterData = () => {
        let result = items;

        // Search Filter
        if (search.trim()) {
            result = result.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
        }

        // Type Filter
        if (activeFilter === 'folders') {
            result = result.filter(i => i.mimeType === 'application/vnd.google-apps.folder');
        } else if (activeFilter === 'files') {
            result = result.filter(i => i.mimeType !== 'application/vnd.google-apps.folder');
        }

        setFilteredItems(result);
    };

    const handlePress = (item: any) => {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
            navigation.push('DriveFolderScreen', { folderId: item.id, title: item.name });
        } else {
            navigation.navigate('PDFViewerScreen', { fileId: item.id, title: item.name });
        }
    };

    const SkeletonItem = () => {
        const pulseAnim = useRef(new Animated.Value(0.3)).current;

        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View
                style={{ opacity: pulseAnim }}
                className="flex-row items-center p-5 mx-6 mb-4 bg-white rounded-[28px] border border-slate-50"
            >
                <View className="w-12 h-12 bg-slate-50 rounded-2xl" />
                <View className="ml-4 flex-1">
                    <View className="h-4 bg-slate-50 rounded w-3/4 mb-2" />
                    <View className="h-3 bg-slate-50 rounded w-1/2" />
                </View>
                <View className="w-4 h-4 bg-slate-50 rounded-full" />
            </Animated.View>
        );
    };



    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION - MATCHING LEADERBOARD */}
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient
                    colors={['#f97316', 'transparent']}
                    className="w-full h-full"
                />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                {loading ? (
                    <View>
                        <View className='px-8 pt-8 bg-transparent'>
                            <View className="flex-row items-center justify-between mb-8">
                                <View>
                                    <Text className="text-zinc-900 text-3xl font-black  tracking-tighter uppercase">Fync <Text className="text-orange-500">Drive</Text></Text>
                                    <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-0.5">Campus Resource Arena</Text>
                                </View>
                                <TouchableOpacity disabled className="w-12 h-12 rounded-2xl items-center justify-center border border-slate-100 bg-white shadow-sm">
                                    <ActivityIndicator size="small" color="#f97316" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="mt-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonItem key={i} />)}
                        </View>
                    </View>
                ) : (
                    <FlatList
                        data={filteredItems}
                        keyExtractor={(item: any) => item.id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListHeaderComponent={
                            <View className='px-8 pt-8 bg-transparent'>
                                <View className="flex-row items-center justify-between mb-8">
                                    <View>
                                        <Text className="text-zinc-900 text-3xl font-black  tracking-tighter uppercase">Fync <Text className="text-orange-500">Drive</Text></Text>
                                        <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-0.5">Campus Resource Arena</Text>
                                    </View>
                                    <TouchableOpacity onPress={loadData} disabled={loading} className={`w-12 h-12 rounded-2xl items-center justify-center border shadow-sm ${loading ? 'border-orange-100 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                                        {loading ? <ActivityIndicator size="small" color="#f97316" /> : <Ionicons name="refresh" size={20} color="#18181b" />}
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row items-center bg-white px-4 py-1 rounded-[20px] border border-slate-100 mb-6">
                                    <Ionicons name="search" size={20} color="#CBD5E1" />
                                    <TextInput
                                        placeholder="Search resources..."
                                        placeholderTextColor="#CBD5E1"
                                        value={search}
                                        onChangeText={setSearch}
                                        className="flex-1 text-zinc-900 font-black  text-sm tracking-tight p-3"
                                    />
                                </View>

                                <View className="flex-row justify-between gap-4 mb-6">
                                    <View className="flex-1 flex-row bg-white rounded-[18px] p-1.5 border border-slate-100">
                                        {[
                                            { id: 'all', label: 'All' },
                                            { id: 'folders', label: 'Folders' },
                                            { id: 'files', label: 'PDFs' }
                                        ].map(chip => (
                                            <TouchableOpacity
                                                key={chip.id}
                                                onPress={() => setActiveFilter(chip.id as any)}
                                                className={`flex-1 items-center py-3 rounded-[12px] ${activeFilter === chip.id ? 'bg-zinc-900' : 'bg-transparent'}`}
                                            >
                                                <Text className={`font-black  text-[10px] uppercase tracking-widest ${activeFilter === chip.id ? 'text-white' : 'text-slate-400'}`}>{chip.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View className="mb-6 flex-row items-center">
                                    <View className="bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 mr-2">
                                        <Text className="text-orange-600 font-black  text-[8px] uppercase tracking-tighter">Current Path</Text>
                                    </View>
                                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest  flex-1" numberOfLines={1}>/ {title || "Root Protocol"}</Text>
                                </View>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    className="flex-row items-center p-5 mx-6 mb-4 bg-white rounded-[28px] border border-slate-100"
                                    onPress={() => handlePress(item)}
                                >
                                    <View className="w-14 h-14 bg-slate-50 rounded-2xl items-center justify-center p-2.5">
                                        <Image
                                            source={{ uri: isFolder ? FOLDER_IMG : PDF_IMG }}
                                            className="w-full h-full"
                                            resizeMode="contain"
                                        />
                                    </View>

                                    <View className="ml-4 flex-1">
                                        <Text className="text-zinc-900 text-sm font-black  uppercase tracking-tight" numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1 ">
                                            {isFolder ? 'Folder' : 'PDF Source'}
                                        </Text>
                                    </View>

                                    <View className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center">
                                        <Ionicons name="chevron-forward" size={12} color="#CBD5E1" />
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-10">
                                <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6">
                                    <Ionicons name="document-text-outline" size={32} color="#CBD5E1" />
                                </View>
                                <Text className="text-slate-400 font-black  text-xs text-center uppercase tracking-widest">No resources found</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

export default DriveFolderScreen;
