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
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { compressImages } from '../utils/mediaUpload';
import axios from '../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
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
      quality: 0.9,
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
      // Compressed on-device, in parallel, before anything is sent.
      const compressed = await compressImages(images);
      compressed.forEach((uri, index) => {
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
        Toast.show({ type: 'success', text1: 'Mission Accomplished!' });
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
    <View className='flex-1 bg-paper'>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView 
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <SafeAreaView className='flex-1'>
          {/* Header */}
          <View className='flex-row items-center px-gutter py-4 justify-between'>
            <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
              <Ionicons name="arrow-back" size={22} color="#12100E" />
            </Pressable>
            <View className="items-center">
              <Text className="text-ink font-display uppercase text-label">Mission Briefing</Text>
              <Text className='text-xl font-display text-ink mt-1 uppercase'>Create <Text className="text-accent-text">Post</Text></Text>
            </View>
            <View className="w-11" />
          </View>

          <ScrollView className="flex-1 px-6 mt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Main Input Card */}
            <View className="bg-card rounded-sheet p-6 shadow-hair border border-line min-h-[350px] relative z-50">
              <View className="flex-row items-center mb-6">
                  <View className="w-1.5 h-6 bg-brand-500 rounded-full mr-3" />
                  <Text className="text-label font-display text-ink-3 uppercase">Share your thoughts</Text>
              </View>
              
              <TextInput
                placeholder="What's on your mind? Use @ to tag friends..."
                placeholderTextColor="#8B857E"
                value={description}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                multiline
                textAlignVertical="top"
                className="text-ink text-lg font-display flex-1 min-h-[180px]"
              />

              {showSuggestions && suggestions.length > 0 && (
                <View className="absolute top-32 left-6 right-6 bg-card border border-line rounded-card shadow-hair max-h-56 z-[100] overflow-hidden">
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {suggestions.map((user) => (
                            <TouchableOpacity
                                key={user._id}
                                onPress={() => handleSelection(user)}
                                className="flex-row items-center p-4 border-b border-line"
                            >
                                <Image source={{ uri: user.avatar || 'https://ui-avatars.com/api/?name=' + user.name }} className="w-10 h-10 rounded-card bg-paper-2" />
                                <View className="ml-4">
                                    <Text className="text-sm font-display text-ink uppercase">{user.name}</Text>
                                    <Text className="text-label font-display text-accent-text uppercase mt-0.5">@{user.username}</Text>
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
                      <Image source={{ uri }} className="h-24 w-24 rounded-card bg-paper-2 border border-line" />
                      <Pressable
                        onPress={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-ink h-7 w-7 rounded-full items-center justify-center border-2 border-white shadow-hair"
                      >
                        <Ionicons name="close" size={14} color="white" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Card Footer: Add Image Button */}
              <View className="flex-row items-center justify-between mt-6 pt-6 border-t border-line">
                <TouchableOpacity 
                  onPress={openGallery} 
                  className="flex-row items-center bg-paper-2 px-5 py-3 rounded-card border border-line"
                >
                  <Ionicons name="image" size={18} color="#F97316" />
                  <Text className="text-ink text-label font-display uppercase ml-3">Add Photos</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Settings Section */}
            <View className="flex-row items-center mt-10 mb-4" style={{ gap: 12 }}>
              <Text className="text-label font-display text-ink-3 uppercase">Post Settings</Text>
              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            </View>
            
            <View className="gap-y-4">
              <TouchableOpacity className="bg-card rounded-card flex-row items-center justify-between p-5 shadow-hair border border-line">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-card bg-paper-2 items-center justify-center border border-line">
                    <Ionicons name="location" size={18} color="#F97316" />
                  </View>
                  <Text className="text-ink font-display uppercase text-label ml-4">Add Location</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C4BEB6" />
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={() => setIsPrivate(!isPrivate)}
                className="bg-card rounded-card flex-row items-center justify-between p-5 shadow-hair border border-line"
              >
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-card items-center justify-center border ${isPrivate ? 'bg-paper-2 border-line' : 'bg-paper-2 border-line'}`}>
                    <Ionicons name={isPrivate ? "lock-closed" : "earth"} size={18} color={isPrivate ? "#F97316" : "#8B857E"} />
                  </View>
                  <View className="ml-4">
                      <Text className="text-ink font-display uppercase text-label">Visibility</Text>
                      <Text className={`text-label font-display uppercase mt-1 ${isPrivate ? 'text-accent-text' : 'text-ink-3'}`}>
                          {isPrivate ? "Private Protocol" : "Public Broadcast"}
                      </Text>
                  </View>
                </View>
                <View className={`w-10 h-6 rounded-full px-1 justify-center ${isPrivate ? 'bg-brand-500' : 'bg-paper-2'}`}>
                    <View className={`w-4 h-4 rounded-full bg-card shadow-hair ${isPrivate ? 'self-end' : 'self-start'}`} />
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
                className="bg-ink h-16 flex-row items-center justify-center border-2 border-ink rounded-md"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                      <Text className="text-white font-display uppercase text-xs">Initiate Post</Text>
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
