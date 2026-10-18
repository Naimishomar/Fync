import React, { useState, useEffect, useRef } from 'react';
import { 
    View, 
    Text, 
    FlatList, 
    TouchableOpacity, 
    TextInput, 
    ScrollView,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, themed } from '../../constants/colors';
import { AppBar } from '../ui/kit';
import { Image } from 'expo-image';

const CATEGORIES = ['All', 'Education', 'Electronics', 'Fashion', 'Books', 'Lifestyle'];

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

    const renderProductItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.productCard}
            onPress={() => navigation.navigate('AffiliateProductDetail', { productId: item._id })}
            activeOpacity={0.9}
        >
            <View style={styles.imageContainer}>
                <Image source={{ uri: item.image }} style={styles.productImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item._id} />
                {item.originalPrice > item.price && (
                    <View style={styles.discountBadge}>
                        <Text style={styles.discountText}>
                            {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                        </Text>
                    </View>
                )}
            </View>
            <View style={styles.productInfo}>
                {!!item.brand && <Text style={styles.brandText}>{item.brand}</Text>}
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.priceRow}>
                    <Text style={styles.priceText}>₹{item.price}</Text>
                    {item.originalPrice > item.price && (
                        <Text style={styles.originalPriceText}>₹{item.originalPrice}</Text>
                    )}
                </View>
                {item.rating > 0 && (
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color={C.alumniLit} />
                        <Text style={styles.ratingText}>{item.rating}</Text>
                        {item.reviewsCount > 0 && (
                            <Text style={styles.reviewsText}>({item.reviewsCount})</Text>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <AppBar title="Fync Store" onBack={() => navigation.goBack()} />
            <View style={styles.header}>
                <View style={styles.headerBody}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={C.ink3} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for laptop, gadgets, books..."
                        placeholderTextColor={C.ink3}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={fetchProducts}
                    />
                </View>
                </View>
            </View>

            <View style={styles.categoriesContainer}>
                <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity 
                            key={cat}
                            style={[
                                styles.categoryButton,
                                selectedCategory === cat && styles.categoryButtonActive
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[
                                styles.categoryText,
                                selectedCategory === cat && styles.categoryTextActive
                            ]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

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
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="bag-handle-outline" size={64} color={C.ink4} />
                            <Text style={styles.emptyText}>No products found in this category</Text>
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
    header: {
        backgroundColor: C.paper,
    },
    headerBody: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 16,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: C.ink,
        paddingHorizontal: 15,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: C.ink,
        fontSize: 14,
    },
    categoriesContainer: {
        marginVertical: 15,
    },
    categoriesScroll: {
        paddingHorizontal: 20,
    },
    categoryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: C.card,
        marginRight: 10,
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: C.ink,
    },
    categoryButtonActive: {
        backgroundColor: C.brand[500],
        borderColor: C.ink,
    },
    categoryText: {
        color: C.ink2,
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    categoryTextActive: {
        color: C.onBrand,
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
        borderWidth: 2,
        borderColor: C.ink,
    },
    imageContainer: {
        width: '100%',
        height: 180,
        position: 'relative',
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
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: C.ink,
    },
    discountText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: 'Inter_700Bold',
    },
    productInfo: {
        padding: 12,
    },
    brandText: {
        fontSize: 10,
        color: C.brand[600],
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    productName: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
        color: C.ink,
        marginBottom: 8,
        height: 36,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    priceText: {
        fontSize: 16,
        fontFamily: 'Inter_700Bold',
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
    emptyText: {
        color: C.ink3,
        marginTop: 15,
        fontSize: 16,
    }
}));

export default AffiliateStore;
