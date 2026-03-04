import React, { useState, useEffect } from "react";
import { 
  View, Text, Pressable, TextInput, FlatList, Image, 
  Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform, 
  TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import axios from "../context/axiosConfig";

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 4;
const ITEM_SIZE = width / COLUMN_COUNT;

const CreateShorts = () => {
  const navigation = useNavigation<any>();
  
  // States
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<MediaLibrary.Asset | null>(null);
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  
  // Upload States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getVideos();
  }, []);

  const getVideos = async () => {
    const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      if (canAskAgain) {
        const { status: retryStatus } = await MediaLibrary.requestPermissionsAsync();
        if (retryStatus !== 'granted') return navigation.goBack();
      } else {
        return navigation.goBack();
      }
    }

    const fetchParams: MediaLibrary.AssetsOptions = {
      mediaType: ['video'], // Pass as an array
      sortBy: ['creationTime'],
      first: 50,
    };

    const { assets } = await MediaLibrary.getAssetsAsync(fetchParams);
    console.log("Assets found:", assets.length); // Debug log to your terminal
    setAssets(assets);
    if (assets.length > 0) setSelectedAsset(assets[0]);
  };

  const handleUpload = async () => {
    if (!selectedAsset || !title.trim()) return;
    setLoading(true);
    
    try {
      // We need the actual URI for the file
      const info = await MediaLibrary.getAssetInfoAsync(selectedAsset);
      const uri = info.localUri || info.uri;

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("video", {
        uri,
        name: `short_${Date.now()}.mp4`,
        type: "video/mp4",
      } as any);

      await axios.post("/shorts/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigation.navigate("Shorts");
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'pick') {
    return (
      <SafeAreaView className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>
          <Text className="text-white font-bold text-lg">New Short</Text>
          <Pressable onPress={() => setStep('details')}>
            <Text className="text-pink-600 font-bold text-lg">Next</Text>
          </Pressable>
        </View>

        {/* Big Preview */}
        <View style={{ width: width, height: width * (16 / 9), maxHeight: height * 0.45 }}>
          {selectedAsset && (
            <Video
              source={{ uri: selectedAsset.uri }}
              style={{ flex: 1 }}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
            />
          )}
        </View>

        {/* Gallery Grid */}
        <View className="flex-1 bg-zinc-900 mt-1">
          <View className="px-4 py-3 bg-black flex-row justify-between items-center">
            <Text className="text-white font-bold">Recent Videos</Text>
            <Ionicons name="camera" size={20} color="white" />
          </View>
          
          <FlatList
            data={assets}
            numColumns={COLUMN_COUNT}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable 
                onPress={() => setSelectedAsset(item)}
                style={{ width: ITEM_SIZE, height: ITEM_SIZE, padding: 1 }}
              >
                <Image 
                  source={{ uri: item.uri }} 
                  style={{ flex: 1, opacity: selectedAsset?.id === item.id ? 0.5 : 1 }} 
                />
                <View className="absolute bottom-1 right-1">
                    <Text className="text-white text-[10px] bg-black/50 px-1 rounded">
                        {Math.floor(item.duration / 60)}:{Math.round(item.duration % 60).toString().padStart(2, '0')}
                    </Text>
                </View>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    );
  }

  // --- DETAILS STEP (SAME AS YOUR GLASSMORPHISM UI) ---
return (
  <View className="flex-1 bg-black">
    <Video
      source={{ uri: selectedAsset?.uri }}
      style={{ position: "absolute", width: width, height: height }}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isLooping
    />
    {/* Gradient overlay for better readability over video */}
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.8)']}
      className="absolute inset-0"
    />

    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
      >
        {/* Top Navigation */}
        <View className="flex-row items-center justify-between px-6">
          <Pressable 
            onPress={() => setStep('pick')} 
            className="bg-black/40 p-2 rounded-2xl border border-white/10"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>
          <Text className="text-pink-600 font-black uppercase tracking-widest text-sm">
            Finalize Post
          </Text>
          <View className="w-10" />
        </View>

        {/* Content Area */}
        <View className="flex-1 justify-end pb-12 px-3">
          {/* Main Glass Container */}
          <View 
            className="bg-black/50 rounded-2xl p-6 border border-pink-600 shadow-2xl"
            style={{ shadowColor: '#000', shadowRadius: 20, shadowOpacity: 0.5 }}
          >
            <Text className="text-pink-500 font-bold mb-4 ml-1 text-xs uppercase tracking-[2px]">
              Short Details
            </Text>

            {/* Aesthetic Title Input */}
            <View className="bg-white/5 rounded-xl border border-pink-600 px-4 mb-4">
              <TextInput
                placeholder="Title"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
                className="text-pink-600 text-sm"
              />
            </View>

            {/* Aesthetic Description Input */}
            <View className="bg-white/5 rounded-xl border border-pink-600 px-4 mb-8">
              <TextInput
                placeholder="What's this short about?..."
                placeholderTextColor="#777"
                value={description}
                onChangeText={setDescription}
                multiline
                className="text-pink-600 text-sm min-h-[80px]"
                style={{ textAlignVertical: 'top' }}
              />
            </View>

            {/* Share Button with Neon Pink Style */}
            <TouchableOpacity 
              onPress={handleUpload} 
              disabled={loading}
              activeOpacity={0.8}
              style={{
                shadowColor: '#db2777', // pink-600
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 10,
                elevation: 8
              }}
            >
              <View className="bg-pink-600 h-16 rounded-xl items-center justify-center flex-row">
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-black uppercase tracking-widest mr-2">
                      Share Short
                    </Text>
                    <Ionicons name="rocket" size={20} color="white" />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>
);
};

export default CreateShorts;