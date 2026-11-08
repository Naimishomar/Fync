import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, themed } from '../../constants/colors';
import { AppBar, SearchField, FilterChips, Empty } from '../ui/kit';
import { Image } from 'expo-image';

import FyncRefreshControl from '../ui/FyncRefreshControl';
const CATEGORIES = ['All', 'Education', 'Electronics', 'Fashion', 'Books', 'Lifestyle'];

const ProductCard = memo(function ProductCard({ item, onOpen }: { item: any; onOpen: (id: string) => void }) {
    const off = item.originalPrice > item.price ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100) : 0;
    return (
        <Pressable
            style={styles.productCard}
            className="active:opacity-85"
            onPress={() => onOpen(item._id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ₹${item.price}`}
        >
            <View style={styles.imageContainer}>
                <Image source={{ uri: item.image }} style={styles.productImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item._id} />
                {off > 0 && (
                    <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>{off}% off</Text>
                    </View>
                )}
            </View>
            <View style={styles.productInfo}>
                {!!item.brand && <Text style={styles.brandText}>{item.brand}</Text>}
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.priceRow}>
                    <Text style={styles.priceText}>₹{item.price}</Text>
                    {off > 0 && <Text style={styles.originalPriceText}>₹{item.originalPrice}</Text>}
                </View>
                {item.rating > 0 && (
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={C.alumniLit} />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                        {item.reviewsCount > 0 && <Text style={styles.reviewsText}>({item.reviewsCount})</Text>}
                    </View>
                )}
            </View>
        </Pressable>
    );
});

const AffiliateStore = () => {
    const navigation = useNavigation<any>();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    // Switching chips quickly: only the latest request may fill the grid.
    const reqSeq = useRef(0);

    const fetchProducts = async () => {
        const seq = ++reqSeq.current;
        try {
            setLoading(true);
            const response = await axios.get(`/affiliate/products`, {
                params: {
                    category: selectedCategory === 'All' ? undefined : selectedCategory,
                    search: searchQuery || undefined
                }
            });
            if (seq !== reqSeq.current) return;
            setProducts(response.data?.products ?? []);
        } catch (error) {
            console.error('Error fetching affiliate products:', error);
        } finally {
            if (seq === reqSeq.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [selectedCategory]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProducts();
    };

    const openProduct = useCallback((id: string) => navigation.navigate('AffiliateProductDetail', { productId: id }), [navigation]);
    const renderProductItem = useCallback(({ item }: { item: any }) => <ProductCard item={item} onOpen={openProduct} />, [openProduct]);

    return (
        <View style={styles.container}>
            <AppBar title="Fync Store" onBack={() => navigation.goBack()} />
            <SearchField
                containerStyle={styles.search}
                placeholder="Search for laptop, gadgets, books..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={fetchProducts}
            />
            <FilterChips items={CATEGORIES} value={selectedCategory} onChange={setSelectedCategory} style={styles.categories} />

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={C.brand[500]} />
                    <Text style={styles.loadingText}>Loading curated deals...</Text>
                </View>
            ) : (
                <FlatList keyboardShouldPersistTaps="handled"
                    data={products}
                    renderItem={renderProductItem}
                    keyExtractor={(item) => item._id}
                    numColumns={2}
                    contentContainerStyle={styles.productList}
                    refreshControl={
                        <FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Empty icon="bag-handle-outline" title="No products found" hint="Try another category or search." />
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = themed(() => ({
    container: {
        flex: 1,
        backgroundColor: C.paper,
    },
    search: {
        marginHorizontal: 20,
        marginTop: 4,
    },
    categories: {
        marginVertical: 12,
    },
    productList: {
        // + productCard margin 5 = 20 gutter
        paddingHorizontal: 15,
        paddingBottom: 100,
    },
    productCard: {
        flex: 0.5,
        backgroundColor: C.card,
        borderRadius: 16,
        margin: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.line,
    },
    imageContainer: {
        width: '100%',
        height: 180,
        position: 'relative',
        backgroundColor: C.paper2,
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    discountBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: C.danger,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    discountText: {
        color: C.paper,
        fontSize: 11,
        fontFamily: 'Inter_600SemiBold',
    },
    productInfo: {
        padding: 12,
    },
    brandText: {
        fontSize: 12,
        color: C.accentText,
        fontFamily: 'Inter_600SemiBold',
        marginBottom: 4,
    },
    productName: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: C.ink,
        marginBottom: 8,
        minHeight: 36,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    priceText: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontVariant: ['tabular-nums'],
        color: C.ink,
        marginRight: 8,
    },
    originalPriceText: {
        fontSize: 12,
        color: C.ink3,
        textDecorationLine: 'line-through',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 12,
        color: C.ink3,
        marginLeft: 4,
    },
    reviewsText: {
        fontSize: 11,
        color: C.ink2,
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: C.ink3,
        marginTop: 15,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
}));

export default AffiliateStore;
