import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image,
    ActivityIndicator, StatusBar, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, ScrollView, RefreshControl, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

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
            <View
                style={{ width: '48%' }}
                className="bg-white rounded-[24px] overflow-hidden mb-5 shadow-sm shadow-black/10 border border-zinc-100"
            >
                <View className="bg-zinc-800 w-full items-center justify-center" style={{ aspectRatio: 1 }}>
                    <Image
                        source={{ uri: item.product_image }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                    {!item.is_available && (
                        <View className="absolute inset-0 bg-black/50 items-center justify-center">
                            <Text className="text-white font-black text-[10px] uppercase tracking-widest">Sold Out</Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View className="p-3 pb-0">
                    <Text className="text-zinc-900 font-black text-xs uppercase tracking-tight" numberOfLines={1}>
                        {item.product_name}
                    </Text>
                    <Text className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider mb-2" numberOfLines={1}>
                        {item.product_description}
                    </Text>
                </View>

                {/* Buy Button */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleBuyItem(item)}
                    disabled={!item.is_available}
                    className={`mx-2 mb-2 py-3 rounded-xl items-center justify-center flex-row ${item.is_available ? 'bg-black' : 'bg-zinc-100'}`}
                >
                    <Text className={`font-black text-[10px] uppercase tracking-widest ${item.is_available ? 'text-white' : 'text-zinc-400'}`}>
                        {item.is_available ? `Buy • ${item.coins_required}` : 'Unavailable'}
                    </Text>
                    {item.is_available && <Text className="text-[10px] ml-1">🪙</Text>}
                </TouchableOpacity>
            </View>
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
                className="bg-white rounded-2xl overflow-hidden mb-4 border border-zinc-100"
            >
                <View className="bg-zinc-100 w-full" style={{ aspectRatio: 1 }} />
                <View className="px-3 pt-3 pb-4">
                    <View className="h-4 bg-zinc-100 rounded w-3/4 self-center mb-4" />
                    <View className="flex-row items-center justify-between">
                        <View className="h-3 bg-zinc-50 rounded w-1/2" />
                        <View className="h-7 bg-zinc-100 rounded-xl w-14" />
                    </View>
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-zinc-50">
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            <SafeAreaView className="flex-1 bg-white" edges={['top']}>

                {/* Header matching ClubListScreen */}
                <View className="px-5 py-4 flex-row justify-between items-center border-b border-zinc-100 bg-white shadow-sm shadow-black/5 z-10">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
                            <Ionicons name="chevron-back" size={24} color="#18181b" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-zinc-900 text-2xl font-black">Marketplace</Text>
                            <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">Spend Your Coins</Text>
                        </View>
                    </View>
                    <View className="items-center border border-amber-100 bg-amber-50 py-1.5 px-3 rounded-xl">
                        <Text className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Balance</Text>
                        <View className="flex-row items-center mt-0.5">
                            <Ionicons name="wallet-outline" size={12} color="#f59e0b" />
                            <Text className="text-amber-600 font-black text-sm ml-1">{user?.coins || 0}</Text>
                        </View>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 p-4">
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
                        columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 16 }}
                        contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}

                        ListEmptyComponent={
                            <View className="items-center mt-32 p-10">
                                <MaterialCommunityIcons name="storefront-outline" size={64} color="#e5e7eb" />
                                <Text className="text-zinc-400 font-black uppercase text-xs tracking-widest text-center mt-6">
                                    No products available{"\n"}Check back later
                                </Text>
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
                    />
                )}


                {/* Purchase Details Modal */}
                <Modal visible={buyModalVisible} animationType="slide" transparent={true}>
                    <View className="flex-1 justify-end bg-black/60">
                        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setBuyModalVisible(false)} />
                        
                        <View className="bg-white rounded-t-[40px] h-[65%] overflow-hidden">
                            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                                <View className="p-6 border-b border-zinc-100 flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-2xl font-black text-zinc-900">Checkout</Text>
                                        <Text className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">Delivery Details</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setBuyModalVisible(false)} className="bg-zinc-100 w-10 h-10 rounded-full items-center justify-center">
                                        <Ionicons name="close" size={24} color="#18181b" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                                    <View className="flex-row items-center bg-zinc-50 p-4 rounded-2xl mb-6 border border-zinc-100">
                                        <Image source={{ uri: selectedProduct?.product_image }} className="w-16 h-16 rounded-xl bg-white" resizeMode="contain" />
                                        <View className="ml-4 flex-1">
                                            <Text className="text-zinc-900 font-bold text-base" numberOfLines={1}>{selectedProduct?.product_name}</Text>
                                            <View className="flex-row items-center mt-1">
                                                <Text className="text-amber-600 font-black text-sm">{selectedProduct?.coins_required}</Text>
                                                <Text className="text-xs ml-1">🪙</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View className="flex-row gap-4 mb-4">
                                        <View className="flex-1">
                                            <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Mobile Number</Text>
                                            <TextInput 
                                                className="bg-zinc-50 px-5 py-4 rounded-2xl font-bold border border-zinc-100 text-zinc-900"
                                                placeholder="+91..."
                                                keyboardType="phone-pad"
                                                value={phone}
                                                onChangeText={setPhone}
                                            />
                                        </View>
                                        <View className="w-1/3">
                                            <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Pincode</Text>
                                            <TextInput 
                                                className="bg-zinc-50 px-5 py-4 rounded-2xl font-bold border border-zinc-100 text-zinc-900"
                                                placeholder="201206"
                                                keyboardType="numeric"
                                                maxLength={6}
                                                value={pincode}
                                                onChangeText={setPincode}
                                            />
                                        </View>
                                    </View>

                                    <View className="mb-6">
                                        <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Delivery Address</Text>
                                        <TextInput 
                                            className="bg-zinc-50 px-5 py-4 rounded-2xl font-semibold border border-zinc-100 text-zinc-900 h-24"
                                            placeholder="Complete address with landmark..."
                                            multiline
                                            textAlignVertical="top"
                                            value={address}
                                            onChangeText={setAddress}
                                        />
                                    </View>
                                </ScrollView>

                                <View className="p-6 border-t border-zinc-100 bg-white mb-8">
                                    <TouchableOpacity 
                                        onPress={confirmPurchase}
                                        disabled={purchasing}
                                        className={`py-4 rounded-2xl items-center justify-center flex-row shadow-lg ${purchasing ? 'bg-zinc-800' : 'bg-black shadow-black/20'}`}
                                    >
                                        {purchasing ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <>
                                                <Ionicons name="card" size={20} color="white" />
                                                <Text className="text-white font-black uppercase text-xs ml-2">Confirm & Purchase</Text>
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
