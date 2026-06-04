import React, { useEffect, useState, useRef, memo } from "react";
import {
  View, Text, FlatList, Image, Pressable, TextInput, Modal,
  Dimensions, Alert, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableOpacity, Linking, RefreshControl, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess, Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import {
  GestureHandlerRootView,
  GestureDetector,
  Gesture
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS
} from 'react-native-reanimated';
import { useWindowDimensions } from 'react-native';

import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { ProjectSkeleton } from "./Skeleton";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32;

interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  college?: string;
}

interface Project {
  _id: string;
  title: string;
  description: string;
  image?: string[];
  video?: string;
  deployed_url?: string;
  github_url?: string;
  likes: number;
  liked_by: string[];
  user: User;
}

/* ---------- YOUTUBE PLAYER COMPONENT ---------- */
const YouTubeVideoPlayer = ({
  source,
  thumbnail,
}: {
  source: string,
  thumbnail?: string,
}) => {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatusSuccess | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [barWidth, setBarWidth] = useState(300);

  const { width: windowWidth } = useWindowDimensions();

  // Pinch to Zoom
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
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
          shouldDuckAndroid: true,
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          playThroughEarpieceAndroid: false
        });
      } catch (e) { }
    };
    setupAudio();
  }, []);

  const skipForward = async () => {
    if (!videoRef.current) return;
    const currentStatus = await videoRef.current.getStatusAsync() as AVPlaybackStatusSuccess;
    if (currentStatus && currentStatus.isLoaded) {
      const newPos = Math.min(currentStatus.durationMillis || 0, currentStatus.positionMillis + 10000);
      await videoRef.current.setPositionAsync(newPos);
    }
  };

  const skipBackward = async () => {
    if (!videoRef.current) return;
    const currentStatus = await videoRef.current.getStatusAsync() as AVPlaybackStatusSuccess;
    if (currentStatus && currentStatus.isLoaded) {
      const newPos = Math.max(0, currentStatus.positionMillis - 10000);
      await videoRef.current.setPositionAsync(newPos);
    }
  };

  const [seekFeedback, setSeekFeedback] = useState<'forward' | 'backward' | null>(null);

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_event, success) => {
      if (success) runOnJS(setShowControls)(!showControls);
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
        setTimeout(() => runOnJS(setSeekFeedback)(null), 500);
      }
    });

  const tapGestures = Gesture.Exclusive(doubleTap, singleTap);
  const videoGesture = Gesture.Simultaneous(pinchGesture, longPressGesture, tapGestures);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPlaybackStatusUpdate = (newStatus: AVPlaybackStatus) => {
    if (newStatus.isLoaded) setStatus(newStatus);
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (!status) {
      await videoRef.current.playAsync();
      return;
    }
    status.isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync();
  };

  const handleSeek = async (e: any) => {
    if (!videoRef.current || !status?.durationMillis || barWidth <= 0) return;
    const { locationX } = e.nativeEvent;
    const seekPosition = (locationX / barWidth) * status.durationMillis;
    await videoRef.current.setPositionAsync(seekPosition);
  };

  return (
    <View className="bg-black relative overflow-hidden w-full h-[300px]">
      <GestureDetector gesture={videoGesture}>
        <Animated.View style={[{ width: '100%', height: '100%' }, animatedStyle]}>
          <Video
            ref={videoRef}
            source={{ uri: source }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            shouldPlay={false}
            isMuted={false}
            posterSource={{ uri: thumbnail }}
            usePoster={!!thumbnail}
            posterStyle={{ resizeMode: 'cover' }}
          />
          {(!status || (status.isLoaded && status.isBuffering)) && (
            <View className="absolute inset-0 items-center justify-center bg-black/10">
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}
          {playbackRate > 1 && (
            <View className="absolute top-10 self-center bg-black/40 px-3 py-1 rounded-full border border-white/20">
              <Text className="text-white font-black text-xs">2x Speed</Text>
            </View>
          )}
          {seekFeedback && (
            <View className={`absolute top-1/2 -translate-y-12 ${seekFeedback === 'forward' ? 'right-12' : 'left-12'} bg-black/60 w-20 h-20 rounded-full items-center justify-center border border-white/20`}>
              <Ionicons name={seekFeedback === 'forward' ? "play-forward" : "play-back"} size={32} color="white" />
              <Text className="text-white font-black text-[10px] mt-1 uppercase">10s</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {showControls && (
        <View pointerEvents="box-none" className="absolute inset-0 bg-black/40 items-center justify-center">
          <View className="flex-row items-center gap-10">
            <TouchableOpacity onPress={skipBackward} className="p-3 rounded-full bg-black/20">
              <Ionicons name="play-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} className="w-16 h-16 rounded-full bg-black/20 items-center justify-center">
              <Ionicons name={status?.isPlaying ? "pause" : "play"} size={36} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={skipForward} className="p-3 rounded-full bg-black/20">
              <Ionicons name="play-forward" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View pointerEvents="box-none" className="absolute bottom-0 inset-x-0 p-4">
            <View pointerEvents="box-none" className="flex-row justify-between mb-2">
              <Text className="text-white text-[10px] font-bold">
                {status ? `${Math.floor(status.positionMillis / 60000)}:${String(Math.floor((status.positionMillis % 60000) / 1000)).padStart(2, '0')}` : '0:00'}
                <Text className="text-white/60"> / {status ? `${Math.floor(status.durationMillis! / 60000)}:${String(Math.floor((status.durationMillis! % 60000) / 1000)).padStart(2, '0')}` : '0:00'}</Text>
              </Text>
            </View>
            <Pressable onPress={handleSeek} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} className="w-full h-3 justify-center">
              <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                <View className="h-full bg-orange-600 rounded-full" style={{ width: status ? `${(status.positionMillis / (status.durationMillis || 1)) * 100}%` : '0%' }} />
              </View>
            </Pressable>
          </View>
        </View>
      )}
    </View>

  );
};

/* ---------- PROJECT CARD SUB-COMPONENT ---------- */
const ProjectCard = memo(({
  item,
  userId,
  toggleLike,
  openComments,
  openEditModal,
  handleDeleteProject,
  navigation
}: {
  item: Project;
  userId: string | undefined;
  toggleLike: (p: Project) => void;
  openComments: (id: string) => void;
  openEditModal: (p: Project) => void;
  handleDeleteProject: (id: string) => void;
  navigation: any;
}) => {
  const isLiked = item.liked_by.includes(userId || "");
  const isOwner = item.user._id === userId || (item.user as any).id === userId;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / CARD_WIDTH);
    setCurrentImageIndex(index);
  };

  const mediaData: { type: 'video' | 'image'; uri: string }[] = [];
  if (item.video) {
    mediaData.push({ type: 'video', uri: item.video });
  }
  if (item.image && item.image.length > 0) {
    item.image.forEach(img => mediaData.push({ type: 'image', uri: img }));
  }

  const [isExpanded, setIsExpanded] = useState(false);
  const words = item.description ? item.description.split(" ") : [];
  const isLong = words.length > 25;

  const displayDescription = isExpanded || !isLong
    ? item.description
    : words.slice(0, 25).join(" ") + "...";

  return (
    <View className="mx-6 mb-10 rounded-2xl bg-white border border-slate-100 shadow-sm shadow-black/5 overflow-hidden">
      {/* User Info Header */}
      <View className="flex-row items-center justify-between px-6 py-5">
        <TouchableOpacity
          onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
          className="flex-row items-center"
        >
          <Image source={{ uri: item.user.avatar || 'https://ui-avatars.com/api/?name=User' }} className="h-10 w-10 rounded-full mr-2 border border-slate-100 bg-slate-50" />
          <View>
            <Text className="font-black text-zinc-900 text-sm uppercase tracking-tighter">{item.user.username || item.user.name}</Text>
            <Text className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{item.user.college || "PROJECT LEAD"}</Text>
          </View>
        </TouchableOpacity>

        {isOwner && (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => openEditModal(item)} className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
              <Ionicons name="pencil" size={16} color="#18181b" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteProject(item._id)} className="w-10 h-10 bg-red-50 rounded-2xl items-center justify-center border border-red-100">
              <Ionicons name="trash" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Media Slider */}
      {mediaData.length > 0 ? (
        <View>
          <FlatList
            horizontal
            data={mediaData}
            keyExtractor={(_, index) => index.toString()}
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item: media }) => {
              if (media.type === 'video') {
                return (
                  <View style={{ width: CARD_WIDTH, height: 320 }}>
                    <YouTubeVideoPlayer
                      source={media.uri.replace(/^http:\/\//i, 'https://')}
                      thumbnail={item.image && item.image.length > 0 ? item.image[0] : undefined}
                    />
                  </View>
                );
              } else {
                const secureUrl = media.uri ? media.uri.replace(/^http:\/\//i, 'https://') : '';
                return (
                  <Image
                    source={{ uri: secureUrl }}
                    style={{ width: CARD_WIDTH, height: 320 }}
                    resizeMode="cover"
                    className="bg-black"
                  />
                );
              }
            }}
          />
          {mediaData.length > 1 && (
            <View pointerEvents="none" className="absolute top-6 right-6 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm z-10">
              <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-tight">
                {currentImageIndex + 1} / {mediaData.length}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Project Details */}
      <View className="px-6 py-6">
        <Text className="font-black text-zinc-900 text-2xl uppercase tracking-tighter mb-3 leading-tight">{item.title}</Text>

        <Text className="text-slate-600 text-sm leading-6 mb-6 font-medium">
          {displayDescription}
          {isLong && (
            <Text onPress={() => setIsExpanded(!isExpanded)} className="text-orange-600 font-black uppercase tracking-widest text-[10px]">
              {isExpanded ? "  Show Less" : "  Read More"}
            </Text>
          )}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-6">
            <Pressable onPress={() => toggleLike(item)} className="flex-row items-center">
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={30} color={isLiked ? "#f97316" : "#1A1A1A"} />
              <Text className="ml-2 text-zinc-900 font-black text-sm uppercase">{item.likes}</Text>
            </Pressable>

            <Pressable onPress={() => openComments(item._id)} className="flex-row items-center">
              <Ionicons name="chatbubble-outline" size={26} color="#1A1A1A" />
            </Pressable>

            {!isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
                className="flex-row items-center bg-zinc-900 px-5 py-3 rounded-2xl shadow-lg shadow-black/20"
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
                <Text className="text-white text-[10px] font-black uppercase tracking-widest ml-2">Connect</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-3">
            {item.github_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.github_url as string)}
                className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100"
              >
                <Ionicons name="logo-github" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            {item.deployed_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.deployed_url as string)}
                className="w-10 h-10 bg-orange-50 rounded-2xl items-center justify-center border border-orange-100"
              >
                <Ionicons name="globe-outline" size={20} color="#f97316" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
});


/* ---------- MAIN COMPONENT ---------- */
export default function FundingFeed() {
  const { user } = useAuth();
  const userId = user?.id || user?._id;
  const navigation = useNavigation<any>();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);


  const fetchProjects = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if (pageNum > 1) setLoadingMore(true);
    else if (!refreshing) setLoading(true);

    try {
      const res = await axios.get(`/funding/get/all?page=${pageNum}&limit=10`);
      if (res.data.success) {
        const newProjects = res.data.projects || [];
        if (shouldAppend) {
          setProjects(prev => [...prev, ...newProjects]);
        } else {
          setProjects(newProjects);
        }

        const pagination = res.data.pagination;
        if (pagination) {
          setHasMore(pagination.page < pagination.pages);
          setPage(pagination.page);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("Error fetching projects", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchProjects(1, false);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchProjects(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchProjects(page + 1, true);
    }
  };


  const openEditModal = (project: Project) => {
    navigation.navigate("CreateFundingFeed", { project });
  };

  const handleDeleteProject = (id: string) => {
    Alert.alert("Delete Project", "Are you sure? This will remove all files permanently.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.post(`/funding/delete/${id}`);
            setProjects(prev => prev.filter(p => p._id !== id));
            Alert.alert("Deleted", "Project removed.");
          } catch (e) {
            Alert.alert("Error", "Failed to delete project");
          }
        }
      }
    ]);
  };

  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const commentInputRef = useRef<TextInput>(null);

  const toggleLike = async (project: Project) => {
    const liked = project.liked_by.includes(userId!);
    setProjects((prev) =>
      prev.map((p) => p._id === project._id ? { ...p, likes: liked ? p.likes - 1 : p.likes + 1, liked_by: liked ? p.liked_by.filter((id) => id !== userId) : [...p.liked_by, userId!] } : p)
    );
    try { await axios.post(`/funding/like/${project._id}`); } catch (error) { }
  };

  const openComments = async (id: string) => {
    setActiveProjectId(id);
    setCommentModal(true);
    setCommentsLoading(true);
    try {
      const res = await axios.get(`/funding/comment/all/${id}`);
      if (res.data.success) setComments(res.data.comments);
    } catch (error) { } finally {
      setCommentsLoading(false);
    }
  };

  const postComment = async () => {
    if (!commentText || !activeProjectId) return;
    try {
      await axios.post(`/funding/comment/add/${activeProjectId}`, {
        text: commentText,
        parentCommentId: replyingTo?._id
      });
      setCommentText("");
      setReplyingTo(null);
      openComments(activeProjectId);
    } catch (error) { }
  };

  const CommentItem = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => (
    <View className={`${isReply ? 'ml-12 mt-4' : 'mb-8 px-2'}`}>
      <View className="flex-row">
        <Image source={{ uri: comment.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className={`${isReply ? 'w-8 h-8' : 'w-12 h-12'} rounded-2xl bg-slate-50 border border-slate-100`} />
        <View className="ml-4 flex-1 bg-slate-50 p-5 rounded-[28px] rounded-tl-none border border-slate-100">
          <View className="flex-row items-baseline mb-2">
            <Text className="font-black text-[10px] text-zinc-900 mr-3 uppercase tracking-tight">{comment.commentor?.username || comment.commentor?.name}</Text>
            <Text className="text-[8px] text-slate-400 font-black uppercase tracking-widest">{new Date(comment.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text className="text-slate-600 text-xs leading-5 font-medium">
            {comment.replyToUser && <Text className="text-orange-500 font-black">@{comment.replyToUser.username} </Text>}
            {comment.text}
          </Text>
          {!isReply && (
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(comment);
                setCommentText(`@${comment.commentor.username} `);
                commentInputRef.current?.focus();
              }}
              className="mt-4 bg-white self-start px-4 py-1.5 rounded-xl border border-slate-100"
            >
              <Text className="text-zinc-900 text-[8px] font-black uppercase tracking-widest">Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {comment.replies && comment.replies.map((reply: any) => (
        <CommentItem key={reply._id} comment={reply} isReply={true} />
      ))}
    </View>
  );

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-[#FDFDFF]">
        <StatusBar barStyle="dark-content" />
        
        {/* Background Protocol Gradient */}
        <View className="absolute top-0 w-full h-80 opacity-20">
          <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
        </View>

        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Arena Header */}
          <View className="px-8 pt-6 pb-4 flex-row justify-between items-center bg-transparent">
            <View className="flex-row items-center">
              <View>
                <Text className="text-zinc-900 text-3xl font-black uppercase tracking-tighter leading-tight">Funding <Text className="text-orange-500">Feed</Text></Text>
                <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Innovation Hub</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View className="mt-4">
              {[1, 2].map(i => <ProjectSkeleton key={i} />)}
            </View>
          ) : (
            <FlatList
              data={projects}
              renderItem={({ item }) => (
                <ProjectCard
                  item={item}
                  userId={userId}
                  toggleLike={toggleLike}
                  openComments={openComments}
                  openEditModal={openEditModal}
                  handleDeleteProject={handleDeleteProject}
                  navigation={navigation}
                />
              )}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={() => (
                loadingMore ? (
                  <View className="py-10 items-center">
                    <ActivityIndicator size="small" color="#f97316" />
                  </View>
                ) : <View className="h-40" />
              )}
              contentContainerStyle={{ paddingTop: 20 }}
              ListEmptyComponent={
                <View className="items-center mt-20 px-10">
                  <View className="w-24 h-24 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100 shadow-sm">
                    <Ionicons name="rocket-outline" size={48} color="#cbd5e1" />
                  </View>
                  <Text className="text-zinc-400 font-black uppercase text-xs tracking-widest text-center">Archive Empty</Text>
                  <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center leading-5">Deploy your innovation to the innovation registry and establish your presence.</Text>
                </View>
              }
            />
          )}

          <Modal visible={commentModal} transparent={true} animationType="slide" onRequestClose={() => setCommentModal(false)}>
            <View className="flex-1 bg-black/50 justify-end">
              <Pressable className="flex-1" onPress={() => { setCommentModal(false); setReplyingTo(null); }} />
              <View className="bg-white h-[80%] rounded-t-[50px] border-t border-slate-100 overflow-hidden shadow-2xl">
                <View className="flex-row justify-between items-center px-10 py-8 border-b border-slate-50 bg-white">
                  <View>
                    <Text className="text-zinc-900 text-2xl font-black uppercase tracking-tighter leading-tight">Signal <Text className="text-orange-500">Intel</Text></Text>
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mt-1">Community Discussion</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setCommentModal(false); setReplyingTo(null); }} className="w-12 h-12 bg-slate-50 rounded-2xl items-center justify-center border border-slate-100">
                    <Ionicons name="close" size={24} color="#18181b" />
                  </TouchableOpacity>
                </View>

                {commentsLoading ? <ActivityIndicator className="mt-10" color="#f97316" /> : (
                  <FlatList
                    data={comments}
                    keyExtractor={c => c._id}
                    contentContainerStyle={{ paddingVertical: 32, paddingBottom: 150 }}
                    renderItem={({ item }) => <CommentItem comment={item} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                      <View className="items-center mt-20 px-10">
                        <View className="w-20 h-20 bg-slate-50 rounded-[32px] items-center justify-center mb-6 border border-slate-100">
                          <Ionicons name="chatbubbles-outline" size={32} color="#cbd5e1" />
                        </View>
                        <Text className="text-zinc-400 font-black uppercase text-xs tracking-widest text-center">No Signals Detected</Text>
                        <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">Transmit your thoughts to the innovation network.</Text>
                      </View>
                    }
                  />
                )}

                <KeyboardAvoidingView behavior="padding">
                  <View className="p-8 border-t border-slate-50 bg-white pb-12">
                    {replyingTo && (
                      <View className="flex-row items-center justify-between bg-orange-50 px-5 py-3 mb-4 rounded-2xl border border-orange-100">
                        <Text className="text-orange-600 font-black uppercase text-[8px] tracking-widest">Replying to @{replyingTo.commentor.username}</Text>
                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                          <Ionicons name="close-circle" size={18} color="#f97316" />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View className="flex-row items-center">
                      <TextInput
                        ref={commentInputRef}
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder={replyingTo ? "Transmit reply..." : "Transmit intelligence..."}
                        placeholderTextColor="#94a3b8"
                        className="flex-1 bg-slate-50 text-zinc-900 rounded-[24px] px-6 py-5 mr-4 border border-slate-100 font-black uppercase text-xs"
                        multiline
                      />
                      <TouchableOpacity onPress={postComment} className="w-14 h-14 bg-zinc-900 rounded-2xl items-center justify-center shadow-lg shadow-black/20">
                        <Ionicons name="send" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}
