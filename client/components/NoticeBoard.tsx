import React, { useState, useEffect, useRef, useCallback } from 'react';
import {View, Text, FlatList, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator, Pressable, Linking, ScrollView, RefreshControl, Platform, StyleSheet, Dimensions, Animated, StatusBar, KeyboardAvoidingView} from 'react-native'
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
import { useBottomInset } from '../constants/layout';
import { C } from '../constants/colors';
import { AppBar, IconBtn } from './ui/kit';
import { isFeatureOn } from '../constants/features';
import CommentsSheet, { CommentsApi } from './ui/CommentsSheet';

const { width } = Dimensions.get('window');
const ADMIN_EMAIL = "dev.fync@fync.com";

// Notice comments are flat (no replies); the rows already match the sheet's shape.
const NOTICE_COMMENTS: CommentsApi = {
  list: (id) => `/notice/comment/all/${id}`,
  add: (id) => `/notice/comment/add/${id}`,
  body: (text) => ({ text }),
  update: (id) => `/notice/comment/update/${id}`,
  remove: (id) => ({ method: 'post', url: `/notice/comment/delete/${id}` }),
};

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

// Outside the screen: declared inside, every render made a new component type,
// so the skeletons remounted and their pulse restarted.
const NoticeSkeleton = React.memo(() => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

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

const NoticeBoard = () => {
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();
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

  /* PAYMENT MODAL */
  const [showPaymentParams, setShowPaymentParams] = useState<any>(null);

  const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

  // Tab switches and page loads can overlap; only the latest request may land.
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);

  const fetchNotices = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if (pageNum > 1) {
      // onEndReached can fire several times before `loadingMore` re-renders.
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }
    else if (!refreshing) setLoading(true);
    const id = ++requestId.current;

    try {
      const endpoint = activeTab === 'college'
        ? `/notice/get?page=${pageNum}&limit=10`
        : `/notice/get/global?page=${pageNum}&limit=10`;

      const res = await axios.get(endpoint);
      if (id !== requestId.current) return;

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
      if (id !== requestId.current) return;
      if (error.response?.status === 404 && pageNum === 1) {
        setNotices([]);
        setHasMore(false);
      } else {
        console.error("Error fetching notices:", error);
      }
    } finally {
      if (pageNum > 1) loadingMoreRef.current = false;
      setLoadingMore(false);
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
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
            <body style="background-color: ${C.paper};">
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
                        name: ${JSON.stringify(user?.name || '')},
                        email: ${JSON.stringify(user?.email || '')},
                        contact: ${JSON.stringify(String(user?.mobileNumber || ''))}
                    },
                    theme: { color: "${C.brand[500]}" },
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
    let msg: any;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
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

  const openComments = (id: string) => {
    setActiveNoticeId(id);
    setCommentsModalVisible(true);
  };

  // `comments` is only ever read for its length.
  const onCommentCount = useCallback((id: string, count: number) => {
    setNotices(prev => prev.map(n => (n._id === id ? { ...n, comments: Array(count).fill('') } : n)));
  }, []);

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
                {item.createdAt && !isNaN(new Date(item.createdAt).getTime())
                  ? format(new Date(item.createdAt), "dd MMM, yyyy • hh:mm a")
                  : ''}
              </Text>
            </View>
            {activeTab === 'global' && (
              <View className="bg-danger/10 px-3 py-1 rounded-full flex-row items-center border border-danger/15">
                <MaterialCommunityIcons name="shield-check" size={12} color={C.fam.fun} />
                <Text className="text-danger text-label font-display ml-1 uppercase">Official</Text>
              </View>
            )}
          </View>

          <Text className="text-ink-2 text-sm leading-6 mb-6 font-medium">"{item.description}"</Text>

          {item.link && (
            <TouchableOpacity
              onPress={() => Linking.openURL(/^[a-z][a-z0-9+.-]*:/i.test(item.link!) ? item.link! : `https://${item.link}`).catch(() => Alert.alert("Error", "Could not open this link."))}
              activeOpacity={0.8}
              className="flex-row items-center bg-paper-2 p-4 rounded-card mb-6 self-start border border-line"
            >
              <View className="w-8 h-8 bg-ink rounded-card items-center justify-center mr-3">
                <Ionicons name="link" size={14} color={C.paper} />
              </View>
              <Text className="text-ink text-label font-display uppercase" numberOfLines={1}>
                Open Attachment
              </Text>
            </TouchableOpacity>
          )}

          {item.image && item.image.length > 0 && (
            <FlatList keyboardShouldPersistTaps="handled"
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
                    source={{ uri: imgUri }}
                    style={{ width: 256, height: 160, borderRadius: 20, marginRight: 16, backgroundColor: C.paper2, borderWidth: 1, borderColor: C.line }}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                </TouchableOpacity>
              )}
            />
          )}

          <View className="h-[1px] bg-paper-2 mb-6" />

          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center flex-1 mr-3" style={{ minWidth: 0 }}>
              <ExpoImage source={{ uri: avatarUrl?.trim() ? avatarUrl : `https://ui-avatars.com/api/?name=User` }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper2, borderWidth: 1, borderColor: C.line }} cachePolicy="disk" />
              <View className="ml-3 flex-1">
                <Text className="text-label text-ink-3 uppercase font-display">By Protocol</Text>
                <Text className="font-semibold text-base text-ink mt-0.5" numberOfLines={1}>
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
                  color={item.liked_by?.includes(user?._id || '') ? C.fam.fun : C.ink4}
                />
                <Text className="text-ink text-label ml-2 font-display">{item.likes || 0}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openComments(item._id)} className="flex-row items-center px-4 py-2 bg-paper-2 rounded-card border border-line">
                <Ionicons name="chatbubble-outline" size={16} color={C.ink4} />
                <Text className="text-ink text-label ml-2 font-display">{item.comments?.length || 0}</Text>
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity onPress={() => deleteNoticeItem(item._id)} className="w-10 h-10 bg-danger/10 rounded-card items-center justify-center border border-danger/15">
                  <Ionicons name="trash-outline" size={16} color={C.fam.fun} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [user?._id, activeTab, handleLikeNotice, openComments, deleteNoticeItem]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Fync Board" onBack={() => navigation.goBack()} />
        <View className="px-gutter">
          <View className="flex-row bg-card p-1.5 rounded-card mb-8 border border-line shadow-hair">
            <TouchableOpacity
              onPress={() => setActiveTab('college')}
              className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === 'college' ? 'bg-ink shadow-hair ' : 'bg-transparent'}`}
            >
              <Text className={`font-display text-label uppercase ${activeTab === 'college' ? 'text-paper' : 'text-ink-3'}`}>Campus</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('global')}
              className={`flex-1 py-3.5 items-center rounded-xl ${activeTab === 'global' ? 'bg-brand-500' : 'bg-transparent'}`}
            >
              <Text className={`font-display text-label uppercase ${activeTab === 'global' ? 'text-on-brand' : 'text-ink-3'}`}>Global</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && !refreshing ? (
          <View>{[1, 2, 3].map(i => <NoticeSkeleton key={i} />)}</View>
        ) : (
            <FlatList keyboardShouldPersistTaps="handled"
              data={notices}
              keyExtractor={item => item._id}
              renderItem={renderNotice}
              contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl tintColor={C.brand[500]} refreshing={refreshing} onRefresh={onRefresh} />}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color={C.brand[500]} />
                </View>
              ) : <View className="h-10" />
            )}
            ListEmptyComponent={
              <View className="items-center justify-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="clipboard-outline" size={32} color={C.ink4} />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No Active Intel</Text>
                <Text className="font-sans text-sm text-ink-4 mt-2 text-center">The board is currently silent.</Text>
              </View>
            }
          />
        )}

        {/* A global notice is a paid boost for non-admins; no in-app digital sales at launch. */}
        {(activeTab !== 'global' || isAdmin || isFeatureOn('paidDigital')) && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setCreateModalVisible(true)}
            className="absolute right-8 w-14 h-14 rounded-card bg-ink items-center justify-center" style={{ bottom: bottomInset + 56 }}
          >
            <Ionicons name="pencil" size={24} color={C.paper} />
          </TouchableOpacity>
        )}

        <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModalVisible(false)}>
          <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
            <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <StatusBar barStyle={C.barStyle} />
            <AppBar
              inset={false}
              title={activeTab === 'global' ? 'New Global Intel' : 'New Campus Intel'}
              right={<IconBtn name="close" onPress={() => setCreateModalVisible(false)} />}
            />
            <ScrollView keyboardShouldPersistTaps="handled" className="px-gutter py-card-pad" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

              <Text className="text-ink-3 text-label font-display uppercase mb-4">Intel Subject</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="font-semibold text-base text-ink bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair rounded-md"
                placeholderTextColor={C.ink4}
                placeholder="Notice Heading"
              />

              <Text className="text-ink-3 text-label font-display uppercase mb-4">Transmission Details</Text>
              <TextInput
                value={desc}
                onChangeText={setDesc}
                multiline
                numberOfLines={5}
                className="bg-card p-5 mb-6 border-[1.5px] border-ink shadow-hair text-ink-2 leading-6 min-h-[150px] font-medium text-xs rounded-md"
                placeholderTextColor={C.ink4}
                placeholder="Establish the facts..."
                textAlignVertical="top"
              />

              <Text className="text-ink-3 text-label font-display uppercase mb-4">Resource Link (Optional)</Text>
              <TextInput
                value={link}
                onChangeText={setLink}
                className="bg-card p-5 mb-8 border-[1.5px] border-ink shadow-hair text-accent-text font-semibold text-xs rounded-md"
                placeholderTextColor={C.ink4}
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
                <Ionicons name="images-outline" size={32} color={C.ink4} />
                <Text className="text-ink-3 font-display uppercase text-label mt-2">Attach Files</Text>
              </TouchableOpacity>

              {images.length > 0 && (
                <ScrollView keyboardShouldPersistTaps="handled" horizontal className="mb-8" showsHorizontalScrollIndicator={false}>
                  {images.map((img, i) => <Image key={i} source={{ uri: img.uri }} className="w-24 h-24 rounded-card mr-4 border border-line" />)}
                </ScrollView>
              )}

              <TouchableOpacity
                onPress={() => handleCreateNotice()}
                disabled={submitting}
                className={`py-5 rounded-card items-center shadow-hair flex-row justify-center ${submitting ? 'bg-paper-2' : 'bg-ink '}`}
              >
                {submitting ? <ActivityIndicator color={C.brand[500]} /> : (
                  <>
                    <Text className="text-paper font-display uppercase text-xs mr-3">
                      {activeTab === 'global' && !isAdmin ? 'Deploy for ₹49' : 'Deploy Notice'}
                    </Text>
                    <Ionicons name="paper-plane" size={16} color={C.paper} />
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        <CommentsSheet
          visible={commentsModalVisible}
          onClose={() => setCommentsModalVisible(false)}
          resource={NOTICE_COMMENTS}
          targetId={activeNoticeId}
          currentUser={user}
          onCountChange={onCommentCount}
        />

        {/* FULL SCREEN IMAGE PREVIEW MODAL */}
        <Modal visible={previewVisible} transparent={true} animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <View style={styles.previewContainer}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewVisible(false)} />
            <TouchableOpacity onPress={() => setPreviewVisible(false)} className="absolute top-12 right-8 z-50 w-12 h-12 bg-black/50 rounded-card items-center justify-center border border-white/20">
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            {selectedImage ? <ExpoImage source={{ uri: selectedImage }} style={{ width: '100%', height: '83%' }} contentFit="contain" cachePolicy="disk" /> : null}
            <View className="absolute items-center w-full" style={{ bottom: bottomInset + 48 }}>
              <Text className="text-white/40 text-label font-display uppercase leading-tight">Secure Preview Protocol • Tap to Close</Text>
            </View>
          </View>
        </Modal>

        {/* PAYMENT MODAL */}
        <Modal visible={!!showPaymentParams} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={() => setShowPaymentParams(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={['bottom']}>
            <AppBar
              title="Secure Transaction"
              right={<IconBtn name="close" onPress={() => { setShowPaymentParams(null); Alert.alert('Cancelled', 'Payment is required to post a global notice.'); }} />}
            />
            {showPaymentParams?.html ? (
              <WebView
                source={{ html: showPaymentParams.html }}
                originWhitelist={["*"]}
                onMessage={handleWebViewMessage}
                style={{ flex: 1, backgroundColor: C.paper }}
              />
            ) : (
              <View className="flex-1 bg-paper justify-center items-center">
                <ActivityIndicator size="large" color={C.brand[500]} />
              </View>
            )}
          </SafeAreaView>
        </Modal>

      </View>
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
