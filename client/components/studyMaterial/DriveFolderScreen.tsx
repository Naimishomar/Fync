import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, FlatList, ActivityIndicator, Animated, StatusBar } from 'react-native';
import { fetchDriveData } from '../../utils/handleDrive';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, ListRow, SearchField, SegmentedTabs, Empty, Meta } from '../ui/kit';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILTERS = ['all', 'folders', 'files'] as const;
const FILTER_LABELS = { all: 'All', folders: 'Folders', files: 'PDFs' };

const DriveRow = React.memo(function DriveRow({ item, onOpen }: { item: any; onOpen: (item: any) => void }) {
    const isFolder = item.mimeType === FOLDER_MIME;
    return (
        <ListRow
            icon={isFolder ? 'folder-outline' : 'document-text-outline'}
            title={item.name}
            subtitle={isFolder ? 'Folder' : 'PDF'}
            onPress={() => onOpen(item)}
            style={{ paddingHorizontal: 20 }}
        />
    );
});

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
            className="flex-row items-center px-gutter py-2 mb-2"
        >
            <View className="w-10 h-10 bg-paper-2 rounded-full" />
            <View className="ml-4 flex-1">
                <View className="h-4 bg-paper-2 rounded w-3/4 mb-2" />
                <View className="h-3 bg-paper-2 rounded w-1/2" />
            </View>
            <View className="w-4 h-4 bg-paper-2 rounded-full" />
        </Animated.View>
    );
};

const DriveFolderScreen = ({ route, navigation }: any) => {
    const { folderId, title } = route?.params ?? {};
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]>('all');

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

    const handlePress = useCallback((item: any) => {
        if (item.mimeType === FOLDER_MIME) {
            navigation.push('DriveFolderScreen', { folderId: item.id, title: item.name });
        } else {
            navigation.navigate('PDFViewerScreen', { fileId: item.id, title: item.name });
        }
    }, [navigation]);

    const renderItem = useCallback(({ item }: { item: any }) => <DriveRow item={item} onOpen={handlePress} />, [handlePress]);



    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar title="Fync Drive" onBack={() => navigation.goBack()}
                    right={loading
                        ? <ActivityIndicator size="small" color={C.brand[500]} style={{ marginRight: 11 }} />
                        : <IconBtn name="refresh" onPress={loadData} accessibilityLabel="Refresh" />} />
                {/* Skeleton only on first load; a refresh keeps the list and spins the button. */}
                {loading && items.length === 0 ? (
                    <View>
                        <View className="mt-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonItem key={i} />)}
                        </View>
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={filteredItems}
                        keyExtractor={(item: any) => item.id}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        renderItem={renderItem}
                        ListHeaderComponent={
                            <View className="px-gutter pt-2 pb-2" style={{ gap: 12 }}>
                                <SearchField value={search} onChangeText={setSearch} placeholder="Search resources" />
                                <SegmentedTabs items={FILTERS} value={activeFilter} onChange={setActiveFilter} labels={FILTER_LABELS} />
                                <Meta numberOfLines={1}>{title || 'Root'}</Meta>
                            </View>
                        }
                        ListEmptyComponent={<Empty icon="document-text-outline" title="No resources found" />}
                    />
                )}
            </View>
        </View>
    );
};

export default DriveFolderScreen;
