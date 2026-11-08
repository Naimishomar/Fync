import React, { useState, useRef, useEffect } from 'react';
import {View, StyleSheet, Text, ActivityIndicator, Share, BackHandler} from 'react-native'
// RN's own SafeAreaView is a no-op on Android, so the header sat under the translucent status bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';
import { C, themed } from '../../constants/colors';
import { AppBar, IconBtn, Meta, Button } from '../ui/kit';

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
                right={<IconBtn name="share-outline" onPress={handleShare} accessibilityLabel="Share link" />}
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
                        <Text style={styles.loadingText}>Loading secure checkout…</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <View style={styles.navControls}>
                    <IconBtn name="chevron-back" onPress={handleBack} disabled={!canGoBack} color={canGoBack ? C.ink : C.ink4} accessibilityLabel="Back" />
                    <IconBtn name="chevron-forward" onPress={handleForward} disabled={!canGoForward} color={canGoForward ? C.ink : C.ink4} accessibilityLabel="Forward" />
                    <IconBtn name="refresh" onPress={handleReload} accessibilityLabel="Reload" />
                </View>

                <Button small variant="primary" title="I've purchased" onPress={confirmPurchase} />
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
        backgroundColor: C.paper,
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
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: C.line,
        backgroundColor: C.card,
    },
    navControls: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 4,
    },
}));

export default AffiliateWebView;
