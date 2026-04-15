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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
                <Text style={styles.brandText}>{item.brand || 'Premium'}</Text>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.priceRow}>
                    <Text style={styles.priceText}>₹{item.price}</Text>
                    {item.originalPrice && (
                        <Text style={styles.originalPriceText}>₹{item.originalPrice}</Text>
                    )}
                </View>
                <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.ratingText}>{item.rating || '4.5'}</Text>
                    <Text style={styles.reviewsText}>({item.reviewsCount || '100'}+)</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a1a', '#000']}
                style={styles.header}
            >
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Fync Store</Text>
                    <TouchableOpacity>
                        <Ionicons name="cart-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search for laptop, gadgets, books..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={fetchProducts}
                    />
                </View>
            </LinearGradient>

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
                    <ActivityIndicator size="large" color="#00FF9D" />
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
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00FF9D" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="bag-handle-outline" size={64} color="#333" />
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
        backgroundColor: '#000',
    },
    header: {
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
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
        backgroundColor: '#111',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    categoryButtonActive: {
        backgroundColor: '#00FF9D',
        borderColor: '#00FF9D',
    },
    categoryText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '600',
    },
    categoryTextActive: {
        color: '#000',
    },
    productList: {
        paddingHorizontal: 10,
        paddingBottom: 100,
    },
    productCard: {
        flex: 0.5,
        backgroundColor: '#111',
        borderRadius: 15,
        margin: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#222',
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
        backgroundColor: '#FF3B30',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 5,
    },
    discountText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    productInfo: {
        padding: 12,
    },
    brandText: {
        fontSize: 10,
        color: '#00FF9D',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
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
        fontWeight: 'bold',
        color: '#fff',
        marginRight: 8,
    },
    originalPriceText: {
        fontSize: 12,
        color: '#666',
        textDecorationLine: 'line-through',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 12,
        color: '#999',
        marginLeft: 4,
    },
    reviewsText: {
        fontSize: 11,
        color: '#555',
        marginLeft: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#999',
        marginTop: 15,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#666',
        marginTop: 15,
        fontSize: 16,
    }
});

export default AffiliateStore;
