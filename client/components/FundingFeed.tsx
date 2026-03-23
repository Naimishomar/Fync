import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, FlatList, Image, Pressable, TextInput, Modal,
  Dimensions, Alert, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, TouchableOpacity, Linking, RefreshControl, StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";
import { RAZORPAY_KEY_ID } from "../constants/keys";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32; 

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
            <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Project Lead</Text>
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
      {item.video ? (
        <Video 
          source={{ uri: item.video.replace(/^http:\/\//i, 'https://') }} 
          style={{ height: 400, width: '100%', backgroundColor: '#050505' }} 
          useNativeControls 
          resizeMode={ResizeMode.CONTAIN} 
        />
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
              const secureUrl = imgUri ? imgUri.replace(/^http:\/\//i, 'https://') : '';
              return (
                <Image
                  source={{ uri: secureUrl }}
                  style={{ width: CARD_WIDTH, height: 280 }}
                  resizeMode="cover"
                  className="bg-gray-50"
                />
              );
            }}
          />
          {item.image.length > 1 && (
            <View className="absolute top-4 right-4 bg-white/90 px-3 py-1 rounded-full border border-gray-100 shadow-sm">
              <Text className="text-zinc-900 text-[10px] font-black tracking-tighter">
                {currentImageIndex + 1} / {item.image.length}
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


  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const [images, setImages] = useState<any[]>([]); 
  const [video, setVideo] = useState<any>(null);   
  const [oldImages, setOldImages] = useState<string[]>([]); 
  const [oldVideo, setOldVideo] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [showPaymentParams, setShowPaymentParams] = useState<any>(null);

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

  const pickImages = async () => {
    if (images.length >= 5) return Alert.alert("Limit reached", "Max 5 images allowed");

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add images.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });
    if (!res.canceled) {
      setOldImages([]); 
      setOldVideo(null);
      setVideo(null);
      setImages((prev) => [...prev, ...res.assets].slice(0, 5));
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add a video.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (!res.canceled) {
      setOldImages([]);
      setOldVideo(null);
      setImages([]); 
      setVideo(res.assets[0]);
    }
  };

  const handleFinalSubmit = async (paymentData?: { paymentRefId: string, razorpay_order_id: string, razorpay_signature: string }) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("deployed_url", deployedUrl);
      formData.append("github_url", githubUrl);

      images.forEach((img, index) => {
        formData.append("image", { uri: img.uri, name: `image_${index}.jpg`, type: "image/jpeg" } as any);
      });
      if (video) {
        formData.append("video", { uri: video.uri, name: "video.mp4", type: "video/mp4" } as any);
      }

      if (paymentData) {
        formData.append("paymentRefId", paymentData.paymentRefId);
        formData.append("razorpay_order_id", paymentData.razorpay_order_id);
        formData.append("razorpay_signature", paymentData.razorpay_signature);
      } else if (!isEditing) {
        formData.append("isEditing", "false");
      }

      if (isEditing && editingId) {
        formData.append("isEditing", "true");
        await axios.post(`/funding/update/${editingId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
        Alert.alert("Success", "Project updated successfully");
      } else {
        await axios.post("/funding/create", formData, { headers: { "Content-Type": "multipart/form-data" } });
        Alert.alert("Success 🎉", "Project posted successfully!");
      }

      setModalVisible(false);
      fetchProjects(1, false);
    } catch (error) {
      console.error("Submit error", error);
      Alert.alert("Error", "Failed to save project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitiateProjectPost = async () => {
    if (!title || !description || !deployedUrl) {
      return Alert.alert("Missing fields", "Fill all required fields");
    }

    if (images.length === 0 && !video && oldImages.length === 0 && !oldVideo) {
      return Alert.alert("Add media", "Add at least one image or video");
    }

    if (isEditing) {
      handleFinalSubmit();
    } else {
      setSubmitting(true);
      try {
        const orderRes = await axios.post('/payment/order', {
          amount: 249,
        });
        const currentOrder = orderRes.data;

        const content = `
        <html>
        <body style="background-color: #F5F7FA;">
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
            <script>
            var options = {
                key: "${RAZORPAY_KEY_ID}",
                amount: "${currentOrder.amount}",
                currency: "INR",
                name: "Fync",
                description: "Post Startup Project Fee",
                order_id: "${currentOrder.id}",
                prefill: {
                    name: "${user?.name || ''}",
                    email: "${user?.email || ''}",
                    contact: "${user?.mobileNumber || ''}"
                },
                theme: { color: "#ec4899" },
                handler: function (response) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        event: "SUCCESS",
                        data: response
                    }));
                },
                modal: {
                    ondismiss: function () {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            event: "FAILED"
                        }));
                    }
                }
            };
            var rzp1 = new Razorpay(options);
            rzp1.open();
            </script>
        </body>
        </html>
        `;
        setShowPaymentParams({ html: content });
      } catch (err) {
        console.error("Order error", err);
        Alert.alert("Oops!", "Could not initiate payment.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleWebViewMessage = (event: any) => {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.event === "SUCCESS") {
      setShowPaymentParams(null);
      handleFinalSubmit({
        paymentRefId: msg.data.razorpay_payment_id,
        razorpay_order_id: msg.data.razorpay_order_id,
        razorpay_signature: msg.data.razorpay_signature
      });
    } else {
      setShowPaymentParams(null);
      Alert.alert("Payment Cancelled", "Payment is required to post a project.");
    }
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
    <View className="flex-1 bg-[#F5F7FA]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">
        <View className="px-6 pt-4 pb-4 flex-row justify-between items-center bg-white border-b border-gray-100 shadow-sm">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-gray-50 rounded-full mr-3 border border-gray-100">
              <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter">PROJECT<Text className="text-pink-500">FEED</Text> 🚀</Text>
          </View>
          <TouchableOpacity onPress={openCreateModal} className="p-2.5 rounded-full border border-pink-100 bg-pink-500 shadow-sm shadow-pink-500/30">
            <Ionicons name="add" size={22} color="white" />
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

        {/* CREATE / EDIT PROJECT MODAL */}
        <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
            <View className="flex-1 bg-black/40 justify-end">
              <Pressable className="flex-1" onPress={() => setModalVisible(false)} />
              <View className="bg-white h-[90%] rounded-t-3xl border-t border-gray-100 p-6 shadow-2xl">
                <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-6" />

                <View className="flex-row justify-between items-center mb-6">
                  <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter">{isEditing ? "Edit" : "Post"} <Text className="text-pink-500">Project</Text></Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1 bg-gray-100 rounded-full">
                    <Ionicons name="close" size={24} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-5">
                    <Text className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-3">Project Overview</Text>
                    <TextInput placeholder="Project Title" placeholderTextColor="#9ca3af" value={title} onChangeText={setTitle} className="text-zinc-900 bg-white p-4 rounded-xl mb-4 font-bold border border-gray-100" />
                    <TextInput placeholder="Tell everyone about your project..." placeholderTextColor="#9ca3af" value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" className="text-zinc-900 bg-white p-4 rounded-xl mb-3 font-medium border border-gray-100 min-h-[120px]" />
                  </View>

                  <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-5">
                    <Text className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-3">Live Links</Text>
                    <View className="flex-row items-center bg-white p-4 rounded-xl mb-4 border border-gray-100 shadow-sm shadow-black/5">
                      <Ionicons name="link-outline" size={20} color="#ec4899" />
                      <TextInput placeholder="Deployed URL (Required)" placeholderTextColor="#9ca3af" value={deployedUrl} onChangeText={setDeployedUrl} className="text-zinc-900 font-bold flex-1 ml-3" autoCapitalize="none" />
                    </View>
                    <View className="flex-row items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm shadow-black/5">
                      <Ionicons name="logo-github" size={20} color="#1A1A1A" />
                      <TextInput placeholder="Github URL (Optional)" placeholderTextColor="#9ca3af" value={githubUrl} onChangeText={setGithubUrl} className="text-zinc-900 font-bold flex-1 ml-3" autoCapitalize="none" />
                    </View>
                  </View>

                  <View className="bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-8">
                    <Text className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-1">Showcase Media</Text>
                    <Text className="text-gray-400 text-[10px] mb-4 font-medium italic">High quality media helps you stand out!</Text>

                    <View className="flex-row gap-4 mb-5">
                      <TouchableOpacity onPress={pickImages} className="flex-1 bg-white py-4 rounded-2xl flex-row items-center justify-center border border-gray-100 shadow-sm shadow-black/5">
                        <Ionicons name="images-outline" size={20} color="#ec4899" />
                        <Text className="text-zinc-900 font-black italic tracking-tighter ml-2 uppercase text-xs">Images</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={pickVideo} className="flex-1 bg-white py-4 rounded-2xl flex-row items-center justify-center border border-gray-100 shadow-sm shadow-black/5">
                        <Ionicons name="videocam-outline" size={20} color="#ec4899" />
                        <Text className="text-zinc-900 font-black italic tracking-tighter ml-2 uppercase text-xs">Video</Text>
                      </TouchableOpacity>
                    </View>

                    {images.length > 0 && (
                      <FlatList horizontal data={images} keyExtractor={(_, i) => i.toString()} showsHorizontalScrollIndicator={false} className="mb-4" renderItem={({ item, index }) => (
                        <View className="mr-3 relative shadow-sm">
                          <Image source={{ uri: item.uri }} className="h-24 w-24 rounded-2xl bg-gray-200" />
                          <TouchableOpacity onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))} className="absolute -top-1 -right-1 bg-white rounded-full p-1 border border-gray-100 shadow-sm">
                            <Ionicons name="close" size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      )} />
                    )}
                    {video && (
                      <View className="mb-4 relative w-full shadow-sm rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800">
                        <Video 
                          source={{ uri: video.uri }} 
                          style={{ height: 250, width: '100%' }} 
                          useNativeControls 
                          resizeMode={ResizeMode.CONTAIN}
                        />
                        <TouchableOpacity onPress={() => setVideo(null)} className="absolute top-2 right-2 bg-white rounded-full p-2 border border-gray-100 shadow-sm">
                          <Ionicons name="close" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    )}

                    {images.length === 0 && !video && oldImages.length > 0 && (
                      <View className="mb-4">
                        <Text className="text-zinc-900 text-[10px] font-bold mb-2 uppercase tracking-tight">Active Images:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {oldImages.map((uri, idx) => <Image key={idx} source={{ uri: uri.replace(/^http:\/\//i, 'https://') }} className="h-20 w-20 rounded-xl bg-gray-100 mr-2 border border-gray-200" />)}
                        </ScrollView>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity onPress={handleInitiateProjectPost} disabled={submitting} className={`py-5 rounded-2xl items-center shadow-lg shadow-pink-500/30 mb-12 ${submitting ? 'bg-pink-400' : 'bg-pink-500'}`}>
                    {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-lg italic tracking-tighter uppercase">{isEditing ? "Update Project" : "Post Project for ₹249"}</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
        </Modal>

        {/* COMMENTS MODAL */}
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

        {/* PAYMENT MODAL */}
        <Modal visible={!!showPaymentParams} animationType="slide" transparent={false} onRequestClose={() => setShowPaymentParams(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
            <View className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100">
              <TouchableOpacity onPress={() => setShowPaymentParams(null)} className="p-2">
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
              <Text className="ml-4 font-black italic tracking-tighter text-lg">Secure Gateway</Text>
            </View>
            <WebView
              source={showPaymentParams}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => <ActivityIndicator color="#ec4899" size="large" style={{ position: 'absolute', top: '50%', left: '45%' }} />}
            />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}