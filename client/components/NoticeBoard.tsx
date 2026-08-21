import React, { useState, useEffect, useRef, useCallback } from 'react';
import {View, Text, FlatList, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator, Pressable, Linking, ScrollView, RefreshControl, Platform, KeyboardAvoidingView, StyleSheet, Dimensions, Animated, StatusBar} from 'react-native'
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import { format } from 'date-fns';
import { RAZORPAY_KEY_ID } from '../constants/keys';
import { Alert } from './ui/AlertModal';

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

        // The server reports hasMore directly now; it used to derive a page
        // count from a full countDocuments on every request.
        setHasMore(Boolean(res.data.hasMore));
        setPage(pageNum);
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
        // The price now comes from the server catalog; sending an amount is ignored.
        const orderRes = await axios.post('/payment/order', { purpose: 'notice_boost' });
        const currentOrder = orderRes.data;
        const content = `
            <html>
            <body style="background-color: #F5F2EC;">
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
                    theme: { color: "#F97316" },
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

  const renderNotice = useCallback(({ item, index }: { item: NoticeType; index: number }) => {
    const isOwner = item.user?._id === user?._id;
    const avatarUrl = item.user?.avatar || `https://ui-avatars.com/api/?name=${item.user?.username || 'Admin'}`;

    return (
      <View
        className={`bg-card rounded-card mb-6 overflow-hidden mx-gutter ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}
        style={index === 0 ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
      >
        <View className="p-6">
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 mr-4">
              <Text className="text-ink font-display text-lg uppercase leading-tight">{item.title}</Text>
              <Text className="text-ink-3 text-label mt-1 uppercase font-display">
                {format(new Date(item.createdAt), "dd MMM, yyyy • hh:mm a")}
              </Text>
            </View>
            {activeTab === 'global' && (
              <View className="bg-danger/10 px-3 py-1 rounded-full flex-row items-center border border-danger/15">
                <MaterialCommunityIcons name="shield-check" size={12} color="#DB2777" />
                <Text className="text-danger text-label font-display ml-1 uppercase">Official</Text>
              </View>
            )}
          </View>

          <Text className="text-ink-2 text-sm leading-6 mb-6 font-medium">"{item.description}"</Text>

          {item.link && (
            <TouchableOpacity
              onPress={() => Linking.openURL(item.link!)}
              activeOpacity={0.8}
              className="flex-row items-center bg-paper-2 p-4 rounded-card mb-6 self-start border border-line"
            >
              <View className="w-8 h-8 bg-ink rounded-card items-center justify-center mr-3">
                <Ionicons name="link" size={14} color="white" />
              </View>
              <Text className="text-ink text-label font-display uppercase" numberOfLines={1}>
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
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={({ item: imgUri }) => (
                <TouchableOpacity
                  onPress={() => { setSelectedImage(imgUri); setPreviewVisible(true); }}
                  activeOpacity={0.8}
                >
                  <ExpoImage
                    source={{ uri: imgUri || 'https://via.placeholder.com/150' }}
                    className="w-64 h-40 rounded-card mr-4 bg-paper-2 border border-line"
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                </TouchableOpacity>
              )}
            />
          )}

          <View className="h-[1px] bg-paper-2 mb-6" />

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <ExpoImage source={{ uri: avatarUrl?.trim() ? avatarUrl : `https://ui-avatars.com/api/?name=User` }} className="w-10 h-10 rounded-card bg-paper-2 border border-line" cachePolicy="disk" />
              <View className="ml-3">
                <Text className="text-label text-ink-3 uppercase font-display">By Protocol</Text>
                <Text className="font-semibold text-base text-ink mt-0.5">
                  {item.user?.name || "Official Admin"}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => handleLikeNotice(item._id, !!item.liked_by?.includes(user?._id || ''))}
                className="flex-row items-center px-4 py-2 bg-paper-2 rounded-card border border-line"
              >
                <Ionicons
                  name={item.liked_by?.includes(user?._id || '') ? "heart" : "heart-outline"}
                  size={16}
                  color={item.liked_by?.includes(user?._id || '') ? "#DB2777" : "#C4BEB6"}
                />
                <Text className="text-ink text-label ml-2 font-display">{item.likes || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openComments(item._id)} className="flex-row items-center px-4 py-2 bg-paper-2 rounded-card border border-line">
                <Ionicons name="chatbubble-outline" size={16} color="#C4BEB6" />
                <Text className="text-ink text-label ml-2 font-display">{item.comments?.length || 0}</Text>
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity onPress={() => deleteNoticeItem(item._id)} className="w-10 h-10 bg-danger/10 rounded-card items-center justify-center border border-danger/15">
                  <Ionicons name="trash-outline" size={16} color="#DB2777" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [user?._id, activeTab, handleLikeNotice, openComments, deleteNoticeItem]);

  const NoticeSkeleton = React.memo(() => {
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
      <Animated.View style={{ opacity: pulseAnim }} className="bg-card rounded-sheet mb-6 border border-line p-card-pad mx-gutter">
        <View className="h-6 bg-paper-2 rounded w-3/4 mb-4" />
        <View className="h-3 bg-paper-2 rounded w-1/4 mb-10" />
        <View className="h-4 bg-paper-2 rounded w-full mb-3" />
        <View className="h-4 bg-paper-2 rounded w-4/5 mb-10" />
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-paper-2 rounded-card" />
            <View className="ml-3"><View className="h-4 bg-paper-2 rounded w-20" /></View>
          </View>
          <View className="flex-row gap-2">
            <View className="w-12 h-10 bg-paper-2 rounded-card" />
            <View className="w-12 h-10 bg-paper-2 rounded-card" />
          </View>
        </View>
      </Animated.View>
    );
  });

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-gutter pt-6">
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-3xl font-display text-ink uppercase leading-tight">
                Fync <Text className="text-accent-text">Board</Text>
              </Text>
              <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Announcement Protocol</Text>
            </View>
          </View>

          <View className="flex-row bg-card p-1.5 rounded-card mb-8 border border-line shadow-hair">
            <TouchableOpacity
              onPress={() => setActiveTab('college')}
              className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === 'college' ? 'bg-ink shadow-hair ' : 'bg-transparent'}`}
            >
              <Text className={`font-display text-label uppercase ${activeTab === 'college' ? 'text-white' : 'text-ink-3'}`}>Campus</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('global')}
              className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === 'global' ? 'bg-brand-500' : 'bg-transparent'}`}
            >
              <Text className={`font-display text-label uppercase ${activeTab === 'global' ? 'text-ink' : 'text-ink-3'}`}>Global</Text>
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
              refreshControl={<RefreshControl tintColor="#F97316" refreshing={refreshing} onRefresh={onRefresh} />}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color="#F97316" />
                </View>
              ) : <View className="h-10" />
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="clipboard-outline" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No Active Intel</Text>
                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">The board is currently silent.</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setCreateModalVisible(true)}
          className="absolute bottom-14 right-8 w-14 h-14 rounded-card bg-ink items-center justify-center"
        >
          <Ionicons name="pencil" size={24} color="white" />
        </TouchableOpacity>

        <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModalVisible(false)}>
          <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            <View className="flex-row justify-between items-center px-gutter py-6 border-b border-line bg-card">
              <Text className="text-xl font-display text-ink uppercase leading-tight">
                New <Text className="text-accent-text">{activeTab === 'global' ? 'Global Intel' : 'Campus Intel'}</Text>
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)} className="bg-paper-2 p-2 rounded-card border border-line">
                <Ionicons name="close" size={20} color="#12100E" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-card-pad" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

              <Text className="text-ink-3 text-label font-display uppercase mb-4">Intel Subject</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="font-semibold text-base text-ink bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair rounded-md"
                placeholderTextColor="#C4BEB6"
                placeholder="Notice Heading"
              />

              <Text className="text-ink-3 text-label font-display uppercase mb-4">Transmission Details</Text>
              <TextInput
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={5}
                className="bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair text-ink-2 leading-6 min-h-[150px] font-medium text-xs rounded-md"
                placeholderTextColor="#C4BEB6"
                placeholder="Establish the facts..."
                textAlignVertical="top"
              />

              <Text className="text-ink-3 text-label font-display uppercase mb-4">Resource Link (Optional)</Text>
              <TextInput
                value={link}
                onChangeText={setLink}
                className="bg-card p-5 mb-8 border-[1.5px] border-ink shadow-hair text-accent-text font-semibold text-xs rounded-md"
                placeholderTextColor="#C4BEB6"
                placeholder="https://protocol-link.com/..."
                autoCapitalize="none"
              />

              <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Visual Evidence</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
              </View>
              <TouchableOpacity
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
                  if (!result.canceled) setImages(result.assets);
                }}
                activeOpacity={0.8}
                className="border-2 border-dashed border-line rounded-sheet p-card-pad items-center justify-center mb-8 bg-paper-2"
              >
                <Ionicons name="images-outline" size={32} color="#C4BEB6" />
                <Text className="text-ink-3 font-display uppercase text-label mt-2">Attach Files</Text>
              </TouchableOpacity>

              {images.length > 0 && (
                <ScrollView horizontal className="mb-8" showsHorizontalScrollIndicator={false}>
                  {images.map((img, i) => <Image key={i} source={{ uri: img.uri || 'https://via.placeholder.com/150' }} className="w-24 h-24 rounded-card mr-4 border border-line" />)}
                </ScrollView>
              )}

              <TouchableOpacity
                onPress={() => handleCreateNotice()}
                disabled={submitting}
                className={`py-5 rounded-card items-center shadow-hair flex-row justify-center ${submitting ? 'bg-paper-2' : 'bg-ink '}`}
              >
                {submitting ? <ActivityIndicator color="#F97316" /> : (
                  <>
                    <Text className="text-white font-display uppercase text-xs mr-3">
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
          <View className="flex-1 bg-ink/40 justify-end">
            <TouchableOpacity activeOpacity={1} className="absolute inset-0" onPress={() => setCommentsModalVisible(false)} />
            <View className="bg-paper h-[80%] rounded-t-sheet overflow-hidden shadow-hair">
              <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mt-4 mb-2" />
              <View className="flex-row justify-between items-center px-gutter py-6 border-b border-line">
                <Text className="font-display text-ink uppercase text-h1">
                  Transmission <Text className="text-accent-text">Log</Text>
                </Text>
                <TouchableOpacity onPress={() => setCommentsModalVisible(false)} className="bg-paper-2 p-2 rounded-card border border-line">
                  <Ionicons name="close" size={20} color="#12100E" />
                </TouchableOpacity>
              </View>

              {commentsLoading ? <ActivityIndicator className="mt-20" color="#F97316" size="large" /> : (
                <FlatList
                  data={noticeComments}
                  keyExtractor={c => c._id}
                  contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View className="flex-row mb-6">
                  <ExpoImage source={{ uri: item.commentor?.avatar?.trim() ? item.commentor.avatar : 'https://ui-avatars.com/api/?name=User' }} className="w-10 h-10 rounded-card bg-paper-2 border border-line" cachePolicy="disk" />
                      <View className="ml-4 flex-1 bg-paper p-5 rounded-card rounded-tl-sm border border-line">
                        <Text className="font-display text-label text-accent-text mb-1 uppercase">{item.commentor?.name || 'Anonymous'}</Text>
                        <Text className="text-ink-2 text-xs font-medium leading-5">"{item.text}"</Text>
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
                          <Ionicons name="trash-outline" size={16} color="#DB2777" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  ListEmptyComponent={
                    <View className="items-center mt-10">
                      <Ionicons name="chatbubbles-outline" size={32} color="#C4BEB6" />
                      <Text className="font-sans text-sm text-center text-ink-3 mt-4">No active discussion.</Text>
                    </View>
                  }
                />
              )}

              <KeyboardAvoidingView behavior="padding">
                <View className="p-6 border-t border-line flex-row items-center bg-card pb-10">
                  <TextInput
                    value={newComment}
                    onChangeText={setNewComment}
                    placeholder="Establish contact..."
                    placeholderTextColor="#C4BEB6"
                    className="flex-1 bg-paper border-[1.5px] border-ink text-ink px-5 py-4 mr-3 font-display uppercase text-label rounded-md"
                  />
                  <TouchableOpacity
                    onPress={postComment}
                    disabled={newComment.trim().length === 0}
                    className={`w-12 h-12 rounded-card items-center justify-center ${newComment.trim().length > 0 ? 'bg-ink shadow-hair' : 'bg-paper-2 border border-line'}`}
                  >
                    <Ionicons name="send" size={18} color={newComment.trim().length > 0 ? "white" : "#C4BEB6"} />
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
            <TouchableOpacity onPress={() => setPreviewVisible(false)} className="absolute top-12 right-8 z-50 w-12 h-12 bg-black/50 rounded-card items-center justify-center border border-white/20">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            {selectedImage ? <ExpoImage source={{ uri: selectedImage }} className="w-full h-5/6" contentFit="contain" cachePolicy="disk" /> : null}
            <View className="absolute bottom-12 items-center w-full">
              <Text className="text-white/40 text-label font-display uppercase leading-tight">Secure Preview Protocol • Tap to Close</Text>
            </View>
          </View>
        </Modal>

        {/* PAYMENT MODAL */}
        <Modal visible={!!showPaymentParams} animationType="slide" transparent={false} onRequestClose={() => setShowPaymentParams(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F2EC' }}>
            <View className="flex-row items-center justify-between p-6 border-b border-line bg-card">
              <Text className="text-ink font-display uppercase text-sm">Secure <Text className="text-accent-text">Transaction</Text></Text>
              <Pressable onPress={() => { setShowPaymentParams(null); Alert.alert('Cancelled', 'Payment is required to post a global notice.'); }}>
                <Ionicons name="close" size={24} color="#12100E" />
              </Pressable>
            </View>
            {showPaymentParams?.html ? (
              <WebView
                source={{ html: showPaymentParams.html }}
                originWhitelist={["*"]}
                onMessage={handleWebViewMessage}
                style={{ flex: 1, backgroundColor: '#F5F2EC' }}
              />
            ) : (
              <View className="flex-1 bg-paper justify-center items-center">
                <ActivityIndicator size="large" color="#F97316" />
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
