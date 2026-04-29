import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert, Pressable, Linking, ScrollView, RefreshControl,
  Platform, KeyboardAvoidingView, StyleSheet, Dimensions, Animated, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import moment from 'moment';
import { RAZORPAY_KEY_ID } from '../constants/keys';

const { width } = Dimensions.get('window');
const ADMIN_EMAIL = "dev.fync@fync.com";

interface Comment {
  _id: string;
  text: string;
  commentor: { _id: string; name: string; avatar: string };
  createdAt: string;
}

interface NoticeType {
  _id: string;
  title: string;
  description: string;
  link?: string;
  image?: string[];
  user: {
    _id: string;
    name: string;
    avatar?: string;
    username: string;
  };
  college: string;
  createdAt: string;
  comments: string[];
  likes?: number;
  liked_by?: string[];
}

const NoticeBoard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'college' | 'global'>('college');
  const [notices, setNotices] = useState<NoticeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Notice Creation State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [link, setLink] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Comments & Selection State
  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [noticeComments, setNoticeComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  /* PAYMENT MODAL */
  const [showPaymentParams, setShowPaymentParams] = useState<any>(null);

  const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

  const fetchNotices = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if (pageNum > 1) setLoadingMore(true);
    else if (!refreshing) setLoading(true);

    try {
      const endpoint = activeTab === 'college'
        ? `/notice/get?page=${pageNum}&limit=10`
        : `/notice/get/global?page=${pageNum}&limit=10`;

      const res = await axios.get(endpoint);

      if (res.data?.success && Array.isArray(res.data?.notices)) {
        const fetchedNotices = res.data.notices;
        if (shouldAppend) {
          setNotices(prev => [...prev, ...fetchedNotices]);
        } else {
          setNotices(fetchedNotices);
        }

        const pagination = res.data.pagination;
        if (pagination) {
          setHasMore(pagination.page < pagination.pages);
          setPage(pagination.page);
        } else {
          setHasMore(false);
        }
      } else {
        if (!shouldAppend) setNotices([]);
        setHasMore(false);
      }
    } catch (error: any) {
      if (error.response?.status === 404 && pageNum === 1) {
        setNotices([]);
        setHasMore(false);
      } else {
        console.error("Error fetching notices:", error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchNotices(1, false);
  }, [activeTab]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchNotices(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchNotices(page + 1, true);
    }
  };

  const handleCreateNotice = async (paymentData?: { paymentRefId: string, razorpay_order_id: string, razorpay_signature: string }) => {
    if (!title.trim() || !desc.trim()) {
      Alert.alert("Required", "Title and Description are required.");
      return;
    }

    if (activeTab === 'global' && !isAdmin && !paymentData) {
      setSubmitting(true);
      try {
        const orderRes = await axios.post('/payment/order', { amount: 49 });
        const currentOrder = orderRes.data;
        const content = `
            <html>
            <body style="background-color: #F8FAFC;">
                <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
                <script>
                var options = {
                    key: "${RAZORPAY_KEY_ID}",
                    amount: "${currentOrder.amount}",
                    currency: "INR",
                    name: "Fync",
                    description: "Global Notice Fee",
                    order_id: "${currentOrder.id}",
                    prefill: {
                        name: "${user?.name || ''}",
                        email: "${user?.email || ''}",
                        contact: "${user?.mobileNumber || ''}"
                    },
                    theme: { color: "#f97316" },
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
        Alert.alert("Error", "Could not initiate payment");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', desc);
      if (link) formData.append('link', link);

      images.forEach((img, index) => {
        const uriParts = img.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        // @ts-ignore
        formData.append('noticeImage', {
          uri: img.uri,
          type: `image/${fileType}`,
          name: `notice_${index}.${fileType}`,
        });
      });

      if (paymentData) {
        formData.append("paymentRefId", paymentData.paymentRefId);
        formData.append("razorpay_order_id", paymentData.razorpay_order_id);
        formData.append("razorpay_signature", paymentData.razorpay_signature);
      }

      const endpoint = (activeTab === 'global') ? '/notice/create/global' : '/notice/create';
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Alert.alert("Success", "Notice published!");
        setCreateModalVisible(false);
        setTitle(''); setDesc(''); setLink(''); setImages([]);
        fetchNotices();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to publish notice.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWebViewMessage = (event: any) => {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.event === "SUCCESS") {
      setShowPaymentParams(null);
      handleCreateNotice({
        paymentRefId: msg.data.razorpay_payment_id,
        razorpay_order_id: msg.data.razorpay_order_id,
        razorpay_signature: msg.data.razorpay_signature
      });
    } else {
      setShowPaymentParams(null);
      Alert.alert("Cancelled", "Payment is required for global notices.");
    }
  };

  const openComments = async (id: string) => {
    setActiveNoticeId(id);
    setCommentsModalVisible(true);
    setCommentsLoading(true);
    try {
      const res = await axios.get(`/notice/comment/all/${id}`);
      if (res.data.success) setNoticeComments(res.data.comments);
    } catch (error) {
      console.log(error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !activeNoticeId) return;
    try {
      const res = await axios.post(`/notice/comment/add/${activeNoticeId}`, { text: newComment });
      if (res.data.success) {
        setNoticeComments([res.data.comment, ...noticeComments]);
        setNewComment("");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to comment");
    }
  };

  const deleteNoticeItem = async (id: string) => {
    Alert.alert("Delete Notice", "Are you sure you want to permanently delete this notice?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await axios.delete(`/notice/delete/${id}`);
            setNotices(prev => prev.filter(n => n._id !== id));
          } catch (e) { Alert.alert("Error", "Could not delete notice"); }
        }
      }
    ])
  };

  const handleLikeNotice = async (id: string, isCurrentlyLiked: boolean) => {
    setNotices(prev => prev.map(n => {
      if (n._id === id) {
        const currentLikes = n.likes || 0;
        const likedBy = n.liked_by || [];
        return {
          ...n,
          likes: isCurrentlyLiked ? currentLikes - 1 : currentLikes + 1,
          liked_by: isCurrentlyLiked
            ? likedBy.filter(uId => uId !== user?._id)
            : [...likedBy, user?._id || '']
        };
      }
      return n;
    }));

    try {
      await axios.post(`/notice/like/${id}`);
    } catch (e) {
      console.log('Error liking notice', e);
    }
  };

  const renderNotice = ({ item }: { item: NoticeType }) => {
    const isOwner = item.user?._id === user?._id;
    const avatarUrl = item.user?.avatar || `https://ui-avatars.com/api/?name=${item.user?.username || 'Admin'}`;

    return (
      <View className="bg-white rounded-[32px] mb-6 overflow-hidden mx-8 border border-slate-100 shadow-sm shadow-black/5">
        <View className="p-6">
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 mr-4">
              <Text className="text-zinc-900 font-black  text-lg uppercase tracking-tight leading-tight">{item.title}</Text>
              <Text className="text-slate-400 text-[10px] mt-1 uppercase tracking-widest font-black ">
                {moment(item.createdAt).format('DD MMM, YYYY • hh:mm A')}
              </Text>
            </View>
            {activeTab === 'global' && (
              <View className="bg-rose-50 px-3 py-1 rounded-full flex-row items-center border border-rose-100">
                <MaterialCommunityIcons name="shield-check" size={12} color="#f43f5e" />
                <Text className="text-rose-500 text-[8px] font-black ml-1 uppercase tracking-[1px]">Official</Text>
              </View>
            )}
          </View>

          <Text className="text-slate-600 text-sm leading-6 mb-6 font-medium ">"{item.description}"</Text>

          {item.link && (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.link!)}
              activeOpacity={0.8}
              className="flex-row items-center bg-slate-50 p-4 rounded-3xl mb-6 self-start border border-slate-100"
            >
              <View className="w-8 h-8 bg-zinc-900 rounded-2xl items-center justify-center mr-3">
                <Ionicons name="link" size={14} color="white" />
              </View>
              <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-widest" numberOfLines={1}>
                Open Attachment
              </Text>
            </TouchableOpacity>
          )}

          {item.image && item.image.length > 0 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={item.image}
              keyExtractor={(img, idx) => idx.toString()}
              className="mb-6"
              renderItem={({ item: imgUri }) => (
                <TouchableOpacity
                  onPress={() => { setSelectedImage(imgUri); setPreviewVisible(true); }}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: imgUri }}
                    className="w-64 h-40 rounded-[28px] mr-4 bg-slate-50 border border-slate-100"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
          )}

          <View className="h-[1px] bg-slate-50 mb-6" />

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Image source={{ uri: avatarUrl }} className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200" />
              <View className="ml-3">
                <Text className="text-[8px] text-slate-400 uppercase tracking-widest font-black ">By Protocol</Text>
                <Text className="text-zinc-900 text-xs font-black  uppercase mt-0.5 tracking-tight">
                  {item.user?.name || "Official Admin"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => handleLikeNotice(item._id, !!item.liked_by?.includes(user?._id || ''))}
                className="flex-row items-center px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <Ionicons
                  name={item.liked_by?.includes(user?._id || '') ? "heart" : "heart-outline"}
                  size={16}
                  color={item.liked_by?.includes(user?._id || '') ? "#f43f5e" : "#CBD5E1"}
                />
                <Text className="text-zinc-900 text-[10px] ml-2 font-black ">{item.likes || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openComments(item._id)} className="flex-row items-center px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <Ionicons name="chatbubble-outline" size={16} color="#CBD5E1" />
                <Text className="text-zinc-900 text-[10px] ml-2 font-black ">{item.comments?.length || 0}</Text>
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity onPress={() => deleteNoticeItem(item._id)} className="w-10 h-10 bg-rose-50 rounded-2xl items-center justify-center border border-rose-100">
                  <Ionicons name="trash-outline" size={16} color="#f43f5e" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const NoticeSkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }, []);

    return (
      <Animated.View style={{ opacity: pulseAnim }} className="bg-white rounded-[32px] mb-6 border border-slate-100 p-8 mx-8">
        <View className="h-6 bg-slate-50 rounded w-3/4 mb-4" />
        <View className="h-3 bg-slate-50 rounded w-1/4 mb-10" />
        <View className="h-4 bg-slate-50 rounded w-full mb-3" />
        <View className="h-4 bg-slate-50 rounded w-4/5 mb-10" />
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-slate-50 rounded-2xl" />
            <View className="ml-3"><View className="h-4 bg-slate-50 rounded w-20" /></View>
          </View>
          <View className="flex-row gap-2">
            <View className="w-12 h-10 bg-slate-50 rounded-2xl" />
            <View className="w-12 h-10 bg-slate-50 rounded-2xl" />
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-8 pt-6">
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-3xl font-black  text-zinc-900 tracking-tighter uppercase leading-tight">
                Fync <Text className="text-orange-500">Board</Text> 📌
              </Text>
              <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-0.5">Announcement Protocol</Text>
            </View>
          </View>

          <View className="flex-row bg-white p-1.5 rounded-[22px] mb-8 border border-slate-100 shadow-sm">
            <TouchableOpacity
              onPress={() => setActiveTab('college')}
              className={`flex-1 py-3.5 items-center rounded-[18px] ${activeTab === 'college' ? 'bg-zinc-900 shadow-lg shadow-black/20' : 'bg-transparent'}`}
            >
              <Text className={`font-black tracking-widest text-[10px]  uppercase ${activeTab === 'college' ? 'text-white' : 'text-slate-400'}`}>Campus</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('global')}
              className={`flex-1 py-3.5 items-center rounded-[18px] ${activeTab === 'global' ? 'bg-orange-500' : 'bg-transparent'}`}
            >
              <Text className={`font-black tracking-widest text-[10px]  uppercase ${activeTab === 'global' ? 'text-white' : 'text-slate-400'}`}>Global</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && !refreshing ? (
          <View>{[1, 2, 3].map(i => <NoticeSkeleton key={i} />)}</View>
        ) : (
          <FlatList
            data={notices}
            keyExtractor={item => item._id}
            renderItem={renderNotice}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl tintColor="#f97316" refreshing={refreshing} onRefresh={onRefresh} />}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#f97316" />
                </View>
              ) : <View className="h-10" />
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-10">
                <View className="w-20 h-20 bg-white rounded-[32px] items-center justify-center mb-6 border border-slate-100">
                  <Ionicons name="clipboard-outline" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-400 font-black  uppercase text-xs tracking-widest text-center">No Active Intel</Text>
                <Text className="text-slate-300 text-[10px] font-bold uppercase mt-2 text-center">The board is currently silent.</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setCreateModalVisible(true)}
          className="absolute bottom-14 right-8 w-14 h-14 rounded-2xl bg-zinc-900 items-center justify-center"
        >
          <Ionicons name="pencil" size={24} color="white" />
        </TouchableOpacity>

        <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModalVisible(false)}>
          <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row justify-between items-center px-8 py-6 border-b border-slate-100 bg-white">
              <Text className="text-xl font-black text-zinc-900  tracking-tighter uppercase leading-tight">
                New <Text className="text-orange-500">{activeTab === 'global' ? 'Global Intel' : 'Campus Intel'}</Text>
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <Ionicons name="close" size={20} color="#18181b" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-8" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Intel Subject</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="bg-white p-5 rounded-3xl mb-6 border border-slate-100 shadow-sm text-zinc-900 font-black  uppercase text-xs"
                placeholderTextColor="#CBD5E1"
                placeholder="Notice Heading"
              />

              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Transmission Details</Text>
              <TextInput
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={5}
                className="bg-white p-5 rounded-3xl mb-6 border border-slate-100 shadow-sm text-zinc-700 leading-6 min-h-[150px] font-medium text-xs "
                placeholderTextColor="#CBD5E1"
                placeholder="Establish the facts..."
                textAlignVertical="top"
              />

              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Resource Link (Optional)</Text>
              <TextInput
                value={link}
                onChangeText={setLink}
                className="bg-white p-5 rounded-3xl mb-8 border border-slate-100 shadow-sm text-orange-500 font-bold text-xs"
                placeholderTextColor="#CBD5E1"
                placeholder="https://protocol-link.com/..."
                autoCapitalize="none"
              />

              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4">Visual Evidence</Text>
              <TouchableOpacity
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
                  if (!result.canceled) setImages(result.assets);
                }}
                activeOpacity={0.8}
                className="border-2 border-dashed border-slate-200 rounded-[32px] p-10 items-center justify-center mb-8 bg-slate-50"
              >
                <Ionicons name="images-outline" size={32} color="#CBD5E1" />
                <Text className="text-slate-400 font-black  uppercase text-[9px] mt-2">Attach Files</Text>
              </TouchableOpacity>

              {images.length > 0 && (
                <ScrollView horizontal className="mb-8" showsHorizontalScrollIndicator={false}>
                  {images.map((img, i) => <Image key={i} source={{ uri: img.uri }} className="w-24 h-24 rounded-2xl mr-4 border border-slate-100" />)}
                </ScrollView>
              )}

              <TouchableOpacity
                onPress={() => handleCreateNotice()}
                disabled={submitting}
                className={`py-5 rounded-[24px] items-center shadow-xl flex-row justify-center ${submitting ? 'bg-slate-100' : 'bg-zinc-900 shadow-black/20'}`}
              >
                {submitting ? <ActivityIndicator color="#f97316" /> : (
                  <>
                    <Text className="text-white font-black  uppercase tracking-widest text-xs mr-3">
                      {activeTab === 'global' && !isAdmin ? 'Deploy for ₹49' : 'Deploy Notice'}
                    </Text>
                    <Ionicons name="paper-plane" size={16} color="white" />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Modal>

        {/* Comments Modal */}
        <Modal visible={commentsModalVisible} animationType="slide" transparent onRequestClose={() => setCommentsModalVisible(false)}>
          <View className="flex-1 bg-zinc-900/40 justify-end">
            <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={() => setCommentsModalVisible(false)} />
            <View className="bg-white h-[80%] rounded-t-[48px] overflow-hidden shadow-2xl">
              <View className="w-12 h-1.5 bg-slate-100 rounded-full self-center mt-4 mb-2" />
              <View className="flex-row justify-between items-center px-8 py-6 border-b border-slate-100">
                <Text className="font-black  text-xl text-zinc-900 tracking-tighter uppercase leading-tight">
                  Transmission <Text className="text-orange-500">Log</Text> 💬
                </Text>
                <TouchableOpacity onPress={() => setCommentsModalVisible(false)} className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <Ionicons name="close" size={20} color="#18181b" />
                </TouchableOpacity>
              </View>

              {commentsLoading ? <ActivityIndicator className="mt-20" color="#f97316" size="large" /> : (
                <FlatList
                  data={noticeComments}
                  keyExtractor={c => c._id}
                  contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View className="flex-row mb-6">
                      <Image source={{ uri: item.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200" />
                      <View className="ml-4 flex-1 bg-slate-50 p-5 rounded-[28px] rounded-tl-sm border border-slate-100">
                        <Text className="font-black  text-[9px] text-orange-500 mb-1 uppercase tracking-widest">{item.commentor?.name || 'Anonymous'}</Text>
                        <Text className="text-slate-600 text-xs font-medium leading-5 ">"{item.text}"</Text>
                      </View>

                      {item.commentor?._id === user?._id && (
                        <TouchableOpacity
                          className="ml-2 mt-2"
                          onPress={async () => {
                            try {
                              await axios.post(`/notice/comment/delete/${item._id}`);
                              setNoticeComments(prev => prev.filter(c => c._id !== item._id));
                              setNotices(prev => prev.map(n => {
                                if (n._id === activeNoticeId) {
                                  return { ...n, comments: n.comments.filter(v => v !== item._id) };
                                }
                                return n;
                              }));
                            } catch (e) {
                              Alert.alert('Error', 'Failed to delete comment');
                            }
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#f43f5e" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  ListEmptyComponent={
                    <View className="items-center mt-10">
                      <Ionicons name="chatbubbles-outline" size={32} color="#CBD5E1" />
                      <Text className="text-center text-slate-400 mt-4 font-black  uppercase text-[10px] tracking-widest">No active discussion.</Text>
                    </View>
                  }
                />
              )}

              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View className="p-6 border-t border-slate-100 flex-row items-center bg-white pb-10">
                  <TextInput
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder="Establish contact..."
                    placeholderTextColor="#CBD5E1"
                    className="flex-1 bg-slate-50 border border-slate-100 text-zinc-900 rounded-2xl px-5 py-4 mr-3 font-black  uppercase text-[10px]"
                  />
                  <TouchableOpacity
                    onPress={postComment}
                    disabled={newComment.trim().length === 0}
                    className={`w-12 h-12 rounded-2xl items-center justify-center ${newComment.trim().length > 0 ? 'bg-zinc-900 shadow-lg' : 'bg-slate-50 border border-slate-100'}`}
                  >
                    <Ionicons name="send" size={18} color={newComment.trim().length > 0 ? "white" : "#CBD5E1"} />
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>

        {/* FULL SCREEN IMAGE PREVIEW MODAL */}
        <Modal visible={previewVisible} transparent={true} animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <View style={styles.previewContainer}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewVisible(false)} />
            <TouchableOpacity onPress={() => setPreviewVisible(false)} className="absolute top-12 right-8 z-50 w-12 h-12 bg-black/50 rounded-2xl items-center justify-center border border-white/20">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            {selectedImage && <Image source={{ uri: selectedImage }} className="w-full h-5/6" resizeMode="contain" />}
            <View className="absolute bottom-12 items-center w-full">
              <Text className="text-white/40 text-[9px] font-black  uppercase tracking-widest leading-tight">Secure Preview Protocol • Tap to Close</Text>
            </View>
          </View>
        </Modal>

        {/* PAYMENT MODAL */}
        <Modal visible={!!showPaymentParams} animationType="slide" transparent={false} onRequestClose={() => setShowPaymentParams(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View className="flex-row items-center justify-between p-6 border-b border-slate-100 bg-white">
              <Text className="text-zinc-900 font-black  uppercase text-sm tracking-tight">Secure <Text className="text-orange-500">Transaction</Text></Text>
              <Pressable onPress={() => { setShowPaymentParams(null); Alert.alert('Cancelled', 'Payment is required to post a global notice.'); }}>
                <Ionicons name="close" size={24} color="#18181b" />
              </Pressable>
            </View>
            {showPaymentParams?.html ? (
              <WebView
                source={{ html: showPaymentParams.html }}
                originWhitelist={["*"]}
                onMessage={handleWebViewMessage}
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
              />
            ) : (
              <View className="flex-1 bg-[#F8FAFC] justify-center items-center">
                <ActivityIndicator size="large" color="#f97316" />
              </View>
            )}
          </SafeAreaView>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  previewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.98)',
    justifyContent: 'center',
    alignItems: 'center'
  }
});

export default NoticeBoard;