import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axios from '../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/auth.context';

interface UserSuggestion {
  _id: string;
  name: string;
  username: string;
  avatar: string;
}

function CreatePost() {
  const { user, setUser } = useAuth();
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mentions, setMentions] = useState<{ id: string, username: string }[]>([]);
  const navigation = useNavigation<any>();
  
  // Tagging states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  const searchUsers = async (query: string) => {
    try {
      const res = await axios.post('/user/search', { name: query });
      if (res.data.success) {
        setSuggestions(res.data.users);
      }
    } catch (e) {
      console.log('Error fetching users for tagging', e);
    }
  };

  useEffect(() => {
    if (showSuggestions) {
      const delayDebounceFn = setTimeout(() => {
        searchUsers(searchQuery);
      }, 1000);

      return () => clearTimeout(delayDebounceFn);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, showSuggestions]);

  const handleTextChange = (text: string) => {
    setDescription(text);
    const textBeforeCursor = text.slice(0, cursorPosition);
    const words = textBeforeCursor.split(/[\s\n]+/);
    const lastWord = words[words.length - 1];

    if (lastWord && lastWord.startsWith('@')) {
      const query = lastWord.substring(1);
      setSearchQuery(query);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelection = (user: UserSuggestion) => {
    const textBeforeCursor = description.slice(0, cursorPosition);
    const textAfterCursor = description.slice(cursorPosition);
    const words = textBeforeCursor.split(/[\s\n]+/);
    words.pop();
    const newTextBefore = words.length > 0 ? words.join(' ') + ' ' : '';
    const newDescription = `${newTextBefore}@${user.username} ${textAfterCursor}`;
    setDescription(newDescription);
    setShowSuggestions(false);
    if (!mentions.find(m => m.id === user._id)) {
        setMentions([...mentions, { id: user._id, username: user.username }]);
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 1,
    });
    if (!result.canceled) {
      const uris = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...uris]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

   const handleSubmit = async () => {
    if (images.length === 0) {
      Toast.show({ type: 'error', text1: 'Please select at least one image' });
      return;
    }
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('description', description);
      const getMimeType = (uri: string) => {
        if (uri.endsWith(".png")) return "image/png";
        if (uri.endsWith(".jpg") || uri.endsWith(".jpeg")) return "image/jpeg";
        return "image/jpeg";
      };
      images.forEach((uri, index) => {
        const filename = uri.split("/").pop() || `image_${index}.jpg`;
        formData.append("image", {
          uri,
          name: filename,
          type: getMimeType(uri),
        } as any);
      });
      formData.append('isPrivate', isPrivate ? 'true' : 'false');
      const mentionedIds = mentions.map(m => m.id);
      if (mentionedIds.length > 0) {
          formData.append('mentions', JSON.stringify(mentionedIds));
      }
      const res = await axios.post('/post/create', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Mission Accomplished! 🚀' });
        if (res.data.streakCount !== undefined && res.data.streakCount !== null) {
          setUser((prev: any) => ({ ...prev, streakCount: res.data.streakCount }));
        }
        setDescription('');
        setImages([]);
        setMentions([]);
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: res.data.message });
      }
    } catch (error) {
      console.log('Upload failed', error);
      Toast.show({ type: 'error', text1: 'Upload failed. Check connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className='flex-1 bg-white'>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={['#f97316', 'transparent']} className="absolute top-0 w-full h-64 opacity-30" />

      <KeyboardAvoidingView 
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <SafeAreaView className='flex-1'>
          {/* Header */}
          <View className='flex-row items-center px-8 py-4 justify-between'>
            <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-2xl bg-white shadow-xl shadow-black/5 border border-slate-50">
              <Ionicons name="arrow-back" size={22} color="#1e293b" />
            </Pressable>
            <View className="items-center">
              <Text className="text-slate-900 font-black uppercase text-2xs tracking-wide">Mission Briefing</Text>
              <Text className='text-xl font-black text-slate-900 mt-1 uppercase tracking-tighter'>Create <Text className="text-orange-500">Post</Text></Text>
            </View>
            <View className="w-11" />
          </View>

          <ScrollView className="flex-1 px-6 mt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Main Input Card */}
            <View className="bg-white rounded-4xl p-6 shadow-2xl shadow-black/5 border border-slate-50 min-h-[350px] relative z-50">
              <View className="flex-row items-center mb-6">
                  <View className="w-1.5 h-6 bg-orange-500 rounded-full mr-3" />
                  <Text className="text-2xs font-black text-slate-500 uppercase tracking-wide">Share your thoughts</Text>
              </View>
              
              <TextInput
                placeholder="What's on your mind? Use @ to tag friends..."
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                multiline
                textAlignVertical="top"
                className="text-slate-800 text-lg font-bold flex-1 min-h-[180px]"
              />

              {showSuggestions && suggestions.length > 0 && (
                <View className="absolute top-32 left-6 right-6 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-black/10 max-h-56 z-[100] elevation-5 overflow-hidden">
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {suggestions.map((user) => (
                            <TouchableOpacity
                                key={user._id}
                                onPress={() => handleSelection(user)}
                                className="flex-row items-center p-4 border-b border-slate-50"
                            >
                                <Image source={{ uri: user.avatar || 'https://ui-avatars.com/api/?name=' + user.name }} className="w-10 h-10 rounded-2xl bg-slate-100" />
                                <View className="ml-4">
                                    <Text className="text-sm font-black text-slate-900 uppercase tracking-tight">{user.name}</Text>
                                    <Text className="text-2xs font-black text-orange-500 uppercase tracking-wide mt-0.5">@{user.username}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
              )}

              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 pt-4">
                  {images.map((uri, index) => (
                    <View key={index} className="mr-4 relative">
                      <Image source={{ uri }} className="h-24 w-24 rounded-2xl bg-slate-100 border border-slate-50" />
                      <Pressable
                        onPress={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-slate-900 h-7 w-7 rounded-full items-center justify-center border-2 border-white shadow-md"
                      >
                        <Ionicons name="close" size={14} color="white" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Card Footer: Add Image Button */}
              <View className="flex-row items-center justify-between mt-6 pt-6 border-t border-slate-50">
                <TouchableOpacity 
                  onPress={openGallery} 
                  className="flex-row items-center bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100"
                >
                  <Ionicons name="image" size={18} color="#f97316" />
                  <Text className="text-slate-900 text-2xs font-black uppercase tracking-wide ml-3">Add Photos</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Settings Section */}
            <Text className="text-2xs font-black text-slate-500 uppercase tracking-wide mt-10 mb-4 ml-2">Post Settings</Text>
            
            <View className="gap-y-4">
              <TouchableOpacity className="bg-white rounded-3xl flex-row items-center justify-between p-5 shadow-2xl shadow-black/5 border border-slate-50">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-2xl bg-orange-50 items-center justify-center border border-orange-100">
                    <Ionicons name="location" size={18} color="#f97316" />
                  </View>
                  <Text className="text-slate-800 font-black uppercase text-2xs tracking-wide ml-4">Add Location</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setIsPrivate(!isPrivate)}
                className="bg-white rounded-3xl flex-row items-center justify-between p-5 shadow-2xl shadow-black/5 border border-slate-50"
              >
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-2xl items-center justify-center border ${isPrivate ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'}`}>
                    <Ionicons name={isPrivate ? "lock-closed" : "earth"} size={18} color={isPrivate ? "#f97316" : "#64748b"} />
                  </View>
                  <View className="ml-4">
                      <Text className="text-slate-800 font-black uppercase text-2xs tracking-wide">Visibility</Text>
                      <Text className={`text-2xs font-black uppercase tracking-widest mt-1 ${isPrivate ? 'text-orange-500' : 'text-slate-500'}`}>
                          {isPrivate ? "Private Protocol" : "Public Broadcast"}
                      </Text>
                  </View>
                </View>
                <View className={`w-10 h-6 rounded-full px-1 justify-center ${isPrivate ? 'bg-orange-500' : 'bg-slate-200'}`}>
                    <View className={`w-4 h-4 rounded-full bg-white shadow-sm ${isPrivate ? 'self-end' : 'self-start'}`} />
                </View>
              </TouchableOpacity>
            </View>

            <View className="h-40" />
          </ScrollView>

          {/* Action Button */}
          <View className="absolute bottom-10 left-8 right-8">
              <TouchableOpacity 
                onPress={handleSubmit}
                disabled={isLoading}
                className="bg-slate-900 h-16 rounded-3xl flex-row items-center justify-center shadow-2xl shadow-black/20"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                      <Text className="text-white font-black uppercase text-xs tracking-wide">Initiate Post</Text>
                      <Ionicons name="send" size={16} color="white" style={{ marginLeft: 10 }} />
                  </>
                )}
              </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default CreatePost;
