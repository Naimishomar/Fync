import React, { useEffect, useState } from "react";
import {
  View, Text, FlatList, Image, Pressable, TextInput, Modal,
  Dimensions, Alert, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableOpacity, Linking, RefreshControl
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32; // Screen width minus mx-4 (16px * 2)

/* ---------- TYPES ---------- */
interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
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

interface Comment {
  _id: string;
  text: string;
  commentor: User;
}

/* ---------- PROJECT CARD SUB-COMPONENT ---------- */
// Managing state per card (for image slider and Read More)
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

  // Image Slider State
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / CARD_WIDTH);
    setCurrentImageIndex(index);
  };

  // Read More State
  const [isExpanded, setIsExpanded] = useState(false);
  const words = item.description ? item.description.split(" ") : [];
  const isLong = words.length > 25; // Adjusted to 25 words for better mobile formatting (approx 100-150 chars)

  const displayDescription = isExpanded || !isLong
    ? item.description
    : words.slice(0, 25).join(" ") + "...";

  return (
    <View className="mx-4 mb-5 rounded-2xl bg-[#1e1e1e]/90 border border-white/10 overflow-hidden">
      {/* User Info Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <View className="flex-row items-center">
          <Image source={{ uri: item.user.avatar || 'https://ui-avatars.com/api/?name=User' }} className="h-10 w-10 rounded-full mr-3 border border-white/10 bg-gray-800" />
          <Text className="font-bold text-white text-base">{item.user.username || item.user.name}</Text>
        </View>

        {/* Edit/Delete Actions for Owner */}
        {isOwner && (
          <View className="flex-row gap-4">
            <TouchableOpacity onPress={() => openEditModal(item)}>
              <Ionicons name="pencil" size={18} color="#9ca3af" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteProject(item._id)}>
              <Ionicons name="trash" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Media Slider */}
      {item.video ? (
        <Video source={{ uri: item.video.replace(/^http:\/\//i, 'https://') }} style={{ height: 260, width: '100%' }} useNativeControls resizeMode={ResizeMode.COVER} />
      ) : item.image && item.image.length > 0 ? (
        <View>
          <FlatList
            horizontal
            data={item.image}
            keyExtractor={(img, index) => index.toString()}
            showsHorizontalScrollIndicator={false}
            pagingEnabled
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item: imgUri }) => {
              // Fix for Android blank images (forces HTTPS)
              const secureUrl = imgUri ? imgUri.replace(/^http:\/\//i, 'https://') : '';
              return (
                <Image
                  source={{ uri: secureUrl }}
                  style={{ width: CARD_WIDTH, height: 260 }}
                  resizeMode="cover"
                  className="bg-gray-800"
                />
              );
            }}
          />
          {/* Instagram-style Image Counter */}
          {item.image.length > 1 && (
            <View className="absolute top-3 right-3 bg-black/70 px-3 py-1 rounded-full border border-white/10">
              <Text className="text-white text-[10px] font-bold tracking-widest">
                {currentImageIndex + 1} / {item.image.length}
              </Text>
            </View>
          )}
        </View>
      ) : null}

      {/* Project Details */}
      <View className="px-4 py-3">
        <Text className="font-bold text-white text-lg mb-1">{item.title}</Text>

        {/* Read More / Show Less Description */}
        <Text className="text-gray-400 text-sm leading-5 mb-3">
          {displayDescription}
          {isLong && (
            <Text onPress={() => setIsExpanded(!isExpanded)} className="text-pink-500 font-bold">
              {isExpanded ? " Show Less" : " Read More"}
            </Text>
          )}
        </Text>

        <View className="flex-row items-center justify-between mb-3 border-b border-white/5 pb-3">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => toggleLike(item)} className="flex-row items-center">
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? "#ec4899" : "white"} />
              <Text className="ml-1 text-gray-300 font-medium">{item.likes}</Text>
            </Pressable>

            <Pressable onPress={() => openComments(item._id)} className="flex-row items-center ml-2">
              <Ionicons name="chatbubble-outline" size={22} color="white" />
            </Pressable>

            {/* Contact Founder Button */}
            {!isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate("PublicProfile", { user: item.user })}
                className="flex-row items-center bg-pink-500 px-3 py-1.5 rounded-full border border-white/10 ml-2"
              >
                <Ionicons name="person-circle-outline" size={16} color="#fff" />
                <Text className="text-gray-300 text-[10px] font-bold ml-1 uppercase tracking-wider">Contact</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Clickable Links */}
          <View className="flex-row gap-3">
            {item.github_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.github_url as string)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="logo-github" size={22} color="white" />
              </TouchableOpacity>
            )}
            {item.deployed_url && (
              <TouchableOpacity
                onPress={() => Linking.openURL(item.deployed_url as string)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="link-outline" size={22} color="skyblue" />
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


  /* CREATE / EDIT PROJECT MODAL */
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const [images, setImages] = useState<any[]>([]); // New local images
  const [video, setVideo] = useState<any>(null);   // New local video
  const [oldImages, setOldImages] = useState<string[]>([]); // To show preview of existing
  const [oldVideo, setOldVideo] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  /* COMMENTS MODAL */
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);

  /* ---------- FETCH PROJECTS ---------- */
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


  /* ---------- MODAL CONTROLS ---------- */
  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setTitle("");
    setDescription("");
    setDeployedUrl("");
    setGithubUrl("");
    setImages([]);
    setVideo(null);
    setOldImages([]);
    setOldVideo(null);
    setModalVisible(true);
  };

  const openEditModal = (project: Project) => {
    setIsEditing(true);
    setEditingId(project._id);
    setTitle(project.title);
    setDescription(project.description);
    setDeployedUrl(project.deployed_url || "");
    setGithubUrl(project.github_url || "");
    setOldImages(project.image || []);
    setOldVideo(project.video || null);
    setImages([]);
    setVideo(null);
    setModalVisible(true);
  };

  /* ---------- MEDIA PICKERS ---------- */
  const pickImages = async () => {
    if (images.length >= 5) return Alert.alert("Limit reached", "Max 5 images allowed");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });
    if (!res.canceled) {
      setOldImages([]); // Clear old preview if new is selected
      setOldVideo(null);
      setVideo(null);
      setImages((prev) => [...prev, ...res.assets].slice(0, 5));
    }
  };

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (!res.canceled) {
      setOldImages([]);
      setOldVideo(null);
      setImages([]); // If video, clear images
      setVideo(res.assets[0]);
    }
  };

  /* ---------- SUBMIT PROJECT ---------- */
  const handleSubmitProject = async () => {
    if (!title || !description || !deployedUrl) {
      return Alert.alert("Missing fields", "Fill all required fields");
    }

    // Check if there is NO old media and NO new media
    if (images.length === 0 && !video && oldImages.length === 0 && !oldVideo) {
      return Alert.alert("Add media", "Add at least one image or video");
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("deployed_url", deployedUrl);
      formData.append("github_url", githubUrl);

      // Only append files if user selected NEW ones
      images.forEach((img, index) => {
        formData.append("image", { uri: img.uri, name: `image_${index}.jpg`, type: "image/jpeg" } as any);
      });
      if (video) {
        formData.append("video", { uri: video.uri, name: "video.mp4", type: "video/mp4" } as any);
      }

      if (isEditing && editingId) {
        await axios.post(`/funding/update/${editingId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
        Alert.alert("Success", "Project updated successfully");
      } else {
        await axios.post("/funding/create", formData, { headers: { "Content-Type": "multipart/form-data" } });
        Alert.alert("Success", "Project created successfully");
      }

      setModalVisible(false);
      fetchProjects();
    } catch (error) {
      console.error("Submit error", error);
      Alert.alert("Error", "Failed to save project");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- DELETE PROJECT ---------- */
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

  /* ---------- LIKE & COMMENTS ---------- */
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
      await axios.post(`/funding/comment/add/${activeProjectId}`, { text: commentText });
      setCommentText("");
      openComments(activeProjectId);
    } catch (error) { }
  };

  /* ---------- UI ---------- */
  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        <View className="px-6 pt-4 mb-4 flex-row justify-between items-center">
          <View>
            <Text className="text-white text-3xl font-black italic tracking-tighter">PROJECT<Text className="text-pink-500">FEED</Text> 🚀</Text>
          </View>
          <TouchableOpacity onPress={openCreateModal} className="p-3 rounded-full border border-pink-500 bg-pink-500/20">
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
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
              ) : <View className="h-10" />
            )}
            contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
            ListEmptyComponent={
              <View className="items-center mt-20 opacity-50">
                <Ionicons name="rocket-outline" size={50} color="gray" />
                <Text className="text-gray-500 mt-4 font-bold">No projects found.</Text>
              </View>
            }
          />
        )}

        {/* CREATE / EDIT PROJECT MODAL */}
        <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
          <BlurView intensity={100} tint="dark" className="flex-1 justify-end">
            <View className="bg-black/90 h-[90%] rounded-t-3xl border-t border-white/10 p-6 shadow-2xl">
              <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-white text-2xl font-black">{isEditing ? "Edit Project" : "Post Project"}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close-circle" size={28} color="gray" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View className="bg-[#1e1e1e]/80 rounded-2xl p-4 border border-white/5 mb-4">
                  <Text className="text-gray-400 font-bold mb-2 text-xs uppercase tracking-wider">Details</Text>
                  <TextInput placeholder="Project Title" placeholderTextColor="#666" value={title} onChangeText={setTitle} className="text-white bg-[#2a2a2a] p-3 rounded-xl mb-3 font-medium" />
                  <TextInput placeholder="Description" placeholderTextColor="#666" value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" className="text-white bg-[#2a2a2a] p-3 rounded-xl mb-3 font-medium min-h-[100px]" />
                </View>

                <View className="bg-[#1e1e1e]/80 rounded-2xl p-4 border border-white/5 mb-4">
                  <Text className="text-gray-400 font-bold mb-2 text-xs uppercase tracking-wider">Links</Text>
                  <View className="flex-row items-center bg-[#2a2a2a] p-3 rounded-xl mb-3">
                    <Ionicons name="link" size={18} color="gray" className="mr-2" />
                    <TextInput placeholder="Deployed URL (Required)" placeholderTextColor="#666" value={deployedUrl} onChangeText={setDeployedUrl} className="text-white font-medium flex-1 ml-2" autoCapitalize="none" />
                  </View>
                  <View className="flex-row items-center bg-[#2a2a2a] p-3 rounded-xl">
                    <Ionicons name="logo-github" size={18} color="gray" className="mr-2" />
                    <TextInput placeholder="Github URL (Optional)" placeholderTextColor="#666" value={githubUrl} onChangeText={setGithubUrl} className="text-white font-medium flex-1 ml-2" autoCapitalize="none" />
                  </View>
                </View>

                <View className="bg-[#1e1e1e]/80 rounded-2xl p-4 border border-white/5 mb-6">
                  <Text className="text-gray-400 font-bold mb-3 text-xs uppercase tracking-wider">Media</Text>
                  <Text className="text-gray-500 text-xs mb-3 italic">Selecting new media will replace the existing media.</Text>

                  <View className="flex-row gap-3 mb-4">
                    <TouchableOpacity onPress={pickImages} className="flex-1 bg-[#2a2a2a] py-3 rounded-xl flex-row items-center justify-center border border-white/5">
                      <Ionicons name="images" size={18} color="#ec4899" />
                      <Text className="text-white font-bold ml-2">Images</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={pickVideo} className="flex-1 bg-[#2a2a2a] py-3 rounded-xl flex-row items-center justify-center border border-white/5">
                      <Ionicons name="videocam" size={18} color="#ec4899" />
                      <Text className="text-white font-bold ml-2">Video</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Render NEW Media Previews */}
                  {images.length > 0 && (
                    <FlatList horizontal data={images} keyExtractor={(_, i) => i.toString()} showsHorizontalScrollIndicator={false} className="mb-3" renderItem={({ item, index }) => (
                      <View className="mr-3 relative">
                        <Image source={{ uri: item.uri }} className="h-24 w-24 rounded-lg bg-gray-800" />
                        <TouchableOpacity onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))} className="absolute top-1 right-1 bg-black/70 rounded-full p-1 border border-white/20">
                          <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                      </View>
                    )} />
                  )}
                  {video && (
                    <View className="mb-3 relative w-full">
                      <Video source={{ uri: video.uri }} style={{ height: 150, width: '100%', borderRadius: 10 }} useNativeControls />
                      <TouchableOpacity onPress={() => setVideo(null)} className="absolute top-2 right-2 bg-black/70 rounded-full p-2 border border-white/20">
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Render OLD Media Previews (only if no new ones are selected) */}
                  {images.length === 0 && !video && oldImages.length > 0 && (
                    <View className="mb-3 opacity-60">
                      <Text className="text-white text-xs mb-2">Current Images:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {oldImages.map((uri, idx) => <Image key={idx} source={{ uri: uri.replace(/^http:\/\//i, 'https://') }} className="h-20 w-20 rounded-lg bg-gray-800 mr-2" />)}
                      </ScrollView>
                    </View>
                  )}
                  {images.length === 0 && !video && oldVideo && (
                    <View className="mb-3 opacity-60">
                      <Text className="text-white text-xs mb-2">Current Video:</Text>
                      <Video source={{ uri: oldVideo.replace(/^http:\/\//i, 'https://') }} style={{ height: 150, width: '100%', borderRadius: 10 }} />
                    </View>
                  )}
                </View>

                <TouchableOpacity onPress={handleSubmitProject} disabled={submitting} className={`py-4 rounded-xl items-center shadow-lg border border-pink-500/30 mb-8 ${submitting ? 'bg-pink-600/50' : 'bg-pink-600'}`}>
                  {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">{isEditing ? "Update Project" : "Post Project"}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </BlurView>
        </Modal>

        {/* COMMENTS MODAL */}
        <Modal visible={commentModal} transparent={true} animationType="slide" onRequestClose={() => setCommentModal(false)}>
          <BlurView intensity={100} tint="dark" className="flex-1 justify-end">
            <View className="bg-black/90 h-[70%] rounded-t-3xl border-t border-white/10 overflow-hidden shadow-2xl">
              <View className="flex-row justify-between items-center px-6 py-4 border-b border-white/10 bg-[#1e1e1e]/50">
                <Text className="font-bold text-lg text-white">Comments</Text>
                <TouchableOpacity onPress={() => setCommentModal(false)}>
                  <Ionicons name="close-circle" size={24} color="gray" />
                </TouchableOpacity>
              </View>

              {commentsLoading ? <ActivityIndicator className="mt-10" color="#ec4899" /> : (
                <FlatList data={comments} keyExtractor={c => c._id} contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => (
                    <View className="flex-row mb-4">
                      <Image source={{ uri: item.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className="w-8 h-8 rounded-full bg-gray-800 border border-white/10" />
                      <View className="ml-3 flex-1 bg-[#2a2a2a] p-3 rounded-xl rounded-tl-none border border-white/5">
                        <Text className="font-bold text-xs text-gray-300 mb-1">{item.commentor?.username || item.commentor?.name}</Text>
                        <Text className="text-gray-400 text-sm leading-5">{item.text}</Text>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={<Text className="text-center text-gray-500 mt-10 font-medium">No comments yet. Be the first!</Text>}
                />
              )}

              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View className="p-4 border-t border-white/10 flex-row items-center bg-[#1e1e1e]/80 pb-8">
                  <TextInput value={commentText} onChangeText={setCommentText} placeholder="Add a comment..." placeholderTextColor="#666" className="flex-1 bg-[#2a2a2a] text-white rounded-full px-4 py-3 mr-3 border border-white/5 font-medium" />
                  <TouchableOpacity onPress={postComment} className="bg-pink-600 p-3 rounded-full border border-pink-500/50">
                    <Ionicons name="send" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </BlurView>
        </Modal>

      </SafeAreaView>
    </View>
  );
}