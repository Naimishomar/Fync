import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, FlatList, Pressable, Linking, ScrollView, RefreshControl, Platform, StyleSheet, Animated, StatusBar, Modal, ActivityIndicator } from 'react-native'
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
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
import { AppBar, IconBtn, Empty, Button, SegmentedTabs, Tag, Sheet, FormField } from './ui/kit';
import { isFeatureOn } from '../constants/features';
import CommentsSheet, { CommentsApi } from './ui/CommentsSheet';

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
    <Animated.View style={{ opacity: pulseAnim }} className="bg-card rounded-2xl mb-3 border border-line p-4 mx-gutter">
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


const TABS = ['college', 'global'] as const;
const TAB_LABELS = { college: 'Campus', global: 'Global' };

const openNoticeLink = (link: string) =>
  Linking.openURL(/^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`).catch(() => Alert.alert("Error", "Could not open this link."));

/** One notice. Module scope + memo: rows update in place instead of remounting. */
const NoticeCard = memo(function NoticeCard({ item, userId, official, onLike, onComments, onDelete, onImage }: {
  item: NoticeType; userId?: string; official: boolean;
  onLike: (id: string, liked: boolean) => void; onComments: (id: string) => void;
  onDelete: (id: string) => void; onImage: (uri: string) => void;
}) {
  const isOwner = item.user?._id === userId;
  const avatarUrl = item.user?.avatar || `https://ui-avatars.com/api/?name=${item.user?.username || 'Admin'}`;
  const liked = !!item.liked_by?.includes(userId || '');
  const date = item.createdAt && !isNaN(new Date(item.createdAt).getTime())
    ? format(new Date(item.createdAt), "dd MMM yyyy · hh:mm a") : '';

  return (
    <View className="bg-card rounded-2xl mb-3 border border-line mx-gutter p-4">
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <ExpoImage source={{ uri: avatarUrl?.trim() ? avatarUrl : `https://ui-avatars.com/api/?name=User` }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper2 }} cachePolicy="disk" />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="font-semibold text-sm text-ink" numberOfLines={1}>{item.user?.name || "Official admin"}</Text>
          {date ? <Text className="text-ink-3 text-xs font-sans">{date}</Text> : null}
        </View>
        {official ? <Tag icon="shield-checkmark-outline" label="Official" /> : null}
      </View>

      <Text className="text-ink font-semibold text-base leading-snug mt-3">{item.title}</Text>
      <Text className="text-ink-2 text-sm leading-6 mt-1 font-sans">{item.description}</Text>

      {item.link ? (
        <Pressable
          onPress={() => openNoticeLink(item.link!)}
          accessibilityRole="link"
          className="flex-row items-center bg-paper-2 rounded-full self-start mt-3 px-4 active:opacity-70"
          style={{ minHeight: 40, gap: 8 }}
        >
          <Ionicons name="link-outline" size={16} color={C.ink} />
          <Text className="text-ink text-sm font-semibold" numberOfLines={1}>Open link</Text>
        </Pressable>
      ) : null}

      {item.image && item.image.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 12 }}>
          {item.image.map((imgUri, idx) => (
            <Pressable key={idx} onPress={() => onImage(imgUri)} accessibilityRole="imagebutton" accessibilityLabel={`Open image ${idx + 1}`} className="active:opacity-80">
              <ExpoImage
                source={{ uri: imgUri }}
                style={{ width: 256, height: 160, borderRadius: 16, backgroundColor: C.paper2 }}
                contentFit="cover"
                cachePolicy="disk"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View className="flex-row items-center mt-3 pt-2 border-t border-line" style={{ marginLeft: -11 }}>
        <Pressable
          onPress={() => onLike(item._id, liked)}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: liked }}
          className="flex-row items-center px-3 rounded-full active:opacity-70"
          style={{ minHeight: 44, gap: 6 }}
        >
          <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? C.danger : C.ink3} />
          <Text className="text-ink-2 text-sm font-semibold">{item.likes || 0}</Text>
        </Pressable>
        <Pressable
          onPress={() => onComments(item._id)}
          accessibilityRole="button"
          accessibilityLabel={`Comments, ${item.comments?.length || 0}`}
          className="flex-row items-center px-3 rounded-full active:opacity-70"
          style={{ minHeight: 44, gap: 6 }}
        >
          <Ionicons name="chatbubble-outline" size={19} color={C.ink3} />
          <Text className="text-ink-2 text-sm font-semibold">{item.comments?.length || 0}</Text>
        </Pressable>
        <View className="flex-1" />
        {isOwner ? (
          <IconBtn name="trash-outline" size={20} color={C.danger} onPress={() => onDelete(item._id)} accessibilityLabel="Delete notice" style={{ marginRight: -11 }} />
        ) : null}
      </View>
    </View>
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
  const [loadError, setLoadError] = useState(false);

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
      if (pageNum === 1) setLoadError(false);

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
        // Page 1 failing on a tab switch used to leave the other tab's notices up.
        if (pageNum === 1) { setNotices([]); setLoadError(true); }
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


  // Latest handlers behind stable callbacks, so memoized cards skip re-render.
  const likeRef = useRef(handleLikeNotice); likeRef.current = handleLikeNotice;
  const delRef = useRef(deleteNoticeItem); delRef.current = deleteNoticeItem;
  const commentsRef = useRef(openComments); commentsRef.current = openComments;
  const onLike = useCallback((id: string, liked: boolean) => likeRef.current(id, liked), []);
  const onDelete = useCallback((id: string) => delRef.current(id), []);
  const onComments = useCallback((id: string) => commentsRef.current(id), []);
  const onImage = useCallback((uri: string) => { setSelectedImage(uri); setPreviewVisible(true); }, []);

  const renderNotice = useCallback(({ item }: { item: NoticeType }) => (
    <NoticeCard item={item} userId={user?._id} official={activeTab === 'global'} onLike={onLike} onComments={onComments} onDelete={onDelete} onImage={onImage} />
  ), [user?._id, activeTab, onLike, onComments, onDelete, onImage]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar title="Notice board" onBack={() => navigation.goBack()} />
        <View className="px-gutter mb-3">
          <SegmentedTabs items={TABS} labels={TAB_LABELS} value={activeTab} onChange={setActiveTab} />
        </View>

        {loading && !refreshing ? (
          <View>{[1, 2, 3].map(i => <NoticeSkeleton key={i} />)}</View>
        ) : (
            <FlatList keyboardShouldPersistTaps="handled"
              data={notices}
              keyExtractor={item => item._id}
              renderItem={renderNotice}
              contentContainerStyle={{ paddingBottom: 120, paddingTop: 8 }}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl tintColor={C.brand[500]} refreshing={refreshing} onRefresh={onRefresh} />}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color={C.brand[500]} />
                </View>
              ) : <View className="h-10" />
            }
            ListEmptyComponent={loadError ? (
              <Empty icon="cloud-offline-outline" title="Couldn't load notices" action={<Button title="Try again" onPress={() => fetchNotices(1, false)} />} />
            ) : (
              <Empty icon="clipboard-outline" title="No notices yet" hint="New notices for your campus show up here." />
            )}
          />
        )}

        {/* A global notice is a paid boost for non-admins; no in-app digital sales at launch. */}
        {(activeTab !== 'global' || isAdmin || isFeatureOn('paidDigital')) && (
          <Pressable
            onPress={() => setCreateModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Post a notice"
            className="absolute right-gutter w-14 h-14 rounded-full bg-brand-500 items-center justify-center active:opacity-70 shadow-hair"
            style={{ bottom: bottomInset + 56 }}
          >
            <Ionicons name="create-outline" size={24} color={C.onBrand} />
          </Pressable>
        )}

        <Sheet
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          title={activeTab === 'global' ? 'New global notice' : 'New campus notice'}
          footer={
            <Button
              block
              variant="primary"
              icon="paper-plane-outline"
              title={activeTab === 'global' && !isAdmin ? 'Post for ₹49' : 'Post notice'}
              loading={submitting}
              onPress={() => handleCreateNotice()}
            />
          }
        >
          <View style={{ gap: 16 }}>
            <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Notice heading" />
            <FormField
              label="Details"
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={5}
              placeholder="What should people know?"
            />
            <FormField
              label="Link"
              hint="Optional"
              value={link}
              onChangeText={setLink}
              placeholder="https://"
              autoCapitalize="none"
              keyboardType="url"
            />
            <View style={{ gap: 6 }}>
              <Text className="font-semibold text-ink-2" style={{ fontSize: 13 }}>Images (optional)</Text>
              <Pressable
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
                  if (!result.canceled) setImages(result.assets);
                }}
                accessibilityRole="button"
                accessibilityLabel={images.length ? `Change images, ${images.length} selected` : 'Add images'}
                className="border border-dashed border-line rounded-2xl items-center justify-center bg-paper-2 active:opacity-70"
                style={{ minHeight: 96, gap: 8 }}
              >
                <Ionicons name="images-outline" size={28} color={C.ink3} />
                <Text className="text-ink-3 font-sans text-sm">{images.length ? `${images.length} selected` : 'Add images'}</Text>
              </Pressable>
              {images.length > 0 && (
                <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6 }}>
                  {images.map((img, i) => <ExpoImage key={i} source={{ uri: img.uri }} style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: C.paper2 }} contentFit="cover" />)}
                </ScrollView>
              )}
            </View>
          </View>
        </Sheet>

        <CommentsSheet
          visible={commentsModalVisible}
          onClose={() => setCommentsModalVisible(false)}
          resource={NOTICE_COMMENTS}
          targetId={activeNoticeId}
          currentUser={user}
          onCountChange={onCommentCount}
        />

        {/* Full-screen image preview: intentionally dark. */}
        <Modal visible={previewVisible} transparent={true} statusBarTranslucent animationType="fade" onRequestClose={() => setPreviewVisible(false)}>
          <View style={styles.previewContainer}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewVisible(false)} accessibilityLabel="Close preview" />
            <View className="absolute top-12 right-gutter z-50">
              <IconBtn name="close" color="#fff" overlay onPress={() => setPreviewVisible(false)} accessibilityLabel="Close preview" />
            </View>
            {selectedImage ? <ExpoImage source={{ uri: selectedImage }} style={{ width: '100%', height: '83%' }} contentFit="contain" cachePolicy="disk" /> : null}
            <View className="absolute items-center w-full" style={{ bottom: bottomInset + 48 }}>
              <Text className="text-white/60 text-xs font-sans">Tap anywhere to close</Text>
            </View>
          </View>
        </Modal>

        {/* PAYMENT MODAL */}
        <Modal visible={!!showPaymentParams} animationType="slide" transparent={false} statusBarTranslucent onRequestClose={() => setShowPaymentParams(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={['bottom']}>
            <AppBar
              title="Payment"
              right={<IconBtn name="close" onPress={() => { setShowPaymentParams(null); Alert.alert('Cancelled', 'Payment is required to post a global notice.'); }} accessibilityLabel="Cancel payment" />}
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
