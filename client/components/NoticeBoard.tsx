import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  Modal, TextInput, ActivityIndicator, Alert, Pressable, Linking, ScrollView, RefreshControl,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../context/axiosConfig'; 
import { useAuth } from '../context/auth.context';
import moment from 'moment';

// --- CONFIG ---
// Replace this with your actual admin email or check user.role from your database
const ADMIN_EMAIL = "dev.fync@fync.com"; 

// --- TYPES ---
interface Comment {
    _id: string;
    text: string;
    commentor: { _id: string; name: string; avatar: string };
    createdAt: string;
}

interface NoticeType {
  _id: string;
  title: string;
  description: string; // Fixed typo from schema 'desciption' to 'description' based on controller
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
  comments: string[]; // Array of IDs
}

const NoticeBoard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'college' | 'global'>('college');
  const [notices, setNotices] = useState<NoticeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [activeNoticeId, setActiveNoticeId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [link, setLink] = useState('');
  const [images, setImages] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Comments State
  const [noticeComments, setNoticeComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // --- FETCH NOTICES ---
  const fetchNotices = async () => {
    try {
      const endpoint = activeTab === 'college' ? '/notice/get' : '/notice/get/global';
      const res = await axios.get(endpoint);
      if (res.data.success) {
        // Sort by newest
        const sorted = res.data.notices.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotices(sorted);
      }
    } catch (error) {
      console.log("Error fetching notices", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchNotices();
  }, [activeTab]);

  // --- CREATE NOTICE ---
  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true, // Allow multiple images
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages(result.assets);
    }
  };

  const handleCreateNotice = async () => {
    if (!title || !desc) {
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
        // @ts-ignore
        formData.append('noticeImage', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `notice_${index}.jpg`,
        });
      });

      // Determine endpoint based on what the user is trying to create
      // If user is Admin and on Global tab, create Global. Else College.
      const endpoint = (activeTab === 'global' && isAdmin) 
        ? '/notice/create/global' 
        : '/notice/create';

      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Alert.alert("Success", "Notice published successfully!");
        setCreateModalVisible(false);
        setTitle(''); setDesc(''); setLink(''); setImages([]);
        fetchNotices();
      }
    } catch (error) {
      console.log("Create notice error", error);
      Alert.alert("Error", "Failed to publish notice.");
    } finally {
      setSubmitting(false);
    }
  };

  // --- COMMENTS LOGIC ---
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
      Alert.alert("Delete Notice", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => {
              try {
                  await axios.delete(`/notice/delete/${id}`);
                  setNotices(prev => prev.filter(n => n._id !== id));
              } catch (e) { Alert.alert("Error", "Could not delete"); }
          }}
      ])
  };

  // --- RENDER NOTICE CARD ---
  const renderNotice = ({ item }: { item: NoticeType }) => {
    const isOwner = item.user._id === user?._id;
    
    return (
      <View className="bg-white rounded-xl mb-4 shadow-sm border border-gray-100 overflow-hidden mx-4 mt-2">
        {/* Decorative Left Border */}
        <View className={`absolute left-0 top-0 bottom-0 w-1.5 ${activeTab === 'global' ? 'bg-red-600' : 'bg-blue-600'}`} />
        
        <View className="p-4 pl-5">
            {/* Header */}
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1">
                    <Text className="text-gray-900 font-bold text-lg leading-6">{item.title}</Text>
                    <Text className="text-gray-400 text-xs mt-1">
                        {moment(item.createdAt).format('DD MMM, YYYY • hh:mm A')}
                    </Text>
                </View>
                {/* Official Badge for Global */}
                {activeTab === 'global' && (
                    <View className="bg-red-100 px-2 py-1 rounded flex-row items-center ml-2">
                        <MaterialCommunityIcons name="shield-check" size={12} color="#dc2626" />
                        <Text className="text-red-600 text-[10px] font-bold ml-1 uppercase">Official</Text>
                    </View>
                )}
            </View>

            {/* Description */}
            <Text className="text-gray-700 text-sm leading-5 mb-3">{item.description}</Text>

            {/* Link Attachment */}
            {item.link && (
                <TouchableOpacity 
                    onPress={() => Linking.openURL(item.link!)}
                    className="flex-row items-center bg-blue-50 p-2 rounded-lg mb-3 self-start border border-blue-100"
                >
                    <Ionicons name="link" size={16} color="#2563eb" />
                    <Text className="text-blue-600 text-xs font-semibold ml-2 underline" numberOfLines={1}>
                        Open Attachment / Link
                    </Text>
                </TouchableOpacity>
            )}

            {/* Images */}
            {item.image && item.image.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                    {item.image.map((img, idx) => (
                        <Image 
                            key={idx} 
                            source={{ uri: img }} 
                            className="w-48 h-32 rounded-lg mr-2 bg-gray-200" 
                            resizeMode="cover" 
                        />
                    ))}
                </ScrollView>
            )}

            <View className="h-[1px] bg-gray-100 my-2" />

            {/* Footer */}
            <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <Image 
                        source={{ uri: item.user.avatar || `https://ui-avatars.com/api/?name=${item.user.username}` }} 
                        className="w-6 h-6 rounded-full bg-gray-200" 
                    />
                    <Text className="text-gray-500 text-xs ml-2 font-medium">
                        {item.user.name || "Admin"}
                    </Text>
                </View>

                <View className="flex-row items-center gap-4">
                    <TouchableOpacity onPress={() => openComments(item._id)} className="flex-row items-center">
                        <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
                        <Text className="text-gray-500 text-xs ml-1">{item.comments.length}</Text>
                    </TouchableOpacity>
                    
                    {isOwner && (
                        <TouchableOpacity onPress={() => deleteNoticeItem(item._id)}>
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
    <View className="flex-1 bg-gray-50">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-4 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
            <View className="flex-row items-center justify-between">
                <View>
                    <Text className="text-2xl font-bold text-gray-900">Notice Board</Text>
                    <Text className="text-gray-500 text-xs">Stay updated with latest announcements</Text>
                </View>
                <View className="bg-gray-100 p-2 rounded-full">
                    <Ionicons name="notifications-outline" size={24} color="#374151" />
                </View>
            </View>

            {/* Tabs */}
            <View className="flex-row bg-gray-100 p-1 rounded-xl mt-4">
                <Pressable 
                    onPress={() => setActiveTab('college')} 
                    className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'college' ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`font-bold ${activeTab === 'college' ? 'text-blue-600' : 'text-gray-500'}`}>College</Text>
                </Pressable>
                <Pressable 
                    onPress={() => setActiveTab('global')} 
                    className={`flex-1 py-2 rounded-lg items-center ${activeTab === 'global' ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`font-bold ${activeTab === 'global' ? 'text-red-600' : 'text-gray-500'}`}>Global (Admin)</Text>
                </Pressable>
            </View>
        </View>

        {/* Content */}
        {loading ? (
            <ActivityIndicator size="large" color="#2563eb" className="mt-20" />
        ) : (
            <FlatList 
                data={notices}
                keyExtractor={item => item._id}
                renderItem={renderNotice}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchNotices()}} />}
                ListEmptyComponent={
                    <View className="items-center justify-center mt-20 opacity-50">
                        <MaterialCommunityIcons name="clipboard-text-off-outline" size={64} color="gray" />
                        <Text className="text-gray-500 mt-4">No notices posted yet.</Text>
                    </View>
                }
            />
        )}

        {/* Create Button Logic */}
        {/* Show if on College Tab OR (On Global Tab AND User is Admin) */}
        { (activeTab === 'college' || (activeTab === 'global' && isAdmin)) && (
            <TouchableOpacity 
                onPress={() => setCreateModalVisible(true)}
                className={`absolute bottom-6 right-6 px-5 py-4 rounded-full shadow-xl flex-row items-center ${activeTab === 'global' ? 'bg-red-600' : 'bg-blue-600'}`}
            >
                <Ionicons name="pencil" size={24} color="white" />
                <Text className="text-white font-bold ml-2">
                    {activeTab === 'global' ? 'Global Notice' : 'Post Notice'}
                </Text>
            </TouchableOpacity>
        )}

        {/* --- CREATE MODAL --- */}
        <Modal visible={createModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCreateModalVisible(false)}>
            <View className="flex-1 bg-white">
                <View className="flex-row justify-between items-center px-4 py-4 border-b border-gray-100">
                    <Text className="text-xl font-bold text-gray-900">
                        New {activeTab === 'global' ? 'Global' : ''} Notice
                    </Text>
                    <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                        <Ionicons name="close" size={28} color="gray" />
                    </TouchableOpacity>
                </View>
                <ScrollView className="p-4">
                    <Text className="text-gray-500 text-xs font-bold uppercase mb-2">Subject / Title</Text>
                    <TextInput 
                        value={title} onChangeText={setTitle} 
                        className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200 text-gray-900 font-bold" 
                        placeholder="e.g. Exam Schedule Changed"
                    />

                    <Text className="text-gray-500 text-xs font-bold uppercase mb-2">Description</Text>
                    <TextInput 
                        value={desc} onChangeText={setDesc} multiline numberOfLines={5}
                        className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200 text-gray-900 h-32" 
                        placeholder="Write the details here..." 
                        textAlignVertical="top"
                    />

                    <Text className="text-gray-500 text-xs font-bold uppercase mb-2">External Link (Optional)</Text>
                    <TextInput 
                        value={link} onChangeText={setLink} 
                        className="bg-gray-50 p-4 rounded-xl mb-6 border border-gray-200 text-blue-600" 
                        placeholder="https://..." 
                        autoCapitalize="none"
                    />

                    <TouchableOpacity onPress={pickImages} className="border-2 border-dashed border-gray-300 rounded-xl p-6 items-center justify-center mb-6 bg-gray-50">
                        <Ionicons name="images-outline" size={32} color="gray" />
                        <Text className="text-gray-400 mt-2 font-medium">Attach Images (Max 3)</Text>
                    </TouchableOpacity>

                    {images.length > 0 && (
                        <ScrollView horizontal className="mb-6">
                            {images.map((img, i) => (
                                <Image key={i} source={{ uri: img.uri }} className="w-24 h-24 rounded-lg mr-2" />
                            ))}
                        </ScrollView>
                    )}

                    <TouchableOpacity 
                        onPress={handleCreateNotice}
                        disabled={submitting}
                        className={`py-4 rounded-xl items-center shadow-md ${activeTab === 'global' ? 'bg-red-600' : 'bg-blue-600'}`}
                    >
                        {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Publish Notice</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </Modal>

        {/* --- COMMENTS MODAL --- */}
        <Modal visible={commentsModalVisible} animationType="slide" transparent onRequestClose={() => setCommentsModalVisible(false)}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white h-[70%] rounded-t-3xl overflow-hidden">
                    <View className="flex-row justify-between items-center px-4 py-3 border-b border-gray-200">
                        <Text className="font-bold text-lg text-gray-800">Comments</Text>
                        <TouchableOpacity onPress={() => setCommentsModalVisible(false)}>
                            <Ionicons name="close-circle" size={24} color="gray" />
                        </TouchableOpacity>
                    </View>
                    
                    {commentsLoading ? (
                        <ActivityIndicator className="mt-10" color="blue" />
                    ) : (
                        <FlatList 
                            data={noticeComments}
                            keyExtractor={c => c._id}
                            contentContainerStyle={{ padding: 16 }}
                            renderItem={({item}) => (
                                <View className="flex-row mb-4">
                                    <Image source={{ uri: item.commentor.avatar }} className="w-8 h-8 rounded-full bg-gray-200" />
                                    <View className="ml-3 flex-1 bg-gray-50 p-2 rounded-lg rounded-tl-none">
                                        <Text className="font-bold text-xs text-gray-800">{item.commentor.name}</Text>
                                        <Text className="text-gray-600 text-sm">{item.text}</Text>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={<Text className="text-center text-gray-400 mt-10">No comments yet.</Text>}
                        />
                    )}

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View className="p-3 border-t border-gray-200 flex-row items-center">
                            <TextInput 
                                value={newComment} onChangeText={setNewComment}
                                placeholder="Add a comment..." 
                                className="flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2"
                            />
                            <TouchableOpacity onPress={postComment}>
                                <Ionicons name="send" size={24} color="#2563eb" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
};

export default NoticeBoard;