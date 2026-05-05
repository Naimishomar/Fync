import React, { useState, useEffect } from "react";
import {
  View, Text, Pressable, TextInput, FlatList, Image,
  Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import axios from "../context/axiosConfig";
import Toast from "react-native-toast-message";
import * as VideoThumbnails from 'expo-video-thumbnails';
import StreakModal from './StreakModal';
import { useAuth } from "../context/auth.context";

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

const VideoItem = React.memo(({ item, isSelected, onSelect }: { 
  item: MediaLibrary.Asset, 
  isSelected: boolean, 
  onSelect: (item: MediaLibrary.Asset) => void 
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const generateThumbnail = async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(item.uri, {
          time: 1000,
        });
        if (isMounted) setThumbnail(uri);
      } catch (e) {
        // Fallback or silence
      }
    };
    generateThumbnail();
    return () => { isMounted = false; };
  }, [item.uri]);

  return (
    <Pressable
      onPress={() => onSelect(item)}
      className="p-[1px]"
      style={{ width: ITEM_SIZE, height: ITEM_SIZE * 1.3 }}
    >
      <View className={`flex-1 rounded-lg overflow-hidden border-2 ${isSelected ? 'border-[#f97316]' : 'border-transparent'}`}>
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            className="flex-1"
            resizeMode="cover"
            style={{ opacity: isSelected ? 0.7 : 1 }}
          />
        ) : (
          <View className="flex-1 bg-neutral-900 items-center justify-center">
             <ActivityIndicator size="small" color="#f97316" />
          </View>
        )}
        <View className="absolute bottom-2 right-2 bg-black/60 px-1.5 py-0.5 rounded-md border border-white/10">
          <Text className="text-white text-[9px] font-black">
            {Math.floor(item.duration / 60)}:{Math.round(item.duration % 60).toString().padStart(2, '0')}
          </Text>
        </View>
        {isSelected && (
          <View className="absolute top-2 right-2 bg-[#f97316] rounded-full w-5 h-5 items-center justify-center shadow-lg">
            <Ionicons name="checkmark" size={12} color="white" />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const CreateShorts = () => {
  const { setUser } = useAuth();
  const navigation = useNavigation<any>();

  // States
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<MediaLibrary.Asset | null>(null);
  const [step, setStep] = useState<'pick' | 'details'>('pick');

  // Upload States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Streak States
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [currentStreakCount, setCurrentStreakCount] = useState(0);

  useEffect(() => {
    getVideos();
  }, []);

  const getVideos = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Access to gallery is required to upload shorts.');
      navigation.goBack();
      return;
    }

    const fetchParams: MediaLibrary.AssetsOptions = {
      mediaType: ['video'],
      sortBy: ['creationTime'],
      first: 50,
    };

    try {
      const result = await MediaLibrary.getAssetsAsync(fetchParams);
      setAssets(result.assets);
      if (result.assets.length > 0) setSelectedAsset(result.assets[0]);
    } catch (err) {
      console.error('[CreateShorts] getAssetsAsync failed:', err);
    }
  };

  const handleUpload = async () => {
    if (!selectedAsset || !title.trim()) {
      Toast.show({ type: 'info', text1: 'Missing Details', text2: 'Please add a title and select a video.' });
      return;
    }

    setLoading(true);

    try {
      const info = await MediaLibrary.getAssetInfoAsync(selectedAsset);
      const uri = info.localUri || info.uri;
      
      // CHECK FILE SIZE (20MB Limit)
      // Note: size is in bytes. 20MB = 20 * 1024 * 1024
      const MAX_SIZE = 20 * 1024 * 1024;
      if (info.size && info.size > MAX_SIZE) {
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Video Too Large',
          text2: 'Please select a video smaller than 20MB.',
        });
        return;
      }

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("video", {
        uri,
        name: `short_${Date.now()}.mp4`,
        type: "video/mp4",
      } as any);

      const res = await axios.post("/shorts/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
          if (res.data.isCompletedToday) {
            setCurrentStreakCount(res.data.streakCount);
            setShowStreakModal(true);
            setTimeout(() => {
              navigation.navigate("Tabs");
            }, 2200);
          } else {
            Toast.show({ type: 'success', text1: 'Short Live!', text2: 'Your video has been uploaded.' });
            navigation.navigate("Tabs");
          }
      }
    } catch (err) {
      console.log(err);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: 'Server rejected the file. (Check Nginx limits)',
      });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pick') {
    return (
      <SafeAreaView className="flex-1 bg-[#0F172A]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="bg-white/5 p-2 rounded-full border border-white/10">
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white font-black text-lg tracking-tight">CREATE <Text className="text-[#f97316]">SHORT</Text></Text>
          <TouchableOpacity 
            onPress={() => setStep('details')}
            className="bg-[#f97316] px-5 py-2 rounded-full shadow-lg"
          >
            <Text className="text-white font-black text-xs uppercase tracking-widest">Next</Text>
          </TouchableOpacity>
        </View>

        {/* Big Preview Area */}
        <View className="px-4 mb-4" style={{ height: height * 0.35 }}>
           <View className="flex-1 bg-black rounded-[32px] overflow-hidden border border-white/10 shadow-2xl">
              {selectedAsset ? (
                <Video
                  source={{ uri: selectedAsset.uri }}
                  style={{ flex: 1 }}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay
                  isLooping
                  isMuted
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                   <ActivityIndicator color="#f97316" />
                </View>
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} className="absolute inset-0" />
           </View>
        </View>

        {/* Gallery Section */}
        <View className="flex-1 bg-white rounded-t-[40px] pt-8 px-4">
          <View className="flex-row justify-between items-center mb-6 px-2">
             <View>
                <Text className="text-xl font-black text-[#1E293B]">Gallery</Text>
                <Text className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mt-1">Select 9:16 Video</Text>
             </View>
             <View className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0]">
                <Ionicons name="videocam" size={20} color="#f97316" />
             </View>
          </View>

          {assets.length === 0 ? (
            <View className="flex-1 items-center justify-center pb-20">
              <View className="bg-[#F8FAFC] p-8 rounded-[40px] border border-[#E2E8F0] mb-4">
                <Ionicons name="videocam-off" size={48} color="#CBD5E1" />
              </View>
              <Text className="text-[#64748B] font-bold text-center px-12">No compatible videos found in your gallery.</Text>
            </View>
          ) : (
            <FlatList
              data={assets}
              numColumns={COLUMN_COUNT}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }) => (
                <VideoItem 
                  item={item} 
                  isSelected={selectedAsset?.id === item.id} 
                  onSelect={setSelectedAsset} 
                />
              )}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Background Video */}
      <Video
        source={{ uri: selectedAsset?.uri ?? '' }}
        style={{ position: "absolute", width: width, height: height }}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
      />
      <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.9)']} className="absolute inset-0" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
          {/* Header */}
          <View className="flex-row items-center px-6 py-4">
            <TouchableOpacity onPress={() => setStep('pick')} className="bg-white/10 p-2 rounded-full border border-white/20">
              <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white font-black text-xs uppercase tracking-[3px] ml-4">Publish Details</Text>
          </View>

          <View className="flex-1 justify-end px-6 pb-12">
            {/* Glassmorphism Panel */}
            <View className="bg-black/60 rounded-[32px] p-6 border border-white/10 backdrop-blur-xl">
               <View className="mb-6">
                  <Text className="text-[#f97316] font-black text-[10px] uppercase tracking-widest mb-3 ml-1">Video Headline</Text>
                  <View className="bg-white/5 rounded-2xl border border-white/10 px-4 h-14 justify-center">
                    <TextInput
                      placeholder="Give it a catchy title..."
                      placeholderTextColor="#64748B"
                      value={title}
                      onChangeText={setTitle}
                      className="text-white font-bold"
                    />
                  </View>
               </View>

               <View className="mb-8">
                  <Text className="text-[#f97316] font-black text-[10px] uppercase tracking-widest mb-3 ml-1">Description (Optional)</Text>
                  <View className="bg-white/5 rounded-2xl border border-white/10 px-4 py-4 min-h-[100px]">
                    <TextInput
                      placeholder="Add tags or a short story..."
                      placeholderTextColor="#64748B"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      style={{ textAlignVertical: 'top' }}
                      className="text-white font-medium"
                    />
                  </View>
               </View>

               <TouchableOpacity 
                  onPress={handleUpload} 
                  disabled={loading}
                  activeOpacity={0.9}
                  className="shadow-2xl shadow-[#f97316]/50"
               >
                  <LinearGradient
                    colors={['#f97316', '#ea580c']}
                    className="h-16 rounded-2xl items-center justify-center flex-row"
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Text className="text-white font-black uppercase tracking-[2px] mr-2">Share to Fync</Text>
                        <Ionicons name="rocket" size={20} color="white" />
                      </>
                    )}
                  </LinearGradient>
               </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <StreakModal visible={showStreakModal} streakCount={currentStreakCount} onClose={() => setShowStreakModal(false)} />
    </View>
  );
};

export default CreateShorts;