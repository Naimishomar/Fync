import React, { useState, useEffect, useRef } from "react";
import {View, Text, Pressable, TextInput, FlatList, Dimensions, ActivityIndicator, KeyboardAvoidingView, TouchableOpacity, StatusBar, Modal, ScrollView} from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useNavigation } from "@react-navigation/native";
import axios from "../context/axiosConfig";
import Toast from "react-native-toast-message";
import * as VideoThumbnails from 'expo-video-thumbnails';
import StreakModal from './StreakModal';
import { useAuth } from "../context/auth.context";
import { compressVideo } from "../utils/mediaUpload";
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { AppBar, IconBtn, Button, Empty, H2, Sheet, FormField } from './ui/kit';
import { useBottomInset } from '../constants/layout';

const { width, height } = Dimensions.get("window");
const COLUMN_COUNT = 3;
// The gallery sits inside px-4 (32px): width/3 overflowed and clipped the right column.
const ITEM_SIZE = (width - 32) / COLUMN_COUNT;

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
      className="p-[2px] active:opacity-85"
      style={{ width: ITEM_SIZE, height: ITEM_SIZE * 1.3 }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Video, ${Math.round(item.duration)} seconds`}
    >
      <View className={`flex-1 rounded-xl overflow-hidden border-2 ${isSelected ? 'border-brand-500' : 'border-transparent'}`}>
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            contentFit="cover"
            style={{ flex: 1, opacity: isSelected ? 0.7 : 1 }}
          />
        ) : (
          <View className="flex-1 bg-paper-2 items-center justify-center">
             {error ? (
                <Ionicons name="videocam-outline" size={24} color={C.ink3} />
             ) : (
                <ActivityIndicator size="small" color={C.brand[500]} />
             )}
          </View>
        )}
        <View className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded-full">
          <Text className="text-white text-xs font-semibold">
            {Math.floor(Math.round(item.duration) / 60)}:{(Math.round(item.duration) % 60).toString().padStart(2, '0')}
          </Text>
        </View>
        {isSelected && (
          <View className="absolute top-2 right-2 bg-brand-500 rounded-full w-6 h-6 items-center justify-center shadow-hair">
            <Ionicons name="checkmark" size={14} color={C.onBrand} />
          </View>
        )}
      </View>
    </Pressable>
  );
});

const CreateShorts = () => {
  const bottomInset = useBottomInset();
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
  const [compressProgress, setCompressProgress] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  // Streak States
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [currentStreakCount, setCurrentStreakCount] = useState(0);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getVideos();
    return () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); };
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
        quality: 0.9,
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

      setLoading(true);
      setCompressProgress(0);

      // Transcoded on-device first. A phone-camera clip is many times larger
      // than it needs to be, and every one of those megabytes was upload time
      // the user sat through.
      const uploadUri = await compressVideo(uri, setCompressProgress);
      setCompressProgress(1);

      // Server multer limit. Checked on the compressed file, not the original.
      const MAX_SIZE = 20 * 1024 * 1024;
      const info = await FileSystem.getInfoAsync(uploadUri);
      if (info.exists && (info as any).size > MAX_SIZE) {
        Toast.show({ type: 'error', text1: 'Video Too Large', text2: 'Still over 20MB after compression. Try a shorter clip.' });
        setLoading(false);
        return;
      }

      // Poster frame, pulled from the compressed file so it matches what
      // actually ships. Grids render this still instead of mounting a <Video>
      // per cell. A failure here is not worth blocking the upload over: the
      // field is optional and the grid falls back to the video.
      let posterUri: string | null = null;
      try {
        const { uri: poster } = await VideoThumbnails.getThumbnailAsync(uploadUri, { time: 1000, quality: 0.6 });
        posterUri = poster;
      } catch { }

      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", description.trim());
      formData.append("video", {
        uri: uploadUri,
        name: `short_${Date.now()}.mp4`,
        type: "video/mp4",
      } as any);
      if (posterUri) {
        formData.append("thumbnail", {
          uri: posterUri,
          name: `short_${Date.now()}.jpg`,
          type: "image/jpeg",
        } as any);
      }

      const res = await axios.post("/shorts/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
          setIsSuccess(true);
          setShowDetailsModal(false);
          if (res.data.isCompletedToday) {
            setCurrentStreakCount(res.data.streakCount);
            setShowStreakModal(true);
            leaveTimer.current = setTimeout(() => { navigation.navigate("Tabs"); }, 2200);
          } else {
            Toast.show({ type: 'success', text1: 'Short Live!', text2: 'Your video has been uploaded.' });
            leaveTimer.current = setTimeout(() => { navigation.navigate("Tabs"); }, 1500);
          }
      } else {
          Toast.show({ type: 'error', text1: 'Upload Failed', text2: res.data.message || 'Please try again.' });
          setLoading(false);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: 'Please try again.' });
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      
      <SafeAreaView className="flex-1" edges={['bottom']}>
      <AppBar title="Create short" onBack={() => navigation.goBack()}
        right={<IconBtn boxed name="arrow-forward" color={selectedAsset ? C.ink : C.ink4}
          accessibilityLabel="Next: add details" disabled={!selectedAsset}
          onPress={() => selectedAsset && setShowDetailsModal(true)} />} />

      {/* Main Preview Container */}
      <View className="px-gutter py-3" style={{ height: height * 0.35 }}>
         <View className="flex-1 bg-paper-2 rounded-2xl overflow-hidden border border-line">
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
                <IconBtn
                  overlay
                  size={18}
                  name={isMuted ? "volume-mute" : "volume-high"}
                  onPress={() => setIsMuted(!isMuted)}
                  accessibilityLabel={isMuted ? "Unmute" : "Mute"}
                  style={{ position: 'absolute', right: 8, bottom: 8 }}
                />
              </View>
            ) : (
              <View className="flex-1 items-center justify-center">
                 {fetching ? (
                   <ActivityIndicator color={C.brand[500]} size="large" />
                 ) : (
                   <Empty
                     icon="videocam-off-outline"
                     title={permissionError ? "No access to your videos" : "No videos found"}
                     action={<Button small title="Browse files" onPress={pickFromSystem} />}
                   />
                 )}
              </View>
            )}
         </View>
      </View>

      {/* Gallery List */}
      <View className="flex-1 px-4">
        <View className="flex-row justify-between items-center px-1 mb-3">
           <View>
              <H2>Gallery</H2>
              <Text className="text-xs text-ink-3 mt-0.5">{assets.length} {assets.length === 1 ? 'video' : 'videos'}</Text>
           </View>
           <IconBtn boxed name="folder-open-outline" onPress={pickFromSystem} accessibilityLabel="Browse files" />
        </View>

        {fetching ? (
          <View className="flex-1 items-center justify-center pb-20">
              <ActivityIndicator color={C.brand[500]} />
              <Text className="text-ink-3 mt-3 text-sm">Loading your videos…</Text>
          </View>
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
              data={assets}
              numColumns={COLUMN_COUNT}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                  <Empty
                    icon="images-outline"
                    title="Can't read your gallery"
                    hint="Pick a video from your files instead."
                    action={<Button small title="Browse files" onPress={pickFromSystem} />}
                  />
              }
              extraData={selectedAsset?.id}
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

      {/* DETAILS - Step 2 */}
      <Sheet
        visible={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        dismissable={!loading}
        title="Add details"
        footer={
          <>
            <Button
              variant="primary"
              block
              icon="rocket-outline"
              title={loading && compressProgress > 0 && compressProgress < 1 ? `Optimising ${Math.round(compressProgress * 100)}%` : 'Post to Fync'}
              loading={loading && !(compressProgress > 0 && compressProgress < 1)}
              disabled={loading}
              onPress={handleUpload}
            />
            <Text className="font-sans text-xs text-ink-3 text-center">
              By posting, you agree to Fync's community guidelines.
            </Text>
          </>
        }
      >
        <View className="gap-4">
          <FormField
            label="Title"
            placeholder="What's this short about?"
            value={title}
            onChangeText={setTitle}
          />
          <FormField
            label="Description (optional)"
            placeholder="Add a story or tags to your short…"
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>
      </Sheet>

      <StreakModal visible={showStreakModal} streakCount={currentStreakCount} onClose={() => setShowStreakModal(false)} />
    </SafeAreaView>
    </View>
  );
};

export default CreateShorts;
