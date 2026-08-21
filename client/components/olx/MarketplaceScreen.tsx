import React, { useEffect, useState, useRef } from 'react';
import {View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Dimensions, ScrollView, Pressable, StatusBar, Animated} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 2 - 28;

// --- TYPES ---
interface Product {
    _id: string;
    product_name: string;
    product_description: string;
    product_image: string[];
    product_type: string;
    price: number;
    seller: {
        _id: string;
        name: string;
        username: string;
        avatar: string;
    };
    college: string;
    createdAt: string;
}

const SellProductModal = ({ isVisible, onClose, onSuccess }: any) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [desc, setDesc] = useState('');
    const [category, setCategory] = useState('electronics');
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
        });
        if (!result.canceled) setImages(result.assets);
    };

    const handleSell = async () => {
        if (!name || !price || !desc || images.length === 0) {
            Alert.alert("Missing Fields", "Please fill all fields and add at least one image.");
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('product_name', name);
            formData.append('product_description', desc);
            formData.append('price', price);
            formData.append('product_type', category);
            images.forEach((img, index) => {
                // @ts-ignore
                formData.append('image', { uri: img.uri, type: 'image/jpeg', name: `product_${index}.jpg` });
            });
            const res = await axios.post('/olx/sell', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success) {
                Alert.alert("Success", "Product listed successfully!");
                onSuccess();
                onClose();
                setName(''); setPrice(''); setDesc(''); setImages([]);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to list product.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 bg-ink/60 justify-end">
                <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={onClose} />
                <View className="bg-paper rounded-t-sheet h-[75%] overflow-hidden shadow-hair">
                    <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mt-4 mb-2" />

                    <View className="flex-row justify-between items-center px-gutter py-2 border-b border-line">
                        <Text className="text-ink font-display uppercase text-h1">List <Text className="text-accent-text">Artifact</Text></Text>
                        <TouchableOpacity onPress={onClose} className="bg-card p-2 rounded-full border border-line">
                            <Ionicons name="close" size={20} color="#12100E" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-card-pad" showsVerticalScrollIndicator={false}>
                        <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                          <Text className="text-ink-3 text-label font-display uppercase">Visual Documentation</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                            <TouchableOpacity onPress={pickImage} className="w-28 h-28 bg-card border border-dashed border-line rounded-card items-center justify-center mr-4 shadow-hair">
                                <Ionicons name="camera-outline" size={24} color="#F97316" />
                                <Text className="text-ink-3 text-label font-display uppercase mt-2">Add Assets</Text>
                            </TouchableOpacity>
                            {images.map((img, index) => (<Image key={index} source={{ uri: img.uri }} className="w-28 h-28 rounded-card mr-4 bg-paper-2 border border-line" />))}
                        </ScrollView>

                        <Text className="text-ink-3 text-label font-display uppercase mb-4">Metadata Details</Text>
                        <TextInput value={name} onChangeText={setName} className="font-semibold text-base text-ink bg-card p-5 border-[1.5px] border-ink shadow-hair mb-4 rounded-md" placeholder="Artifact Name" placeholderTextColor="#C4BEB6" />
                        <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" className="font-semibold text-base text-ink bg-card p-5 border-[1.5px] border-ink shadow-hair mb-6 rounded-md" placeholder="Valuation (INR)" placeholderTextColor="#C4BEB6" />

                        <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                          <Text className="text-ink-3 text-label font-display uppercase">Classification</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-8">
                            {['electronics', 'books', 'fashion', 'others'].map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setCategory(cat)}
                                    className={`px-6 py-3 rounded-card border mr-3 ${category === cat ? 'bg-ink border-ink shadow-hair ' : 'bg-card border-line shadow-hair'}`}
                                >
                                    <Text className={`font-display uppercase text-label ${category === cat ? 'text-white' : 'text-ink-3'}`}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text className="text-ink-3 text-label font-display uppercase mb-4 mt-2">Technical Description</Text>
                        <TextInput value={desc} onChangeText={setDesc} multiline numberOfLines={4} className="bg-card text-ink p-5 border-[1.5px] border-ink shadow-hair mb-10 font-medium text-xs leading-5 rounded-md" placeholder="Operational status, physical condition, etc." placeholderTextColor="#C4BEB6" textAlignVertical="top" />

                        <TouchableOpacity onPress={handleSell} disabled={loading} className={`p-5 rounded-card items-center mb-20 shadow-hair ${loading ? 'bg-paper-2' : 'bg-ink '}`}>
                            {loading ? <ActivityIndicator color="#F97316" /> : <Text className="text-white font-display uppercase text-xs">Deploy to Marketplace</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const ProductDetailsModal = ({ product, isVisible, onClose, currentUserId, onDelete }: any) => {
    const navigation = useNavigation<any>();
    if (!product) return null;
    const isOwner = product.seller._id === currentUserId;

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 bg-ink/60 justify-end">
                <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={onClose} />
                <View className="bg-paper rounded-t-sheet overflow-hidden max-h-[90%] w-full shadow-hair">
                    <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mt-4 mb-2" />
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="relative">
                            <Image source={{ uri: product.product_image[0] }} className="w-full h-96 bg-paper-2" resizeMode="cover" />
                        </View>

                        <View className="p-card-pad">
                            <View className="flex-row justify-between items-start mb-6">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="bg-brand-500 px-2 py-0.5 rounded mr-2">
                                            <Text className="text-ink font-display text-label uppercase">{product.product_type}</Text>
                                        </View>
                                        <Text className="text-ink-3 text-label font-semibold uppercase">Listing ID: {product._id.slice(-6)}</Text>
                                    </View>
                                    <Text className="text-ink text-3xl font-display uppercase mb-2 leading-tight">{product.product_name}</Text>
                                    <View className="flex-row items-center">
                                        <Text className="text-ink text-2xl font-display mr-2">₹{product.price}</Text>
                                        <View className="bg-success/10 border border-success/15 px-2.5 py-1 rounded-full">
                                            <Text className="text-success font-display text-label uppercase">In Stock</Text>
                                        </View>
                                    </View>
                                </View>
                                {isOwner && (
                                    <TouchableOpacity onPress={() => onDelete(product._id)} className="bg-danger/10 p-3 rounded-card border border-danger/15 shadow-hair">
                                        <Ionicons name="trash-outline" size={20} color="#DB2777" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                              <Text className="text-ink-3 text-label font-display uppercase">Seller Information</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <Pressable
                                onPress={() => { onClose(); navigation.navigate("PublicProfile", { user: product?.seller }); }}
                                className="flex-row items-center mb-8 bg-paper-2 p-4 rounded-card border border-line"
                            >
                                <Image
                                    source={{ uri: product.seller.avatar || `https://ui-avatars.com/api/?name=${product.seller.username}` }}
                                    className="w-12 h-12 rounded-xl bg-card border border-line"
                                />
                                <View className="ml-4">
                                    <Text className="font-semibold text-base text-ink">{product.seller.name}</Text>
                                    <Text className="text-ink-3 text-label font-semibold uppercase mt-1">@{product.seller.username} • {product.college}</Text>
                                </View>
                                <View className="ml-auto w-8 h-8 bg-card rounded-full items-center justify-center border border-line">
                                    <Ionicons name="chevron-forward" size={14} color="#C4BEB6" />
                                </View>
                            </Pressable>

                            <View className="flex-row items-center mt-6 mb-2" style={{ gap: 12 }}>
                              <Text className="text-ink-3 text-label font-display uppercase">Description</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <Text className="text-ink-2 font-medium text-sm leading-6 mb-8">"{product.product_description}"</Text>

                            <View className="flex-row gap-3 mb-10">
                                <View className="bg-ink border border-ink px-2.5 py-1 rounded-full">
                                    <Text className="text-white text-label font-display uppercase">{product.product_type}</Text>
                                </View>
                                <View className="bg-card border border-line px-2.5 py-1 rounded-full">
                                    <Text className="text-ink-3 text-label font-display uppercase">Listed {new Date(product.createdAt).toLocaleDateString()}</Text>
                                </View>
                            </View>

                            {!isOwner && (
                                <TouchableOpacity
                                    className="bg-brand-500 w-full p-5 items-center flex-row justify-center gap-3 mb-8 border-2 border-ink rounded-md"
                                    onPress={async () => {
                                        try {
                                            const res = await axios.post("/chat/start", { userId: product.seller?._id });
                                            onClose();
                                            navigation.navigate("Chat", {
                                                conversationId: res.data.conversation._id,
                                                otherUser: product.seller
                                            });
                                        } catch (err) {
                                            Alert.alert("Error", "Could not start chat");
                                        }
                                    }}
                                >
                                    <Ionicons name="chatbubbles" size={20} color="white" />
                                    <Text className="text-white font-display uppercase text-xs">Chat with Seller</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>

                    <TouchableOpacity onPress={onClose} className="absolute top-6 right-6 bg-black/30 p-2 rounded-xl border border-white/20">
                        <Ionicons name="close" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const MarketplaceScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState('all');

    const [sellModalVisible, setSellModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const fetchProducts = async () => {
        try {
            if (!refreshing) setLoading(true);
            const res = await axios.get('/olx/products');
            if (res.data.success) {
                setProducts(res.data.products);
                setFilteredProducts(res.data.products);
            }
        } catch (error) {
            console.log("Error fetching products", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    useEffect(() => {
        let res = products;
        if (search.trim()) {
            res = res.filter(p => p.product_name.toLowerCase().includes(search.toLowerCase()));
        }
        if (activeTab !== 'all') {
            res = res.filter(p => p.product_type === activeTab);
        }
        setFilteredProducts(res);
    }, [search, products, activeTab]);

    const handleDelete = async (id: string) => {
        Alert.alert("Evict Item", "Are you sure you want to remove this listed asset?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Evict", style: "destructive", onPress: async () => {
                    try {
                        await axios.post(`/olx/delete/${id}`);
                        setProducts(prev => prev.filter(p => p._id !== id));
                        setSelectedProduct(null);
                    } catch (error) {
                        Alert.alert("Error", "Request failed.");
                    }
                }
            }
        ]);
    };

    const COLUMN_WIDTH = (width - 48 - 12) / 2; // 48 is horizontal padding, 12 is gap between cards

    const renderProductItem = ({ item, index }: { item: Product; index: number }) => (
        <Pressable
            onPress={() => setSelectedProduct(item)}
            className={`bg-card rounded-card overflow-hidden mb-4 ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}
            style={index === 0
              ? { width: COLUMN_WIDTH, shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 }
              : { width: COLUMN_WIDTH }}
        >
            <View className="relative bg-paper-2">
                <Image
                    source={{ uri: item.product_image[0] }}
                    className="w-full h-44"
                    resizeMode="cover"
                />
                {/* Badge */}
                <View className="absolute bottom-2 left-2 bg-brand-500 px-2 py-0.5 rounded-md">
                    <Text className="text-ink text-label font-display uppercase">{item.product_type}</Text>
                </View>
            </View>

            <View className="p-3">
                <Text className="text-ink font-semibold text-xs mb-1" numberOfLines={1}>
                    {item.product_name}
                </Text>

                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center">
                        <Text className="text-ink font-semibold text-base">₹{item.price}</Text>
                    </View>
                </View>

                <View className="flex-row items-center pt-2 border-t border-line">
                    <Image
                        source={{ uri: item.seller.avatar || `https://ui-avatars.com/api/?name=${item.seller.username}` }}
                        className="w-4 h-4 rounded-full mr-1.5 bg-paper-2"
                    />
                    <Text className="text-ink-3 text-label font-medium flex-1" numberOfLines={1}>
                        {item.seller.username}
                    </Text>
                    <View className="bg-paper-2 px-1.5 py-0.5 rounded border border-line">
                        <Text className="text-ink-3 text-label font-display uppercase">Verified</Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Arena Header */}
                <View className='px-gutter pt-6 bg-transparent'>
                    <View className="flex-row items-center justify-between mb-8">
                        <View>
                            <Text className="text-ink text-4xl font-display uppercase leading-tight">Fync <Text className="text-accent-text">Market</Text></Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Campus Asset exchange</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setSellModalVisible(true)}
                            className="w-14 h-14 rounded-card items-center justify-center bg-ink shadow-hair"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* SEARCH DOCK */}
                    <View className="flex-row items-center bg-card px-5 py-1.5 border-2 border-ink shadow-hair mb-8 rounded-md">
                        <Ionicons name="search" size={20} color="#8B857E" />
                        <TextInput
                            placeholder="Search artifacts..."
                            placeholderTextColor="#C4BEB6"
                            value={search}
                            onChangeText={setSearch}
                            className="flex-1 text-ink font-semibold text-sm p-3"
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch("")}>
                                <Ionicons name="close-circle" size={18} color="#C4BEB6" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* CATEGORY CHIPS */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6">
                        {['all', 'electronics', 'books', 'fashion', 'others'].map(tab => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                className={`px-6 py-3 rounded-xl border border-line mr-3 ${activeTab === tab ? 'bg-ink shadow-hair ' : 'bg-card shadow-hair'}`}
                            >
                                <Text className={`font-display text-label uppercase ${activeTab === tab ? 'text-white' : 'text-ink-3'}`}>{tab}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {loading && !refreshing ? (
                    <View className="mt-10 px-gutter">
                        <ActivityIndicator color="#F97316" size="large" />
                        <Text className="font-sans text-sm text-ink-3 text-center mt-4">Syncing Marketplace Indices...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredProducts}
                        renderItem={renderProductItem}
                        keyExtractor={(item) => item._id}
                        numColumns={2}
                        columnWrapperStyle={{ paddingHorizontal: 20 }}
                        contentContainerStyle={{ paddingTop: 10, paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} tintColor="#F97316" />
                        }
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 px-gutter">
                                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                    <Ionicons name="basket-outline" size={32} color="#C4BEB6" />
                                </View>
                                <Text className="font-semibold text-base text-ink text-center">No Active Listings</Text>
                                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Be the first hunter to deploy assets here.</Text>
                            </View>
                        }
                    />
                )}

                <SellProductModal
                    isVisible={sellModalVisible}
                    onClose={() => setSellModalVisible(false)}
                    onSuccess={fetchProducts}
                />

                <ProductDetailsModal
                    product={selectedProduct}
                    isVisible={!!selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    currentUserId={user?._id}
                    onDelete={handleDelete}
                />
            </SafeAreaView>
        </View>
    );
};

export default MarketplaceScreen;
