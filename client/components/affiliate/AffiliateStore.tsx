import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    FlatList, 
    Image, 
    TouchableOpacity, 
    TextInput, 
    StyleSheet, 
    ScrollView,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';

const CATEGORIES = ['All', 'Education', 'Electronics', 'Fashion', 'Books', 'Lifestyle'];

const AffiliateStore = () => {
    const navigation = useNavigation<any>();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/affiliate/products`, {
                params: {
                    category: selectedCategory === 'All' ? undefined : selectedCategory,
                    search: searchQuery || undefined
                }
            });
            setProducts(response.data.products);
        } catch (error) {
            console.error('Error fetching affiliate products:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
                <Image source={{ uri: item.image }} style={styles.productImage} />
                {item.originalPrice && (
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
                    {item.originalPrice && (
                        <Text style={styles.originalPriceText}>₹{item.originalPrice}</Text>
                    )}
                </View>
                {item.rating > 0 && (
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={12} color="#F5B700" />
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
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()}
                        className="w-11 h-11 items-center justify-center rounded-xl"
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        style={{ marginLeft: -11 }}>
                        <Ionicons name="arrow-back" size={24} color="#12100E" />
                    </TouchableOpacity>
                </View>

                {/* Two-line display headline on the left, matching Explore,
                    Meet the Team and Fync Market. */}
                <Text style={styles.display}>Fync</Text>
                <Text style={[styles.display, styles.displayAccent]}>Store</Text>
                <Text style={styles.displaySub}>Deals worth a student&apos;s money</Text>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#8B857E" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for laptop, gadgets, books..."
                        placeholderTextColor="#8B857E"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={fetchProducts}
                    />
                </View>
            </View>

            <View style={styles.categoriesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
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
                    <ActivityIndicator size="large" color="#F97316" />
                    <Text style={styles.loadingText}>Loading curated deals...</Text>
                </View>
            ) : (
                <FlatList
                    data={products}
                    renderItem={renderProductItem}
                    keyExtractor={(item) => item._id}
                    numColumns={2}
                    contentContainerStyle={styles.productList}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="bag-handle-outline" size={64} color="#C4BEB6" />
                            <Text style={styles.emptyText}>No products found in this category</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F2EC',
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#F5F2EC',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    display: {
        fontSize: 34,
        lineHeight: 35,
        letterSpacing: -1.2,
        fontFamily: 'SpaceGrotesk_700Bold',
        textTransform: 'uppercase',
        color: '#12100E',
    },
    displayAccent: {
        color: '#EA580C',
    },
    displaySub: {
        marginTop: 12,
        marginBottom: 18,
        fontSize: 11,
        letterSpacing: 1.4,
        fontFamily: 'SpaceGrotesk_700Bold',
        textTransform: 'uppercase',
        color: '#8B857E',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#12100E',
        paddingHorizontal: 15,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#12100E',
        fontSize: 14,
    },
    categoriesContainer: {
        marginVertical: 15,
    },
    categoriesScroll: {
        paddingHorizontal: 15,
    },
    categoryButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        marginRight: 10,
        minHeight: 44,
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#12100E',
    },
    categoryButtonActive: {
        backgroundColor: '#F97316',
        borderColor: '#12100E',
    },
    categoryText: {
        color: '#57534E',
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    categoryTextActive: {
        color: '#12100E',
    },
    productList: {
        paddingHorizontal: 10,
        paddingBottom: 100,
    },
    productCard: {
        flex: 0.5,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        margin: 5,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#12100E',
    },
    imageContainer: {
        width: '100%',
        height: 180,
        position: 'relative',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    discountBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: '#DC2626',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#12100E',
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
        color: '#EA580C',
        fontFamily: 'Inter_700Bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    productName: {
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
        color: '#12100E',
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
        color: '#12100E',
        marginRight: 8,
    },
    originalPriceText: {
        fontSize: 12,
        color: '#8B857E',
        textDecorationLine: 'line-through',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 12,
        color: '#8B857E',
        marginLeft: 4,
    },
    reviewsText: {
        fontSize: 11,
        color: '#57534E',
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#8B857E',
        marginTop: 15,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#8B857E',
        marginTop: 15,
        fontSize: 16,
    }
});

export default AffiliateStore;
