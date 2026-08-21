import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, StatusBar, Platform, Modal, TextInput, KeyboardAvoidingView, ScrollView, RefreshControl, Animated, Pressable} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
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
                setProducts(res.data.products);
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
            <Pressable
                onPress={() => handleBuyItem(item)}
                style={{ width: '48%' }}
                className="bg-card rounded-xl overflow-hidden mb-5 border border-line shadow-hair"
            >
                <View className="bg-paper-2 w-full items-center justify-center relative" style={{ aspectRatio: 1 }}>
                    <Image
                        source={{ uri: item.product_image }}
                        style={{ width: '85%', height: '85%' }}
                        resizeMode="contain"
                        className='rounded-xl'
                    />
                    {!item.is_available && (
                        <View className="absolute inset-0 bg-ink/40 items-center justify-center">
                            <View className="bg-card border border-line px-2.5 py-1 rounded-full">
                                <Text className="text-ink font-display text-label uppercase">Stock Out</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View className="p-3">
                    <Text className="text-ink font-semibold text-xs mb-1" numberOfLines={1}>
                        {item.product_name}
                    </Text>

                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center">
                            <Text className="text-ink font-semibold text-base">{item.coins_required}</Text>
                            <Text className="text-label ml-1"></Text>
                        </View>
                    </View>

                    {/* Buy Button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleBuyItem(item)}
                        disabled={!item.is_available}
                        className={`w-full py-2.5 rounded-xl items-center justify-center flex-row ${item.is_available && canAfford ? 'bg-ink shadow-hair ' : 'bg-paper-2 border border-line'}`}
                    >
                        <Text className={`font-display text-label uppercase ${item.is_available && canAfford ? 'text-white' : 'text-ink-3'}`}>
                            {item.is_available ? (canAfford ? 'Redeem Item' : 'Low Coins') : 'Stock Out'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        );
    };

    const ProductSkeleton = () => {
        const pulseAnim = useRef(new Animated.Value(0.4)).current;

        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View
                style={{ opacity: pulseAnim, width: '48%' }}
                className="bg-card rounded-card overflow-hidden mb-4 border border-line"
            >
                <View className="bg-paper-2 w-full" style={{ aspectRatio: 1 }} />
                <View className="px-3 pt-3 pb-4">
                    <View className="h-4 bg-paper-2 rounded w-3/4 self-center mb-4" />
                    <View className="flex-row items-center justify-between">
                        <View className="h-3 bg-paper-2 rounded w-1/2" />
                        <View className="h-7 bg-paper-2 rounded-xl w-14" />
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* Arena Header Decoration */}

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Arena Header */}
                <View className="px-gutter pt-6 flex-row justify-between items-center mb-8">
                    <View className="flex-row items-center">
                        <View>
                            <Text className="text-ink text-3xl font-display uppercase leading-tight">Reward <Text className="text-warning">Store</Text></Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Spend Your Fync Coins</Text>
                        </View>
                    </View>
                    <StampCard>
                        <View className="items-center py-3 px-4">
                            <Text className="font-display text-label text-ink-3 uppercase">Balance</Text>
                            <Text className="font-display text-ink mt-1" style={{ fontSize: 26, lineHeight: 28, letterSpacing: -0.8 }}>
                                {user?.coins || 0}
                            </Text>
                            <Text className="font-display text-label text-ink-3 uppercase">Fync Coins</Text>
                        </View>
                    </StampCard>
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 px-gutter pt-10">
                        <View className="flex-row justify-between mb-4">
                            <ProductSkeleton />
                            <ProductSkeleton />
                        </View>
                        <View className="flex-row justify-between">
                            <ProductSkeleton />
                            <ProductSkeleton />
                        </View>
                    </View>
                ) : (
                    <FlatList
                        data={products}
                        keyExtractor={(item) => item._id}
                        renderItem={renderProduct}
                        numColumns={2}
                        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 20 }}
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B45309" />}
                        ListEmptyComponent={
                            <View className="items-center mt-32 p-card-pad">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Ionicons name="storefront-outline" size={32} color="#C4BEB6" />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">Store Empty</Text>
                                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">New artifacts arriving soon.</Text>
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Checkout Modal (Bottom Sheet Style) */}
                <Modal visible={buyModalVisible} animationType="slide" transparent={true}>
                    <View className="flex-1 justify-end bg-ink/60">
                        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setBuyModalVisible(false)} />

                        <View className="bg-paper rounded-t-sheet h-[75%] overflow-hidden shadow-hair">
                            <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mt-4 mb-2" />

                            <KeyboardAvoidingView behavior="padding" className="flex-1">
                                <View className="px-gutter py-6 border-b border-line flex-row justify-between items-center bg-card">
                                    <View>
                                        <Text className="font-display text-ink uppercase text-h1">Checkout</Text>
                                        <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Shipping Destination</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setBuyModalVisible(false)} className="bg-paper-2 w-10 h-10 rounded-card items-center justify-center border border-line">
                                        <Ionicons name="close" size={20} color="#12100E" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView className="flex-1 p-card-pad" showsVerticalScrollIndicator={false}>
                                    <View className="flex-row items-center bg-paper-2 p-5 rounded-card mb-8 border border-line">
                                        <Image source={{ uri: selectedProduct?.product_image }} className="w-20 h-20 rounded-card bg-card border border-line" resizeMode="contain" />
                                        <View className="ml-5 flex-1">
                                            <Text className="text-ink font-display uppercase text-sm" numberOfLines={1}>{selectedProduct?.product_name}</Text>
                                            <View className="flex-row items-center mt-2 bg-card self-start px-2 py-1 rounded-lg border border-line">
                                                <Text className="text-warning font-display text-sm">{selectedProduct?.coins_required} Coins</Text>
                                                <Text className="text-xs ml-1"></Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View className="flex-row gap-4 mb-6">
                                        <View className="flex-1">
                                            <Text className="text-ink-3 font-display text-label uppercase mb-3 ml-1">Mobile Comms</Text>
                                            <TextInput
                                                className="font-semibold text-base text-ink bg-card px-5 py-4 border-[1.5px] border-ink shadow-hair rounded-md"
                                                placeholder="+91..."
                                                placeholderTextColor="#C4BEB6"
                                                keyboardType="phone-pad"
                                                value={phone}
                                                onChangeText={setPhone}
                                            />
                                        </View>
                                        <View className="w-1/3">
                                            <Text className="text-ink-3 font-display text-label uppercase mb-3 ml-1">Zip Code</Text>
                                            <TextInput
                                                className="font-semibold text-base text-ink bg-card px-5 py-4 border-[1.5px] border-ink shadow-hair rounded-md"
                                                placeholder="201206"
                                                placeholderTextColor="#C4BEB6"
                                                keyboardType="numeric"
                                                maxLength={6}
                                                value={pincode}
                                                onChangeText={setPincode}
                                            />
                                        </View>
                                    </View>

                                    <View className="mb-10">
                                        <Text className="text-ink-3 font-display text-label uppercase mb-3 ml-1">Delivery Node</Text>
                                        <TextInput
                                            className="bg-card px-5 py-5 font-medium text-xs border-[1.5px] border-ink shadow-hair text-ink h-28 rounded-md"
                                            placeholder="Complete address with landmark..."
                                            placeholderTextColor="#C4BEB6"
                                            multiline
                                            textAlignVertical="top"
                                            value={address}
                                            onChangeText={setAddress}
                                        />
                                    </View>
                                </ScrollView>

                                <View className="p-card-pad border-t border-line bg-card pb-12">
                                    <TouchableOpacity
                                        onPress={confirmPurchase}
                                        disabled={purchasing}
                                        className={`py-5 rounded-card items-center justify-center flex-row shadow-hair ${purchasing ? 'bg-paper-2' : 'bg-ink '}`}
                                    >
                                        {purchasing ? (
                                            <ActivityIndicator color="#B45309" />
                                        ) : (
                                            <>
                                                <Ionicons name="flash-outline" size={20} color="#B45309" />
                                                <Text className="text-white font-display uppercase text-xs ml-2">Authorize Redemption</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </KeyboardAvoidingView>
                        </View>
                    </View>
                </Modal>

            </SafeAreaView>
        </View>
    );
};

export default MarketplaceScreen;
