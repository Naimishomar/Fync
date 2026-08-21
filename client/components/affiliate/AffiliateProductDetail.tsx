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
import Ionicons from '@expo/vector-icons/Ionicons';
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
            const shareUrl = `https://fync-api.duckdns.org/product?id=${product._id}`;
            await Share.share({
                message: `Check out this amazing deal on Fync: ${product.name}\n\nLink: ${shareUrl}\n\nOpen in App: fync://store/product/${product._id}`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F97316" />
            </View>
        );
    }

    if (!product) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Product not found</Text>
                <TouchableOpacity onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
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
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                            className="w-11 h-11 items-center justify-center rounded-xl"
                            style={[styles.iconButton, { marginLeft: -11 }]}
                        >
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
                        {!!product.brand && <Text style={styles.brandText}>{product.brand}</Text>}
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

                        {product.rating > 0 && (
                            <View style={styles.ratingSection}>
                                <View style={styles.starsContainer}>
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Ionicons
                                            key={s}
                                            name={s <= Math.round(product.rating) ? 'star' : 'star-outline'}
                                            size={18}
                                            color="#F5B700"
                                        />
                                    ))}
                                </View>
                                <Text style={styles.ratingText}>{product.rating}</Text>
                                {product.reviewsCount > 0 && (
                                    <Text style={styles.reviewsText}>({product.reviewsCount} reviews)</Text>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Product Description</Text>
                        <Text style={styles.descriptionText}>{product.description}</Text>
                    </View>

                    <View style={styles.disclosure}>
                        <Ionicons name="information-circle-outline" size={18} color="#57534E" />
                        <Text style={styles.disclosureText}>
                            You will complete this purchase on the retailer&apos;s own site. Fync may earn a
                            commission at no extra cost to you.
                        </Text>
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
                    <Ionicons name="arrow-forward" size={20} color="#12100E" style={{marginLeft: 8}} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F2EC',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F2EC',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F2EC',
    },
    errorText: {
        color: '#12100E',
        fontSize: 18,
    },
    goBackText: {
        color: '#EA580C',
        fontFamily: 'Inter_700Bold',
        marginTop: 10,
    },
    imageContainer: {
        width: '100%',
        height: 400,
        backgroundColor: '#FFFFFF',
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
        backgroundColor: '#F5F2EC',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -30,
    },
    headerInfo: {
        marginBottom: 20,
    },
    categoryBadge: {
        backgroundColor: '#F97316',
        color: '#12100E',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#12100E',
        overflow: 'hidden',
        fontSize: 10,
        letterSpacing: 0.5,
        alignSelf: 'flex-start',
        marginBottom: 12,
        fontFamily: 'SpaceGrotesk_700Bold',
        textTransform: 'uppercase',
    },
    brandText: {
        color: '#EA580C',
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
        marginBottom: 5,
    },
    productTitle: {
        fontSize: 26,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: -0.5,
        color: '#12100E',
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
        fontFamily: 'SpaceGrotesk_700Bold',
        fontVariant: ['tabular-nums'],
        color: '#12100E',
        marginRight: 15,
    },
    originalPriceText: {
        fontSize: 18,
        color: '#8B857E',
        textDecorationLine: 'line-through',
        marginRight: 15,
    },
    discountContainer: {
        backgroundColor: '#DC2626',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    discountText: {
        color: '#12100E',
        fontFamily: 'Inter_700Bold',
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
        color: '#12100E',
        marginRight: 10,
        fontFamily: 'Inter_600SemiBold',
    },
    reviewsText: {
        color: '#8B857E',
    },
    divider: {
        height: 1,
        backgroundColor: '#E3DDD3',
        marginVertical: 20,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: '#12100E',
        paddingBottom: 8,
        marginBottom: 14,
        borderBottomWidth: 2,
        borderBottomColor: '#12100E',
    },
    descriptionText: {
        fontSize: 15,
        color: '#57534E',
        lineHeight: 24,
    },
    disclosure: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#EDE8E0',
        borderRadius: 14,
        padding: 14,
    },
    disclosureText: {
        flex: 1,
        color: '#57534E',
        fontSize: 12,
        lineHeight: 18,
    },
    infoCard: {
        backgroundColor: '#FFFFFF',
        padding: 15,
        borderRadius: 14,
        alignItems: 'center',
        width: (width - 60) / 3,
        borderWidth: 2,
        borderColor: '#12100E',
    },
    infoCardTitle: {
        color: '#12100E',
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        marginTop: 8,
    },
    infoCardSub: {
        color: '#8B857E',
        fontSize: 10,
        marginTop: 4,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F5F2EC',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 35,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 2,
        borderTopColor: '#12100E',
    },
    bottomPrice: {
        flex: 1,
    },
    bottomPriceLabel: {
        color: '#8B857E',
        fontSize: 12,
    },
    bottomPriceValue: {
        color: '#12100E',
        fontSize: 22,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontVariant: ['tabular-nums'],
    },
    buyButton: {
        backgroundColor: '#F97316',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#12100E',
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButtonText: {
        color: '#12100E',
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
    }
});

export default AffiliateProductDetail;
