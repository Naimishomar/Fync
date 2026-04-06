import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Pressable,
  Image,
  ViewToken,
  ActivityIndicator,
  Alert,
  Share,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess, Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { 
  GestureHandlerRootView, 
  GestureDetector,
  Gesture
} from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  runOnJS
} from 'react-native-reanimated';
//@ts-ignore
import FyncLogo from "../assets/Fync.jpg"

interface FyncMediaItem {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  video_link: string;
  tags: string[];
  likes: number;
  liked_by: string[];
  dislikes: number;
  disliked_by: string[];
  comment: string[];
  admin: {
    _id: string;
    name: string;
    username: string;
    email: string;
    avatar?: string;
  };
  duration?: string;
  date: string;
}

const formatDuration = (duration: string | undefined): string => {
  if (!duration || duration === "0:00") return "0:00";
  
  // If it's already in MM:SS format
  if (duration.includes(':')) {
    const parts = duration.split(':');
    const mins = parseInt(parts[0]);
    const secs = parseInt(parts[1]);
    
    // Check for the millisecond bug (minutes > 600 usually means it was ms)
    if (mins >= 600) {
      const totalSeconds = Math.floor((mins * 60 + secs) / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    return duration;
  }
  
  // If it's raw milliseconds
  const ms = parseInt(duration);
  if (!isNaN(ms) && ms > 10000) { // Arbitrary large number to distinguish from small seconds
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  
  return duration;
};

const YouTubeVideoPlayer = ({ 
  source, 
  thumbnail, 
  onClose 
}: { 
  source: string, 
  thumbnail: string, 
  onClose: () => void 
}) => {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barWidth, setBarWidth] = useState(300);
  const { width: windowWidth } = useWindowDimensions();
  const {user} = useAuth();

  // Pinch to Zoom Gesture
  const scale = useSharedValue(1);
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = event.scale;
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
      }
    });

  // Long Press for 2x Speed
  const isPressingSpeed = useSharedValue(false);
  const longPressGesture = Gesture.LongPress()
    .onStart(() => {
      isPressingSpeed.value = true;
      runOnJS(setPlaybackRate)(2.0);
    })
    .onEnd(() => {
      isPressingSpeed.value = false;
      runOnJS(setPlaybackRate)(1.0);
    });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setRateAsync(playbackRate, true);
    }
  }, [playbackRate]);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          staysActiveInBackground: true, // Try allowing background focus to settle
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false
        });
      } catch (e) {
        console.log("Audio mode setup failed", e);
      }
    };
    setupAudio();
  }, []);

  useEffect(() => {
    console.log("🎥 Video Player: New source prepared:", source);
  }, [source]);

  // Double Tap Seek Gestures
  const skipForward = async () => {
    resetHideTimer();
    if (!videoRef.current) return;
    const currentStatus = await videoRef.current.getStatusAsync() as AVPlaybackStatusSuccess;
    if (currentStatus && currentStatus.isLoaded) {
      const newPos = Math.min(currentStatus.durationMillis || 0, currentStatus.positionMillis + 10000);
      await videoRef.current.setPositionAsync(newPos);
    }
  };

  const skipBackward = async () => {
    resetHideTimer();
    if (!videoRef.current) return;
    const currentStatus = await videoRef.current.getStatusAsync() as AVPlaybackStatusSuccess;
    if (currentStatus && currentStatus.isLoaded) {
      const newPos = Math.max(0, currentStatus.positionMillis - 10000);
      await videoRef.current.setPositionAsync(newPos);
    }
  };

  const [seekFeedback, setSeekFeedback] = useState<'forward' | 'backward' | null>(null);

  // Unified Taps Logic
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_event, success) => {
      if (success) runOnJS(toggleControls)();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (success) {
        if (event.x < windowWidth / 2) {
          runOnJS(setSeekFeedback)('backward');
          runOnJS(skipBackward)();
        } else {
          runOnJS(setSeekFeedback)('forward');
          runOnJS(skipForward)();
        }
        // Reset feedback after 500ms
        setTimeout(() => {
          runOnJS(setSeekFeedback)(null);
        }, 500);
      }
    });

  // Combined Gestures - Race between Single and Double tap
  const tapGestures = Gesture.Exclusive(doubleTap, singleTap);
  const videoGesture = Gesture.Simultaneous(pinchGesture, longPressGesture, tapGestures);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPlaybackStatusUpdate = (newStatus: AVPlaybackStatus) => {
    if (newStatus.isLoaded) {
      setStatus(newStatus);
    }
  };

  const togglePlay = async () => {
    resetHideTimer();
    if (!videoRef.current) return;
    
    if (!status) {
      // If status hasn't loaded yet, just try to play
      await videoRef.current.playAsync();
      return;
    }

    if (status.isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const onVideoError = (error: string) => {
    console.error("Video Playback Error:", error);
    Alert.alert("Video Error", "Unable to load video. Please check your connection or link.");
  };

  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 1000); // Exactly 1s as requested
  }, []);

  useEffect(() => {
    if (showControls) {
      resetHideTimer();
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [showControls]);

  const toggleControls = () => {
    resetHideTimer(); // Always show and start/reset 1s timer on tap
  };

  const toggleFullscreen = async () => {
    resetHideTimer();
    try {
      if (!isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      }
    } catch (e) {
      console.log("Toggle fullscreen failed", e);
    }
  };

  const handleSeek = async (e: any) => {
    resetHideTimer();
    if (!videoRef.current || !status?.durationMillis || barWidth <= 0) return;
    const { locationX } = e.nativeEvent;
    const seekPosition = (locationX / barWidth) * status.durationMillis;
    await videoRef.current.setPositionAsync(seekPosition);
  };

  return (
    <View 
      onTouchStart={resetHideTimer}
      className={`bg-black relative overflow-hidden ${isFullscreen ? 'absolute inset-0 z-[999]' : 'w-full aspect-video'}`}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, longPressGesture, doubleTap)}>
        <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
          <Video
            ref={videoRef}
            source={{ uri: source }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={isFullscreen ? ResizeMode.COVER : ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onError={onVideoError}
            shouldPlay={true}
            isMuted={false}
            posterSource={{ uri: thumbnail }}
            usePoster={true}
            posterStyle={{ resizeMode: 'cover' }}
          />
          {(!status || (status.isLoaded && status.isBuffering)) && (
            <View className="absolute inset-0 items-center justify-center bg-black/10">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
          {playbackRate > 1 && (
            <View className="absolute top-20 self-center bg-black/40 px-3 py-1 rounded-full border border-white/20">
              <Text className="text-white font-black text-xs">2x Speed</Text>
            </View>
          )}

          {/* Seek Feedback */}
          {seekFeedback && (
            <View className={`absolute top-1/2 -translate-y-6 ${seekFeedback === 'forward' ? 'right-20' : 'left-20'} bg-black/60 w-24 h-24 rounded-full items-center justify-center border border-white/20`}>
              <Ionicons name={seekFeedback === 'forward' ? "play-forward" : "play-back"} size={40} color="white" />
              <Text className="text-white font-black text-xs mt-1 uppercase tracking-widest">{seekFeedback === 'forward' ? '+10s' : '-10s'}</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Controls Overlay */}
      {showControls && (
        <View 
          pointerEvents="box-none"
          className="absolute inset-0 bg-black/40 items-center justify-center p-4"
        >
          <View className="flex-row items-center gap-12">
            <TouchableOpacity onPress={skipBackward} className="p-4 rounded-full bg-black/20 backdrop-blur-md">
              <Ionicons name="play-back" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={togglePlay} className="w-20 h-20 rounded-full bg-black/20 backdrop-blur-md items-center justify-center">
              <Ionicons name={status?.isPlaying ? "pause" : "play"} size={44} color="white" style={!status?.isPlaying ? { marginLeft: 4 } : {}} />
            </TouchableOpacity>

            <TouchableOpacity onPress={skipForward} className="p-4 rounded-full bg-black/20 backdrop-blur-md">
              <Ionicons name="play-forward" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Bottom Seek Bar */}
          <View pointerEvents="box-none" className="absolute bottom-0 inset-x-0 p-4">
             <View pointerEvents="box-none" className="flex-row justify-between mb-2">
               <Text className="text-white text-[10px] font-bold">
                 {status ? `${Math.floor(status.positionMillis / 60000)}:${String(Math.floor((status.positionMillis % 60000) / 1000)).padStart(2, '0')}` : '0:00'}
                 <Text className="text-white/60"> / {status ? `${Math.floor(status.durationMillis! / 60000)}:${String(Math.floor((status.durationMillis! % 60000) / 1000)).padStart(2, '0')}` : '0:00'}</Text>
               </Text>
               <TouchableOpacity onPress={toggleFullscreen}>
                 <Ionicons name={isFullscreen ? "contract-outline" : "expand-outline"} size={18} color="white" />
               </TouchableOpacity>
             </View>
             <Pressable 
              onPress={handleSeek}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              className="w-full h-3 justify-center"
             >
               <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                 <View 
                  className="h-full bg-red-600 rounded-full" 
                  style={{ width: status ? `${(status.positionMillis / (status.durationMillis || 1)) * 100}%` : '0%' }} 
                 />
               </View>
             </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const YouTubeCard = React.memo(({
  item,
  onPress,
  isAdmin,
  onDelete,
  onEdit,
}: {
  item: FyncMediaItem;
  onPress: (item: FyncMediaItem) => void;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (item: FyncMediaItem) => void;
}) => {
  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={() => onPress(item)}
      className="bg-white mb-4 w-full shadow-sm"
    >
      {/* Thumbnail */}
      <View className="w-full aspect-video relative bg-gray-100 mx-0 overflow-hidden">
        <Image 
          source={{ uri: item.thumbnail }} 
          className="w-full h-full" 
          resizeMode="cover"
        />
        <View className="absolute bottom-3 right-3 bg-black/80 px-1.5 py-0.5 rounded-md">
          <Text className="text-white text-[10px] font-black uppercase tracking-tighter">{formatDuration(item.duration)}</Text>
        </View>

        {isAdmin && (
          <View className="absolute top-3 right-3 flex-row gap-2">
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onEdit(item); }}
              className="w-9 h-9 bg-white/70 rounded-full items-center justify-center backdrop-blur-lg border border-gray-200"
            >
              <Ionicons name="pencil" size={16} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onDelete(item._id); }}
              className="w-9 h-9 bg-red-500/90 rounded-full items-center justify-center border border-red-500/20"
            >
              <Ionicons name="trash" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Info Row - YouTube spacing */}
      <View className="flex-row p-4 pt-4">
        <Image 
          source={FyncLogo} 
          className="w-10 h-10 rounded-full bg-gray-100 mr-3 border border-gray-50 shadow-sm"
        />
        <View className="flex-1">
          <Text className="text-zinc-900 text-[15px] font-bold leading-5 mb-1 tracking-tight" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-gray-500 text-[13px] font-medium">
            {'Fync Official'} • {new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <TouchableOpacity className="ml-2 h-10 w-6 items-center">
          <Ionicons name="ellipsis-vertical" size={16} color="#4b5563" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const MediaDetailView = React.memo(({
  item,
  onClose,
  currentUserId,
  onCommentPress
}: {
  item: FyncMediaItem;
  onClose: () => void;
  currentUserId: string;
  onCommentPress: (id: string) => void;
}) => {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<Video>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Optimistic Interaction States
  const [isLiked, setIsLiked] = useState(item.liked_by?.some((id: any) => String(id) === String(currentUserId)));
  const [isDisliked, setIsDisliked] = useState(item.disliked_by?.some((id: any) => String(id) === String(currentUserId)));
  const [likeCount, setLikeCount] = useState(item.likes || 0);
  const [dislikeCount, setDislikeCount] = useState(item.dislikes || 0);

  const handleLike = async () => {
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(prev => Math.max(0, prev - 1));
    } else {
      setIsLiked(true);
      setLikeCount(prev => prev + 1);
      if (isDisliked) {
        setIsDisliked(false);
        setDislikeCount(prev => Math.max(0, prev - 1));
      }
    }
    try {
      await axios.post(`/fync-media/like/${item._id}`);
    } catch (err) {}
  };

  const handleDislike = async () => {
    if (isDisliked) {
      setIsDisliked(false);
      setDislikeCount(prev => Math.max(0, prev - 1));
    } else {
      setIsDisliked(true);
      setDislikeCount(prev => prev + 1);
      if (isLiked) {
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      }
    }
    try {
      await axios.post(`/fync-media/dislike/${item._id}`);
    } catch (err) {}
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://fync.app/fync-media?id=${item._id}`;
      await Share.share({ message: `${item.title}\n\n${shareUrl}` });
    } catch (err) {}
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        {/* YouTube Video Component */}
        <YouTubeVideoPlayer 
          source={item.video_link} 
          thumbnail={item.thumbnail}
          onClose={onClose} 
        />

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            <Text className="text-zinc-900 text-[19px] font-black leading-tight mb-4 tracking-tight">{item.title}</Text>
            
            {/* Action Row - YouTube Pill Style */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center bg-gray-100 rounded-full h-10 px-1">
                  <TouchableOpacity onPress={handleLike} className="flex-row items-center gap-2 pl-3 pr-4 border-r border-gray-300">
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? "#ec4899" : "#1A1A1A"} />
                    <Text className="font-bold text-xs text-zinc-900">{likeCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDislike} className="flex-row items-center gap-2 pl-4 pr-3">
                    <Ionicons name={isDisliked ? "heart-dislike" : "heart-dislike-outline"} size={20} color={isDisliked ? "#6b7280" : "#1A1A1A"} />
                    <Text className="font-bold text-xs text-zinc-900">{dislikeCount}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleShare} className="bg-gray-100 h-10 px-5 rounded-full flex-row items-center gap-2">
                  <Ionicons name="share-social-outline" size={18} color="#1A1A1A" />
                  <Text className="font-bold text-xs text-zinc-900">Share</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>


            {/* Description Section */}
            <TouchableOpacity 
              onPress={() => setIsExpanded(!isExpanded)}
              activeOpacity={0.8}
              className="bg-gray-50 rounded-2xl p-4 mb-6"
            >
              <View className="flex-row gap-2 mb-2">
                <Text className="text-zinc-900 text-xs font-black uppercase tracking-tighter">Information</Text>
                <Text className="text-zinc-900 text-xs">•</Text>
                <Text className="text-gray-500 text-xs font-medium">{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              
              <Text className="text-zinc-800 leading-6 text-[14px] font-medium" numberOfLines={isExpanded ? undefined : 2}>
                {item.description}
              </Text>
              
              <View className="flex-row items-center gap-2 mt-2">
                {item.tags?.map((tag, idx) => (
                  <Text key={idx} className="text-pink-500 font-medium text-xs">#{tag}</Text>
                ))}
              </View>
              
              <Text className="text-gray-400 font-bold text-xs mt-3">{isExpanded ? 'Show less' : 'Show more'}</Text>
            </TouchableOpacity>

            {/* Comment Preview Section */}
            <View className="bg-gray-50 rounded-2xl border border-gray-100 px-4 py-2 mb-20 overflow-hidden">
              <TouchableOpacity 
                onPress={() => onCommentPress(item._id)}
                className="flex-row justify-between items-center mb-4"
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-zinc-800 font-black text-sm">Comments</Text>
                  <Text className="text-zinc-900 text-sm font-medium">{item.comment?.length || 0}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => onCommentPress(item._id)}
                className="flex-row items-center bg-gray-100 rounded-full px-3 py-2 border border-gray-200"
              >
                 <Image source={{ uri: user?.avatar }} className="w-7 h-7 rounded-full mr-2 bg-gray-100" />
                 <Text className="text-gray-500 text-sm font-medium">Add community thoughts...</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
});

export default function FyncMediaFeed() {
  const { user } = useAuth();
  
  const [media, setMedia] = useState<FyncMediaItem[]>([]);
  const [activeMedia, setActiveMedia] = useState<FyncMediaItem | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Upload/Edit States
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<FyncMediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadThumbnail, setUploadThumbnail] = useState<string | null>(null);
  const [uploadVideo, setUploadVideo] = useState<string | null>(null);
  const [uploadDuration, setUploadDuration] = useState<string | null>(null);

  // Comment States
  const [activeCommentMediaId, setActiveCommentMediaId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [replyingTo, setReplyingTo] = useState<any>(null);
  const commentInputRef = useRef<TextInput>(null);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isAdmin = user?.user_access === 'admin';

  const fetchMedia = async (pageNum = 1, shouldRefresh = false) => {
    if (!hasMore && !shouldRefresh && pageNum !== 1) return;
    if (pageNum === 1) setLoading(true);
    if (pageNum > 1) setLoadingMore(true);

    try {
      const res = await axios.get(`/fync-media/all?page=${pageNum}&limit=10`);
      if (res.data.success) {
        const newMedia = res.data.data;
        if (shouldRefresh || pageNum === 1) {
          setMedia(newMedia);
        } else {
          setMedia([...media, ...newMedia]);
        }
        setPage(pageNum);
        setHasMore(newMedia.length >= 10);
      }
    } catch (err) {
      console.log("Error fetching Fync Media", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMedia(1, true);
  }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMedia(page + 1);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedia(1, true);
  };

  const fetchComments = async (mediaId: string) => {
    setLoadingComments(true);
    try {
      const res = await axios.get(`/fync-media/comment/all/${mediaId}`);
      if (res.data.success) {
        setComments(res.data.comments);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleOpenComments = useCallback((mediaId: string) => {
    setActiveCommentMediaId(mediaId);
    fetchComments(mediaId);
  }, []);

  const handlePostComment = async () => {
    if (!activeCommentMediaId || !newCommentText.trim()) return;

    setPostingComment(true);
    try {
      const res = await axios.post(`/fync-media/comment/add/${activeCommentMediaId}`, {
        text: newCommentText,
        parentComment: replyingTo?._id || null,
        replyToUser: replyingTo?.commentor?._id || null
      });

      if (res.data.success) {
        setNewCommentText("");
        setReplyingTo(null);
        fetchComments(activeCommentMediaId);
        
        // Optimistically update comment count in media array
        setMedia(prev => prev.map(m => m._id === activeCommentMediaId ? { ...m, comment: [...m.comment, res.data.comment._id] } : m));
      }
    } catch (err) {
      console.log("Error posting comment:", err);
      Alert.alert("Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await axios.delete(`/fync-media/comment/${commentId}`);
      if (activeCommentMediaId) fetchComments(activeCommentMediaId);
    } catch (err) {
      console.log("Error deleting comment:", err);
    }
  };

  const handleEditPress = (item: FyncMediaItem) => {
    setEditingItem(item);
    setUploadTitle(item.title);
    setUploadDescription(item.description);
    setUploadTags(item.tags?.join(",") || "");
    setUploadThumbnail(item.thumbnail);
    setUploadVideo(item.video_link);
    setUploadModalVisible(true);
  };

  const handleDeletePress = async (id: string) => {
    Alert.alert(
      "Delete Media",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await axios.delete(`/fync-media/delete/${id}`);
              if (res.data.success) {
                setMedia(prev => prev.filter(m => m._id !== id));
                Alert.alert("Success", "Media deleted successfully");
              }
            } catch (err) {
              Alert.alert("Error deleting media");
            }
          }
        }
      ]
    );
  };

  const renderItem = useCallback(({ item }: { item: FyncMediaItem }) => (
    <YouTubeCard
      item={item}
      onPress={(selected) => setActiveMedia(selected)}
      isAdmin={isAdmin}
      onEdit={handleEditPress}
      onDelete={handleDeletePress}
    />
  ), [isAdmin]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setUploadThumbnail(result.assets[0].uri);
  };

  const pickVideo = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) {
      setUploadVideo(result.assets[0].uri);
      // Format duration from milliseconds/seconds
      // Format duration from milliseconds
      if (result.assets[0].duration) {
        // expo-image-picker duration is in milliseconds
        const totalMs = result.assets[0].duration;
        const totalSeconds = Math.floor(totalMs / 1000);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        setUploadDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadTitle || !uploadDescription || !uploadThumbnail || !uploadVideo) {
      Alert.alert("Missing Fields", "Please provide a title, description, thumbnail, and video.");
      return;
    }

    if (uploadTitle.length > 100) {
      Alert.alert("Title Too Long", "Title must be 100 characters or less.");
      return;
    }

    const wordCount = uploadDescription.trim().split(/\s+/).length;
    if (wordCount > 300) {
      Alert.alert("Description Too Long", "Description must be less than 300 words.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle);
      formData.append("description", uploadDescription);
      formData.append("tags", uploadTags);

      const thumbFilename = uploadThumbnail.split('/').pop() || 'thumbnail.jpg';
      const thumbMatch = /\.(\w+)$/.exec(thumbFilename);
      const thumbType = thumbMatch ? `image/${thumbMatch[1]}` : `image`;
      formData.append("thumbnail", { uri: uploadThumbnail, name: thumbFilename, type: thumbType } as any);

      const vidFilename = uploadVideo.split('/').pop() || 'video.mp4';
      const vidMatch = /\.(\w+)$/.exec(vidFilename);
      const vidType = vidMatch ? `video/${vidMatch[1]}` : `video`;
      formData.append("video", { uri: uploadVideo, name: vidFilename, type: vidType } as any);
      
      if (uploadDuration) {
        formData.append("duration", uploadDuration);
      }

      const url = editingItem ? `/fync-media/update/${editingItem._id}` : '/fync-media/create';
      const method = editingItem ? 'put' : 'post';

      const res = await axios[method](url, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data.success) {
        Alert.alert("Success", `Media ${editingItem ? 'updated' : 'uploaded'} successfully!`);
        setUploadModalVisible(false);
        setEditingItem(null);
        setUploadTitle("");
        setUploadDescription("");
        setUploadTags("");
        setUploadThumbnail(null);
        setUploadVideo(null);
        setUploadDuration(null);
        onRefresh();
      }
    } catch (error: any) {
      Alert.alert(`${editingItem ? 'Update' : 'Upload'} Failed`, error.response?.data?.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const handleCloseModal = () => {
    setUploadModalVisible(false);
    setEditingItem(null);
    setUploadTitle("");
    setUploadDescription("");
    setUploadTags("");
    setUploadThumbnail(null);
    setUploadVideo(null);
    setUploadDuration(null);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" />
        <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="px-6 py-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm mb-6">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-1 bg-gray-50 rounded-full mr-3 border border-gray-100">
              <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-zinc-900 text-2xl font-black">FYNC{" "}<Text className="text-pink-500">MEDIA</Text></Text>
          </View>
          {isAdmin && (
            <TouchableOpacity 
              onPress={() => setUploadModalVisible(true)}
              className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-200"
            >
              <Ionicons name="add" size={24} color="#db2777" />
            </TouchableOpacity>
          )}
        </View>

        {loading && media.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#ec4899" />
          </View>
        ) : media.length === 0 ? (
          <View className="flex-1 items-center justify-center pb-20">
            <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6 border border-gray-200 shadow-sm">
              <Ionicons name="videocam-outline" size={48} color="#cbd5e1" />
            </View>
            <Text className="text-zinc-900 text-xl font-black">No Fync Media found</Text>
            <Text className="text-gray-500 text-sm mt-2 font-medium">Be the first to see updates when they arrive.</Text>
          </View>
        ) : (
          <FlatList
            data={media}
            renderItem={renderItem}
            keyExtractor={item => item._id}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#ec4899" className="mb-10" /> : <View className="h-10" />}
          />
        )}
      </SafeAreaView>

      {/* Video Detail Modal */}
      <Modal 
        visible={!!activeMedia} 
        animationType="slide" 
        presentationStyle="fullScreen"
        onRequestClose={() => setActiveMedia(null)}
      >
        {activeMedia && (
          <MediaDetailView 
            item={activeMedia} 
            onClose={() => setActiveMedia(null)}
            currentUserId={user?._id || user?.id}
            onCommentPress={handleOpenComments}
          />
        )}
      </Modal>

      {/* Upload Modal */}
      <Modal 
        visible={uploadModalVisible} 
        animationType="slide" 
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable className="flex-1" onPress={handleCloseModal} />
          <View className="bg-white rounded-t-[40px] h-[80%] overflow-hidden border-t border-gray-200">
            {/* Grab Handle */}
            <View className="items-center pt-3 pb-1">
              <View className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </View>

            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : undefined} 
              className="flex-1"
            >
              <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
                <Text className="text-xl font-black text-zinc-900">{editingItem ? 'Update' : 'Upload'} Media</Text>
                <TouchableOpacity onPress={handleCloseModal} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                  <Ionicons name="close" size={20} color="#1A1A1A" />
                </TouchableOpacity>
              </View>

          <ScrollView className="flex-1 p-5 space-y-5" contentContainerStyle={{ paddingBottom: 100 }}>
            <View>
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title</Text>
              <TextInput
                value={uploadTitle}
                multiline
                onChangeText={setUploadTitle}
                placeholder="Enter title..."
                className="bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100 font-medium text-zinc-900"
              />
            </View>

            <View className="mt-4">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</Text>
              <TextInput
                value={uploadDescription}
                onChangeText={setUploadDescription}
                placeholder="Write a description..."
                multiline
                numberOfLines={3}
                className="bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100 font-medium text-zinc-900 h-28"
                textAlignVertical="top"
              />
            </View>

            <View className="mt-4">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tags</Text>
              <TextInput
                value={uploadTags}
                onChangeText={setUploadTags}
                placeholder="tech, events, fync (comma separated)"
                className="bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100 font-medium text-zinc-900"
              />
            </View>

            <View className="flex-row gap-4 mt-6 h-36">
              <TouchableOpacity onPress={pickImage} className="flex-1 border-2 border-dashed border-gray-200 rounded-3xl items-center justify-center bg-gray-50 overflow-hidden relative">
                {uploadThumbnail ? (
                  <>
                    <Image source={{ uri: uploadThumbnail }} className="w-full h-full absolute" resizeMode="cover" />
                    <View className="absolute inset-0 bg-black/40 items-center justify-center">
                      <Ionicons name="pencil" size={24} color="white" />
                      <Text className="text-white font-bold text-[10px] mt-1">Change</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color="#ec4899" />
                    <Text className="text-zinc-600 font-bold mt-2 text-xs">Thumbnail</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={pickVideo} className="flex-1 border-2 border-dashed border-gray-200 rounded-3xl items-center justify-center bg-gray-50 overflow-hidden relative">
                {uploadVideo ? (
                  <>
                    <Video 
                      source={{ uri: uploadVideo }} 
                      style={{ width: '100%', height: '100%', position: 'absolute' }} 
                      resizeMode={ResizeMode.COVER} 
                      shouldPlay={false}
                      isMuted={true}
                    />
                    <View className="absolute inset-0 bg-black/40 items-center justify-center">
                      <Ionicons name="pencil" size={24} color="white" />
                      <Text className="text-white font-bold text-[10px] mt-1">Change</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="videocam-outline" size={32} color="#6366f1" />
                    <Text className="text-zinc-600 font-bold mt-2 text-xs">Video</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View className="p-2 border-t border-gray-100 bg-white mb-3">
            <TouchableOpacity 
              onPress={handleUpload} 
              disabled={uploading}
              className={`py-4 rounded-2xl items-center justify-center flex-row shadow-lg ${uploading ? 'bg-pink-300' : 'bg-pink-500 shadow-pink-500/30'}`}
            >
              {uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color="white" />
                  <Text className="text-white font-black italic uppercase tracking-widest text-xs ml-2">{editingItem ? 'Update News' : 'Publish'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  </Modal>

      {/* Comment Modal */}
      <Modal visible={!!activeCommentMediaId} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setActiveCommentMediaId(null)}>
        <SafeAreaView className="flex-1 bg-white">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-100 bg-white">
              <Text className="font-black text-xl text-zinc-900">COMMENTS</Text>
              <TouchableOpacity onPress={() => setActiveCommentMediaId(null)} className="p-1 bg-gray-50 rounded-full border border-gray-100">
                <Ionicons name="close" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#ec4899" />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={item => item._id}
                contentContainerStyle={{ padding: 20 }}
                ListEmptyComponent={
                  <View className="items-center justify-center mt-20">
                    <Ionicons name="chatbubbles-outline" size={48} color="#e2e8f0" />
                    <Text className="text-gray-500 font-bold mt-4">No comments yet</Text>
                    <Text className="text-gray-400 text-xs mt-1">Be the first to join the conversation.</Text>
                  </View>
                }
                renderItem={({ item }: { item: any }) => {
                  // Only render top-level comments in the main list
                  if (item.parentComment) return null;
                  
                  const renderCommentItem = (comment: any, isReply = false) => {
                    // Find replies to THIS specific comment
                    const commentReplies = comments.filter((c: any) => String(c.parentComment) === String(comment._id));

                    return (
                      <View key={comment._id} className={`${isReply ? 'ml-8 mt-4' : 'mb-6'}`}>
                        <View className="flex-row">
                          <Image source={{ uri: comment.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className={`${isReply ? 'w-7 h-7' : 'w-9 h-9'} rounded-full mr-2 bg-gray-100`} />
                          <View className="flex-1 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-100">
                            <View className="flex-row justify-between items-center mb-1">
                              <Text className="text-gray-400 text-[9px] font-black">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </Text>
                            </View>
                            <Text className="text-zinc-800 text-[13px] font-medium leading-5">{comment.text}</Text>
                            
                            <View className="flex-row items-center mt-2 gap-4">
                               {!isReply && (
                                 <TouchableOpacity onPress={() => {
                                   setReplyingTo(comment);
                                   setNewCommentText(`@${comment.commentor.username} `);
                                   commentInputRef.current?.focus();
                                 }}>
                                   <Text className="text-pink-500 text-[10px] font-bold uppercase tracking-widest">Reply</Text>
                                 </TouchableOpacity>
                               )}
                               {comment.commentor?._id === (user?._id || user?.id) && (
                                  <TouchableOpacity onPress={() => handleDeleteComment(comment._id)}>
                                    <Text className="text-red-500/90 text-[10px] font-bold uppercase tracking-widest">Delete</Text>
                                  </TouchableOpacity>
                               )}
                            </View>
                          </View>
                        </View>
                        
                        {/* Render Replies */}
                        {commentReplies.map((reply: any) => renderCommentItem(reply, true))}
                      </View>
                    );
                  };

                  return renderCommentItem(item);
                }}
              />
            )}

            {/* Replying indicator */}
            {replyingTo && (
              <View className="px-4 py-2 bg-gray-50 flex-row justify-between items-center border-t border-gray-100">
                <Text className="text-gray-500 text-[10px] font-bold italic">
                  Replying to <Text className="text-pink-500">@{replyingTo.commentor?.username}</Text>
                </Text>
                <TouchableOpacity onPress={() => { setReplyingTo(null); setNewCommentText(""); }}>
                  <Ionicons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              </View>
            )}

            <View className="p-4 border-t border-gray-100 bg-white flex-row items-center">
              <Image source={{ uri: user?.avatar }} className="w-10 h-10 rounded-full mr-2 bg-gray-100" />
              <TextInput
                ref={commentInputRef}
                value={newCommentText}
                onChangeText={setNewCommentText}
                placeholder="Write a comment..."
                placeholderTextColor="#9ca3af"
                className="flex-1 bg-gray-50 px-3 py-2.5 rounded-full border border-gray-100 font-medium text-zinc-900"
              />
              <TouchableOpacity 
                disabled={postingComment || !newCommentText.trim()} 
                onPress={handlePostComment}
                className={`w-10 h-10 rounded-full items-center justify-center ml-2 shadow-md ${newCommentText.trim() ? 'bg-pink-500 shadow-pink-500/30' : 'bg-gray-200 shadow-none'}`}
              >
                {postingComment ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="send" size={18} color={newCommentText.trim() ? "white" : "#94a3b8"} style={{ marginLeft: 2 }} />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>


        </View>
    </GestureHandlerRootView>
  );
}
