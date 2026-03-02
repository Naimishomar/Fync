import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  Modal, TextInput, ActivityIndicator, Alert, Pressable, Linking, ScrollView, RefreshControl,
  Platform, KeyboardAvoidingView, StyleSheet, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../context/axiosConfig'; 
import { useAuth } from '../context/auth.context';
import moment from 'moment';

const { width } = Dimensions.get('window');
// Ensure this exactly matches the email in your backend .env file
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
}

const NoticeBoard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'college' | 'global'>('college');
  const [notices, setNotices] = useState<NoticeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  // FIXED ADMIN CHECK: Added .trim() to catch invisible spaces
  const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

  const fetchNotices = async () => {
    try {
      setLoading(true);
      setNotices([]); 
      const endpoint = activeTab === 'college' ? '/notice/get' : '/notice/get/global';
      const res = await axios.get(endpoint);

      if (res.data?.success && Array.isArray(res.data?.notices)) {
        const sorted = res.data.notices.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotices(sorted);
      }
    } catch (error: any) {
      Alert.alert("Error", "Could not load notices.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [activeTab]);

  const onRefresh = () => {
      setRefreshing(true);
      fetchNotices();
  };

  const handleCreateNotice = async () => {
    if (!title.trim() || !desc.trim()) {
      Alert.alert("Required", "Title and Description are required.");
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

      const endpoint = (activeTab === 'global' && isAdmin) ? '/notice/create/global' : '/notice/create';
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

  const openComments = async (id: string) => {
      setActiveNoticeId(id);
      setCommentsModalVisible(true);
      setCommentsLoading(true);
      try {
          const res = await axios.get(`/notice/comment/all/${id}`);
          if(res.data.success) setNoticeComments(res.data.comments);
      } catch (error) {
          console.log(error);
      } finally {
          setCommentsLoading(false);
      }
  };

  const postComment = async () => {
      if(!newComment.trim() || !activeNoticeId) return;
      try {
          const res = await axios.post(`/notice/comment/add/${activeNoticeId}`, { text: newComment });
          if(res.data.success) {
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
          { text: "Delete", style: "destructive", onPress: async () => {
              try {
                  await axios.delete(`/notice/delete/${id}`);
                  setNotices(prev => prev.filter(n => n._id !== id));
              } catch (e) { Alert.alert("Error", "Could not delete notice"); }
          }}
      ])
  };

  const renderNotice = ({ item }: { item: NoticeType }) => {
    const isOwner = item.user?._id === user?._id;
    const avatarUrl = item.user?.avatar || `https://ui-avatars.com/api/?name=${item.user?.username || 'Admin'}`;
    
    return (
      <View className="bg-[#1e1e1e]/80 rounded-3xl mb-5 shadow-2xl border border-white/10 overflow-hidden mx-6 mt-2">
        <View className={`absolute left-0 top-0 bottom-0 w-1.5 ${activeTab === 'global' ? 'bg-red-500' : 'bg-pink-500'}`} />
        
        <View className="p-5 pl-6">
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                    <Text className="text-white font-bold text-lg leading-6">{item.title}</Text>
                    <Text className="text-gray-400 text-[10px] mt-1 uppercase tracking-wider font-bold">
                        {moment(item.createdAt).format('DD MMM, YYYY • hh:mm A')}
                    </Text>
                </View>
                {activeTab === 'global' && (
                    <View className="bg-red-500/20 px-2 py-1 rounded-md flex-row items-center ml-2 border border-red-500/30">
                        <MaterialCommunityIcons name="shield-check" size={12} color="#ef4444" />
                        <Text className="text-red-400 text-[10px] font-black ml-1 uppercase tracking-widest">Official</Text>
                    </View>
                )}
            </View>

            <Text className="text-gray-300 text-sm leading-6 mb-4">{item.description}</Text>

            {item.link && (
                <TouchableOpacity 
                    onPress={() => Linking.openURL(item.link!)}
                    activeOpacity={0.8}
                    className="flex-row items-center bg-[#2a2a2a] p-3 rounded-xl mb-4 self-start border border-white/10"
                >
                    <Ionicons name="link" size={16} color="#ec4899" />
                    <Text className="text-pink-400 text-xs font-bold ml-2 underline tracking-wider" numberOfLines={1}>
                        Open Attachment
                    </Text>
                </TouchableOpacity>
            )}

            {/* MULTIPLE IMAGES HORIZONTAL SIDEBAR */}
            {item.image && item.image.length > 0 && (
                <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.image}
                    keyExtractor={(img, idx) => idx.toString()}
                    className="mb-4"
                    renderItem={({ item: imgUri }) => (
                    <TouchableOpacity 
                        onPress={() => {
                            setSelectedImage(imgUri);
                            setPreviewVisible(true);
                        }}
                        activeOpacity={0.8}
                    >
                        <Image 
                            source={{ uri: imgUri }} 
                            className="w-64 h-40 rounded-2xl mr-3 bg-gray-800 border border-white/10" 
                            resizeMode="cover" 
                        />
                    </TouchableOpacity>
                    )}
                />
            )}

            <View className="h-[1px] bg-white/10 my-3" />

            <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <Image source={{ uri: avatarUrl }} className="w-8 h-8 rounded-full bg-gray-800 border border-white/10" />
                    <View className="ml-3">
                        <Text className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Posted By</Text>
                        <Text className="text-white text-xs font-bold mt-0.5">
                            {item.user?.name || "Official Admin"}
                        </Text>
                    </View>
                </View>

                <View className="flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => openComments(item._id)} className="flex-row items-center p-2 bg-white/5 rounded-full border border-white/5">
                        <Ionicons name="chatbubble-outline" size={18} color="#9ca3af" />
                        <Text className="text-gray-300 text-xs ml-2 font-bold">{item.comments?.length || 0}</Text>
                    </TouchableOpacity>
                    
                    {isOwner && (
                        <TouchableOpacity onPress={() => deleteNoticeItem(item._id)} className="p-2 bg-red-500/10 rounded-full border border-red-500/20">
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black">
      {/* Background Gradient */}
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-6 py-4 flex-row justify-between items-center z-10">
            <View>
                <Text className="text-3xl font-black italic text-white tracking-tighter">
                  NOTICE <Text className="text-pink-500">BOARD</Text> 📌
                </Text>
                <Text className="text-gray-400 text-xs mt-1 uppercase tracking-widest font-bold">Stay updated with latest announcements</Text>
            </View>
        </View>

        {/* Tabs */}
        <View className="flex-row mx-6 mt-2 mb-4 bg-[#2a2a2a] p-1 rounded-xl border border-white/10 shadow-lg">
            <TouchableOpacity 
                onPress={() => setActiveTab('college')}
                className={`flex-1 py-2.5 items-center rounded-lg transition-all ${
                    activeTab === 'college' ? 'bg-pink-600' : 'bg-transparent'
                }`}
            >
                <Text className={`font-black tracking-widest text-xs uppercase ${activeTab === 'college' ? 'text-white' : 'text-gray-400'}`}>College</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                onPress={() => setActiveTab('global')}
                className={`flex-1 py-2.5 items-center rounded-lg transition-all ${
                    activeTab === 'global' ? 'bg-red-600' : 'bg-transparent'
                }`}
            >
                <Text className={`font-black tracking-widest text-xs uppercase ${activeTab === 'global' ? 'text-white' : 'text-gray-400'}`}>Global</Text>
            </TouchableOpacity>
        </View>

        {/* List */}
        {loading && !refreshing ? (
            <ActivityIndicator size="large" color={activeTab === 'global' ? '#ef4444' : '#ec4899'} className="mt-20" />
        ) : (
            <FlatList 
                data={notices}
                keyExtractor={item => item._id}
                renderItem={renderNotice}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl tintColor={activeTab === 'global' ? '#ef4444' : '#ec4899'} refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20 opacity-50">
                        <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color="gray" />
                        <Text className="text-gray-400 mt-4 font-bold text-lg">No notices here yet.</Text>
                    </View>
                }
            />
        )}

        {/* BOTTOM FLOATING CREATE FAB - Only visible to normal users in college tab, or admins in both tabs */}
        {(activeTab === 'college' || (activeTab === 'global' && isAdmin)) && (
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setCreateModalVisible(true)}
                className={`absolute bottom-14 right-6 px-6 py-4 rounded-full shadow-2xl flex-row items-center border ${
                  activeTab === 'global' ? 'bg-red-600 border-red-500/50 shadow-red-500/30' : 'bg-pink-600 border-pink-500/50 shadow-pink-500/30'
                }`}
            >
                <Ionicons name="pencil" size={20} color="white" />
                <Text className="text-white font-black tracking-widest ml-2 uppercase text-sm">
                    {activeTab === 'global' ? 'Global Notice' : 'Post Notice'}
                </Text>
            </TouchableOpacity>
        )}

        {/* Create Modal */}
        <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModalVisible(false)}>
            <View className="flex-1 bg-[#1e1e1e]">
                <View className="flex-row justify-between items-center px-6 py-5 border-b border-white/10 bg-black/20">
                    <Text className="text-xl font-black text-white italic tracking-tighter">
                      NEW <Text className={activeTab === 'global' ? 'text-red-500' : 'text-pink-500'}>
                        {activeTab === 'global' ? 'GLOBAL NOTICE' : 'NOTICE'}
                      </Text>
                    </Text>
                    <TouchableOpacity onPress={() => setCreateModalVisible(false)} className="p-1 bg-white/10 rounded-full border border-white/10">
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                </View>
                <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                    
                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Subject</Text>
                    <TextInput 
                      value={title} 
                      onChangeText={setTitle} 
                      className="bg-[#2a2a2a] p-4 rounded-2xl mb-6 border border-white/10 text-white font-bold text-base" 
                      placeholderTextColor="#6b7280"
                      placeholder="Notice Heading" 
                    />

                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Description</Text>
                    <TextInput 
                      value={desc} 
                      onChangeText={setDesc} 
                      multiline 
                      numberOfLines={5} 
                      className="bg-[#2a2a2a] p-4 rounded-2xl mb-6 border border-white/10 text-white leading-6 min-h-[120px]" 
                      placeholderTextColor="#6b7280"
                      placeholder="Write details..." 
                      textAlignVertical="top" 
                    />

                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 ml-1">Link (Optional)</Text>
                    <TextInput 
                      value={link} 
                      onChangeText={setLink} 
                      className="bg-[#2a2a2a] p-4 rounded-2xl mb-8 border border-white/10 text-pink-400" 
                      placeholderTextColor="#6b7280"
                      placeholder="https://..." 
                      autoCapitalize="none" 
                    />

                    <TouchableOpacity 
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
                        if (!result.canceled) setImages(result.assets);
                      }} 
                      activeOpacity={0.8}
                      className="border-2 border-dashed border-white/20 rounded-3xl p-6 items-center justify-center mb-6 bg-[#2a2a2a]/50"
                    >
                        <View className="bg-white/5 p-4 rounded-full mb-3">
                          <Ionicons name="images-outline" size={32} color="#9ca3af" />
                        </View>
                        <Text className="text-gray-300 font-bold tracking-widest uppercase text-xs">Attach Images</Text>
                    </TouchableOpacity>

                    {images.length > 0 && (
                        <ScrollView horizontal className="mb-8" showsHorizontalScrollIndicator={false}>
                            {images.map((img, i) => <Image key={i} source={{ uri: img.uri }} className="w-24 h-24 rounded-2xl mr-3 border border-white/10" />)}
                        </ScrollView>
                    )}

                    <TouchableOpacity 
                      onPress={handleCreateNotice} 
                      disabled={submitting} 
                      className={`py-5 rounded-2xl items-center shadow-lg border flex-row justify-center ${
                        activeTab === 'global' ? 'bg-red-600 border-red-500/50' : 'bg-pink-600 border-pink-500/50'
                      }`}
                    >
                        {submitting ? <ActivityIndicator color="white" /> : (
                          <>
                            <Text className="text-white font-black text-lg tracking-widest uppercase mr-2">Publish</Text>
                            <Ionicons name="paper-plane" size={20} color="white" />
                          </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>

        {/* Comments Modal */}
        <Modal visible={commentsModalVisible} animationType="slide" transparent onRequestClose={() => setCommentsModalVisible(false)}>
            <View className="flex-1 bg-black/80 justify-end">
                <View className="bg-[#1e1e1e] h-[75%] rounded-t-3xl overflow-hidden border-t border-white/10 shadow-2xl">
                    <View className="flex-row justify-between items-center px-6 py-5 border-b border-white/10 bg-black/20">
                        <Text className="font-black italic text-xl text-white tracking-tighter">
                          COMMENTS <Text className="text-pink-500">💬</Text>
                        </Text>
                        <TouchableOpacity onPress={() => setCommentsModalVisible(false)} className="p-1 bg-white/10 rounded-full border border-white/10">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                    
                    {commentsLoading ? <ActivityIndicator className="mt-10" color="#ec4899" size="large" /> : (
                        <FlatList 
                            data={noticeComments}
                            keyExtractor={c => c._id}
                            contentContainerStyle={{ padding: 20 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({item}) => (
                                <View className="flex-row mb-5">
                                    <Image source={{ uri: item.commentor?.avatar || 'https://ui-avatars.com/api/?name=User' }} className="w-10 h-10 rounded-full bg-gray-800 border border-white/10" />
                                    <View className="ml-3 flex-1 bg-[#2a2a2a] p-4 rounded-2xl rounded-tl-sm border border-white/5">
                                        <Text className="font-bold text-xs text-pink-400 mb-1 tracking-wider">{item.commentor?.name || 'Anonymous'}</Text>
                                        <Text className="text-gray-200 text-sm leading-5">{item.text}</Text>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={
                              <View className="items-center opacity-50 mt-10">
                                <Ionicons name="chatbubbles-outline" size={48} color="gray" />
                                <Text className="text-center text-gray-400 mt-4 font-bold">No comments yet. Be the first!</Text>
                              </View>
                            }
                        />
                    )}

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View className="p-4 border-t border-white/10 flex-row items-center bg-black/40 pb-8">
                            <TextInput 
                              value={newComment} 
                              onChangeText={setNewComment} 
                              placeholder="Add a comment..." 
                              placeholderTextColor="#6b7280"
                              className="flex-1 bg-[#2a2a2a] border border-white/10 text-white rounded-full px-5 py-4 mr-3 font-medium" 
                            />
                            <TouchableOpacity 
                              onPress={postComment}
                              disabled={newComment.trim().length === 0}
                              className={`p-3.5 rounded-full border items-center justify-center ${
                                newComment.trim().length > 0 ? 'bg-pink-600 border-pink-500/50' : 'bg-[#2a2a2a] border-white/10'
                              }`}
                            >
                              <Ionicons name="send" size={20} color={newComment.trim().length > 0 ? "white" : "#6b7280"} style={{ marginLeft: 2 }} />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>

        {/* FULL SCREEN IMAGE PREVIEW MODAL */}
        <Modal 
            visible={previewVisible} 
            transparent={true} 
            animationType="fade"
            onRequestClose={() => setPreviewVisible(false)}
        >
            <View style={styles.previewContainer}>
                {/* Close Overlay Pressable */}
                <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setPreviewVisible(false)} />
                
                {/* Close Button UI */}
                <TouchableOpacity 
                    onPress={() => setPreviewVisible(false)}
                    className="absolute top-12 right-6 z-50 p-2 bg-black/50 rounded-full"
                >
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>

                {selectedImage && (
                    <Image 
                        source={{ uri: selectedImage }} 
                        className="w-full h-5/6"
                        resizeMode="contain" 
                    />
                )}
                
                <View className="absolute bottom-12 items-center w-full">
                    <Text className="text-white/60 text-xs font-bold tracking-widest uppercase">Tap anywhere to return</Text>
                </View>
            </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
    previewContainer: {
        flex: 1, 
        backgroundColor: 'rgba(0,0,0,0.95)', 
        justifyContent: 'center', 
        alignItems: 'center'
    }
});

export default NoticeBoard;