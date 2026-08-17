import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image,
    ActivityIndicator, StatusBar, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, ScrollView, RefreshControl, Animated,
    Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

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
                className="bg-white rounded-xl overflow-hidden mb-5 border border-slate-100 shadow-sm"
            >
                <View className="bg-slate-50 w-full items-center justify-center relative" style={{ aspectRatio: 1 }}>
                    <Image
                        source={{ uri: item.product_image }}
                        style={{ width: '85%', height: '85%' }}
                        resizeMode="contain"
                        className='rounded-xl'
                    />
                    {!item.is_available && (
                        <View className="absolute inset-0 bg-slate-900/40 items-center justify-center">
                            <View className="bg-white px-3 py-1 rounded-lg border border-slate-200">
                                <Text className="text-slate-900 font-black text-2xs uppercase tracking-wide">Stock Out</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View className="p-3">
                    <Text className="text-slate-900 font-bold text-xs mb-1" numberOfLines={1}>
                        {item.product_name}
                    </Text>

                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center">
                            <Text className="text-slate-900 font-black text-base tracking-tighter">{item.coins_required}</Text>
                            <Text className="text-2xs ml-1">🪙</Text>
                        </View>
                    </View>

                    {/* Buy Button */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleBuyItem(item)}
                        disabled={!item.is_available}
                        className={`w-full py-2.5 rounded-xl items-center justify-center flex-row ${item.is_available && canAfford ? 'bg-slate-900 shadow-lg shadow-black/20' : 'bg-slate-50 border border-slate-100'}`}
                    >
                        <Text className={`font-black text-2xs uppercase tracking-widest ${item.is_available && canAfford ? 'text-white' : 'text-slate-500'}`}>
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
                className="bg-white rounded-2xl overflow-hidden mb-4 border border-slate-100"
            >
                <View className="bg-slate-100 w-full" style={{ aspectRatio: 1 }} />
                <View className="px-3 pt-3 pb-4">
                    <View className="h-4 bg-slate-100 rounded w-3/4 self-center mb-4" />
                    <View className="flex-row items-center justify-between">
                        <View className="h-3 bg-slate-50 rounded w-1/2" />
                        <View className="h-7 bg-slate-100 rounded-xl w-14" />
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />

            {/* Arena Header Decoration */}
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient
                    colors={['#f59e0b', 'transparent']}
                    className="w-full h-full"
                />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Arena Header */}
                <View className="px-8 pt-6 flex-row justify-between items-center mb-8">
                    <View className="flex-row items-center">
                        <View>
                            <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">Reward <Text className="text-amber-500">Store</Text></Text>
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Spend Your Fync Coins</Text>
                        </View>
                    </View>
                    <View className="items-center border border-amber-100 bg-amber-50/50 py-2 px-4 rounded-2xl shadow-xl shadow-amber-500/10">
                        <Text className="text-amber-500 text-2xs font-black uppercase tracking-wide mb-1">Balance</Text>
                        <View className="flex-row items-center">
                            <Text className="text-amber-600 font-black text-lg mr-1">{user?.coins || 0}</Text>
                            <Text className="text-sm">🪙</Text>
                        </View>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 px-8 pt-10">
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
                        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 24 }}
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" />}
                        ListEmptyComponent={
                            <View className="items-center mt-32 p-10">
                                <View className="w-20 h-20 bg-white rounded-4xl items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                    <Ionicons name="storefront-outline" size={32} color="#CBD5E1" />
                                </View>
                                <Text className="text-slate-500 font-black  uppercase text-xs tracking-wide text-center">Store Empty</Text>
                                <Text className="text-slate-300 text-2xs font-bold uppercase mt-2 text-center">New artifacts arriving soon.</Text>
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
                    />
                )}

                {/* Checkout Modal (Bottom Sheet Style) */}
                <Modal visible={buyModalVisible} animationType="slide" transparent={true}>
                    <View className="flex-1 justify-end bg-slate-900/60">
                        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setBuyModalVisible(false)} />

                        <View className="bg-white rounded-t-5xl h-[75%] overflow-hidden shadow-2xl">
                            <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mt-4 mb-2" />

                            <KeyboardAvoidingView behavior="padding" className="flex-1">
                                <View className="px-8 py-6 border-b border-slate-50 flex-row justify-between items-center bg-white">
                                    <View>
                                        <Text className="text-2xl font-black text-slate-900 uppercase tracking-tight">Checkout</Text>
                                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Shipping Destination</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setBuyModalVisible(false)} className="bg-slate-50 w-10 h-10 rounded-2xl items-center justify-center border border-slate-100">
                                        <Ionicons name="close" size={20} color="#18181b" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView className="flex-1 p-8" showsVerticalScrollIndicator={false}>
                                    <View className="flex-row items-center bg-slate-50 p-5 rounded-3xl mb-8 border border-slate-100">
                                        <Image source={{ uri: selectedProduct?.product_image }} className="w-20 h-20 rounded-2xl bg-white border border-slate-200" resizeMode="contain" />
                                        <View className="ml-5 flex-1">
                                            <Text className="text-slate-900 font-black uppercase text-sm tracking-tight" numberOfLines={1}>{selectedProduct?.product_name}</Text>
                                            <View className="flex-row items-center mt-2 bg-white self-start px-2 py-1 rounded-lg border border-slate-100">
                                                <Text className="text-amber-600 font-black text-sm tracking-tighter">{selectedProduct?.coins_required} Coins</Text>
                                                <Text className="text-xs ml-1">🪙</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View className="flex-row gap-4 mb-6">
                                        <View className="flex-1">
                                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-3 ml-1">Mobile Comms</Text>
                                            <TextInput
                                                className="bg-white px-5 py-4 rounded-2xl font-black  uppercase text-xs border border-slate-100 shadow-sm text-slate-900"
                                                placeholder="+91..."
                                                placeholderTextColor="#CBD5E1"
                                                keyboardType="phone-pad"
                                                value={phone}
                                                onChangeText={setPhone}
                                            />
                                        </View>
                                        <View className="w-1/3">
                                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-3 ml-1">Zip Code</Text>
                                            <TextInput
                                                className="bg-white px-5 py-4 rounded-2xl font-black  uppercase text-xs border border-slate-100 shadow-sm text-slate-900"
                                                placeholder="201206"
                                                placeholderTextColor="#CBD5E1"
                                                keyboardType="numeric"
                                                maxLength={6}
                                                value={pincode}
                                                onChangeText={setPincode}
                                            />
                                        </View>
                                    </View>

                                    <View className="mb-10">
                                        <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-3 ml-1">Delivery Node</Text>
                                        <TextInput
                                            className="bg-white px-5 py-5 rounded-2xl font-medium text-xs border border-slate-100 shadow-sm text-slate-900 h-28"
                                            placeholder="Complete address with landmark..."
                                            placeholderTextColor="#CBD5E1"
                                            multiline
                                            textAlignVertical="top"
                                            value={address}
                                            onChangeText={setAddress}
                                        />
                                    </View>
                                </ScrollView>

                                <View className="p-8 border-t border-slate-50 bg-white pb-12">
                                    <TouchableOpacity
                                        onPress={confirmPurchase}
                                        disabled={purchasing}
                                        className={`py-5 rounded-3xl items-center justify-center flex-row shadow-2xl ${purchasing ? 'bg-slate-100' : 'bg-black shadow-black/40'}`}
                                    >
                                        {purchasing ? (
                                            <ActivityIndicator color="#f59e0b" />
                                        ) : (
                                            <>
                                                <Ionicons name="flash-outline" size={20} color="#f59e0b" />
                                                <Text className="text-white font-black  uppercase tracking-wide text-xs ml-2">Authorize Redemption</Text>
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
