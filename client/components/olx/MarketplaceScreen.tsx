import React, { useEffect, useState, useRef } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Modal, TextInput, 
  Alert, Dimensions, ScrollView, Pressable, StatusBar, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

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
            <View className="flex-1 bg-zinc-900/60 justify-end">
                <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={onClose} />
                <View className="bg-[#F8FAFC] rounded-t-[48px] h-[75%] overflow-hidden shadow-2xl">
                    <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mt-4 mb-2" />
                    
                    <View className="flex-row justify-between items-center px-8 py-2 border-b border-slate-100">
                        <Text className="text-zinc-900 text-2xl font-black uppercase tracking-tight">List <Text className="text-orange-500">Artifact</Text></Text>
                        <TouchableOpacity onPress={onClose} className="bg-white p-2 rounded-full border border-slate-100">
                            <Ionicons name="close" size={20} color="#18181b" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-8" showsVerticalScrollIndicator={false}>
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Visual Documentation</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                            <TouchableOpacity onPress={pickImage} className="w-28 h-28 bg-white border border-dashed border-slate-200 rounded-3xl items-center justify-center mr-4 shadow-sm">
                                <Ionicons name="camera-outline" size={24} color="#f97316" />
                                <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-2">Add Assets</Text>
                            </TouchableOpacity>
                            {images.map((img, index) => (<Image key={index} source={{ uri: img.uri }} className="w-28 h-28 rounded-3xl mr-4 bg-slate-100 border border-slate-200" />))}
                        </ScrollView>
                        
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Metadata Details</Text>
                        <TextInput value={name} onChangeText={setName} className="bg-white text-zinc-900 p-5 rounded-3xl border border-slate-100 shadow-sm mb-4 font-black italic uppercase text-xs" placeholder="Artifact Name" placeholderTextColor="#CBD5E1" />
                        <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" className="bg-white text-zinc-900 p-5 rounded-3xl border border-slate-100 shadow-sm mb-6 font-black italic uppercase text-xs" placeholder="Valuation (INR)" placeholderTextColor="#CBD5E1" />
                        
                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Classification</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-8">
                            {['electronics', 'books', 'fashion', 'others'].map(cat => (
                                <TouchableOpacity 
                                    key={cat}
                                    onPress={() => setCategory(cat)}
                                    className={`px-6 py-3 rounded-2xl border mr-3 ${category === cat ? 'bg-zinc-900 border-zinc-900 shadow-lg shadow-black/20' : 'bg-white border-slate-100 shadow-sm'}`}
                                >
                                    <Text className={`font-black uppercase italic text-[9px] tracking-widest ${category === cat ? 'text-white' : 'text-slate-400'}`}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 mt-2">Technical Description</Text>
                        <TextInput value={desc} onChangeText={setDesc} multiline numberOfLines={4} className="bg-white text-zinc-900 p-5 rounded-3xl border border-slate-100 shadow-sm mb-10 font-medium text-xs leading-5" placeholder="Operational status, physical condition, etc." placeholderTextColor="#CBD5E1" textAlignVertical="top" />
                        
                        <TouchableOpacity onPress={handleSell} disabled={loading} className={`p-5 rounded-[24px] items-center mb-20 shadow-xl ${loading ? 'bg-slate-100' : 'bg-zinc-900 shadow-black/20'}`}>
                            {loading ? <ActivityIndicator color="#f97316" /> : <Text className="text-white font-black uppercase tracking-widest text-xs">Deploy to Marketplace</Text>}
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
             <View className="flex-1 bg-zinc-900/60 justify-end">
                <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={onClose} />
                <View className="bg-white rounded-t-[48px] overflow-hidden max-h-[90%] w-full shadow-2xl">
                    <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mt-4 mb-2" />
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="relative">
                            <Image source={{ uri: product.product_image[0] }} className="w-full h-96 bg-slate-50" resizeMode="cover" />
                        </View>
                        
                        <View className="p-8">
                            <View className="flex-row justify-between items-start mb-6">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className="bg-orange-500 px-2 py-0.5 rounded mr-2">
                                            <Text className="text-white font-black text-[7px] uppercase tracking-widest">{product.product_type}</Text>
                                        </View>
                                        <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">Listing ID: {product._id.slice(-6)}</Text>
                                    </View>
                                    <Text className="text-zinc-900 text-3xl font-black uppercase tracking-tighter mb-2 leading-tight">{product.product_name}</Text>
                                    <View className="flex-row items-center">
                                        <Text className="text-zinc-900 text-2xl font-black tracking-tighter mr-2">₹{product.price}</Text>
                                        <View className="bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                            <Text className="text-green-600 font-black text-[8px] uppercase tracking-widest">In Stock</Text>
                                        </View>
                                    </View>
                                </View>
                                {isOwner && (
                                    <TouchableOpacity onPress={() => onDelete(product._id)} className="bg-rose-50 p-3 rounded-2xl border border-rose-100 shadow-sm">
                                        <Ionicons name="trash-outline" size={20} color="#f43f5e" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Seller Information</Text>
                            <Pressable 
                                onPress={() => { onClose(); navigation.navigate("PublicProfile", { user: product?.seller }); }} 
                                className="flex-row items-center mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100"
                            >
                                <Image 
                                    source={{ uri: product.seller.avatar || `https://ui-avatars.com/api/?name=${product.seller.username}` }} 
                                    className="w-12 h-12 rounded-xl bg-white border border-slate-200"
                                />
                                <View className="ml-4">
                                    <Text className="text-zinc-900 font-black uppercase text-xs tracking-tight">{product.seller.name}</Text>
                                    <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">@{product.seller.username} • {product.college}</Text>
                                </View>
                                <View className="ml-auto w-8 h-8 bg-white rounded-full items-center justify-center border border-slate-100">
                                    <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                                </View>
                            </Pressable>

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Description</Text>
                            <Text className="text-zinc-600 font-medium text-sm leading-6 mb-8 italic">"{product.product_description}"</Text>
                            
                            <View className="flex-row gap-3 mb-10">
                                <View className="bg-zinc-900 px-5 py-2.5 rounded-2xl border border-black shadow-sm">
                                    <Text className="text-white text-[9px] font-black uppercase tracking-widest">{product.product_type}</Text>
                                </View>
                                <View className="bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                                    <Text className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Listed {new Date(product.createdAt).toLocaleDateString()}</Text>
                                </View>
                            </View>

                            {!isOwner && (
                                <TouchableOpacity 
                                    className="bg-orange-500 w-full p-5 rounded-2xl items-center flex-row justify-center gap-3 shadow-xl shadow-orange-500/20 mb-8"
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
                                    <Text className="text-white font-black uppercase tracking-widest text-xs">Chat with Seller</Text>
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

const renderProductItem = ({ item }: { item: Product }) => (
    <Pressable 
        onPress={() => setSelectedProduct(item)}
        className="bg-white rounded-xl overflow-hidden mb-4 border border-slate-100 shadow-sm"
        style={{ width: COLUMN_WIDTH }}
    >
        <View className="relative bg-slate-50">
            <Image 
                source={{ uri: item.product_image[0] }} 
                className="w-full h-44" 
                resizeMode="cover"
            />
            {/* Badge */}
            <View className="absolute bottom-2 left-2 bg-orange-500 px-2 py-0.5 rounded-md">
                <Text className="text-white text-[7px] font-black uppercase tracking-widest">{item.product_type}</Text>
            </View>
        </View>
        
        <View className="p-3">
            <Text className="text-zinc-900 font-bold text-xs mb-1" numberOfLines={1}>
                {item.product_name}
            </Text>
            
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                    <Text className="text-zinc-900 font-black text-base tracking-tighter">₹{item.price}</Text>
                </View>
            </View>

            <View className="flex-row items-center pt-2 border-t border-slate-50">
                <Image 
                    source={{ uri: item.seller.avatar || `https://ui-avatars.com/api/?name=${item.seller.username}` }} 
                    className="w-4 h-4 rounded-full mr-1.5 bg-slate-200"
                />
                <Text className="text-slate-400 text-[8px] font-medium flex-1" numberOfLines={1}>
                    {item.seller.username}
                </Text>
                <View className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                    <Text className="text-slate-400 text-[6px] font-black uppercase">Verified</Text>
                </View>
            </View>
        </View>
    </Pressable>
);

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
          <LinearGradient 
              colors={['#f97316', 'transparent']} 
              className="w-full h-full"
          />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Arena Header */}
        <View className='px-8 pt-6 bg-transparent'>
            <View className="flex-row items-center justify-between mb-8">
                <View>
                    <Text className="text-zinc-900 text-4xl font-black tracking-tighter uppercase leading-tight">Fync <Text className="text-orange-500">Market</Text></Text>
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-0.5">Campus Asset exchange</Text>
                </View>
                <TouchableOpacity 
                    onPress={() => setSellModalVisible(true)} 
                    className="w-14 h-14 rounded-2xl items-center justify-center bg-zinc-900 shadow-2xl shadow-black/40"
                >
                    <Ionicons name="add" size={28} color="white" />
                </TouchableOpacity>
            </View>

            {/* SEARCH DOCK */}
            <View className="flex-row items-center bg-white px-5 py-1.5 rounded-2xl border border-slate-100 shadow-xl shadow-black/5 mb-8">
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput 
                    placeholder="Search artifacts..." 
                    placeholderTextColor="#CBD5E1" 
                    value={search}
                    onChangeText={setSearch}
                    className="flex-1 text-zinc-900 font-bold text-sm tracking-tight p-3" 
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch("")}>
                        <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                )}
            </View>

            {/* CATEGORY CHIPS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6">
                {['all', 'electronics', 'books', 'fashion', 'others'].map(tab => (
                    <TouchableOpacity 
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={`px-6 py-3 rounded-xl border border-slate-100 mr-3 ${activeTab === tab ? 'bg-zinc-900 shadow-lg shadow-black/20' : 'bg-white shadow-sm'}`}
                    >
                        <Text className={`font-black text-[9px] uppercase tracking-widest ${activeTab === tab ? 'text-white' : 'text-slate-400'}`}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>

        {loading && !refreshing ? (
            <View className="mt-10 px-8">
                <ActivityIndicator color="#f97316" size="large" />
                <Text className="text-slate-400 text-center font-black italic uppercase text-[10px] tracking-widest mt-4">Syncing Marketplace Indices...</Text>
            </View>
        ) : (
            <FlatList
                data={filteredProducts}
                renderItem={renderProductItem}
                keyExtractor={(item) => item._id}
                numColumns={2}
                columnWrapperStyle={{ paddingHorizontal: 24 }}
                contentContainerStyle={{ paddingTop: 10, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} tintColor="#f97316" />
                }
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20 px-10">
                        <View className="w-20 h-20 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                            <Ionicons name="basket-outline" size={32} color="#CBD5E1" />
                        </View>
                        <Text className="text-zinc-400 font-black italic uppercase text-xs tracking-widest text-center">No Active Listings</Text>
                        <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">Be the first hunter to deploy assets here.</Text>
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