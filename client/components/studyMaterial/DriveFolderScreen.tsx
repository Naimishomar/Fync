import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Animated, StatusBar, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { fetchDriveData } from '../../utils/handleDrive';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

const FOLDER_IMG = 'https://cdn-icons-png.flaticon.com/512/716/716784.png';
const PDF_IMG = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';

// Module scope: declared inside the screen it was a new component type on
// every render, so each render remounted all six and restarted their loops.
const SkeletonItem = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
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

const DriveFolderScreen = ({ route, navigation }: any) => {
    const { folderId, title } = route.params;
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<'all' | 'folders' | 'files'>('all');

    useEffect(() => {
        navigation.setOptions({ title: title || "Resources" });
        loadData();
    }, [folderId]);


    const loadData = async () => {
        setLoading(true);
        const data = await fetchDriveData(folderId);
        setItems(data || []);
        setLoading(false);
    };

    const filteredItems = useMemo(() => {
        let result = items;

        // Search Filter
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter(i => (i.name || '').toLowerCase().includes(q));
        }

        // Type Filter
        if (activeFilter === 'folders') {
            result = result.filter(i => i.mimeType === 'application/vnd.google-apps.folder');
        } else if (activeFilter === 'files') {
            result = result.filter(i => i.mimeType !== 'application/vnd.google-apps.folder');
        }

        return result;
    }, [search, items, activeFilter]);

    const handlePress = (item: any) => {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
            navigation.push('DriveFolderScreen', { folderId: item.id, title: item.name });
        } else {
            navigation.navigate('PDFViewerScreen', { fileId: item.id, title: item.name });
        }
    };



    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION - MATCHING LEADERBOARD */}

            <View className="flex-1">
                <AppBar title="Fync Drive" onBack={() => navigation.goBack()}
                    right={loading
                        ? <ActivityIndicator size="small" color={C.brand[500]} style={{ marginRight: 11 }} />
                        : <IconBtn name="refresh" onPress={loadData} />} />
                {/* Skeleton only on first load; a refresh keeps the list and spins the button. */}
                {loading && items.length === 0 ? (
                    <View>
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
                            <View className='px-gutter pt-2 bg-transparent'>

                                <View className="flex-row items-center bg-card px-4 py-1 border-2 border-ink mb-6 rounded-md">
                                    <Ionicons name="search" size={20} color={C.ink4} />
                                    <TextInput
                                        placeholder="Search resources..."
                                        placeholderTextColor={C.ink4}
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
                                            style={{ width: '100%', height: '100%' }}
                                            contentFit="contain"
                                            cachePolicy="memory-disk"
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
                                        <Ionicons name="chevron-forward" size={12} color={C.ink4} />
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={
                            <View className="items-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Ionicons name="document-text-outline" size={32} color={C.ink4} />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">No resources found</Text>
                            </View>
                        }
                    />
                )}
            </View>
        </View>
    );
};

export default DriveFolderScreen;
