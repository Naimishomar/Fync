import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, FlatList, Image, Pressable, TextInput, Modal,
  Dimensions, Alert, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableOpacity, Linking, RefreshControl, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess, Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";
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
import { useWindowDimensions } from 'react-native';

import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { RAZORPAY_KEY_ID } from "../constants/keys";

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
      } catch (e) {}
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
                  <View className="h-full bg-red-600 rounded-full" style={{ width: status ? `${(status.positionMillis / (status.durationMillis || 1)) * 100}%` : '0%' }} />
                </View>
              </Pressable>
            </View>
          </View>
        )}
    </View>

  );
};

/* ---------- PROJECT CARD SUB-COMPONENT ---------- */
const ProjectCard = ({
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
    <View className="mx-4 mb-6 rounded-3xl bg-white border border-gray-100 shadow-sm shadow-black/5 overflow-hidden">
      {/* User Info Header */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <TouchableOpacity 
          onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
          className="flex-row items-center"
        >
          <Image source={{ uri: item.user.avatar || 'https://ui-avatars.com/api/?name=User' }} className="h-10 w-10 rounded-full mr-3 border border-gray-100 bg-gray-50" />
          <View>
            <Text className="font-bold text-zinc-900 text-[14px]">{item.user.username || item.user.name}</Text>
            <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.user.college || "PROJECT LEAD"}</Text>
          </View>
        </TouchableOpacity>

        {isOwner && (
          <View className="flex-row gap-4">
            <TouchableOpacity onPress={() => openEditModal(item)} className="p-2 bg-gray-50 rounded-full">
              <Ionicons name="pencil" size={16} color="#4b5563" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteProject(item._id)} className="p-2 bg-red-50 rounded-full">
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
                  <View style={{ width: CARD_WIDTH, height: 300 }}>
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
                    style={{ width: CARD_WIDTH, height: 300 }}
                    resizeMode="cover"
                    className="bg-gray-50 bg-black"
                  />
                );
              }
            }}
          />
          {mediaData.length > 1 && (
            <View pointerEvents="none" className="absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full border border-gray-100 shadow-sm z-10">
              <Text className="text-zinc-900 text-[10px] font-black tracking-tighter">
                {currentImageIndex + 1} / {mediaData.length}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Project Details */}
      <View className="px-5 py-4">
        <Text className="font-black text-zinc-900 text-xl italic tracking-tighter mb-2">{item.title}</Text>

        <Text className="text-zinc-600 text-[13px] leading-5 mb-4">
          {displayDescription}
          {isLong && (
            <Text onPress={() => setIsExpanded(!isExpanded)} className="text-pink-500 font-black italic tracking-tighter">
              {isExpanded ? " Show Less" : " Read More"}
            </Text>
          )}
        </Text>

        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => toggleLike(item)} className="flex-row items-center">
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "#ec4899" : "#1A1A1A"} />
              <Text className="ml-1.5 text-zinc-900 font-black text-sm italic">{item.likes}</Text>
            </Pressable>

            <Pressable onPress={() => openComments(item._id)} className="flex-row items-center">
              <Ionicons name="chatbubble-outline" size={26} color="#1A1A1A" />
            </Pressable>

            {!isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
                className="flex-row items-center bg-zinc-900 px-4 py-2 rounded-full shadow-sm shadow-zinc-900/20"
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
                <Text className="text-white text-[10px] font-black italic tracking-tighter ml-2 uppercase">Connect</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-4">
            {item.github_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.github_url as string)}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="logo-github" size={20} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            {item.deployed_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.deployed_url as string)}
                className="bg-pink-50 p-2 rounded-full border border-pink-100"
              >
                <Ionicons name="globe-outline" size={20} color="#ec4899" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};


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
    <View className={`${isReply ? 'ml-12 mt-2' : 'mb-6 px-2'}`}>
      <View className="flex-row">
        <Image source={{ uri: comment.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className={`${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-gray-50 border border-gray-100`} />
        <View className="ml-3 flex-1 bg-gray-50 p-4 rounded-3xl rounded-tl-none border border-gray-100">
          <View className="flex-row items-baseline mb-1">
            <Text className="font-bold text-xs text-zinc-900 mr-2">{comment.commentor?.username || comment.commentor?.name}</Text>
            <Text className="text-[10px] text-gray-400 font-medium">{new Date(comment.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text className="text-zinc-700 text-sm leading-5">
            {comment.replyToUser && <Text className="text-pink-500 font-bold">@{comment.replyToUser.username} </Text>}
            {comment.text}
          </Text>
          {!isReply && (
            <TouchableOpacity 
              onPress={() => {
                setReplyingTo(comment);
                setCommentText(`@${comment.commentor.username} `);
                commentInputRef.current?.focus();
              }}
              className="mt-3"
            >
              <Text className="text-pink-500 text-[10px] font-black uppercase tracking-widest italic">Reply</Text>
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
      <View className="flex-1 bg-white">
        <StatusBar barStyle="light-content" />
        <SafeAreaView className="flex-1">
        <View className="px-6 pb-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-gray-50 rounded-full mr-3 border border-gray-100">
              <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter">PROJECT <Text className="text-pink-500">FEED</Text> 🚀</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#ec4899" className="mt-20" />
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
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#ec4899" />
                </View>
              ) : <View className="h-20" />
            )}
            contentContainerStyle={{ paddingTop: 16 }}
            ListEmptyComponent={
              <View className="items-center mt-20 px-10">
                <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-6 shadow-sm border border-gray-100">
                  <Ionicons name="rocket-outline" size={40} color="#cbd5e1" />
                </View>
                <Text className="text-zinc-900 text-xl font-black italic tracking-tight">No projects yet</Text>
                <Text className="text-gray-500 text-sm mt-2 text-center font-medium">Be the first to showcase your innovation and connect with the community!</Text>
              </View>
            }
          />
        )}

        <Modal visible={commentModal} transparent={true} animationType="slide" onRequestClose={() => setCommentModal(false)}>
            <View className="flex-1 bg-black/40 justify-end">
              <Pressable className="flex-1" onPress={() => { setCommentModal(false); setReplyingTo(null); }} />
              <View className="bg-white h-[75%] rounded-t-3xl border-t border-gray-100 overflow-hidden shadow-2xl">
                <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100 bg-white">
                  <View>
                    <Text className="font-black text-xl text-zinc-900 italic tracking-tighter">Project <Text className="text-pink-500">Discussion</Text></Text>
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Community Insights</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setCommentModal(false); setReplyingTo(null); }} className="p-2 bg-gray-50 rounded-full">
                    <Ionicons name="close" size={22} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>

                {commentsLoading ? <ActivityIndicator className="mt-10" color="#ec4899" /> : (
                  <FlatList 
                    data={comments} 
                    keyExtractor={c => c._id} 
                    contentContainerStyle={{ paddingVertical: 20, paddingBottom: 100 }}
                    renderItem={({ item }) => <CommentItem comment={item} />}
                    ListEmptyComponent={
                      <View className="items-center mt-20 px-10">
                        <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4 border border-gray-100">
                          <Ionicons name="chatbubbles-outline" size={32} color="#cbd5e1" />
                        </View>
                        <Text className="text-center text-zinc-900 text-lg font-black italic tracking-tighter">Join the conversation</Text>
                        <Text className="text-center text-gray-500 text-xs mt-1 font-medium">Ask questions, offer feedback, or just share your support!</Text>
                      </View>
                    }
                  />
                )}

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                  <View className="p-5 border-t border-gray-100 bg-white pb-10">
                    {replyingTo && (
                      <View className="flex-row items-center justify-between bg-gray-50 px-4 py-2 mb-3 rounded-xl border border-gray-100">
                        <Text className="text-gray-500 text-xs font-medium">Replying to <Text className="font-black text-zinc-900">@{replyingTo.commentor.username}</Text></Text>
                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                          <Ionicons name="close-circle" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View className="flex-row items-center">
                      <TextInput 
                        ref={commentInputRef}
                        value={commentText} 
                        onChangeText={setCommentText} 
                        placeholder={replyingTo ? "Write your reply..." : "Share your thoughts..."} 
                        placeholderTextColor="#9ca3af" 
                        className="flex-1 bg-gray-50 text-zinc-900 rounded-2xl px-5 py-4 mr-3 border border-gray-100 font-medium" 
                        multiline
                      />
                      <TouchableOpacity onPress={postComment} className="bg-pink-500 p-4 rounded-2xl shadow-sm shadow-pink-500/20">
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

