import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  Modal, TextInput, ActivityIndicator, Alert, Pressable 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../context/axiosConfig'; 
import { useAuth } from '../context/auth.context';

// --- TYPES ---
interface LostAndFoundItem {
  _id: string;
  item: string;
  image?: string;
  place: string;
  lostOrFound: 'lost' | 'found';
  found_or_lost_by: {
    _id: string;
    name: string;
    username: string;
    avatar?: string;
  };
  createdAt: string;
  is_found_item_claimed?: boolean;
  is_lost_item_found?: boolean;
}

const LostAndFound = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lost' | 'found'>('lost');
  const [items, setItems] = useState<LostAndFoundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPlace, setNewItemPlace] = useState('');
  const [newItemImage, setNewItemImage] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- FETCH ITEMS ---
  const fetchItems = async () => {
    try {
      const endpoint = activeTab === 'lost' ? '/lostAndFound/get/lost' : '/lostAndFound/get/found';
      const res = await axios.get(endpoint);
      if (res.data.success) {
        // Optional: Sort so active items are first
        const sorted = res.data.items.sort((a: any, b: any) => {
            const aStatus = activeTab === 'lost' ? a.is_lost_item_found : a.is_found_item_claimed;
            const bStatus = activeTab === 'lost' ? b.is_lost_item_found : b.is_found_item_claimed;
            return Number(aStatus) - Number(bStatus); // False (0) first, True (1) last
        });
        setItems(sorted);
      }
    } catch (error) {
      console.log("Error fetching items", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchItems();
  }, [activeTab]);

  // --- CREATE ITEM ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setNewItemImage(result.assets[0]);
    }
  };

  const handleCreateItem = async () => {
    if (!newItemName || !newItemPlace) {
      Alert.alert("Error", "Name and Place are required.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('item', newItemName);
      formData.append('place', newItemPlace);
      
      if (newItemImage) {
        // @ts-ignore
        formData.append('productImage', {
          uri: newItemImage.uri,
          type: 'image/jpeg',
          name: 'item.jpg',
        });
      }

      const endpoint = activeTab === 'lost' 
        ? '/lostAndFound/create/lost' 
        : '/lostAndFound/create/found';

      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Alert.alert("Success", "Item posted successfully!");
        setModalVisible(false);
        setNewItemName('');
        setNewItemPlace('');
        setNewItemImage(null);
        fetchItems(); 
      }
    } catch (error) {
      console.log("Create error", error);
      Alert.alert("Error", "Failed to post item.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- CLAIM / MARK AS FOUND ---
  const handleClaimItem = async (itemId: string) => {
    const title = activeTab === 'lost' ? "Mark as Found?" : "Claim Item?";
    const message = activeTab === 'lost' 
        ? "Have you found your lost item?" 
        : "Has the owner claimed this item?";

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Yes", 
        onPress: async () => {
          try {
            const endpoint = activeTab === 'lost' 
                ? `/lostAndFound/claimed/lost/${itemId}` 
                : `/lostAndFound/claimed/found/${itemId}`;

            const res = await axios.post(endpoint, { claimed_by: user._id }); 

            if (res.data.success) {
                Alert.alert("Updated", "Status updated successfully.");
                fetchItems();
            }
          } catch (error) {
            Alert.alert("Error", "Could not update status.");
          }
        } 
      }
    ]);
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }: { item: LostAndFoundItem }) => {
    const isOwner = item.found_or_lost_by._id === user._id;
    
    // Check if the item is already resolved
    const isResolved = activeTab === 'lost' 
        ? item.is_lost_item_found 
        : item.is_found_item_claimed;

    return (
      <View className={`rounded-xl mb-4 overflow-hidden border ${isResolved ? 'bg-gray-900 border-gray-800 opacity-60' : 'bg-gray-900 border-gray-700'}`}>
        <View className="p-4 flex-row">
          
          {/* Image Section */}
          <View className="w-24 h-24 bg-gray-800 rounded-lg mr-4 overflow-hidden relative">
             {item.image ? (
                 <Image source={{ uri: item.image }} className="w-full h-full" resizeMode="cover" />
             ) : (
                 <View className="w-full h-full items-center justify-center">
                     <Ionicons name="image-outline" size={30} color="#555" />
                 </View>
             )}
             
             {/*  - Visual Indicator Overlay */}
             {isResolved && (
                 <View className="absolute inset-0 bg-black/60 items-center justify-center">
                     <Ionicons name="checkmark-circle" size={32} color="#4ade80" />
                 </View>
             )}
          </View>

          {/* Details Section */}
          <View className="flex-1 justify-between">
             <View>
                 <Text className={`text-lg font-bold ${isResolved ? 'text-gray-500 line-through' : 'text-white'}`} numberOfLines={1}>
                    {item.item}
                 </Text>
                 
                 <View className="flex-row items-center mt-1">
                     <Ionicons name="location-outline" size={14} color="#9ca3af" />
                     <Text className="text-gray-400 text-sm ml-1" numberOfLines={1}>{item.place}</Text>
                 </View>
                 
                 <Text className="text-gray-500 text-xs mt-1">
                    {activeTab === 'lost' ? 'Lost by' : 'Found by'} @{item.found_or_lost_by.username}
                 </Text>
             </View>

             {/* Status / Action Button */}
             {isResolved ? (
                 <View className="mt-2 py-1 px-3 rounded-lg bg-green-900/30 self-start border border-green-900">
                     <Text className="text-green-500 font-bold text-xs">
                        {activeTab === 'lost' ? "FOUND" : "CLAIMED"}
                     </Text>
                 </View>
             ) : (
                 isOwner && (
                     <TouchableOpacity 
                        onPress={() => handleClaimItem(item._id)}
                        className={`mt-2 py-2 px-4 rounded-lg self-start ${activeTab === 'lost' ? 'bg-red-600' : 'bg-blue-600'}`}
                     >
                         <Text className="text-white font-bold text-xs">
                            {activeTab === 'lost' ? "Mark as Found" : "Mark as Claimed"}
                         </Text>
                     </TouchableOpacity>
                 )
             )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Header & Tabs */}
      <View className="px-4 py-2">
        <Text className="text-white text-2xl font-bold mb-4">Lost & Found</Text>
        
        {/* Toggle Switch */}
        <View className="flex-row bg-gray-900 p-1 rounded-xl mb-4">
            <Pressable 
                onPress={() => setActiveTab('lost')} 
                className={`flex-1 py-3 rounded-lg items-center ${activeTab === 'lost' ? 'bg-red-500/20' : 'bg-transparent'}`}
            >
                <Text className={`font-bold ${activeTab === 'lost' ? 'text-red-500' : 'text-gray-500'}`}>LOST ITEMS</Text>
            </Pressable>
            <Pressable 
                onPress={() => setActiveTab('found')} 
                className={`flex-1 py-3 rounded-lg items-center ${activeTab === 'found' ? 'bg-green-500/20' : 'bg-transparent'}`}
            >
                <Text className={`font-bold ${activeTab === 'found' ? 'text-green-500' : 'text-gray-500'}`}>FOUND ITEMS</Text>
            </Pressable>
        </View>
      </View>

      {/* List */}
      {loading ? (
          <ActivityIndicator size="large" color="#fff" className="mt-20" />
      ) : (
          <FlatList 
            data={items}
            keyExtractor={item => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchItems(); }}
            ListEmptyComponent={
                <View className="items-center justify-center mt-20">
                    <Ionicons name="search" size={48} color="#333" />
                    <Text className="text-gray-500 text-center mt-4">No items listed.</Text>
                </View>
            }
          />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity 
        onPress={() => setModalVisible(true)}
        // Changed 'right-6' to 'self-center'
        className={`relative bottom-16 self-center w-14 h-14 rounded-full items-center justify-center shadow-lg ${activeTab === 'lost' ? 'bg-red-500' : 'bg-green-600'}`}
      >
          <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* CREATE MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/80 justify-end">
            <View className="bg-gray-900 rounded-t-3xl p-6 h-[70%]">
                <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-white text-xl font-bold">
                        Report {activeTab === 'lost' ? 'Lost' : 'Found'} Item
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Ionicons name="close" size={24} color="gray" />
                    </TouchableOpacity>
                </View>

                {/* Form */}
                <Text className="text-gray-400 text-xs uppercase mb-2">What was it?</Text>
                <TextInput 
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="e.g. Blue Water Bottle"
                    placeholderTextColor="#666"
                    className="bg-black text-white p-4 rounded-xl mb-4 border border-gray-800"
                />

                <Text className="text-gray-400 text-xs uppercase mb-2">Where?</Text>
                <TextInput 
                    value={newItemPlace}
                    onChangeText={setNewItemPlace}
                    placeholder={activeTab === 'lost' ? "Last seen at..." : "Found at..."}
                    placeholderTextColor="#666"
                    className="bg-black text-white p-4 rounded-xl mb-6 border border-gray-800"
                />

                <TouchableOpacity onPress={pickImage} className="flex-row items-center justify-center bg-gray-800 p-4 rounded-xl mb-8 border border-dashed border-gray-600">
                    {newItemImage ? (
                        <Image source={{ uri: newItemImage.uri }} className="w-full h-32 rounded-lg" resizeMode="contain" />
                    ) : (
                        <>
                            <Ionicons name="camera-outline" size={24} color="gray" />
                            <Text className="text-gray-400 ml-2">Add Photo (Optional)</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={handleCreateItem}
                    disabled={submitting}
                    className={`p-4 rounded-xl items-center ${activeTab === 'lost' ? 'bg-red-500' : 'bg-green-600'}`}
                >
                    {submitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Post Item</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default LostAndFound;