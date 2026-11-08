import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StatusBar, Animated, Dimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

import { AppBar, Button, Card, Empty, Label, Num, Sheet, FormField } from '../ui/kit';
import { C } from '../../constants/colors';
import { ProductTile } from '../olx/ProductTile';

import FyncRefreshControl from '../ui/FyncRefreshControl';
// 20px gutter each side, 12 between the two columns.
const COLUMN_WIDTH = (Dimensions.get('window').width - 40 - 12) / 2;
// Outside the screen so a parent re-render doesn't remount it and restart the pulse.
const ProductSkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    return (
        <Animated.View
            style={{ opacity: pulseAnim, width: COLUMN_WIDTH }}
            className="bg-card rounded-2xl overflow-hidden mb-3 border border-line"
        >
            <View className="bg-paper-2 w-full" style={{ aspectRatio: 1 }} />
            <View className="px-3 pt-3 pb-4">
                <View className="h-4 bg-paper-2 rounded w-3/4 self-center mb-4" />
                <View className="flex-row items-center justify-between">
                    <View className="h-3 bg-paper-2 rounded w-1/2" />
                    <View className="h-9 bg-paper-2 rounded-full w-16" />
                </View>
            </View>
        </Animated.View>
    );
};

const MarketplaceScreen = () => {
    const navigation = useNavigation<any>();
    const { user, setUser } = useAuth();

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Purchase Modal State
    const [buyModalVisible, setBuyModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState(user?.mobileNumber || '');
    const [pincode, setPincode] = useState('');
    const [purchasing, setPurchasing] = useState(false);

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/marketplace');
            if (res.data.success) {
                setProducts(res.data.products || []);
            }
        } catch (error) {
            console.log("Error fetching products", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProducts();
    };

    const handleBuyItem = (product: any) => {
        if ((user?.coins || 0) < product.coins_required) {
            return Alert.alert("Insufficient Balance", "You do not have enough coins to purchase this item.");
        }
        setSelectedProduct(product);
        setBuyModalVisible(true);
    };

    const confirmPurchase = async () => {
        if (purchasing) return;
        if (!address.trim() || !phone.trim() || !pincode.trim()) {
            return Alert.alert("Missing Details", "Please provide delivery address, pincode and mobile number.");
        }

        Alert.alert(
            "Final Confirmation",
            `Are you sure you want to spend ${selectedProduct?.coins_required} coins for ${selectedProduct?.product_name}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm & Buy",
                    style: "default",
                    onPress: async () => {
                        setPurchasing(true);
                        try {
                            const res = await axios.post(`/api/marketplace/${selectedProduct._id}/buy`, {
                                address,
                                pincode,
                                mobileNumber: phone
                            });

                            if (res.data.success) {
                                setUser((prev: any) => ({ ...prev, coins: res.data.remaining_coins }));
                                Alert.alert("Success!", "Your order has been placed successfully!");
                                setBuyModalVisible(false);
                                setAddress('');
                                setPincode('');
                            }
                        } catch (error: any) {
                            console.error("PURCHASE FATAL ERROR:", error);
                            Alert.alert("Purchase Failed", error.response?.data?.message || "Something went wrong.");
                        } finally {
                            setPurchasing(false);
                        }
                    }
                }
            ]
        );
    };



    // --- Renders ---
    const renderProduct = ({ item }: { item: any }) => {
        const canAfford = (user?.coins || 0) >= item.coins_required;
        return (
            <ProductTile
                image={item.product_image}
                title={item.product_name}
                price={`${item.coins_required} coins`}
                contain
                cover={item.is_available ? undefined : 'Out of stock'}
                width={COLUMN_WIDTH}
                onPress={() => handleBuyItem(item)}
                footer={
                    <Button
                        small
                        block
                        variant={item.is_available && canAfford ? 'primary' : 'secondary'}
                        title={item.is_available ? (canAfford ? 'Redeem' : 'Not enough coins') : 'Out of stock'}
                        onPress={() => handleBuyItem(item)}
                        disabled={!item.is_available}
                        style={{ marginTop: 4 }}
                    />
                }
            />
        );
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar title="Reward Store" onBack={() => navigation.goBack()} />
                <Card style={{ marginHorizontal: 20, marginBottom: 16 }}>
                    <Label>Your balance</Label>
                    <Num style={{ fontSize: 28, lineHeight: 32, marginTop: 4 }}>{user?.coins || 0} <Text className="text-ink-3 text-sm font-medium">Fync coins</Text></Num>
                </Card>

                {loading && !refreshing ? (
                    <View className="flex-1 px-gutter">
                        <View className="flex-row justify-between">
                            <ProductSkeleton />
                            <ProductSkeleton />
                        </View>
                        <View className="flex-row justify-between">
                            <ProductSkeleton />
                            <ProductSkeleton />
                        </View>
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={products}
                        keyExtractor={(item) => item._id}
                        renderItem={renderProduct}
                        numColumns={2}
                        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.warning} />}
                        ListEmptyComponent={
                            <View className="mt-20">
                                <Empty icon="storefront-outline" title="Store is empty" hint="New rewards are arriving soon." />
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <Sheet
                    visible={buyModalVisible}
                    onClose={() => setBuyModalVisible(false)}
                    title="Checkout"
                    subtitle="Where should we deliver it?"
                    footer={<Button variant="primary" block icon="flash-outline" title="Redeem now" onPress={confirmPurchase} loading={purchasing} />}
                >
                    <View style={{ gap: 16 }}>
                        <View className="flex-row items-center bg-paper-2 p-3 rounded-2xl" style={{ gap: 12 }}>
                            <ExpoImage source={{ uri: selectedProduct?.product_image }} style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: C.card }} contentFit="contain" cachePolicy="memory-disk" />
                            <View className="flex-1" style={{ minWidth: 0, gap: 2 }}>
                                <Text className="text-ink font-semibold text-base" numberOfLines={1}>{selectedProduct?.product_name}</Text>
                                <Text className="text-ink-2 text-sm">{selectedProduct?.coins_required} coins</Text>
                            </View>
                        </View>

                        <View className="flex-row" style={{ gap: 12 }}>
                            <FormField
                                label="Mobile number"
                                placeholder="+91..."
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                                containerStyle={{ flex: 1 }}
                            />
                            <FormField
                                label="Pincode"
                                placeholder="201206"
                                keyboardType="numeric"
                                maxLength={6}
                                value={pincode}
                                onChangeText={setPincode}
                                containerStyle={{ width: '36%' }}
                            />
                        </View>

                        <FormField
                            label="Delivery address"
                            placeholder="Complete address with landmark"
                            multiline
                            value={address}
                            onChangeText={setAddress}
                        />
                    </View>
                </Sheet>
            </View>
        </View>
    );
};

export default MarketplaceScreen;
