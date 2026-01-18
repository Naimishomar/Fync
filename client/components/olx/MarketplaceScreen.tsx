import React, { useEffect, useState } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Modal, TextInput, 
  Alert, Dimensions, ScrollView, Pressable 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native'; // 1. Import Navigation

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 2 - 24;

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

// --- SUB-COMPONENT: SELL PRODUCT MODAL (No Changes) ---
const SellProductModal = ({ isVisible, onClose, onSuccess }: any) => {
    // ... (Keep existing code same as before)
    // For brevity, I'm hiding the internal logic since it hasn't changed. 
    // Just paste your previous SellProductModal code here.
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
        <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View className="flex-1 bg-black">
                <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
                <View className="flex-row justify-between items-center px-4 py-4 border-b border-gray-800">
                    <Text className="text-white text-xl font-bold">Sell Item</Text>
                    <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="white" /></TouchableOpacity>
                </View>
                <ScrollView className="p-4">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                        <TouchableOpacity onPress={pickImage} className="w-24 h-24 bg-gray-900 border border-dashed border-gray-600 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="camera-outline" size={30} color="gray" /><Text className="text-gray-500 text-xs mt-1">Add Photo</Text>
                        </TouchableOpacity>
                        {images.map((img, index) => (<Image key={index} source={{ uri: img.uri }} className="w-24 h-24 rounded-lg mr-3 bg-gray-800" />))}
                    </ScrollView>
                    <TextInput value={name} onChangeText={setName} className="bg-gray-900 text-white p-4 rounded-lg mb-4" placeholder="Title" placeholderTextColor="#666" />
                    <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" className="bg-gray-900 text-white p-4 rounded-lg mb-4" placeholder="Price" placeholderTextColor="#666" />
                    <TextInput value={desc} onChangeText={setDesc} multiline numberOfLines={4} className="bg-gray-900 text-white p-4 rounded-lg mb-8" placeholder="Description" placeholderTextColor="#666" textAlignVertical="top" />
                    <TouchableOpacity onPress={handleSell} disabled={loading} className={`p-4 rounded-full items-center mb-10 ${loading ? 'bg-gray-700' : 'bg-blue-600'}`}>
                        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">List Item</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>
    );
};

// --- SUB-COMPONENT: PRODUCT DETAILS MODAL ---
const ProductDetailsModal = ({ product, isVisible, onClose, currentUserId, onDelete }: any) => {
    const navigation = useNavigation<any>(); // 2. Add Navigation Hook
    
    if (!product) return null;
    const isOwner = product.seller._id === currentUserId;

    const handleVisitProfile = () => {
        onClose(); // Close modal first
        // 3. Navigate to Public Profile
        navigation.navigate("PublicProfile", { user: product?.seller }); 
    };

    return (
        <Modal visible={isVisible} animationType="fade" transparent={true} onRequestClose={onClose}>
             <View className="flex-1 bg-black/90 justify-center p-4">
                <View className="bg-gray-900 rounded-2xl overflow-hidden max-h-[85%] w-full">
                    <ScrollView>
                        <Image source={{ uri: product.product_image[0] }} className="w-full h-72 bg-gray-800" resizeMode="cover" />
                        
                        <View className="p-5">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1">
                                    <Text className="text-white text-2xl font-bold mb-1">{product.product_name}</Text>
                                    <Text className="text-blue-400 text-xl font-bold">₹{product.price}</Text>
                                </View>
                                {isOwner && (
                                    <TouchableOpacity onPress={() => onDelete(product._id)} className="bg-red-500/20 p-2 rounded-lg mr-5">
                                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Seller Info - Clickable */}
                            <Pressable onPress={handleVisitProfile} className="flex-row items-center mt-4 mb-6 bg-black/40 p-3 rounded-lg border border-gray-800">
                                <Image 
                                    source={{ uri: product.seller.avatar || `https://ui-avatars.com/api/?name=${product.seller.username}` }} 
                                    className="w-10 h-10 rounded-full bg-gray-700"
                                />
                                <View className="ml-3">
                                    <Text className="text-white font-bold">{product.seller.name}</Text>
                                    <Text className="text-gray-500 text-xs">@{product.seller.username} • {product.college}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="gray" style={{ marginLeft: 'auto' }} />
                            </Pressable>

                            <Text className="text-gray-400 text-xs uppercase font-bold mb-2">Description</Text>
                            <Text className="text-gray-300 leading-6 mb-6">{product.product_description}</Text>
                            
                            <View className="flex-row gap-2 mt-2">
                                <View className="bg-gray-800 px-3 py-1 rounded-md border border-gray-700">
                                    <Text className="text-gray-400 text-xs capitalize">{product.product_type}</Text>
                                </View>
                                <View className="bg-gray-800 px-3 py-1 rounded-md border border-gray-700">
                                    <Text className="text-gray-400 text-xs">{new Date(product.createdAt).toLocaleDateString()}</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity onPress={onClose} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full">
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>

                    {!isOwner && (
                         <View className="p-4 bg-black border-t border-gray-800">
                            <TouchableOpacity className="bg-green-600 w-full py-4 rounded-xl items-center flex-row justify-center gap-2">
                                <Ionicons name="logo-whatsapp" size={20} color="white" />
                                <Text className="text-white font-bold text-lg">Contact Seller</Text>
                            </TouchableOpacity>
                         </View>
                    )}
                </View>
             </View>
        </Modal>
    );
}


// --- MAIN SCREEN ---
const MarketplaceScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>(); // 4. Navigation Hook
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/olx/products');
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

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Item", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
            text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await axios.delete(`/olx/${id}`);
                    setProducts(prev => prev.filter(p => p._id !== id));
                    setSelectedProduct(null); 
                } catch (error) {
                    Alert.alert("Error", "Could not delete item");
                }
            }
        }
    ]);
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <Pressable 
        onPress={() => setSelectedProduct(item)}
        className="bg-gray-900 rounded-xl overflow-hidden mb-4 border border-gray-800"
        style={{ width: COLUMN_WIDTH, marginRight: 16 }}
    >
        <Image 
            source={{ uri: item.product_image[0] }} 
            className="w-full h-40 bg-gray-800" 
            resizeMode="cover"
        />
        <View className="p-3">
            <Text className="text-white font-bold text-lg">₹{item.price}</Text>
            <Text className="text-gray-300 text-sm mb-1" numberOfLines={1}>{item.product_name}</Text>
            <Text className="text-gray-500 text-xs" numberOfLines={1}>{item.college}</Text>
            
            {/* 5. Clickable Seller Info in Grid */}
            <Pressable 
                onPress={() => navigation.navigate("PublicProfile", { user: item?.seller })}
                className="flex-row items-center mt-2"
            >
                 <Image 
                    source={{ uri: item.seller.avatar || `https://ui-avatars.com/api/?name=${item.seller.username}` }} 
                    className="w-5 h-5 rounded-full mr-2 bg-gray-700"
                 />
                 <Text className="text-gray-500 text-xs" numberOfLines={1}>@{item.seller.username}</Text>
            </Pressable>
        </View>
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-black">
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-900">
        <View>
            <Text className="text-white text-2xl font-bold tracking-tighter italic">Campus OLX</Text>
            <Text className="text-gray-500 text-xs">Buy & Sell within {user?.college || 'your college'}</Text>
        </View>
        <TouchableOpacity onPress={() => setSellModalVisible(true)} className="bg-white px-4 py-2 rounded-full">
            <Text className="font-bold text-black">+ Sell</Text>
        </TouchableOpacity>
      </View>

      {/* Product Grid */}
      {loading ? (
        <ActivityIndicator size="large" color="#fff" className="mt-20" />
      ) : (
        <FlatList
            data={products}
            renderItem={renderProductItem}
            keyExtractor={(item) => item._id}
            numColumns={2}
            columnWrapperStyle={{ paddingHorizontal: 16 }}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProducts(); }} tintColor="#fff" />
            }
            ListEmptyComponent={
                <View className="items-center justify-center mt-20">
                    <Ionicons name="basket-outline" size={64} color="#333" />
                    <Text className="text-gray-500 mt-4">No items listed yet.</Text>
                    <Text className="text-gray-600 text-xs">Be the first to sell something!</Text>
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
  );
};

export default MarketplaceScreen;