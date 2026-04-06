import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axios from '../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

interface UserSuggestion {
  _id: string;
  name: string;
  username: string;
  avatar: string;
}

function CreatePost() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [mentions, setMentions] = useState<{ id: string, username: string }[]>([]);
  const navigation = useNavigation();
  
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
    
    // Check if we are currently typing a mention
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
    // Replace the @query with @username
    const textBeforeCursor = description.slice(0, cursorPosition);
    const textAfterCursor = description.slice(cursorPosition);
    
    const words = textBeforeCursor.split(/[\s\n]+/);
    words.pop(); // remove the typing part
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

      const res = await axios.post('/post/create',  
        formData,{
          headers:{
            'Content-Type': 'multipart/form-data'
          }
        });

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Posted successfully!' });
        setDescription('');
        setImages([]);
        setMentions([]);
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: res.data.message });
      }
    } catch (error) {
      console.log('Upload failed', error);
      console.log(error);
      Toast.show({ type: 'error', text1: 'Failed to upload' });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <SafeAreaView className='flex-1 bg-[#F0F4F8]'>
      {/* Header */}
      <View className='flex-row items-center px-5 py-3'>
        <Pressable onPress={() => navigation.goBack()} className="bg-white w-10 h-10 items-center justify-center rounded-full shadow-sm shadow-black/5">
          <Ionicons name="arrow-back-outline" size={20} color="#1A1A1A" />
        </Pressable>
        <View className="flex-1 items-center pr-10">
          <Text className='text-2xl font-bold text-gray-900'>Create <Text className="text-pink-500">Post</Text></Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 mt-2" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Main Input Card */}
        <View className="bg-white rounded-[24px] p-5 shadow-sm shadow-black/5 min-h-[300px] relative z-50">
          <Text className="text-[17px] font-bold text-gray-900 mb-2">Title</Text>
          <TextInput
            placeholder="Body Text (Optional)"
            placeholderTextColor="#cbd5e1"
            value={description}
            onChangeText={handleTextChange}
            onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
            multiline
            textAlignVertical="top"
            className="text-zinc-800 text-base flex-1 min-h-[150px]"
          />

          {showSuggestions && suggestions.length > 0 && (
            <View className="absolute top-28 left-4 right-4 bg-white border border-gray-100 rounded-2xl shadow-lg shadow-black/10 max-h-48 z-[100] elevation-5">
                <ScrollView keyboardShouldPersistTaps="handled">
                    {suggestions.map((user) => (
                        <Pressable
                            key={user._id}
                            onPress={() => handleSelection(user)}
                            className="flex-row items-center p-3 border-b border-gray-50"
                        >
                            <Image source={{ uri: user.avatar || 'https://ui-avatars.com/api/?name=User' }} className="w-8 h-8 rounded-full bg-gray-100" />
                            <View className="ml-3">
                                <Text className="text-sm font-bold text-gray-900">{user.name}</Text>
                                <Text className="text-xs text-gray-500">@{user.username}</Text>
                            </View>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
          )}

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 mb-2 flex-grow-0">
              {images.map((uri, index) => (
                <View key={index} className="mr-3 relative">
                  <Image source={{ uri }} className="h-20 w-20 rounded-xl bg-gray-100" />
                  <Pressable
                    onPress={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-black/70 h-6 w-6 rounded-full items-center justify-center"
                  >
                    <Text className="text-white text-xs font-bold">✕</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Card Footer: Icons & Badge */}
          <View className="flex-row items-center justify-between mt-auto pt-4 relative z-10 w-full">
            <View className="flex-row items-center gap-3">
              <Pressable onPress={openGallery} className="flex-row items-center gap-2 px-3 py-2 rounded-full border border-gray-200 items-center justify-center bg-gray-50/50">
                <Text className="text-gray-400 text-[11px] font-semibold">Select Photos</Text>
                <Ionicons name="image-outline" size={18} color="#475569" />
              </Pressable>
            </View>
            <View className="px-4 py-1.5 rounded-full border border-blue-200 bg-blue-50/50">
              <Text className="text-blue-400 text-[11px] font-semibold">Community</Text>
            </View>
          </View>
        </View>

        {/* Options List */}
        <View className="mt-4 gap-y-3">
          <Pressable className="bg-white rounded-[20px] flex-row items-center justify-between p-[18px] shadow-sm shadow-black/5">
            <View className="flex-row items-center gap-4">
              <View className="w-9 h-9 rounded-full border border-gray-200 items-center justify-center bg-gray-50">
                <Ionicons name="location-outline" size={18} color="#475569" />
              </View>
              <Text className="text-gray-900 font-bold text-[15px]">Add Location</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>

          <Pressable 
            onPress={() => setIsPrivate(!isPrivate)}
            className="bg-white rounded-[20px] flex-row items-center justify-between p-[18px] shadow-sm shadow-black/5"
          >
            <View className="flex-row items-center gap-4">
              <View className="w-9 h-9 rounded-full border border-gray-200 items-center justify-center bg-gray-50">
                <Ionicons name={isPrivate ? "lock-closed" : "lock-open-outline"} size={18} color="#475569" />
              </View>
              <Text className="text-gray-900 font-bold text-[15px]">
                {isPrivate ? "Share Post Privately" : "Share Post to Public"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </Pressable>
        </View>

        {/* Spacer for bottom buttons */}
        <View className="h-32" />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <View className="absolute bottom-8 left-5 right-5 flex-row gap-3 bg-transparent pointer-events-box-none">
        <Pressable 
          disabled={isLoading}
          onPress={handleSubmit} 
          className="flex-[1.5] bg-[#1a1a1a] rounded-full py-4 items-center justify-center shadow-md shadow-black/10 flex-row gap-2"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-[15px]">Post</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default CreatePost;
