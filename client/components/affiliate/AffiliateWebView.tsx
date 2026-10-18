import React, { useState, useRef, useEffect } from 'react';
import {View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Share, BackHandler} from 'react-native'
// RN's own SafeAreaView is a no-op on Android, so the header sat under the translucent status bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';
import { C, themed } from '../../constants/colors';
import { AppBar, IconBtn, Meta } from '../ui/kit';

const AffiliateWebView = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { url, saleId } = route.params ?? {};
    const [loading, setLoading] = useState(true);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const webViewRef = useRef<WebView>(null);

    const handleBack = () => {
        if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
        } else {
            navigation.goBack();
        }
    };

    // Android back walks the merchant's page history first, like a browser,
    // instead of dropping the user out of checkout mid-flow.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (canGoBack && webViewRef.current) {
                webViewRef.current.goBack();
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [canGoBack]);

    const handleForward = () => {
        if (canGoForward && webViewRef.current) {
            webViewRef.current.goForward();
        }
    };

    const handleReload = () => {
        webViewRef.current?.reload();
    };

    const handleShare = async () => {
        try {
            await Share.share({
                url: url,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const confirmPurchase = () => {
        Alert.alert(
            "Confirm Purchase",
            "Did you complete the purchase on the merchant site? This helps us track your rewards.",
            [
                { text: "No", style: "cancel" },
                { 
                    text: "Yes, I bought it", 
                    onPress: async () => {
                        try {
                            if (saleId) {
                                await axios.post('/affiliate/complete', { saleId });
                                Alert.alert("Success", "Platform commission tracked. Thank you for supporting Fync!");
                            }
                        } catch (error) {
                            console.error('Error completing sale:', error);
                        }
                    } 
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <AppBar
                title="Checkout"
                onBack={handleBack}
                right={<IconBtn name="share-outline" onPress={handleShare} />}
            />
            <Meta numberOfLines={1} style={styles.url}>{url}</Meta>

            <View style={styles.webViewContainer}>
                <WebView
                    ref={webViewRef}
                    source={{ uri: url }}
                    onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)}
                    onNavigationStateChange={(navState) => {
                        setCanGoBack(navState.canGoBack);
                        setCanGoForward(navState.canGoForward);
                    }}
                    style={styles.webview}
                    allowsBackForwardNavigationGestures={true}
                />
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={C.brand[500]} />
                        <Text style={styles.loadingText}>Loading Secure Checkout...</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <View style={styles.navControls}>
                    <TouchableOpacity onPress={handleBack} disabled={!canGoBack} style={styles.footerIcon}>
                        <Ionicons name="chevron-back" size={24} color={canGoBack ? C.ink : C.ink4} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleForward} disabled={!canGoForward} style={styles.footerIcon}>
                        <Ionicons name="chevron-forward" size={24} color={canGoForward ? C.ink : C.ink4} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleReload} style={styles.footerIcon}>
                        <Ionicons name="refresh" size={24} color={C.ink} />
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={styles.doneButton} onPress={confirmPurchase}>
                    <Text style={styles.doneButtonText}>I&apos;ve Purchased</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = themed(() => ({
    container: {
        flex: 1,
        backgroundColor: C.paper,
    },
    url: {
        paddingHorizontal: 20,
        paddingBottom: 8,
    },
    webViewContainer: {
        flex: 1,
        position: 'relative',
    },
    webview: {
        flex: 1,
        backgroundColor: '#12100E',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: C.paper,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: C.ink3,
        marginTop: 15,
        fontSize: 14,
    },
    footer: {
        height: 70,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        borderTopWidth: 1,
        borderTopColor: C.line,
        backgroundColor: C.card,
    },
    navControls: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    footerIcon: {
        paddingHorizontal: 15,
        minHeight: 44,
        justifyContent: 'center',
    },
    doneButton: {
        backgroundColor: C.brand[600],
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    doneButtonText: {
        color: C.onBrand,
        fontFamily: 'Inter_700Bold',
        fontSize: 14,
    }
}));

export default AffiliateWebView;
