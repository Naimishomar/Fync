import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Animated, StatusBar, TextInput } from 'react-native';
import { fetchDriveData } from '../../utils/handleDrive';
import Ionicons from '@expo/vector-icons/Ionicons';
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
                className="flex-row items-center p-5 mx-gutter mb-4 bg-card rounded-card border border-line"
            >
                <View className="w-12 h-12 bg-paper-2 rounded-card" />
                <View className="ml-4 flex-1">
                    <View className="h-4 bg-paper-2 rounded w-3/4 mb-2" />
                    <View className="h-3 bg-paper-2 rounded w-1/2" />
                </View>
                <View className="w-4 h-4 bg-paper-2 rounded-full" />
            </Animated.View>
        );
    };



    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION - MATCHING LEADERBOARD */}

            <SafeAreaView className="flex-1" edges={['top']}>
                {loading ? (
                    <View>
                        <View className='px-gutter pt-8 bg-transparent'>
                            <View className="flex-row items-center justify-between mb-8">
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
                                    <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Fync</Text>
                                    <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Drive</Text>
                                    <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Campus Resource Arena</Text>
                                </View>
                                <TouchableOpacity disabled className="w-12 h-12 rounded-card items-center justify-center border border-line bg-card shadow-hair">
                                    <ActivityIndicator size="small" color="#F97316" />
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
                            <View className='px-gutter pt-8 bg-transparent'>
                                <View className="flex-row items-center justify-between mb-8">
                                    <View>
                                        <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Fync</Text>
                                        <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Drive</Text>
                                        <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Campus Resource Arena</Text>
                                    </View>
                                    <TouchableOpacity onPress={loadData} disabled={loading} className={`w-12 h-12 rounded-card items-center justify-center border shadow-hair ${loading ? 'border-line bg-paper-2' : 'border-line bg-card'}`}>
                                        {loading ? <ActivityIndicator size="small" color="#F97316" /> : <Ionicons name="refresh" size={20} color="#12100E" />}
                                    </TouchableOpacity>
                                </View>

                                <View className="flex-row items-center bg-card px-4 py-1 border-2 border-ink mb-6 rounded-md">
                                    <Ionicons name="search" size={20} color="#C4BEB6" />
                                    <TextInput
                                        placeholder="Search resources..."
                                        placeholderTextColor="#C4BEB6"
                                        value={search}
                                        onChangeText={setSearch}
                                        className="flex-1 text-ink font-display text-sm p-3"
                                    />
                                </View>

                                <View className="flex-row justify-between gap-4 mb-6">
                                    <View className="flex-1 flex-row bg-card rounded-xl p-1.5 border border-line">
                                        {[
                                            { id: 'all', label: 'All' },
                                            { id: 'folders', label: 'Folders' },
                                            { id: 'files', label: 'PDFs' }
                                        ].map(chip => (
                                            <TouchableOpacity
                                                key={chip.id}
                                                onPress={() => setActiveFilter(chip.id as any)}
                                                className={`flex-1 items-center py-3 rounded-md ${activeFilter === chip.id ? 'bg-ink' : 'bg-transparent'}`}
                                            >
                                                <Text className={`font-display text-label uppercase ${activeFilter === chip.id ? 'text-white' : 'text-ink-3'}`}>{chip.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View className="mb-6 flex-row items-center">
                                    <View className="bg-brand-500/10 border border-brand-500/20 mr-2 px-2.5 py-1 rounded-full">
                                        <Text className="text-accent-text font-display text-label uppercase">Current Path</Text>
                                    </View>
                                    <Text className="text-ink-3 text-label font-display uppercase flex-1" numberOfLines={1}>/ {title || "Root Protocol"}</Text>
                                </View>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const isFolder = item.mimeType === 'application/vnd.google-apps.folder';

                            return (
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    className="flex-row items-center p-5 mx-gutter mb-4 bg-card rounded-card border border-line"
                                    onPress={() => handlePress(item)}
                                >
                                    <View className="w-14 h-14 bg-paper-2 rounded-card items-center justify-center p-2.5">
                                        <Image
                                            source={{ uri: isFolder ? FOLDER_IMG : PDF_IMG }}
                                            className="w-full h-full"
                                            resizeMode="contain"
                                        />
                                    </View>

                                    <View className="ml-4 flex-1">
                                        <Text className="text-ink text-sm font-display uppercase" numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text className="text-ink-3 text-label font-display uppercase mt-1">
                                            {isFolder ? 'Folder' : 'PDF Source'}
                                        </Text>
                                    </View>

                                    <View className="w-8 h-8 bg-paper-2 rounded-full items-center justify-center">
                                        <Ionicons name="chevron-forward" size={12} color="#C4BEB6" />
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Ionicons name="document-text-outline" size={32} color="#C4BEB6" />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">No resources found</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

export default DriveFolderScreen;
