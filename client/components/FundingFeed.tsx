import React, { useEffect, useState, useRef, memo } from "react";
import { readCache, writeCache } from "../utils/screenCache";
import {View, Text, FlatList, Image, Pressable, TextInput, Modal, Dimensions, ScrollView, ActivityIndicator, KeyboardAvoidingView, TouchableOpacity, Linking, RefreshControl, StatusBar} from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from '@expo/vector-icons/Ionicons';
import { Video, ResizeMode, AVPlaybackStatus, AVPlaybackStatusSuccess, Audio, InterruptionModeIOS, InterruptionModeAndroid } from "expo-av";
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
import { useTabBarClearance } from '../constants/layout';
import { Alert } from './ui/AlertModal';

import { RoleSticker } from './ui/kit';
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
    <View className="bg-ink relative overflow-hidden w-full h-[300px]">
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
              <Text className="text-white font-display text-xs">2x Speed</Text>
            </View>
          )}
          {seekFeedback && (
            <View className={`absolute top-1/2 -translate-y-12 ${seekFeedback === 'forward' ? 'right-12' : 'left-12'} bg-black/60 w-20 h-20 rounded-full items-center justify-center border border-white/20`}>
              <Ionicons name={seekFeedback === 'forward' ? "play-forward" : "play-back"} size={32} color="white" />
              <Text className="text-white font-display text-label mt-1 uppercase">10s</Text>
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
              <Text className="text-white text-label font-semibold">
                {status ? `${Math.floor(status.positionMillis / 60000)}:${String(Math.floor((status.positionMillis % 60000) / 1000)).padStart(2, '0')}` : '0:00'}
                <Text className="text-white/60"> / {status ? `${Math.floor(status.durationMillis! / 60000)}:${String(Math.floor((status.durationMillis! % 60000) / 1000)).padStart(2, '0')}` : '0:00'}</Text>
              </Text>
            </View>
            <Pressable onPress={handleSeek} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} className="w-full h-3 justify-center">
              <View className="w-full h-1 bg-card/20 rounded-full overflow-hidden">
                <View className="h-full bg-brand-600 rounded-full" style={{ width: status ? `${(status.positionMillis / (status.durationMillis || 1)) * 100}%` : '0%' }} />
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
  navigation,
  stamped,
}: {
  item: Project;
  userId: string | undefined;
  toggleLike: (p: Project) => void;
  openComments: (id: string) => void;
  openEditModal: (p: Project) => void;
  handleDeleteProject: (id: string) => void;
  navigation: any;
  /** The lead pitch carries the screen's one stamp. */
  stamped?: boolean;
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
    <View
      className={`mx-gutter mb-10 rounded-card bg-card overflow-hidden ${stamped ? 'border-2 border-ink' : 'border border-line'}`}
      style={stamped ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
    >
      {/* User Info Header */}
      <View className="flex-row items-center justify-between px-6 py-5">
        <TouchableOpacity
          onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
          className="flex-row items-center"
        >
          <Image source={{ uri: item.user.avatar || 'https://ui-avatars.com/api/?name=User' }} className="h-10 w-10 rounded-full mr-2 border border-line bg-paper-2" />
          <View>
            <Text className="font-display text-ink text-sm uppercase">{item.user.username || item.user.name}</Text>
            <Text className="text-label text-ink-3 font-display uppercase">{item.user.college || "PROJECT LEAD"}</Text>
          </View>
        </TouchableOpacity>

        {isOwner && (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => openEditModal(item)} className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center border border-line">
              <Ionicons name="pencil" size={16} color="#12100E" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteProject(item._id)} className="w-10 h-10 bg-danger/10 rounded-card items-center justify-center border border-danger/15">
              <Ionicons name="trash" size={16} color="#DC2626" />
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
                    className="bg-ink"
                  />
                );
              }
            }}
          />
          {mediaData.length > 1 && (
            <View pointerEvents="none" className="absolute top-6 right-6 bg-card/90 px-3 py-1.5 rounded-card border border-line shadow-hair z-10">
              <Text className="text-ink text-label font-display uppercase">
                {currentImageIndex + 1} / {mediaData.length}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Project Details */}
      <View className="px-6 py-6">
        <Text className="font-display text-ink text-2xl uppercase mb-3 leading-tight">{item.title}</Text>

        <Text className="text-ink-2 text-sm leading-6 mb-6 font-medium">
          {displayDescription}
          {isLong && (
            <Text onPress={() => setIsExpanded(!isExpanded)} className="text-accent-text font-display uppercase text-label">
              {isExpanded ? "  Show Less" : "  Read More"}
            </Text>
          )}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-6">
            <Pressable onPress={() => toggleLike(item)} className="flex-row items-center">
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={30} color={isLiked ? "#F97316" : "#12100E"} />
              <Text className="ml-2 text-ink font-display text-sm uppercase">{item.likes}</Text>
            </Pressable>

            <Pressable onPress={() => openComments(item._id)} className="flex-row items-center">
              <Ionicons name="chatbubble-outline" size={26} color="#12100E" />
            </Pressable>

            {!isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
                className="flex-row items-center bg-ink px-5 py-3 rounded-card shadow-hair"
              >
                <Ionicons name="chatbubbles-outline" size={16} color="#fff" />
                <Text className="text-white text-label font-display uppercase ml-2">Connect</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-3">
            {item.github_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.github_url as string)}
                className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center border border-line"
              >
                <Ionicons name="logo-github" size={20} color="#12100E" />
              </TouchableOpacity>
            )}
            {item.deployed_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.deployed_url as string)}
                className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center border border-line"
              >
                <Ionicons name="globe-outline" size={20} color="#F97316" />
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
  const tabBarClearance = useTabBarClearance();
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
          // Guard against a duplicate id crashing the list if a project is
          // created between two page requests and shifts the offset.
          setProjects(prev => {
            const seen = new Set(prev.map(p => p._id));
            return [...prev, ...newProjects.filter((p: Project) => !seen.has(p._id))];
          });
        } else {
          setProjects(newProjects);
          writeCache('funding_feed', newProjects);
        }

        // The server reports hasMore directly now. It used to send a page count
        // derived from a full countDocuments, and returned 404 for any page past
        // the last one -- so reaching the end of the feed looked like a failure.
        setHasMore(Boolean(res.data.hasMore));
        setPage(pageNum);
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
    let cancelled = false;
    readCache<Project[]>('funding_feed').then(cached => {
      if (cancelled || !cached?.length) return;
      setProjects(prev => (prev.length ? prev : cached));
      setLoading(false);
    });
    fetchProjects(1, false);
    return () => { cancelled = true; };
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
        <Image source={{ uri: comment.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className={`${isReply ? 'w-8 h-8' : 'w-12 h-12'} rounded-card bg-paper-2 border border-line`} />
        <View className="ml-4 flex-1 bg-paper p-5 rounded-card rounded-tl-none border border-line">
          <View className="flex-row items-baseline mb-2">
            <Text className="font-display text-label text-ink mr-3 uppercase">{comment.commentor?.username || comment.commentor?.name}</Text>
            <Text className="text-label text-ink-3 font-display uppercase">{new Date(comment.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text className="text-ink-2 text-xs leading-5 font-medium">
            {comment.replyToUser && <Text className="text-accent-text font-display">@{comment.replyToUser.username} </Text>}
            {comment.text}
          </Text>
          {!isReply && (
            <TouchableOpacity
              onPress={() => {
                setReplyingTo(comment);
                setCommentText(`@${comment.commentor.username} `);
                commentInputRef.current?.focus();
              }}
              className="mt-4 bg-card self-start px-4 py-1.5 rounded-card border border-line"
            >
              <Text className="text-ink text-label font-display uppercase">Reply</Text>
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
      <View className="flex-1 bg-paper">
        <StatusBar barStyle="dark-content" />
        
        {/* Background Protocol Gradient */}

        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Arena Header */}
          <View className="px-gutter pt-6 pb-4 flex-row justify-between items-center bg-transparent">
            <View className="flex-row items-center">
              <View>
                <Text className="text-ink text-3xl font-display uppercase leading-tight">Funding <Text className="text-accent-text">Feed</Text></Text>
                <Text className="text-ink-3 text-label font-display uppercase">Innovation Hub</Text>
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
              renderItem={({ item, index }) => (
                <ProjectCard
                  item={item}
                  stamped={index === 0}
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
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={() => (
                loadingMore ? (
                  <View className="py-10 items-center">
                    <ActivityIndicator size="small" color="#F97316" />
                  </View>
                ) : <View className="h-40" />
              )}
              contentContainerStyle={{ paddingTop: 20 }}
              ListEmptyComponent={
                <View className="items-center mt-20 px-gutter">
                  <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                    <Ionicons name="rocket-outline" size={48} color="#C4BEB6" />
                  </View>
                  <Text className="font-semibold text-base text-ink text-center">Archive Empty</Text>
                  <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Deploy your innovation to the innovation registry and establish your presence.</Text>
                </View>
              }
            />
          )}

          <Modal visible={commentModal} transparent={true} animationType="slide" onRequestClose={() => setCommentModal(false)}>
            <View className="flex-1 bg-black/50 justify-end">
              <Pressable className="flex-1" onPress={() => { setCommentModal(false); setReplyingTo(null); }} />
              <View className="bg-paper h-[80%] rounded-t-sheet border-t border-line overflow-hidden shadow-hair">
                <View className="flex-row justify-between items-center px-gutter py-8 border-b border-line bg-card">
                  <View>
                    <Text className="text-ink font-display uppercase text-h1">Signal <Text className="text-accent-text">Intel</Text></Text>
                    <Text className="text-ink-3 text-label font-display uppercase mt-1">Community Discussion</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setCommentModal(false); setReplyingTo(null); }} className="w-12 h-12 bg-paper-2 rounded-card items-center justify-center border border-line">
                    <Ionicons name="close" size={24} color="#12100E" />
                  </TouchableOpacity>
                </View>

                {commentsLoading ? <ActivityIndicator className="mt-10" color="#F97316" /> : (
                  <FlatList
                    data={comments}
                    keyExtractor={c => c._id}
                    contentContainerStyle={{ paddingTop: 32, paddingBottom: tabBarClearance }}
                    renderItem={({ item }) => <CommentItem comment={item} />}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                      <View className="items-center mt-20 px-gutter">
                        <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                          <Ionicons name="chatbubbles-outline" size={32} color="#C4BEB6" />
                        </View>
                        <Text className="font-semibold text-base text-ink text-center">No Signals Detected</Text>
                        <Text className="font-sans text-sm text-ink-4 mt-2 text-center">Transmit your thoughts to the innovation network.</Text>
                      </View>
                    }
                  />
                )}

                <KeyboardAvoidingView behavior="padding">
                  <View className="p-card-pad border-t border-line bg-card pb-12">
                    {replyingTo && (
                      <View className="flex-row items-center justify-between bg-paper-2 px-5 py-3 mb-4 rounded-card border border-line">
                        <Text className="text-accent-text font-display uppercase text-label">Replying to @{replyingTo.commentor.username}</Text>
                        <TouchableOpacity onPress={() => setReplyingTo(null)}>
                          <Ionicons name="close-circle" size={18} color="#F97316" />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View className="flex-row items-center">
                      <TextInput
                        ref={commentInputRef}
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder={replyingTo ? "Transmit reply..." : "Transmit intelligence..."}
                        placeholderTextColor="#8B857E"
                        className="font-semibold text-base text-ink flex-1 bg-paper px-6 py-5 mr-4 border-[1.5px] border-ink rounded-md"
                        multiline
                      />
                      <TouchableOpacity onPress={postComment} className="w-14 h-14 bg-ink items-center justify-center border-2 border-ink rounded-md">
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
