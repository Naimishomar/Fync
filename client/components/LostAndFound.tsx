import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  Modal, TextInput, ActivityIndicator, Alert, Pressable, Animated, StatusBar,
  RefreshControl,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../context/axiosConfig'; 
import { useAuth } from '../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

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
      if (!refreshing) setLoading(true);
      const endpoint = activeTab === 'lost' ? '/lostAndFound/get/lost' : '/lostAndFound/get/found';
      const res = await axios.get(endpoint);
      if (res.data.success) {
        const sorted = res.data.items.sort((a: any, b: any) => {
            const aStatus = activeTab === 'lost' ? a.is_lost_item_found : a.is_found_item_claimed;
            const bStatus = activeTab === 'lost' ? b.is_lost_item_found : b.is_found_item_claimed;
            return Number(aStatus) - Number(bStatus);
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

  useEffect(() => { fetchItems(); }, [activeTab]);

  // --- CREATE ITEM ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setNewItemImage(result.assets[0]);
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
        Alert.alert("Success", "Incident reported to HQ.");
        setModalVisible(false);
        setNewItemName('');
        setNewItemPlace('');
        setNewItemImage(null);
        fetchItems(); 
      }
    } catch (error) {
       Alert.alert("Error", "Transmission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimItem = async (itemId: string) => {
    const title = activeTab === 'lost' ? "Recovery Confirmed?" : "Handover Confirmed?";
    const message = activeTab === 'lost' 
        ? "Have you recovered your lost asset?" 
        : "Has the artifact been handed over to its owner?";

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Confirm", 
        onPress: async () => {
          try {
            const endpoint = activeTab === 'lost' 
                ? `/lostAndFound/claimed/lost/${itemId}` 
                : `/lostAndFound/claimed/found/${itemId}`;

            const res = await axios.post(endpoint, { claimed_by: user._id }); 

            if (res.data.success) {
                Alert.alert("HQ Synced", "Incident status updated.");
                fetchItems();
            }
          } catch (error) {
            Alert.alert("Error", "Sync failed.");
          }
        } 
      }
    ]);
  };

  const renderItem = ({ item }: { item: LostAndFoundItem }) => {
    const isOwner = item.found_or_lost_by._id === user._id;
    const isResolved = activeTab === 'lost' ? item.is_lost_item_found : item.is_found_item_claimed;

    return (
      <View className={`mx-8 mb-4 bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm ${isResolved ? 'opacity-50' : ''}`}>
        <View className="p-4 flex-row">
          <View className="w-20 h-20 bg-slate-50 rounded-xl mr-4 overflow-hidden border border-slate-100 items-center justify-center relative">
             {item.image ? (
                 <Image source={{ uri: item.image }} className="w-full h-full" resizeMode="cover" />
             ) : (
                 <Ionicons name="cube-outline" size={24} color="#CBD5E1" />
             )}
             {isResolved && (
                 <View className="absolute inset-0 bg-white/40 items-center justify-center">
                     <Ionicons name="checkmark-circle" size={28} color="#f97316" />
                 </View>
             )}
          </View>

          <View className="flex-1 justify-between">
             <View>
                 <View className="flex-row justify-between items-start">
                     <Text className="text-zinc-900 text-base font-bold flex-1 mr-2" numberOfLines={1}>
                        {item.item}
                     </Text>
                     <View className={`px-2 py-0.5 rounded ${activeTab === 'lost' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                         <Text className={`text-[7px] font-black uppercase tracking-widest ${activeTab === 'lost' ? 'text-rose-500' : 'text-emerald-600'}`}>
                             {activeTab === 'lost' ? 'Lost' : 'Found'}
                         </Text>
                     </View>
                 </View>
                 
                 <View className="flex-row items-center mt-1.5">
                     <Ionicons name="location" size={10} color="#94A3B8" />
                     <Text className="text-slate-400 text-[9px] font-bold uppercase tracking-tight ml-1" numberOfLines={1}>{item.place}</Text>
                 </View>
             </View>

             <View className="flex-row items-center justify-between pt-2">
                <View className="flex-row items-center">
                    <Image 
                        source={{ uri: item.found_or_lost_by.avatar || `https://ui-avatars.com/api/?name=${item.found_or_lost_by.username}` }} 
                        className="w-4 h-4 rounded-full bg-slate-100 border border-slate-200 mr-1.5"
                    />
                    <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-tighter">
                       @{item.found_or_lost_by.username}
                    </Text>
                </View>
                
                {isResolved ? (
                    <View className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        <Text className="text-slate-400 font-black text-[7px] uppercase tracking-widest">
                           Resolved
                        </Text>
                    </View>
                ) : (
                    isOwner && (
                        <TouchableOpacity 
                           onPress={() => handleClaimItem(item._id)}
                           className="bg-zinc-900 px-3 py-1.5 rounded-lg shadow-sm"
                        >
                            <Text className="text-white font-black text-[7px] uppercase tracking-widest">
                               Update Status
                            </Text>
                        </TouchableOpacity>
                    )
                )}
             </View>
          </View>
        </View>
      </View>
    );
  };

    const ItemSkeleton = () => {
        const pulseAnim = useRef(new Animated.Value(0.3)).current;
        useEffect(() => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }, []);

        return (
            <Animated.View style={{ opacity: pulseAnim }} className="bg-white rounded-[32px] mb-6 border border-slate-100 p-6 flex-row mx-8">
                <View className="w-24 h-24 bg-slate-50 rounded-3xl mr-5" />
                <View className="flex-1 justify-center">
                    <View className="h-4 bg-slate-50 rounded w-3/4 mb-3" />
                    <View className="h-3 bg-slate-50 rounded w-1/2 mb-2" />
                    <View className="h-6 bg-slate-50 rounded-xl w-1/3 mt-2" />
                </View>
            </Animated.View>
        );
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <View className="absolute top-0 w-full h-80 opacity-20">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
            </View>

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-8 pt-6">
                    <View className="flex-row items-center justify-between mb-8">
                        <View>
                            <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">Fync <Text className="text-orange-500">Scan</Text></Text>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-0.5">Asset Recovery Protocol</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => setModalVisible(true)} 
                            className="w-14 h-14 rounded-2xl items-center justify-center bg-zinc-900 shadow-2xl shadow-black/40"
                        >
                            <Ionicons name="add" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row bg-white p-1.5 rounded-2xl mb-8 border border-slate-100 shadow-sm">
                        <TouchableOpacity
                            onPress={() => setActiveTab('lost')}
                            className={`flex-1 py-3.5 rounded-xl items-center ${activeTab === 'lost' ? 'bg-zinc-900' : 'bg-transparent'}`}
                        >
                            <Text className={`font-black text-[10px] uppercase tracking-widest ${activeTab === 'lost' ? 'text-white' : 'text-slate-400'}`}>Lost Assets</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('found')}
                            className={`flex-1 py-3.5 rounded-xl items-center ${activeTab === 'found' ? 'bg-orange-500' : 'bg-transparent'}`}
                        >
                            <Text className={`font-black text-[10px] uppercase tracking-widest ${activeTab === 'found' ? 'text-white' : 'text-slate-400'}`}>Found Units</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View>{[1, 2, 3, 4].map(i => <ItemSkeleton key={i} />)}</View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={item => item._id}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 120 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor="#f97316" />}
                        ListEmptyComponent={
                            <View className="items-center justify-center mt-20 px-10">
                                <View className="w-20 h-20 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                                    <Ionicons name="search" size={32} color="#CBD5E1" />
                                </View>
                                <Text className="text-zinc-400 font-black italic uppercase text-xs tracking-widest text-center">No Active Signals</Text>
                                <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">Scanning campus for artifacts...</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 bg-zinc-900/60 justify-end">
                    <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={() => setModalVisible(false)} />
                    <View className="bg-white rounded-t-[48px] h-[80%] shadow-2xl overflow-hidden">
                        <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mt-4 mb-2" />
                        
                        <View className="px-8 py-6 border-b border-slate-50 flex-row justify-between items-center bg-white">
                            <View>
                                <Text className="text-zinc-900 text-2xl font-black uppercase tracking-tight">Report <Text className="text-orange-500">Incident</Text></Text>
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Campus Recovery Protocol</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} className="bg-slate-50 w-10 h-10 rounded-2xl items-center justify-center border border-slate-100">
                                <Ionicons name="close" size={20} color="#18181b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-8" showsVerticalScrollIndicator={false}>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Identification</Text>
                            <TextInput 
                                value={newItemName}
                                onChangeText={setNewItemName}
                                placeholder="e.g. TITAN v2 Pro (Blue Frame)"
                                placeholderTextColor="#CBD5E1"
                                className="bg-white text-zinc-900 p-5 rounded-3xl mb-6 border border-slate-100 shadow-sm font-black italic uppercase text-xs"
                            />

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Location Coordinates</Text>
                            <TextInput 
                                value={newItemPlace}
                                onChangeText={setNewItemPlace}
                                placeholder={activeTab === 'lost' ? "Last seen at..." : "Discovered at..."}
                                placeholderTextColor="#CBD5E1"
                                className="bg-white text-zinc-900 p-5 rounded-3xl mb-8 border border-slate-100 shadow-sm font-black italic uppercase text-xs"
                            />

                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Visual Evidence</Text>
                            <TouchableOpacity onPress={pickImage} className="flex-row items-center justify-center bg-slate-50 p-8 rounded-3xl mb-10 border border-dashed border-slate-200">
                                {newItemImage ? (
                                    <Image source={{ uri: newItemImage.uri }} className="w-full h-40 rounded-2xl" resizeMode="cover" />
                                ) : (
                                    <View className="items-center">
                                        <Ionicons name="camera-outline" size={28} color="#CBD5E1" />
                                        <Text className="text-slate-400 font-black italic uppercase text-[9px] mt-2">Capture Asset Image</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={handleCreateItem}
                                disabled={submitting}
                                className={`p-5 rounded-[24px] items-center mb-20 shadow-2xl ${activeTab === 'lost' ? 'bg-zinc-900 shadow-black/40' : 'bg-orange-500 shadow-orange-500/20'}`}
                            >
                                {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black italic uppercase tracking-widest text-xs">Deploy Report to HQ</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default LostAndFound;