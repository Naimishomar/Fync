import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image,
    ActivityIndicator, StatusBar, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, ScrollView, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

const MarketplaceScreen = () => {
    const navigation = useNavigation<any>();
    const { user, setUser } = useAuth();
    // Admin status is determined server-side from GET /api/marketplace
    const [isAdmin, setIsAdmin] = useState(false);

    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Admin Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [newImage, setNewImage] = useState<any>(null);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newCoins, setNewCoins] = useState('');

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/api/marketplace');
            if (res.data.success) {
                setProducts(res.data.products);
                setIsAdmin(res.data.isAdmin); // Backend decides admin status
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

    const handleBuyItem = async (product: any) => {
        if ((user?.coins || 0) < product.coins_required) {
            return Alert.alert("Insufficient Balance", "You do not have enough coins to purchase this item.");
        }

        Alert.alert(
            "Confirm Purchase",
            `Are you sure you want to buy ${product.product_name} for ${product.coins_required} coins?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Purchase",
                    onPress: async () => {
                        try {
                            const res = await axios.post(`/api/marketplace/${product._id}/buy`);
                            if (res.data.success) {
                                Alert.alert("Success!", "Item purchased successfully!");
                                // Update local user state immediately
                                setUser((prev: any) => ({ ...prev, coins: prev.coins - product.coins_required }));
                            }
                        } catch (error: any) {
                            Alert.alert("Failed", error.response?.data?.message || "Purchase failed.");
                        }
                    }
                }
            ]
        );
    };

    // --- Admin Functions ---
    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],   // Square only
            quality: 0.8,
        });

        if (!result.canceled) {
            setNewImage(result.assets[0]);
        }
    };

    const handleCreateProduct = async () => {
        if (!newName || !newDesc || !newCoins || !newImage) {
            return Alert.alert("Missing Fields", "Please fill all details and select an image.");
        }
        if (newName.trim().length < 3) {
            return Alert.alert("Name Too Short", "Product name must be at least 3 characters.");
        }
        if (newDesc.trim().length < 3) {
            return Alert.alert("Description Too Short", "Please write a longer description (at least 3 characters).");
        }
        if (isNaN(Number(newCoins)) || Number(newCoins) <= 0) {
            return Alert.alert("Invalid Coins", "Please enter a valid coin amount greater than 0.");
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('product_name', newName);
            formData.append('product_description', newDesc);
            formData.append('coins_required', newCoins);

            const uriParts = newImage.uri.split('.');
            const fileType = uriParts[uriParts.length - 1];
            formData.append('product_image', {
                uri: newImage.uri,
                name: `marketplace_image.${fileType}`,
                type: `image/${fileType}`,
            } as any);

            const res = await axios.post('/api/marketplace/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                Alert.alert("Created", "Product successfully added to the marketplace!");
                setShowAddModal(false);
                setNewName(''); setNewDesc(''); setNewCoins(''); setNewImage(null);
                fetchProducts();
            }
        } catch (error: any) {
            Alert.alert("Error Failed", error.response?.data?.message || "Failed to create product.");
        } finally {
            setSaving(false);
        }
    };

    // --- Renders ---
    const renderProduct = ({ item }: { item: any }) => {
        const canAfford = (user?.coins || 0) >= item.coins_required;

        return (
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => handleBuyItem(item)}
                disabled={!item.is_available}
                style={{ width: '48%' }}
                className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm shadow-black/10 border border-zinc-100"
            >
                <View className="bg-zinc-800 w-full items-center justify-center" style={{ aspectRatio: 1 }}>
                    <Image
                        source={{ uri: item.product_image }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                    />
                    {!item.is_available && (
                        <View className="absolute inset-0 bg-black/50 items-center justify-center">
                            <Text className="text-white font-black text-[10px] uppercase tracking-widest">Out of Stock</Text>
                        </View>
                    )}
                </View>

                {/* Product Name Centered below image */}
                <Text className="text-zinc-900 font-bold text-sm text-center px-3 pt-2.5 pb-1" numberOfLines={1}>
                    {item.product_name}
                </Text>

                {/* Bottom row: description + coin pill */}
                <View className="flex-row items-center justify-between px-3 pb-3 pt-1">
                    <Text className="text-zinc-400 text-[11px] flex-1 mr-2" numberOfLines={1}>
                        {item.product_description}
                    </Text>
                    <View className={`flex-row items-center px-2.5 py-1.5 rounded-xl ${canAfford && item.is_available ? 'bg-amber-100' : 'bg-zinc-100'}`}>
                        <Text className={`font-black text-xs mr-1 ${canAfford && item.is_available ? 'text-amber-700' : 'text-zinc-400'}`}>
                            {item.coins_required.toLocaleString()}
                        </Text>
                        <Text className="text-base" style={{ lineHeight: 18 }}>🪙</Text>
                    </View>
                </View>
            </TouchableOpacity>
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

                {loading ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="large" color="#000" />
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
                        ListHeaderComponent={
                            isAdmin ? (
                                <TouchableOpacity
                                    onPress={() => setShowAddModal(true)}
                                    className="mx-4 mb-6 bg-zinc-900 p-5 rounded-2xl flex-row items-center justify-between shadow-xl shadow-black/20"
                                >
                                    <View className="flex-row items-center">
                                        <View className="w-10 h-10 bg-pink-500 rounded-xl items-center justify-center">
                                            <Ionicons name="add" size={24} color="white" />
                                        </View>
                                        <View className="ml-4">
                                            <Text className="text-white font-black uppercase text-[10px] tracking-widest mb-0.5">Admin Controls</Text>
                                            <Text className="text-white/60 text-[8px] font-bold uppercase tracking-widest">Publish New Product</Text>
                                        </View>
                                    </View>
                                    <Feather name="chevron-right" size={18} color="white" />
                                </TouchableOpacity>
                            ) : null
                        }
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

                {/* Admin Add Product Modal */}
                <Modal visible={showAddModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddModal(false)}>
                    <View className="flex-1 justify-end bg-black/60">
                        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setShowAddModal(false)} />
                        
                        <View className="bg-white rounded-t-[40px] h-[85%] overflow-hidden shadow-2xl">
                            {/* Grab Handle */}
                            <View className="items-center pt-3 pb-1">
                                <View className="w-12 h-1.5 bg-zinc-200 rounded-full" />
                            </View>

                            <KeyboardAvoidingView 
                                behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                                className="flex-1"
                            >
                                <View className="flex-row items-center justify-between px-6 py-4 border-b border-zinc-100">
                                    <Text className="text-2xl font-black uppercase tracking-tight text-zinc-900">Add Product</Text>
                                    <TouchableOpacity onPress={() => setShowAddModal(false)} className="bg-zinc-100 w-8 h-8 rounded-full items-center justify-center">
                                        <Feather name="x" size={18} color="black" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView className="flex-1 p-6 space-y-5" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                                    {/* Centered square image picker */}
                                    <View className="items-center mb-6">
                                        <TouchableOpacity
                                            onPress={handlePickImage}
                                            activeOpacity={0.8}
                                            style={{ width: 160, height: 160 }}
                                            className={`rounded-3xl overflow-hidden items-center justify-center border-2 border-dashed ${newImage ? 'border-pink-300 bg-zinc-800' : 'border-zinc-200 bg-zinc-50'}`}
                                        >
                                            {newImage ? (
                                                <>
                                                    <Image source={{ uri: newImage.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                                    <View className="absolute inset-0 bg-black/30 items-center justify-center">
                                                        <Ionicons name="pencil" size={22} color="white" />
                                                        <Text className="text-white font-bold text-[9px] mt-1 uppercase tracking-widest">Change</Text>
                                                    </View>
                                                </>
                                            ) : (
                                                <View className="items-center">
                                                    <View className="bg-white w-12 h-12 rounded-full items-center justify-center mb-2 shadow-sm border border-zinc-100">
                                                        <Ionicons name="camera" size={24} color="#52525b" />
                                                    </View>
                                                    <Text className="text-zinc-500 font-bold uppercase tracking-widest text-[9px]">Tap to Upload</Text>
                                                    <Text className="text-zinc-400 text-[8px] mt-0.5">Square Image</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    <View className="mb-4">
                                        <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Product Title</Text>
                                        <TextInput 
                                            className="bg-zinc-50 px-5 py-4 rounded-2xl font-bold border border-zinc-100 text-zinc-900"
                                            placeholder="e.g. Fync Premium Hoodie"
                                            value={newName}
                                            onChangeText={setNewName}
                                        />
                                    </View>

                                    <View className="mb-4">
                                        <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Coins Required</Text>
                                        <TextInput 
                                            className="bg-zinc-50 px-5 py-4 rounded-2xl font-bold border border-zinc-100 text-zinc-900"
                                            placeholder="500"
                                            keyboardType="numeric"
                                            value={newCoins}
                                            onChangeText={setNewCoins}
                                        />
                                    </View>

                                    <View className="mb-8">
                                        <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Description</Text>
                                        <TextInput 
                                            className="bg-zinc-50 px-5 py-4 rounded-2xl font-semibold border border-zinc-100 text-zinc-900 h-28"
                                            placeholder="Describe the product..."
                                            multiline
                                            numberOfLines={3}
                                            textAlignVertical="top"
                                            value={newDesc}
                                            onChangeText={setNewDesc}
                                        />
                                    </View>
                                </ScrollView>

                                <View className="p-4 border-t border-zinc-100 bg-white mb-5">
                                    <TouchableOpacity 
                                        onPress={handleCreateProduct}
                                        disabled={saving}
                                        className={`py-4 rounded-2xl items-center justify-center flex-row shadow-lg ${saving ? 'bg-zinc-800' : 'bg-black shadow-black/20'}`}
                                    >
                                        {saving ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <>
                                                <Ionicons name="cloud-upload" size={20} color="white" />
                                                <Text className="text-white font-black uppercase text-xs ml-2">Publish to Store</Text>
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
