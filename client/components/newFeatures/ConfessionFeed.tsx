import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, TextInput, 
  ActivityIndicator, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform, Share 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import axios from '../../context/axiosConfig'; 
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native'; // Added navigation hook

interface Confession {
  _id: string;
  senderId: any; 
  collegeName: string;
  message: string;
  likes: string[];
  createdAt: string;
}

interface Comment {
  _id: string;
  text: string;
  commentor: { _id: string, username: string, avatar?: string };
  createdAt: string;
}

export default function ConfessionFeed() {
  const navigation = useNavigation<any>(); // Hook for navigation
  const { user } = useAuth();
  const CURRENT_USER_ID = user?._id || user?.id;

  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Create Modal
  const [isCreateVisible, setCreateVisible] = useState(false);
  const [newConfessionText, setNewConfessionText] = useState("");
  const [posting, setPosting] = useState(false);

  // Comment Modal
  const [isCommentVisible, setCommentVisible] = useState(false);
  const [activeConfessionId, setActiveConfessionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  // --- 1. FETCH CONFESSIONS ---
  const fetchConfessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/confession/get');
      if (response.data.success) {
        const sorted = response.data.confession.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setConfessions(sorted);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConfessions();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConfessions();
  };

  // --- 2. CREATE CONFESSION ---
  const handlePostConfession = async () => {
    if (!newConfessionText.trim()) return;
    setPosting(true);
    try {
      const response = await axios.post('/confession/create', { message: newConfessionText });
      if (response.data.success) {
        setNewConfessionText("");
        setCreateVisible(false);
        fetchConfessions(); 
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  // --- 3. LIKE ---
  const handleLike = async (id: string) => {
    setConfessions(prev => prev.map(item => {
      if (item._id === id) {
        const isLiked = item.likes.includes(CURRENT_USER_ID);
        const newLikes = isLiked 
          ? item.likes.filter(uid => uid !== CURRENT_USER_ID)
          : [...item.likes, CURRENT_USER_ID];
        return { ...item, likes: newLikes };
      }
      return item;
    }));

    try {
      await axios.post(`/confession/like/${id}`);
    } catch (error) { console.error("Like Error", error); }
  };

  // --- 4. HANDLE TAG PRESS (Navigate or Invite) ---
  const handleTagPress = async (targetName: string, isMention: boolean) => {
    if (!isMention) return; // Do nothing if it's just the college name

    try {
        // 1. Search for the user
        const response = await axios.post('/user/search', { name: targetName });
        const users = response.data.users || [];
        
        // 2. Find exact match (case insensitive)
        const matchedUser = users.find((u: any) => u.username.toLowerCase() === targetName.toLowerCase());

        if (matchedUser) {
            // 3. User Found -> Navigate to Profile
            // Ensure you have a 'PublicProfile' route defined in your navigation stack
            navigation.navigate('PublicProfile', { 
                user: matchedUser 
            });
        } else {
            // 4. User Not Found -> Show Invite Alert
            Alert.alert(
                "User Not Found",
                `@${targetName} isn't on the app yet. Invite them to see this confession?`,
                [
                    { text: "Cancel", style: "cancel" },
                    { 
                        text: "Invite", 
                        onPress: async () => {
                            try {
                                await Share.share({
                                    message: `Hey! Someone mentioned you (@${targetName}) in a confession on our app! Check it out here: https://yourapp.link/download`,
                                });
                            } catch (error) {
                                console.log(error);
                            }
                        } 
                    }
                ]
            );
        }
    } catch (error) {
        console.error("Search Error", error);
        Alert.alert("Error", "Could not verify user.");
    }
  };

  // --- 5. DELETE / REPORT ACTION ---
  const handleMenuAction = (item: Confession) => {
    const senderIdStr = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;
    const isMyPost = senderIdStr === CURRENT_USER_ID;

    if (isMyPost) {
        Alert.alert("Delete Post", "Are you sure? This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                try {
                    await axios.delete(`/confession/delete/${item._id}`);
                    setConfessions(prev => prev.filter(c => c._id !== item._id));
                } catch (err) { Alert.alert("Error", "Could not delete."); }
            }}
        ]);
    } else {
        Alert.alert("Report Post", "Is this inappropriate?", [
            { text: "Cancel", style: "cancel" },
            { text: "Report", style: "destructive", onPress: async () => {
                try {
                    await axios.post(`/confession/report/${item._id}`);
                    Alert.alert("Reported", "We will review this content.");
                } catch (err) { Alert.alert("Error", "Could not report."); }
            }}
        ]);
    }
  };

  // --- 6. COMMENTS ---
  const openComments = async (confessionId: string) => {
      setActiveConfessionId(confessionId);
      setCommentVisible(true);
      setLoadingComments(true);
      try {
          const res = await axios.get(`/confession/comments/${confessionId}`);
          if (res.data.success) {
              setComments(res.data.comments);
          }
      } catch (error) { console.error(error); } 
      finally { setLoadingComments(false); }
  };

  const postComment = async () => {
      if(!newCommentText.trim() || !activeConfessionId) return;
      try {
          const res = await axios.post(`/confession/comment/${activeConfessionId}`, { text: newCommentText });
          if(res.data.success) {
              const newComment = res.data.comment;
              newComment.commentor = { _id: CURRENT_USER_ID, username: user?.username || "You" }; 
              setComments(prev => [...prev, newComment]);
              setNewCommentText("");
          }
      } catch (error) { Alert.alert("Error", "Failed to comment."); }
  };

  const getMaskedIdentity = (nameObj: any) => {
    if (!nameObj) return "Anonymous";
    const id = typeof nameObj === 'string' ? nameObj : nameObj._id;
    if (id === CURRENT_USER_ID) return "You";
    if (nameObj.username) {
        const name = nameObj.username;
        if (name.length <= 2) return name;
        return `${name.slice(0, 2)}****${name.slice(-2)}`;
    }
    return `User-${id?.slice(-4) || '???'}`;
  };

  const renderCommentItem = ({ item }: { item: Comment }) => {
      const isMyComment = item.commentor?._id === CURRENT_USER_ID;
      return (
        <View className={`mb-3 p-3 rounded-xl border ${isMyComment ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-white/5 border-white/5'}`}>
            <View className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center">
                    <View className={`w-5 h-5 rounded-full items-center justify-center mr-2 ${isMyComment ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                        <MaterialCommunityIcons name={isMyComment ? "account" : "incognito"} size={12} color="white" />
                    </View>
                    <Text className={`font-bold text-xs ${isMyComment ? 'text-indigo-300' : 'text-gray-400'}`}>
                        {getMaskedIdentity(item.commentor)}
                    </Text>
                </View>
                <Text className="text-gray-600 text-[10px]">
                    {item.createdAt ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) : 'Just now'}
                </Text>
            </View>
            <Text className="text-gray-300 text-sm ml-7">{item.text}</Text>
        </View>
      );
  };

  const renderItem = ({ item }: { item: Confession }) => {
    const isLiked = item.likes.includes(CURRENT_USER_ID);
    const senderIdStr = typeof item.senderId === 'object' ? item.senderId._id : item.senderId;
    const isMyPost = senderIdStr === CURRENT_USER_ID;

    // Detect @Mention
    const firstWord = item.message.trim().split(/[\s\n]+/)[0];
    const isMention = firstWord.startsWith('@') && firstWord.length > 1;
    const displayTarget = isMention ? firstWord.substring(1) : item.collegeName;

    return (
      <View 
        className={`rounded-2xl mb-4 mx-4 p-5 shadow-lg border ${
            isMyPost 
            ? 'bg-indigo-900/10 border-indigo-500/30' 
            : 'bg-[#1e1e1e]/90 border-white/10'
        }`}
      >
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center">
                <View className={`w-8 h-8 rounded-full items-center justify-center border border-white/20 ${isMyPost ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                    <MaterialCommunityIcons name={isMyPost ? "account" : "incognito"} size={18} color="white" />
                </View>
                <View className="ml-3">
                    <Text className={`font-bold text-sm ${isMyPost ? 'text-indigo-300' : 'text-gray-200'}`}>
                        {getMaskedIdentity(item.senderId)}
                    </Text>
                    <Text className="text-gray-500 text-[10px]">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </Text>
                </View>
            </View>

            <TouchableOpacity onPress={() => handleMenuAction(item)} className="p-1">
                <Ionicons 
                    name={isMyPost ? "trash-outline" : "alert-circle-outline"} 
                    size={20} 
                    color={isMyPost ? "#ef4444" : "#6b7280"} 
                />
            </TouchableOpacity>
        </View>

        {/* Message */}
        <Text className="text-white text-base leading-6 font-medium mb-4">
            {item.message}
        </Text>

        {/* Footer */}
        <View className="flex-row items-center justify-between border-t border-white/5 pt-3">
            <View className="flex-row gap-6">
                <TouchableOpacity className="flex-row items-center" onPress={() => handleLike(item._id)}>
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#ec4899" : "#9ca3af"} />
                    <Text className={`ml-1.5 text-sm ${isLiked ? 'text-pink-500 font-bold' : 'text-gray-400'}`}>
                        {item.likes.length}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity className="flex-row items-center" onPress={() => openComments(item._id)}>
                    <Ionicons name="chatbubble-outline" size={20} color="#9ca3af" />
                    <Text className="ml-1.5 text-gray-400 text-sm">Comment</Text>
                </TouchableOpacity>
            </View>

            {/* 👇 UPDATED FOOTER LOGIC 👇 */}
            <TouchableOpacity 
                onPress={() => handleTagPress(displayTarget, isMention)}
                disabled={!isMention} // Only clickable if it's a mention
                className="flex-row items-center"
            >
                 <Ionicons name={isMention ? "at-outline" : "school-outline"} size={14} color="#6b7280" />
                 <Text className={`text-[10px] ml-1 ${isMention ? "text-indigo-300 font-bold underline" : "text-gray-600"}`}>
                    {displayTarget}
                 </Text>
            </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black">
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', 'rgba(0,0,0,0.85)', '#000000']} 
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1">
        <View className="px-5 pt-4 pb-2 flex-row justify-between items-center">
            <View>
                <Text className="text-white text-3xl font-black shadow-lg">Confessions 🤫</Text>
                <Text className="text-gray-400 text-xs font-medium mt-1">Your college secrets, safe & anonymous.</Text>
            </View>
            <TouchableOpacity onPress={() => setCreateVisible(true)} className="bg-indigo-600 w-10 h-10 rounded-full items-center justify-center shadow-lg shadow-indigo-500/30">
                <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
        </View>

        <FlatList
            data={confessions}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={!loading ? (
                <View className="items-center mt-20 opacity-50"><MaterialCommunityIcons name="message-text-outline" size={60} color="#fff" /><Text className="text-gray-400 mt-4">No confessions yet.</Text></View>
            ) : <ActivityIndicator size="large" color="#6366f1" className="mt-20" />}
        />

        {/* --- CREATE POST MODAL --- */}
        <Modal animationType="slide" transparent={true} visible={isCreateVisible} onRequestClose={() => setCreateVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end">
                <TouchableOpacity className="flex-1 bg-black/50 backdrop-blur-sm" activeOpacity={1} onPress={() => setCreateVisible(false)} />
                <View className="bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 p-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">New Confession</Text>
                        <TouchableOpacity onPress={() => setCreateVisible(false)}><Ionicons name="close" size={24} color="#9ca3af" /></TouchableOpacity>
                    </View>
                    <TextInput multiline placeholder="Type your secret... Use @Name to tag." placeholderTextColor="#555" value={newConfessionText} onChangeText={setNewConfessionText} className="bg-black/50 text-white p-4 rounded-xl text-base min-h-[120px] mb-4 border border-white/5" textAlignVertical="top" />
                    <TouchableOpacity onPress={handlePostConfession} disabled={posting}>
                        <LinearGradient colors={['#6366f1', '#a855f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-4 rounded-xl items-center shadow-lg shadow-indigo-500/30">
                            {posting ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-base">Post Anonymously</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>

        {/* --- COMMENTS MODAL --- */}
        <Modal animationType="slide" transparent={true} visible={isCommentVisible} onRequestClose={() => setCommentVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end">
                <TouchableOpacity className="flex-1 bg-black/80 backdrop-blur-md" activeOpacity={1} onPress={() => setCommentVisible(false)} />
                <View className="bg-black h-[60%] rounded-t-3xl border-t border-white/10 flex-col shadow-2xl">
                    <View className="p-4 border-b border-white/10 flex-row justify-between items-center bg-[#1a1a1a] rounded-t-3xl">
                        <Text className="text-white font-bold text-lg tracking-wide">Comments</Text>
                        <TouchableOpacity onPress={() => setCommentVisible(false)}><Ionicons name="close" size={24} color="#9ca3af" /></TouchableOpacity>
                    </View>

                    {loadingComments ? (
                        <ActivityIndicator color="#6366f1" className="mt-10" />
                    ) : (
                        <FlatList
                            data={comments}
                            keyExtractor={(item, index) => item._id || index.toString()}
                            contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                            renderItem={renderCommentItem}
                            ListEmptyComponent={
                                <View className="items-center mt-10">
                                    <MaterialCommunityIcons name="comment-text-outline" size={40} color="#333" />
                                    <Text className="text-gray-500 text-center mt-2">No comments yet. Be the first!</Text>
                                </View>
                            }
                        />
                    )}

                    <View className="p-4 border-t border-white/10 bg-black/40 flex-row items-center">
                        <TextInput 
                            value={newCommentText} 
                            onChangeText={setNewCommentText} 
                            placeholder="Add a comment..." 
                            placeholderTextColor="#666"
                            className="flex-1 bg-[#2a2a2a] text-white p-3 px-4 rounded-full mr-3 text-sm border border-white/5"
                        />
                        <TouchableOpacity onPress={postComment} disabled={!newCommentText.trim()}>
                            <View className={`w-10 h-10 rounded-full items-center justify-center ${!newCommentText.trim() ? 'bg-gray-700' : 'bg-indigo-600'}`}>
                                <Ionicons name="send" size={18} color="white" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>

      </SafeAreaView>
    </View>
  );
}