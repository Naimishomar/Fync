import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    Image, 
    StyleSheet, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator,
    Dimensions,
    Share,
    Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const AffiliateProductDetail = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { productId } = route.params;
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProductDetails = async () => {
            try {
                const response = await axios.get(`/affiliate/products/${productId}`);
                setProduct(response.data.product);
            } catch (error) {
                console.error('Error fetching product details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProductDetails();
    }, [productId]);

    const handleBuyNow = async () => {
        try {
            // Track the click in our backend before opening the link
            const response = await axios.post('/affiliate/track', { productId });
            const { saleId } = response.data;
            
            // Navigate to WebView to stay in app
            navigation.navigate('AffiliateWebView', { 
                url: product.affiliateLink,
                productId: product._id,
                saleId: saleId
            });
        } catch (error) {
            console.error('Error tracking click:', error);
            // Even if tracking fails, still open the link for the user
            navigation.navigate('AffiliateWebView', { 
                url: product.affiliateLink,
                productId: product._id
            });
        }
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out this amazing deal on Fync: ${product.name}\nBuy it here: fync://store/product/${product._id}`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#00FF9D" />
            </View>
        );
    }

    if (!product) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Product not found</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.goBackText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: product.image }} style={styles.productImage} />
                    <LinearGradient
                        colors={['rgba(0,0,0,0.5)', 'transparent']}
                        style={styles.imageHeader}
                    >
                        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconButton} onPress={handleShare}>
                            <Ionicons name="share-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </LinearGradient>
                </View>

                <View style={styles.content}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.categoryBadge}>{product.category}</Text>
                        <Text style={styles.brandText}>{product.brand || 'Premium Brand'}</Text>
                        <Text style={styles.productTitle}>{product.name}</Text>
                        
                        <View style={styles.priceRow}>
                            <Text style={styles.priceText}>₹{product.price}</Text>
                            {product.originalPrice && (
                                <>
                                    <Text style={styles.originalPriceText}>₹{product.originalPrice}</Text>
                                    <View style={styles.discountContainer}>
                                        <Text style={styles.discountText}>
                                            {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                                        </Text>
                                    </View>
                                </>
                            )}
                        </View>

                        <View style={styles.ratingSection}>
                            <View style={styles.starsContainer}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                    <Ionicons 
                                        key={s} 
                                        name={s <= (product.rating || 4.5) ? "star" : "star-half"} 
                                        size={18} 
                                        color="#FFD700" 
                                    />
                                ))}
                            </View>
                            <Text style={styles.ratingText}>{product.rating || '4.5'} Rating</Text>
                            <Text style={styles.reviewsText}>({product.reviewsCount || '128'} Reviews)</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Product Description</Text>
                        <Text style={styles.descriptionText}>{product.description}</Text>
                    </View>

                    <View style={styles.infoCards}>
                        <View style={styles.infoCard}>
                            <Ionicons name="shield-checkmark-outline" size={24} color="#00FF9D" />
                            <Text style={styles.infoCardTitle}>Authentic</Text>
                            <Text style={styles.infoCardSub}>100% Genuine</Text>
                        </View>
                        <View style={styles.infoCard}>
                            <Ionicons name="return-up-back-outline" size={24} color="#00FF9D" />
                            <Text style={styles.infoCardTitle}>7 Days</Text>
                            <Text style={styles.infoCardSub}>Easy Return</Text>
                        </View>
                        <View style={styles.infoCard}>
                            <Ionicons name="flash-outline" size={24} color="#00FF9D" />
                            <Text style={styles.infoCardTitle}>Fast</Text>
                            <Text style={styles.infoCardSub}>Delivery</Text>
                        </View>
                    </View>
                    
                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            <View style={styles.bottomBar}>
                <View style={styles.bottomPrice}>
                    <Text style={styles.bottomPriceLabel}>Total Price</Text>
                    <Text style={styles.bottomPriceValue}>₹{product.price}</Text>
                </View>
                <TouchableOpacity style={styles.buyButton} onPress={handleBuyNow}>
                    <Text style={styles.buyButtonText}>Buy Now</Text>
                    <Ionicons name="arrow-forward" size={20} color="#000" style={{marginLeft: 8}} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    errorText: {
        color: '#fff',
        fontSize: 18,
    },
    goBackText: {
        color: '#00FF9D',
        marginTop: 10,
    },
    imageContainer: {
        width: '100%',
        height: 400,
        backgroundColor: '#111',
    },
    productImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    imageHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 50,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 20,
        backgroundColor: '#000',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        marginTop: -30,
    },
    headerInfo: {
        marginBottom: 20,
    },
    categoryBadge: {
        backgroundColor: '#222',
        color: '#999',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 6,
        fontSize: 10,
        alignSelf: 'flex-start',
        marginBottom: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    brandText: {
        color: '#00FF9D',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    productTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
        lineHeight: 32,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    priceText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginRight: 15,
    },
    originalPriceText: {
        fontSize: 18,
        color: '#666',
        textDecorationLine: 'line-through',
        marginRight: 15,
    },
    discountContainer: {
        backgroundColor: '#FF3B30',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    discountText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    ratingSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    starsContainer: {
        flexDirection: 'row',
        marginRight: 10,
    },
    ratingText: {
        color: '#fff',
        marginRight: 10,
        fontWeight: '600',
    },
    reviewsText: {
        color: '#666',
    },
    divider: {
        height: 1,
        backgroundColor: '#222',
        marginVertical: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
    },
    descriptionText: {
        fontSize: 15,
        color: '#ccc',
        lineHeight: 24,
    },
    infoCards: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    infoCard: {
        backgroundColor: '#111',
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        width: (width - 60) / 3,
        borderWidth: 1,
        borderColor: '#222',
    },
    infoCardTitle: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginTop: 8,
    },
    infoCardSub: {
        color: '#666',
        fontSize: 10,
        marginTop: 4,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#111',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 35,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#222',
    },
    bottomPrice: {
        flex: 1,
    },
    bottomPriceLabel: {
        color: '#999',
        fontSize: 12,
    },
    bottomPriceValue: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    buyButton: {
        backgroundColor: '#00FF9D',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default AffiliateProductDetail;
