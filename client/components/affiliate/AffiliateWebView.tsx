import React, { useState, useRef } from 'react';
import {View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, SafeAreaView, Platform, Share} from 'react-native'
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';

const AffiliateWebView = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { url, productId, saleId } = route.params;
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
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.headerIcon}>
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>Checkout</Text>
                    <Text style={styles.headerSubtitle} numberOfLines={1}>{url}</Text>
                </View>
                <TouchableOpacity onPress={handleShare} style={styles.headerIcon}>
                    <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

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
                        <ActivityIndicator size="large" color="#00FF9D" />
                        <Text style={styles.loadingText}>Loading Secure Checkout...</Text>
                    </View>
                )}
            </View>

            <View style={styles.footer}>
                <View style={styles.navControls}>
                    <TouchableOpacity onPress={handleBack} disabled={!canGoBack} style={styles.footerIcon}>
                        <Ionicons name="chevron-back" size={24} color={canGoBack ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleForward} disabled={!canGoForward} style={styles.footerIcon}>
                        <Ionicons name="chevron-forward" size={24} color={canGoForward ? "#fff" : "#333"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleReload} style={styles.footerIcon}>
                        <Ionicons name="refresh" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={styles.doneButton} onPress={confirmPurchase}>
                    <Text style={styles.doneButtonText}>I've Purchased</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#111',
    },
    headerIcon: {
        padding: 5,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#666',
        fontSize: 10,
    },
    webViewContainer: {
        flex: 1,
        position: 'relative',
    },
    webview: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#999',
        marginTop: 15,
        fontSize: 14,
    },
    footer: {
        height: 70,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        borderTopWidth: 1,
        borderTopColor: '#222',
        backgroundColor: '#111',
        paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    navControls: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    footerIcon: {
        paddingHorizontal: 15,
    },
    doneButton: {
        backgroundColor: '#00FF9D',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    doneButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
    }
});

export default AffiliateWebView;
