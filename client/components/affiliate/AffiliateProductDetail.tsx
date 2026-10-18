import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator,
    Dimensions,
    Share,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from '../ui/AlertModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useBottomInset } from '../../constants/layout';
import { C, themed } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';

const { width } = Dimensions.get('window');

const AffiliateProductDetail = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { productId, shareCode } = route.params ?? {};
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [opening, setOpening] = useState(false);
    const bottomInset = useBottomInset();

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
        // One tap, one tracked click: a double tap used to log two sales and push two webviews.
        if (opening) return;
        setOpening(true);
        try {
            // Track the click in our backend before opening the link
            const response = await axios.post('/affiliate/track', { productId, shareCode });
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
        } finally {
            setOpening(false);
        }
    };

    /**
     * Shares the user's own referral link rather than a bare product URL, so the
     * taps it produces are attributable to them. The link is minted once per
     * person per product and reused after that.
     */
    const handleShare = async () => {
        try {
            const res = await axios.post('/affiliate/share', { productId: product._id });
            const url = res.data?.url;
            if (!url) throw new Error('no link');
            await Share.share({
                message: `${product.name} — spotted on Fync\n\n${url}`,
            });
        } catch (error: any) {
            // A delisted product cannot be shared; anything else is a network blip.
            const msg = error?.response?.status === 409
                ? 'This product is no longer listed.'
                : 'Could not create your share link. Try again.';
            Alert.alert('Not shared', msg);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={C.brand[500]} />
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
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: product.image }} style={styles.productImage} contentFit="cover" cachePolicy="memory-disk" />
                </View>

                <View style={styles.content}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.categoryBadge}>{product.category}</Text>
                        {!!product.brand && <Text style={styles.brandText}>{product.brand}</Text>}
                        <Text style={styles.productTitle}>{product.name}</Text>
                        
                        <View style={styles.priceRow}>
                            <Text style={styles.priceText}>₹{product.price}</Text>
                            {product.originalPrice > product.price && (
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
                                            color={C.alumniLit}
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
                        <Ionicons name="information-circle-outline" size={18} color={C.ink2} />
                        <Text style={styles.disclosureText}>
                            You will complete this purchase on the retailer&apos;s own site. Fync may earn a
                            commission at no extra cost to you.
                        </Text>
                    </View>

                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={styles.imageHeader} pointerEvents="box-none">
                <AppBar
                    overlay
                    onBack={() => navigation.goBack()}
                    right={<IconBtn overlay name="share-outline" onPress={handleShare} />}
                />
            </LinearGradient>

            <View style={[styles.bottomBar, { paddingBottom: bottomInset + 10 }]}>
                <View style={styles.bottomPrice}>
                    <Text style={styles.bottomPriceLabel}>Total Price</Text>
                    <Text style={styles.bottomPriceValue}>₹{product.price}</Text>
                </View>
                <TouchableOpacity style={[styles.buyButton, opening && { opacity: 0.6 }]} onPress={handleBuyNow} disabled={opening}>
                    <Text style={styles.buyButtonText}>Buy Now</Text>
                    <Ionicons name="arrow-forward" size={20} color={C.onBrand} style={{marginLeft: 8}} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = themed(() => ({
    container: {
        flex: 1,
        backgroundColor: C.paper,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: C.paper,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: C.paper,
    },
    errorText: {
        color: C.ink,
        fontSize: 18,
    },
    goBackText: {
        color: C.brand[600],
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
    },
    imageHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    content: {
        padding: 20,
        backgroundColor: C.paper,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: -30,
    },
    headerInfo: {
        marginBottom: 20,
    },
    categoryBadge: {
        backgroundColor: C.brand[500],
        color: C.onBrand,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: C.ink,
        overflow: 'hidden',
        fontSize: 10,
        letterSpacing: 0.5,
        alignSelf: 'flex-start',
        marginBottom: 12,
        fontFamily: 'SpaceGrotesk_700Bold',
        textTransform: 'uppercase',
    },
    brandText: {
        color: C.brand[600],
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
        marginBottom: 5,
    },
    productTitle: {
        fontSize: 26,
        fontFamily: 'SpaceGrotesk_700Bold',
        letterSpacing: -0.5,
        color: C.ink,
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
        color: C.ink,
        marginRight: 15,
    },
    originalPriceText: {
        fontSize: 18,
        color: C.ink3,
        textDecorationLine: 'line-through',
        marginRight: 15,
    },
    discountContainer: {
        backgroundColor: C.danger,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    discountText: {
        color: C.ink,
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
        color: C.ink,
        marginRight: 10,
        fontFamily: 'Inter_600SemiBold',
    },
    reviewsText: {
        color: C.ink3,
    },
    divider: {
        height: 1,
        backgroundColor: C.line,
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
        color: C.ink,
        paddingBottom: 8,
        marginBottom: 14,
        borderBottomWidth: 2,
        borderBottomColor: C.ink,
    },
    descriptionText: {
        fontSize: 15,
        color: C.ink2,
        lineHeight: 24,
    },
    disclosure: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: C.paper2,
        borderRadius: 14,
        padding: 14,
    },
    disclosureText: {
        flex: 1,
        color: C.ink2,
        fontSize: 12,
        lineHeight: 18,
    },
    infoCard: {
        backgroundColor: C.card,
        padding: 15,
        borderRadius: 14,
        alignItems: 'center',
        width: (width - 60) / 3,
        borderWidth: 2,
        borderColor: C.ink,
    },
    infoCardTitle: {
        color: C.ink,
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
        marginTop: 8,
    },
    infoCardSub: {
        color: C.ink3,
        fontSize: 10,
        marginTop: 4,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: C.paper,
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 35,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 2,
        borderTopColor: C.ink,
    },
    bottomPrice: {
        flex: 1,
    },
    bottomPriceLabel: {
        color: C.ink3,
        fontSize: 12,
    },
    bottomPriceValue: {
        color: C.ink,
        fontSize: 22,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontVariant: ['tabular-nums'],
    },
    buyButton: {
        backgroundColor: C.brand[500],
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: C.ink,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buyButtonText: {
        color: C.onBrand,
        fontFamily: 'Inter_700Bold',
        fontSize: 16,
    }
}));

export default AffiliateProductDetail;
