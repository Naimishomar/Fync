import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Pressable, TextInput, FlatList, Image,
  Dimensions, ActivityIndicator, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert, StatusBar, Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
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
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const generateThumbnail = async () => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(item.uri, {
          time: 1000,
        });
        if (isMounted) setThumbnail(uri);
      } catch (e) {
        if (isMounted) setError(true);
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
      <View className={`flex-1 rounded-2xl overflow-hidden border-2 ${isSelected ? 'border-[#f97316]' : 'border-transparent'}`}>
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            className="flex-1"
            resizeMode="cover"
            style={{ opacity: isSelected ? 0.7 : 1 }}
          />
        ) : (
          <View className="flex-1 bg-slate-100 items-center justify-center">
             {error ? (
                <Ionicons name="videocam-outline" size={24} color="#94a3b8" />
             ) : (
                <ActivityIndicator size="small" color="#f97316" />
             )}
          </View>
        )}
        <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded-lg">
          <Text className="text-white text-2xs font-black">
            {Math.floor(item.duration / 60)}:{Math.round(item.duration % 60).toString().padStart(2, '0')}
          </Text>
        </View>
        {isSelected && (
          <View className="absolute top-2 right-2 bg-[#f97316] rounded-full w-6 h-6 items-center justify-center shadow-lg">
            <Ionicons name="checkmark" size={14} color="white" />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const CreateShorts = () => {
  const { setUser } = useAuth();
  const navigation = useNavigation<any>();
  const videoRef = useRef<Video>(null);

  // States
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Modal / Step States
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Upload States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Streak States
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [currentStreakCount, setCurrentStreakCount] = useState(0);

  useEffect(() => {
    getVideos();
  }, []);

  const getVideos = async () => {
    try {
      setFetching(true);
      setPermissionError(false);
      
      const { status } = await MediaLibrary.getPermissionsAsync();
      
      if (status !== 'granted') {
          const request = await MediaLibrary.requestPermissionsAsync();
          if (request.status !== 'granted') {
              setPermissionError(true);
              setFetching(false);
              return;
          }
      }

      const result = await MediaLibrary.getAssetsAsync({
        mediaType: ['video'],
        sortBy: ['creationTime'],
        first: 100,
      });

      setAssets(result.assets);
      if (result.assets.length > 0) {
        setSelectedAsset(result.assets[0]);
      }
    } catch (err) {
      setPermissionError(true);
    } finally {
      setFetching(false);
    }
  };

  const pickFromSystem = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setSelectedAsset(result.assets[0]);
        setShowDetailsModal(true);
      }
    } catch (err) {
      Alert.alert("Error", "Could not open system picker.");
    }
  };

  const handleUpload = async () => {
    if (!selectedAsset || !title.trim()) {
      Toast.show({ type: 'info', text1: 'Title Required', text2: 'Please add a headline for your short.' });
      return;
    }

    try {
      const uri = selectedAsset.uri;
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (fileInfo.exists) {
        const MAX_SIZE = 20 * 1024 * 1024;
        if (fileInfo.size > MAX_SIZE) {
          Toast.show({ type: 'error', text1: 'Video Too Large', text2: 'Max limit is 20MB.' });
          return;
        }
      }

      setLoading(true);

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
          setIsSuccess(true);
          setShowDetailsModal(false);
          if (res.data.isCompletedToday) {
            setCurrentStreakCount(res.data.streakCount);
            setShowStreakModal(true);
            setTimeout(() => { navigation.navigate("Tabs"); }, 2200);
          } else {
            Toast.show({ type: 'success', text1: 'Short Live!', text2: 'Your video has been uploaded.' });
            setTimeout(() => { navigation.navigate("Tabs"); }, 1500);
          }
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: 'Please try again.' });
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#f97316', 'transparent']} className="absolute top-0 w-full h-80 opacity-30" />
      
      <SafeAreaView className="flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center">
          <Ionicons name="close" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-[#1e293b] text-xl font-black uppercase tracking-tighter">Create Short</Text>
          <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Gallery Sync</Text>
        </View>
        <TouchableOpacity 
          onPress={() => selectedAsset && setShowDetailsModal(true)}
          disabled={!selectedAsset}
          className={`w-10 h-10 rounded-full items-center justify-center ${selectedAsset ? 'bg-[#f97316]' : 'bg-slate-100'}`}
        >
          <Ionicons name="arrow-forward" size={20} color="black" />
        </TouchableOpacity>
      </View>

      {/* Main Preview Container */}
      <View className="px-6 py-4" style={{ height: height * 0.35 }}>
         <View className="flex-1 bg-slate-50 rounded-4xl overflow-hidden border border-slate-100 shadow-sm">
            {selectedAsset ? (
              <View className="flex-1">
                <Video
                  source={{ uri: selectedAsset.uri }}
                  style={{ flex: 1 }}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping
                  isMuted={isMuted}
                />
                <TouchableOpacity 
                  onPress={() => setIsMuted(!isMuted)}
                  className="absolute bottom-4 right-4 bg-black/40 w-10 h-10 rounded-full items-center justify-center border border-white/20"
                >
                  <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center">
                 {fetching ? (
                   <ActivityIndicator color="#f97316" size="large" />
                 ) : (
                   <View className="items-center px-10">
                      <Ionicons name="videocam-off-outline" size={40} color="#cbd5e1" />
                      <Text className="text-slate-500 mt-2 font-black text-center text-2xs uppercase tracking-wide">
                          {permissionError ? "Permission Denied" : "No Content Found"}
                      </Text>
                      <TouchableOpacity onPress={pickFromSystem} className="mt-4 bg-[#f97316] px-6 py-3 rounded-2xl">
                          <Text className="text-white font-black uppercase text-2xs tracking-wide">Browse Vault</Text>
                      </TouchableOpacity>
                   </View>
                 )}
              </View>
            )}
         </View>
      </View>

      {/* Gallery List */}
      <View className="flex-1 px-4">
        <View className="flex-row justify-between items-center px-2 mb-4">
           <View>
              <Text className="text-2xl font-black text-[#1e293b] tracking-tighter">GALLERY</Text>
              <Text className="text-2xs text-slate-500 font-black uppercase tracking-wide">{assets.length} Videos Available</Text>
           </View>
           <TouchableOpacity onPress={pickFromSystem} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Ionicons name="search-outline" size={20} color="#f97316" />
           </TouchableOpacity>
        </View>

        {fetching ? (
          <View className="flex-1 items-center justify-center pb-20">
              <ActivityIndicator color="#f97316" />
              <Text className="text-slate-500 mt-4 font-black uppercase text-2xs tracking-wide">Indexing Assets...</Text>
          </View>
        ) : (
          <FlatList
              data={assets}
              numColumns={COLUMN_COUNT}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                  <View className="flex-1 items-center justify-center pt-10">
                      <Text className="text-slate-500 font-bold text-center text-xs px-10 leading-5">
                          Unable to access gallery. Please use the system browser to select a video.
                      </Text>
                      <TouchableOpacity onPress={pickFromSystem} className="mt-6 bg-[#1e293b] px-8 py-3 rounded-2xl shadow-lg">
                          <Text className="text-white font-black uppercase text-2xs tracking-wide">Open Browser</Text>
                      </TouchableOpacity>
                  </View>
              }
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

      {/* DETAILS MODAL - Step 2 (Bottom Sheet Style) */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable 
            className="absolute inset-0" 
            onPress={() => setShowDetailsModal(false)} 
          />
          <View 
            style={{ height: height * 0.5 }} 
            className="bg-white rounded-t-5xl shadow-2xl overflow-hidden"
          >
            <KeyboardAvoidingView 
              behavior="padding" 
              className="flex-1"
            >
              {/* Grab Handle */}
              <View className="items-center pt-4 pb-2">
                <View className="w-12 h-1.5 bg-slate-200 rounded-full" />
              </View>

              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-8 py-4">
                <View className="w-10" />
                <View className="items-center">
                  <Text className="text-[#1e293b] text-xl font-black uppercase tracking-tighter">Finalize</Text>
                  <Text className="text-[#f97316] text-2xs font-black uppercase tracking-wide">Details</Text>
                </View>
                <TouchableOpacity onPress={() => setShowDetailsModal(false)} className="w-10 h-10 rounded-full bg-slate-50 items-center justify-center">
                  <Ionicons name="close" size={20} color="#1e293b" />
                </TouchableOpacity>
              </View>

              <View className="flex-1 px-8 pt-6">
                <View className="mb-8">
                  <Text className="text-slate-500 font-black text-2xs mb-1 ml-1 uppercase tracking-wide">Title</Text>
                  <View className="bg-slate-50 rounded-xl border border-slate-100 px-3 justify-center shadow-sm">
                    <TextInput
                      placeholder="WHAT'S THIS SHORT ABOUT?"
                      placeholderTextColor="#94a3b8"
                      value={title}
                      onChangeText={setTitle}
                      className="text-[#1e293b] font-black tracking-tight text-base"
                    />
                  </View>
                </View>

                <View className="mb-10">
                  <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-1 ml-1">Description <Text className="text-slate-300">(Optional)</Text></Text>
                  <View className="bg-slate-50 rounded-xl border border-slate-100 px-3 py-1 min-h-[160px] shadow-sm">
                    <TextInput
                      placeholder="ADD A STORY OR TAGS TO YOUR SHORT..."
                      placeholderTextColor="#94a3b8"
                      value={description}
                      onChangeText={setDescription}
                      multiline
                      style={{ textAlignVertical: 'top' }}
                      className="text-[#1e293b] font-bold text-sm leading-6"
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handleUpload} 
                  disabled={loading}
                  activeOpacity={0.9}
                  className="shadow-2xl shadow-orange-500/20 rounded-full"
                >
                  <LinearGradient
                    colors={['#f97316', '#ea580c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    className="h-16 rounded-full items-center justify-center flex-row"
                  >
                    {loading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Text className="text-white font-black uppercase tracking-[3px] mr-3 text-base">Post to Fync</Text>
                        <Ionicons name="rocket-outline" size={20} color="white" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
                
                <Text className="text-slate-300 text-center mt-2 font-black text-2xs uppercase tracking-wide px-10">
                  By posting, you agree to Fync's community guidelines and protocol standards.
                </Text>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <StreakModal visible={showStreakModal} streakCount={currentStreakCount} onClose={() => setShowStreakModal(false)} />
    </SafeAreaView>
    </View>
  );
};

export default CreateShorts;
