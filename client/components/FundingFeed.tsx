import React, { useEffect, useState, useRef, memo, useCallback } from "react";
import { readCache, writeCache } from "../utils/screenCache";
import {View, Text, FlatList, Pressable, Dimensions, ScrollView, ActivityIndicator, TouchableOpacity, Linking, StatusBar} from 'react-native'
import { Image } from 'expo-image';
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
import Avatar from "./Avatar";
import { Alert } from './ui/AlertModal';

import { AppBar, Button, Empty, IconBtn } from './ui/kit';
import CommentsSheet, { CommentsApi } from './ui/CommentsSheet';
import { C } from '../constants/colors';
import FyncRefreshControl from './ui/FyncRefreshControl';
// Threads come back nested already; only the reply field is spelled differently.
const FUNDING_COMMENTS: CommentsApi = {
  list: (id) => `/funding/comment/all/${id}`,
  add: (id) => `/funding/comment/add/${id}`,
  body: (text, parentId) => ({ text, parentCommentId: parentId ?? undefined }),
  replies: true,
  remove: (id) => ({ method: 'post', url: `/funding/comment/delete/${id}` }),
};

const { width } = Dimensions.get("window");
// Fallback until the slider measures itself: the card sits on the 20px gutter.
const CARD_WIDTH = width - 40;

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
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (seekTimer.current) clearTimeout(seekTimer.current); }, []);

  // Runs on the JS thread; the tap callback below is a worklet and cannot own a timer.
  const seekWithFeedback = (dir: 'forward' | 'backward') => {
    setSeekFeedback(dir);
    if (dir === 'forward') skipForward(); else skipBackward();
    if (seekTimer.current) clearTimeout(seekTimer.current);
    seekTimer.current = setTimeout(() => setSeekFeedback(null), 500);
  };

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((_event, success) => {
      if (success) runOnJS(setShowControls)(!showControls);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (success) {
        runOnJS(seekWithFeedback)(event.x < windowWidth / 2 ? 'backward' : 'forward');
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
    <View className="bg-night relative overflow-hidden w-full h-[300px]">
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
              <ActivityIndicator size="large" color={C.white} />
            </View>
          )}
          {playbackRate > 1 && (
            <View className="absolute top-10 self-center bg-black/40 px-3 py-1 rounded-full border border-white/20">
              <Text className="text-white font-semibold text-xs">2x speed</Text>
            </View>
          )}
          {seekFeedback && (
            <View className={`absolute top-1/2 -translate-y-12 ${seekFeedback === 'forward' ? 'right-12' : 'left-12'} bg-black/60 w-20 h-20 rounded-full items-center justify-center border border-white/20`}>
              <Ionicons name={seekFeedback === 'forward' ? "play-forward" : "play-back"} size={32} color="white" />
              <Text className="text-white font-semibold text-xs mt-1">10s</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {showControls && (
        <View pointerEvents="box-none" className="absolute inset-0 bg-black/40 items-center justify-center">
          <View className="flex-row items-center gap-10">
            <TouchableOpacity onPress={skipBackward} className="p-3 rounded-full bg-black/20" accessibilityRole="button" accessibilityLabel="Back 10 seconds">
              <Ionicons name="play-back" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlay} className="w-16 h-16 rounded-full bg-black/20 items-center justify-center" accessibilityRole="button" accessibilityLabel={status?.isPlaying ? "Pause" : "Play"}>
              <Ionicons name={status?.isPlaying ? "pause" : "play"} size={36} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={skipForward} className="p-3 rounded-full bg-black/20" accessibilityRole="button" accessibilityLabel="Forward 10 seconds">
              <Ionicons name="play-forward" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View pointerEvents="box-none" className="absolute bottom-0 inset-x-0 p-4">
            <View pointerEvents="box-none" className="flex-row justify-between mb-2">
              <Text className="text-white text-label font-semibold">
                {status ? `${Math.floor(status.positionMillis / 60000)}:${String(Math.floor((status.positionMillis % 60000) / 1000)).padStart(2, '0')}` : '0:00'}
                <Text className="text-white/60"> / {status ? `${Math.floor((status.durationMillis ?? 0) / 60000)}:${String(Math.floor(((status.durationMillis ?? 0) % 60000) / 1000)).padStart(2, '0')}` : '0:00'}</Text>
              </Text>
            </View>
            <Pressable onPress={handleSeek} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)} className="w-full h-3 justify-center">
              <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
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
}: {
  item: Project;
  userId: string | undefined;
  toggleLike: (p: Project) => void;
  openComments: (id: string) => void;
  openEditModal: (p: Project) => void;
  handleDeleteProject: (id: string) => void;
  navigation: any;
}) => {
  // A deleted author comes back as null; the card must still render.
  const author: User = item.user ?? ({} as User);
  const isLiked = (item.liked_by ?? []).includes(userId || "");
  const isOwner = !!userId && (author._id === userId || (author as any).id === userId);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // The slider sits inside the card's border, so measure it instead of
  // deriving it from the window — a few px off and paging drifts.
  const [mediaWidth, setMediaWidth] = useState(CARD_WIDTH);

  // On settle only: updating per scroll frame re-rendered the card all swipe long.
  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    setCurrentImageIndex(Math.round(scrollPosition / mediaWidth));
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
      className="mx-gutter mb-3 rounded-2xl bg-card overflow-hidden border border-line"
    >
      {/* User Info Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity
          onPress={() => author._id && navigation.navigate("PublicProfile", { user: author })}
          className="flex-row items-center flex-1 mr-3"
          style={{ minWidth: 0 }}
          accessibilityRole="button"
        >
          <View className="mr-3">
            <Avatar user={author} size={40} showBadge={false} />
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-ink text-sm" numberOfLines={1}>{author.username || author.name}</Text>
            <Text className="text-xs text-ink-3" numberOfLines={1}>{author.college || "Project lead"}</Text>
          </View>
        </TouchableOpacity>

        {isOwner && (
          <View className="flex-row gap-2" style={{ marginRight: -4 }}>
            <IconBtn boxed size={18} name="pencil-outline" onPress={() => openEditModal(item)} accessibilityLabel="Edit project" />
            <IconBtn boxed size={18} name="trash-outline" color={C.danger} onPress={() => handleDeleteProject(item._id)} accessibilityLabel="Delete project" />
          </View>
        )}
      </View>

      {/* Media Slider */}
      {mediaData.length > 0 ? (
        <View onLayout={(e) => setMediaWidth(e.nativeEvent.layout.width)}>
          <FlatList keyboardShouldPersistTaps="handled"
            horizontal
            data={mediaData}
            keyExtractor={(_, index) => index.toString()}
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            onMomentumScrollEnd={handleScroll}
            renderItem={({ item: media }) => {
              if (media.type === 'video') {
                return (
                  <View style={{ width: mediaWidth, height: 320 }}>
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
                    style={{ width: mediaWidth, height: 320, backgroundColor: C.night }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    recyclingKey={secureUrl}
                  />
                );
              }
            }}
          />
          {mediaData.length > 1 && (
            <View pointerEvents="none" className="absolute top-3 right-3 bg-black/50 px-2 py-1 rounded-full z-10">
              <Text className="text-white text-xs font-semibold">
                {currentImageIndex + 1} / {mediaData.length}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Project Details */}
      <View className="p-4">
        <Text className="font-display text-ink text-xl mb-2 leading-tight">{item.title}</Text>

        <Text className="text-ink-2 text-sm leading-5 mb-4">
          {displayDescription}
          {isLong && (
            <Text onPress={() => setIsExpanded(!isExpanded)} className="text-ink font-semibold text-sm" accessibilityRole="button">
              {isExpanded ? "  Show less" : "  Read more"}
            </Text>
          )}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2" style={{ marginLeft: -8 }}>
            <Pressable onPress={() => toggleLike(item)} className="flex-row items-center px-2 active:opacity-85" style={{ minHeight: 44 }} accessibilityRole="button" accessibilityState={{ selected: isLiked }} accessibilityLabel={isLiked ? "Unlike project" : "Like project"}>
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? C.brand[500] : C.ink} />
              <Text className={`ml-1.5 font-semibold text-sm ${isLiked ? 'text-accent-text' : 'text-ink'}`}>{item.likes}</Text>
            </Pressable>

            <Pressable onPress={() => openComments(item._id)} className="flex-row items-center px-2 active:opacity-85" style={{ minHeight: 44 }} accessibilityRole="button" accessibilityLabel="Comments">
              <Ionicons name="chatbubble-outline" size={22} color={C.ink} />
            </Pressable>

            {!isOwner && (
              <Button
                small
                icon="chatbubbles-outline"
                title="Connect"
                onPress={() => author._id && navigation.navigate("PublicProfile", { user: author })}
              />
            )}
          </View>

          <View className="flex-row gap-2">
            {item.github_url && (
              <IconBtn boxed size={20} name="logo-github" accessibilityLabel="Open GitHub" onPress={() => Linking.openURL(item.github_url as string).catch(() => Alert.alert("Error", "Could not open link"))} />
            )}
            {item.deployed_url && (
              <IconBtn boxed size={20} name="globe-outline" accessibilityLabel="Open live site" onPress={() => Linking.openURL(item.deployed_url as string).catch(() => Alert.alert("Error", "Could not open link"))} />
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
    // Page 1 never flips `loading` back on: it starts true, and on pull-to-refresh
    // the stale `refreshing` here used to swap the list for the skeleton.
    if (pageNum > 1) setLoadingMore(true);

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


  // Stable callbacks so the memoised ProjectCard actually skips re-renders.
  const openEditModal = useCallback((project: Project) => {
    navigation.navigate("CreateFundingFeed", { project });
  }, [navigation]);

  const handleDeleteProject = useCallback((id: string) => {
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
  }, []);

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const toggleLike = useCallback(async (project: Project) => {
    if (!userId) return;
    const liked = (project.liked_by ?? []).includes(userId);
    const apply = (like: boolean) => setProjects((prev) =>
      prev.map((p) => {
        if (p._id !== project._id) return p;
        const others = (p.liked_by ?? []).filter((id) => id !== userId);
        const had = others.length !== (p.liked_by ?? []).length;
        if (had === like) return p;
        return { ...p, likes: (p.likes ?? 0) + (like ? 1 : -1), liked_by: like ? [...others, userId] : others };
      })
    );
    apply(!liked);
    try { await axios.post(`/funding/like/${project._id}`); } catch (error) { apply(liked); }
  }, [userId]);

  const openComments = useCallback((id: string) => setActiveProjectId(id), []);

  const renderProject = useCallback(({ item }: { item: Project }) => (
    <ProjectCard
      item={item}
      userId={userId}
      toggleLike={toggleLike}
      openComments={openComments}
      openEditModal={openEditModal}
      handleDeleteProject={handleDeleteProject}
      navigation={navigation}
    />
  ), [userId, toggleLike, openComments, openEditModal, handleDeleteProject, navigation]);

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-paper">
        <StatusBar barStyle={C.barStyle} />
        
        {/* Background Protocol Gradient */}

        <View className="flex-1">
          <AppBar title="Funding feed" onBack={() => navigation.goBack()} />

          {loading ? (
            <View className="mt-4">
              {[1, 2].map(i => <ProjectSkeleton key={i} />)}
            </View>
          ) : (
            <FlatList keyboardShouldPersistTaps="handled"
              data={projects}
              renderItem={renderProject}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={false}
              refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loadingMore ? (
                  <View className="py-10 items-center">
                    <ActivityIndicator size="small" color={C.brand[500]} />
                  </View>
                ) : <View className="h-40" />
              }
              contentContainerStyle={{ paddingTop: 8 }}
              ListEmptyComponent={
                <View className="mt-16">
                  <Empty icon="rocket-outline" title="No projects yet" hint="Share what you're building to find backers and teammates." action={<Button variant="primary" title="Share a project" onPress={() => navigation.navigate("CreateFundingFeed")} />} />
                </View>
              }
            />
          )}

          <CommentsSheet
            visible={!!activeProjectId}
            onClose={() => setActiveProjectId(null)}
            resource={FUNDING_COMMENTS}
            targetId={activeProjectId}
            currentUser={user}
          />
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
