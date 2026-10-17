import React, { useRef, useState, useEffect, useCallback } from "react";
import { Image as ExpoImage } from 'expo-image';
import {View, Text, FlatList, Dimensions, Pressable, Image, ViewToken, ActivityIndicator, Share, TouchableOpacity, StatusBar, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions} from 'react-native'
import { getFullUrl } from "../utils/imageUtils";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess, Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import Ionicons from '@expo/vector-icons/Ionicons';
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
import FyncLogo from "../assets/Fync.png"
import { Alert } from './ui/AlertModal';
import { useBottomInset } from '../constants/layout';
import { C } from '../constants/colors';
import { AppBar, IconBtn } from './ui/kit';
import CommentsSheet, { CommentsApi } from './ui/CommentsSheet';

// The server returns every comment flat, newest first, each reply pointing at
// its parent. The sheet wants threads, so fold each reply under its top-level
// ancestor (a reply to a reply still lands in the right thread).
const MEDIA_COMMENTS: CommentsApi = {
  list: (id) => `/fync-media/comment/all/${id}`,
  add: (id) => `/fync-media/comment/add/${id}`,
  replies: true,
  remove: (id) => ({ method: 'delete', url: `/fync-media/comment/${id}` }),
  pick: (data) => {
    const all: any[] = data?.comments ?? [];
    const byId = new Map(all.map((c) => [String(c._id), c]));
    const rootOf = (c: any): any => {
      const parent = c.parentComment && byId.get(String(c.parentComment));
      return parent ? rootOf(parent) : c;
    };
    const tops = all.filter((c) => !c.parentComment).map((c) => ({ ...c, replies: [] as any[] }));
    const topById = new Map(tops.map((t) => [String(t._id), t]));
    all.forEach((c) => { if (c.parentComment) topById.get(String(rootOf(c)._id))?.replies.push(c); });
    return tops;
  },
  // The add response is unpopulated: `commentor` is a bare id until the refetch.
  normalize: (c) => ({
    ...c,
    commentor: typeof c.commentor === 'object' ? c.commentor : { _id: c.commentor },
  }),
};

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
  const bottomInset = useBottomInset();
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barWidth, setBarWidth] = useState(300);
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();

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

  // Leaving the player must hand the rest of the app back in portrait, and free
  // the decoder. Both used to live in the controls effect below, which unloaded
  // the video every time the controls auto-hid.
  const fullscreenRef = useRef(false);
  fullscreenRef.current = isFullscreen;
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (seekTimer.current) clearTimeout(seekTimer.current);
      video?.unloadAsync().catch(() => {});
      if (fullscreenRef.current) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

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
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Runs on the JS thread; the tap callback below is a worklet and cannot own a timer.
  const seekWithFeedback = (dir: 'forward' | 'backward') => {
    setSeekFeedback(dir);
    if (dir === 'forward') skipForward(); else skipBackward();
    if (seekTimer.current) clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => setSeekFeedback(null), 500);
  };

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
        runOnJS(seekWithFeedback)(event.x < windowWidth / 2 ? 'backward' : 'forward');
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
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
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
      className={`bg-ink relative overflow-hidden ${isFullscreen ? 'absolute inset-0 z-[999]' : 'w-full aspect-video'}`}
    >
      <GestureDetector gesture={Gesture.Simultaneous(pinchGesture, longPressGesture, doubleTap)}>
        <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
          <Video
            ref={videoRef}
            source={{ uri: getFullUrl(source) || '' }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={isFullscreen ? ResizeMode.COVER : ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            onError={onVideoError}
            shouldPlay={true}
            isMuted={false}
            posterSource={{ uri: getFullUrl(thumbnail) || '' }}
            usePoster={true}
            posterStyle={{ resizeMode: 'cover' }}
          />
          {(!status || (status.isLoaded && status.isBuffering)) && (
            <View className="absolute inset-0 items-center justify-center bg-black/10">
              <ActivityIndicator size="large" color={C.white} />
            </View>
          )}
          {playbackRate > 1 && (
            <View className="absolute top-20 self-center bg-black/40 px-3 py-1 rounded-full border border-white/20">
              <Text className="text-white font-display text-xs">2x Speed</Text>
            </View>
          )}

          {/* Seek Feedback */}
          {seekFeedback && (
            <View className={`absolute top-1/2 -translate-y-6 ${seekFeedback === 'forward' ? 'right-20' : 'left-20'} bg-black/60 w-24 h-24 rounded-full items-center justify-center border border-white/20`}>
              <Ionicons name={seekFeedback === 'forward' ? "play-forward" : "play-back"} size={40} color="white" />
              <Text className="text-white font-display text-xs mt-1 uppercase">{seekFeedback === 'forward' ? '+10s' : '-10s'}</Text>
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
          <View pointerEvents="box-none" className="absolute inset-x-0 p-4" style={{ bottom: bottomInset }}>
            <View pointerEvents="box-none" className="flex-row justify-between mb-2">
              <Text className="text-white text-label font-semibold">
                {status ? `${Math.floor(status.positionMillis / 60000)}:${String(Math.floor((status.positionMillis % 60000) / 1000)).padStart(2, '0')}` : '0:00'}
                <Text className="text-white/60"> / {status ? `${Math.floor((status.durationMillis ?? 0) / 60000)}:${String(Math.floor(((status.durationMillis ?? 0) % 60000) / 1000)).padStart(2, '0')}` : '0:00'}</Text>
              </Text>
              <TouchableOpacity onPress={toggleFullscreen} hitSlop={12}>
                <Ionicons name={isFullscreen ? "contract-outline" : "expand-outline"} size={18} color="white" />
              </TouchableOpacity>
            </View>
            <Pressable
              onPress={handleSeek}
              onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
              className="w-full h-3 justify-center"
            >
              <View className="w-full h-1 bg-card/20 rounded-full overflow-hidden">
                <View
                  className="h-full bg-danger rounded-full"
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
  stamped,
}: {
  item: FyncMediaItem;
  onPress: (item: FyncMediaItem) => void;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (item: FyncMediaItem) => void;
  /** The lead broadcast carries the screen's one stamp. */
  stamped?: boolean;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPress(item)}
      className={`bg-card mb-3 w-full rounded-card overflow-hidden ${stamped ? 'border-2 border-ink' : 'border border-line'}`}
      style={stamped ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
    >
      {/* Thumbnail */}
      <View className="w-full aspect-video relative bg-paper-2 mx-0">
        <ExpoImage
          source={{ uri: getFullUrl(item.thumbnail) || '' }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item._id}
        />
        <View className="absolute bottom-4 right-4 bg-ink/90 px-2 py-1 rounded-lg border border-white/20">
          <Text className="text-white text-label font-display uppercase">{formatDuration(item.duration)}</Text>
        </View>

        {isAdmin && (
          <View className="absolute top-4 right-4 flex-row gap-2">
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onEdit(item); }}
              className="w-10 h-10 bg-card/90 rounded-card items-center justify-center backdrop-blur-xl border border-line shadow-hair"
            >
              <Ionicons name="pencil" size={16} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onDelete(item._id); }}
              className="w-10 h-10 bg-danger rounded-card items-center justify-center border border-danger shadow-hair"
            >
              <Ionicons name="trash" size={16} color="white" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Info Row */}
      <View className="flex-row p-5 pt-5 items-center">
        <Image
          source={FyncLogo}
          className="w-11 h-11 rounded-full bg-paper-2 mr-2 border border-line shadow-hair"
        />
        <View className="flex-1">
          <Text className="text-ink text-base font-semibold leading-5" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-ink-3 text-label font-display">
            {new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
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
    } catch (err) { }
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
    } catch (err) { }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `https://fync-api.duckdns.org/fync-media?id=${item._id}`;
      await Share.share({ message: `${item.title}\n\n${shareUrl}` });
    } catch (err) { }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
      <View className="flex-1 bg-paper">
        {/* The only way out used to be Android's back button. */}
        <AppBar title="Fync Media" onBack={onClose} />
        {/* YouTube Video Component */}
        <YouTubeVideoPlayer
          source={item.video_link}
          thumbnail={item.thumbnail}
          onClose={onClose}
        />

        <ScrollView keyboardShouldPersistTaps="handled" className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-card-pad">
            <Text className="text-ink text-2xl font-display uppercase leading-tight mb-6">{item.title}</Text>

            {/* Action Row - Arena Pill Style */}
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} className="mb-8">
              <View className="flex-row items-center gap-4">
                <View className="flex-row items-center bg-card rounded-card h-12 px-1 border border-line shadow-hair">
                  <TouchableOpacity onPress={handleLike} className="flex-row items-center gap-2 pl-4 pr-5 border-r border-line">
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={20} color={isLiked ? "#F97316" : "#8B857E"} />
                    <Text className="font-semibold text-base text-ink">{likeCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDislike} className="flex-row items-center gap-2 pl-5 pr-4">
                    <Ionicons name={isDisliked ? "heart-dislike" : "heart-dislike-outline"} size={20} color={isDisliked ? "#12100E" : "#8B857E"} />
                    <Text className="font-semibold text-base text-ink">{dislikeCount}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={handleShare} className="bg-card h-12 px-6 rounded-card flex-row items-center gap-2 border border-line shadow-hair">
                  <Ionicons name="share-social-outline" size={18} color={C.ink} />
                  <Text className="font-semibold text-base text-ink">Broadcast</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>


            {/* Description Section */}
            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              activeOpacity={0.8}
              className="bg-card rounded-card p-6 border border-line shadow-hair mb-8"
            >
              <View className="flex-row items-center gap-2 mb-4">
                <View className="bg-brand-500 w-1 h-3 rounded-full" />
                <Text className="text-ink text-label font-display uppercase">Protocol Intel</Text>
                <Text className="text-ink-4 text-label">•</Text>
                <Text className="text-ink-3 text-label font-semibold uppercase">{new Date(item.date).toLocaleDateString()}</Text>
              </View>

              <Text className="text-ink-2 leading-7 text-sm font-medium" numberOfLines={isExpanded ? undefined : 2}>
                {item.description}
              </Text>

              <View className="flex-row items-center gap-2 mt-4 flex-wrap">
                {item.tags?.map((tag, idx) => (
                  <View key={idx} className="bg-paper-2 px-2 py-1 rounded-md border border-line">
                    <Text className="text-accent-text font-display text-label uppercase">#{tag}</Text>
                  </View>
                ))}
              </View>

              <Text className="text-ink-3 font-display uppercase text-label mt-6">{isExpanded ? 'Collapse Intel' : 'Expand Details'}</Text>
            </TouchableOpacity>

            {/* Comment Preview Section */}
            <View className="bg-card rounded-card border border-line px-6 py-6 mb-20 shadow-hair">
              <TouchableOpacity
                onPress={() => onCommentPress(item._id)}
                className="flex-row justify-between items-center mb-6"
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-ink w-10 h-10 rounded-xl items-center justify-center">
                    <Ionicons name="chatbubble" size={18} color="white" />
                  </View>
                  <View>
                    <Text className="font-semibold text-base text-ink">Community Feedback</Text>
                    <Text className="text-ink-3 text-label font-semibold uppercase mt-0.5">{item.comment?.length || 0} Responses</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.ink3} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onCommentPress(item._id)}
                className="flex-row items-center bg-paper-2 rounded-card px-4 py-3 border border-line"
              >
                <Image source={{ uri: getFullUrl(user?.avatar) || `https://ui-avatars.com/api/?name=${user?.username || 'U'}` }} className="w-8 h-8 rounded-xl mr-3 bg-paper-2" />
                <Text className="text-ink-3 text-label font-display uppercase">Contribute to discussion...</Text>
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

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const bottomInset = useBottomInset();

  const isAdmin = user?.user_access === 'admin';

  const fetchMedia = async (pageNum = 1, shouldRefresh = false) => {
    if (!hasMore && !shouldRefresh && pageNum !== 1) return;
    if (pageNum === 1) setLoading(true);
    if (pageNum > 1) setLoadingMore(true);

    try {
      const res = await axios.get(`/fync-media/all?page=${pageNum}&limit=10`);
      if (res.data.success) {
        const newMedia: FyncMediaItem[] = res.data.data ?? [];
        if (shouldRefresh || pageNum === 1) {
          setMedia(newMedia);
        } else {
          // Functional + de-duped: the closure's `media` can be a page behind,
          // and a post published between pages shifts the offset.
          setMedia(prev => {
            const seen = new Set(prev.map(m => m._id));
            return [...prev, ...newMedia.filter(m => !seen.has(m._id))];
          });
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
    if (!loading && !loadingMore && hasMore) {
      fetchMedia(page + 1);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMedia(1, true);
  };

  const handleOpenComments = useCallback((mediaId: string) => {
    setActiveCommentMediaId(mediaId);
  }, []);

  // `comment` is only ever read for its length.
  const onCommentCount = useCallback((id: string, count: number) => {
    setMedia(prev => prev.map(m => (m._id === id ? { ...m, comment: Array(count).fill('') } : m)));
  }, []);

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

  const renderItem = useCallback(({ item, index }: { item: FyncMediaItem; index: number }) => (
    <YouTubeCard
      item={item}
      stamped={index === 0}
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

      // When editing, an untouched thumbnail/video is still the remote URL. The
      // server keeps the existing file when none is sent, and Android cannot
      // stream a remote URL as a multipart file — so only attach local picks.
      const isLocal = (uri: string) => /^(file|content|ph|assets-library):/i.test(uri);

      if (isLocal(uploadThumbnail)) {
        const thumbFilename = uploadThumbnail.split('/').pop() || 'thumbnail.jpg';
        const thumbMatch = /\.(\w+)$/.exec(thumbFilename);
        const thumbType = thumbMatch ? `image/${thumbMatch[1]}` : `image`;
        formData.append("thumbnail", { uri: uploadThumbnail, name: thumbFilename, type: thumbType } as any);
      }

      if (isLocal(uploadVideo)) {
        const vidFilename = uploadVideo.split('/').pop() || 'video.mp4';
        const vidMatch = /\.(\w+)$/.exec(vidFilename);
        const vidType = vidMatch ? `video/${vidMatch[1]}` : `video`;
        formData.append("video", { uri: uploadVideo, name: vidFilename, type: vidType } as any);
      }

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
      <View className="flex-1 bg-paper">
        <StatusBar barStyle="dark-content" />

        {/* HEADER DECORATION */}

        <View className="flex-1">
          <AppBar
            title="Fync Media"
            onBack={() => navigation.goBack()}
            right={isAdmin ? <IconBtn name="add" boxed onPress={() => setUploadModalVisible(true)} /> : undefined}
          />

          {loading && media.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={C.brand[500]} />
            </View>
          ) : media.length === 0 ? (
            <View className="items-center justify-center mt-20 px-gutter">
              <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                <Ionicons name="videocam-outline" size={48} color={C.ink4} />
              </View>
              <Text className="font-semibold text-base text-ink text-center">Archive Empty</Text>
              <Text className="font-sans text-sm text-ink-4 mt-2 text-center">No broadcast records found in the registry.</Text>
            </View>
          ) : (
            <FlatList keyboardShouldPersistTaps="handled"
              data={media}
              renderItem={renderItem}
              keyExtractor={item => item._id}
              showsVerticalScrollIndicator={false}
              refreshing={refreshing}
              onRefresh={onRefresh}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
              initialNumToRender={5}
              maxToRenderPerBatch={3}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={C.brand[500]} className="mb-10" /> : <View className="h-10" />}
            />
          )}
        </View>

        {/* Video Detail Modal */}
        <Modal
          visible={!!activeMedia}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
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
            <View className="bg-paper rounded-t-sheet h-[80%] overflow-hidden border-t border-line">
              {/* Grab Handle */}
              <View className="items-center pt-3 pb-1">
                <View className="w-12 h-1.5 bg-ink-4 rounded-full" />
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
              >
                <View className="flex-row items-center justify-between px-6 py-4 border-b border-line">
                  <Text className="font-display text-ink text-h1">{editingItem ? 'Update' : 'Upload'} Media</Text>
                  <TouchableOpacity onPress={handleCloseModal} className="w-8 h-8 bg-paper-2 rounded-full items-center justify-center" hitSlop={6}>
                    <Ionicons name="close" size={20} color={C.ink} />
                  </TouchableOpacity>
                </View>

                <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 p-5 space-y-5" contentContainerStyle={{ paddingBottom: 100 }}>
                  <View>
                    <Text className="text-xs font-semibold text-ink-3 uppercase mb-2">Title</Text>
                    <TextInput
                      value={uploadTitle}
                      multiline
                      onChangeText={setUploadTitle}
                      placeholder="Enter title..."
                      className="bg-card px-4 py-2.5 border-[1.5px] border-ink font-medium text-ink rounded-md"
                    />
                  </View>

                  <View className="mt-4">
                    <Text className="text-xs font-semibold text-ink-3 uppercase mb-2">Description</Text>
                    <TextInput
                      value={uploadDescription}
                      onChangeText={setUploadDescription}
                      placeholder="Write a description..."
                      multiline
                      numberOfLines={3}
                      className="bg-card px-4 py-2.5 border-[1.5px] border-ink font-medium text-ink h-28 rounded-md"
                      textAlignVertical="top"
                    />
                  </View>

                  <View className="mt-4">
                    <Text className="text-xs font-semibold text-ink-3 uppercase mb-2">Tags</Text>
                    <TextInput
                      value={uploadTags}
                      onChangeText={setUploadTags}
                      placeholder="tech, events, fync (comma separated)"
                      className="bg-card px-4 py-2.5 border-[1.5px] border-ink font-medium text-ink rounded-md"
                    />
                  </View>

                  <View className="flex-row gap-4 mt-6 h-36">
                    <TouchableOpacity onPress={pickImage} className="flex-1 border-2 border-dashed border-line items-center justify-center bg-paper-2 overflow-hidden relative rounded-md">
                      {uploadThumbnail ? (
                        <>
                          <Image source={{ uri: uploadThumbnail }} className="w-full h-full absolute" resizeMode="cover" />
                          <View className="absolute inset-0 bg-black/40 items-center justify-center">
                            <Ionicons name="pencil" size={24} color="white" />
                            <Text className="text-white font-semibold text-label mt-1">Change</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="image-outline" size={32} color={C.brand[500]} />
                          <Text className="text-ink-2 font-semibold mt-2 text-xs">Thumbnail</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={pickVideo} className="flex-1 border-2 border-dashed border-line items-center justify-center bg-paper-2 overflow-hidden relative rounded-md">
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
                            <Text className="text-white font-semibold text-label mt-1">Change</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <Ionicons name="videocam-outline" size={32} color={C.recruiter} />
                          <Text className="text-ink-2 font-semibold mt-2 text-xs">Video</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View className="p-4 border-t border-line bg-card" style={{ paddingBottom: bottomInset }}>
                  <TouchableOpacity
                    onPress={handleUpload}
                    disabled={uploading}
                    className={`h-14 rounded-card items-center justify-center flex-row shadow-hair ${uploading ? 'bg-brand-200' : 'bg-brand-500 '}`}
                  >
                    {uploading ? (
                      <ActivityIndicator color={C.ink} />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color={C.ink} />
                        <Text className="text-ink font-display uppercase text-sm ml-3">{editingItem ? 'Update Archive' : 'Publish Broadcast'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>

        <CommentsSheet
          visible={!!activeCommentMediaId}
          onClose={() => setActiveCommentMediaId(null)}
          resource={MEDIA_COMMENTS}
          targetId={activeCommentMediaId}
          currentUser={user}
          onCountChange={onCommentCount}
        />
      </View>
    </GestureHandlerRootView>
  );
}
