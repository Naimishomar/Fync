import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, Dimensions, ScrollView, Pressable, StatusBar } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Empty, Button, Chip, FilterChips, Label, Num, Tag, TagRow, ListRow, Avatar, Sheet, SearchField, FormField } from '../ui/kit';
import { ProductTile } from './ProductTile';

import FyncRefreshControl from '../ui/FyncRefreshControl';
const CATEGORIES = ['electronics', 'books', 'fashion', 'others'] as const;
const TABS = ['all', ...CATEGORIES] as const;
const CAT_LABEL: Record<string, string> = { all: 'All', electronics: 'Electronics', books: 'Books', fashion: 'Fashion', others: 'Others' };
// 20px gutter each side, 12 between the two columns.
const COLUMN_WIDTH = (Dimensions.get('window').width - 40 - 12) / 2;

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
        if (!name.trim() || !price.trim() || !desc.trim() || images.length === 0) {
            Alert.alert("Missing Fields", "Please fill all fields and add at least one image.");
            return;
        }
        if (!(Number(price) > 0)) {
            Alert.alert("Invalid Price", "Enter the price as a number, e.g. 499.");
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
        <Sheet
            visible={isVisible}
            onClose={onClose}
            title="List an item"
            height="85%"
            footer={<Button variant="primary" block title="Post listing" onPress={handleSell} loading={loading} />}
        >
            <View style={{ gap: 16 }}>
                <View style={{ gap: 8 }}>
                    <Label>Photos</Label>
                    <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                        <Pressable
                            onPress={pickImage}
                            accessibilityRole="button"
                            accessibilityLabel="Add photos"
                            className="w-24 h-24 bg-paper-2 border border-dashed border-line rounded-2xl items-center justify-center active:opacity-85"
                        >
                            <Ionicons name="camera-outline" size={24} color={C.ink2} />
                            <Text className="text-ink-3 text-xs font-medium mt-1">Add photos</Text>
                        </Pressable>
                        {images.map((img, index) => (
                            <ExpoImage key={img.uri ?? index} source={{ uri: img.uri }} style={{ width: 96, height: 96, borderRadius: 16, backgroundColor: C.paper2 }} />
                        ))}
                    </ScrollView>
                </View>

                <FormField label="Item name" value={name} onChangeText={setName} placeholder="What are you selling?" />
                <FormField label="Price (INR)" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="e.g. 499" />

                <View style={{ gap: 8 }}>
                    <Label>Category</Label>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {CATEGORIES.map(cat => (
                            <Chip key={cat} label={CAT_LABEL[cat]} active={category === cat} onPress={() => setCategory(cat)} />
                        ))}
                    </View>
                </View>

                <FormField label="Description" value={desc} onChangeText={setDesc} multiline numberOfLines={4} placeholder="Condition, age, what's included" />
            </View>
        </Sheet>
    );
};

const ProductDetailsModal = ({ product, isVisible, onClose, currentUserId, onDelete }: any) => {
    const navigation = useNavigation<any>();
    const startingChat = useRef(false);
    if (!product) return null;
    const isOwner = !!product.seller?._id && product.seller._id === currentUserId;

    const startChat = async () => {
        if (startingChat.current) return;
        startingChat.current = true;
        try {
            const res = await axios.post("/chat/start", { userId: product.seller?._id });
            onClose();
            navigation.navigate("Chat", {
                conversationId: res.data.conversation._id,
                otherUser: product.seller
            });
        } catch (err) {
            Alert.alert("Error", "Could not start chat");
        } finally {
            startingChat.current = false;
        }
    };

    return (
        <Sheet
            visible={isVisible}
            onClose={onClose}
            title={product.product_name}
            footer={isOwner
                ? <Button variant="danger" block icon="trash-outline" title="Remove listing" onPress={() => onDelete(product._id)} />
                : <Button variant="primary" block icon="chatbubbles-outline" title="Chat with seller" onPress={startChat} />}
        >
            <View style={{ gap: 16 }}>
                <ExpoImage
                    source={{ uri: product.product_image?.[0] }}
                    style={{ width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: C.paper2 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                />
                <View style={{ gap: 8 }}>
                    <Num style={{ fontSize: 24, lineHeight: 30 }}>₹{product.price}</Num>
                    <TagRow>
                        <Tag label={CAT_LABEL[product.product_type] ?? product.product_type} />
                        <Tag label={`Listed ${new Date(product.createdAt).toLocaleDateString()}`} />
                    </TagRow>
                </View>

                <View style={{ gap: 4 }}>
                    <Label>Seller</Label>
                    <ListRow
                        leading={<Avatar uri={product.seller?.avatar} initials={product.seller?.name || product.seller?.username} size={44} />}
                        title={product.seller?.name || product.seller?.username || 'Seller'}
                        subtitle={`@${product.seller?.username}${product.college ? ` · ${product.college}` : ''}`}
                        onPress={() => { onClose(); navigation.navigate("PublicProfile", { user: product?.seller }); }}
                    />
                </View>

                <View style={{ gap: 4 }}>
                    <Label>Description</Label>
                    <Text className="text-ink-2 text-base">{product.product_description}</Text>
                </View>
            </View>
        </Sheet>
    );
};

const MarketplaceScreen = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<typeof TABS[number]>('all');
    const [loadError, setLoadError] = useState(false);

    const [sellModalVisible, setSellModalVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

    const fetchProducts = async () => {
        try {
            const res = await axios.get('/olx/products');
            if (res.data?.success) {
                setProducts(res.data.products || []);
            }
            setLoadError(false);
        } catch (error) {
            console.log("Error fetching products", error);
            setLoadError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchProducts(); }, []);

    const filteredProducts = useMemo(() => {
        let res = products;
        const q = search.trim().toLowerCase();
        if (q) {
            res = res.filter(p => (p.product_name || '').toLowerCase().includes(q));
        }
        if (activeTab !== 'all') {
            res = res.filter(p => p.product_type === activeTab);
        }
        return res;
    }, [search, products, activeTab]);

    const handleDelete = async (id: string) => {
        Alert.alert("Remove listing", "Remove this item from the market?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Remove", style: "destructive", onPress: async () => {
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

    const renderProductItem = ({ item }: { item: Product }) => (
        <ProductTile
            image={item.product_image?.[0]}
            title={item.product_name}
            price={`₹${item.price}`}
            badge={CAT_LABEL[item.product_type] ?? item.product_type}
            width={COLUMN_WIDTH}
            onPress={() => setSelectedProduct(item)}
            footer={
                <View className="flex-row items-center pt-2 mt-1 border-t border-line" style={{ gap: 6 }}>
                    <Avatar uri={item.seller?.avatar} initials={item.seller?.username} size={20} />
                    <Text className="text-ink-3 text-xs flex-1" numberOfLines={1}>{item.seller?.username}</Text>
                </View>
            }
        />
    );

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar
                    title="Fync Market"
                    onBack={() => navigation.goBack()}
                    right={<IconBtn name="add" boxed accessibilityLabel="List an item" onPress={() => setSellModalVisible(true)} />}
                />
                <SearchField value={search} onChangeText={setSearch} placeholder="Search listings" containerStyle={{ marginHorizontal: 20, marginBottom: 12 }} />
                <FilterChips items={TABS} value={activeTab} onChange={setActiveTab} labels={CAT_LABEL} style={{ marginBottom: 12 }} />

                {loading && !refreshing ? (
                    <View className="mt-10 px-gutter">
                        <ActivityIndicator color={C.brand[500]} size="large" />
                    </View>
                ) : (
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={filteredProducts}
                        renderItem={renderProductItem}
                        keyExtractor={(item) => item._id}
                        numColumns={2}
                        columnWrapperStyle={{ paddingHorizontal: 20, justifyContent: 'space-between' }}
                        contentContainerStyle={{ paddingTop: 4, paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} tintColor={C.brand[500]} />
                        }
                        ListEmptyComponent={
                            <View className="mt-20">
                                {loadError && products.length === 0 ? (
                                    <Empty icon="cloud-offline-outline" title="Couldn't load listings" action={<Button title="Try again" onPress={() => { setLoading(true); fetchProducts(); }} />} />
                                ) : (
                                    <Empty icon="basket-outline" title="No listings yet" hint="Be the first to sell something here." action={<Button variant="primary" title="List an item" onPress={() => setSellModalVisible(true)} />} />
                                )}
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
            </View>
        </View>
    );
};

export default MarketplaceScreen;
