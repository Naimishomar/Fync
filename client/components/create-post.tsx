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
  Modal,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { compressImages } from '../utils/mediaUpload';
import axios from '../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/auth.context';
import { useBottomInset } from '../constants/layout';
import { C } from '../constants/colors';
import { AppBar } from './ui/kit';

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
  const [location, setLocation] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  // The input only exists once "Other" is chosen. Showing it alongside the
  // college option made the sheet look like a form when the common answer is
  // one tap.
  const [otherOpen, setOtherOpen] = useState(false);
  const [mentions, setMentions] = useState<{ id: string, username: string }[]>([]);
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();
  
  // Tagging states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  useEffect(() => {
    if (showSuggestions) {
      // A slower response for an older query must not replace the current one.
      let stale = false;
      const delayDebounceFn = setTimeout(async () => {
        try {
          const res = await axios.post('/user/search', { name: searchQuery });
          if (!stale && res.data.success) setSuggestions(res.data.users || []);
        } catch (e) {
          console.log('Error fetching users for tagging', e);
        }
      }, 1000);

      return () => { stale = true; clearTimeout(delayDebounceFn); };
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
      if (location) formData.append('location', location);
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
        // The profile grid no longer refetches on every focus, so tell it that
        // this particular return trip does have something new to show.
        DeviceEventEmitter.emit('post:created');
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
          <AppBar title="Create Post" subtitle="Mission Briefing" onBack={() => navigation.goBack()} />

          <ScrollView className="flex-1 px-5 mt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Main Input Card */}
            <View className="bg-card rounded-sheet p-6 shadow-hair border border-line min-h-[350px] relative z-50">
              <View className="flex-row items-center mb-6">
                  <View className="w-1.5 h-6 bg-brand-500 rounded-full mr-3" />
                  <Text className="text-label font-display text-ink-3 uppercase">Share your thoughts</Text>
              </View>
              
              <TextInput
                placeholder="What's on your mind? Use @ to tag friends..."
                placeholderTextColor={C.ink3}
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
                                <Image source={{ uri: user.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || '') }} className="w-10 h-10 rounded-card bg-paper-2" />
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
                        hitSlop={10}
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
                  <Ionicons name="image" size={18} color={C.brand[500]} />
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
              {/* This had no onPress at all — it looked tappable and did
                  nothing. */}
              <TouchableOpacity
                onPress={() => { setOtherOpen(false); setCustomLocation(''); setLocationOpen(true); }}
                className="bg-card rounded-card flex-row items-center justify-between p-5 border-2 border-ink"
                accessibilityRole="button"
                accessibilityLabel={location ? `Location: ${location}. Change it.` : 'Add a location'}
              >
                <View className="flex-row items-center flex-1 min-w-0">
                  <View className="w-10 h-10 rounded-xl bg-paper items-center justify-center border-2 border-ink">
                    <Ionicons name="location" size={18} color={C.brand[600]} />
                  </View>
                  <View className="ml-4 flex-1 min-w-0">
                    <Text className="text-ink font-display uppercase text-label">
                      {location ? 'Location' : 'Add location'}
                    </Text>
                    {!!location && (
                      <Text className="font-sans text-ink-2 mt-[2px]" style={{ fontSize: 12 }} numberOfLines={1}>
                        {location}
                      </Text>
                    )}
                  </View>
                </View>

                {location ? (
                  <Pressable
                    onPress={() => setLocation(null)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Remove location"
                  >
                    <Ionicons name="close-circle" size={20} color={C.ink3} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={C.ink3} />
                )}
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
          <View className="absolute left-8 right-8" style={{ bottom: bottomInset + 40 }}>
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

      {/* Campus places, not coordinates.
          A GPS fix reverse-geocodes to the campus postcode — "Sector 62" tells
          a classmate nothing about where you actually are. These are the names
          students use, with free text for everywhere else. */}
      <Modal visible={locationOpen} transparent animationType="slide" onRequestClose={() => setLocationOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(18,16,14,0.45)' }}
        >
          <Pressable className="flex-1" onPress={() => { setOtherOpen(false); setLocationOpen(false); }} />

          <View
            className="bg-paper rounded-t-sheet border-t-2 border-x-2 border-ink px-5 pt-4"
            style={{ paddingBottom: bottomInset + 12 }}
          >
            <View className="items-center mb-3">
              <View className="h-1 w-10 bg-ink-3 rounded-full" />
            </View>

            <Text className="font-display text-xl text-ink">Add location</Text>
            <View className="h-[2px] bg-ink mt-1 mb-4" style={{ width: 44 }} />

            <View className="flex-row" style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!user?.college) return;
                  setLocation(user.college);
                  setOtherOpen(false);
                  setLocationOpen(false);
                }}
                disabled={!user?.college}
                className={`flex-1 items-center justify-center rounded-card border-2 border-ink ${user?.college ? 'bg-card' : 'bg-paper-2'}`}
                style={{ minHeight: 72 }}
                accessibilityRole="button"
                accessibilityLabel={user?.college ? `Use ${user.college}` : 'No college on your profile'}
              >
                <Ionicons name="school-outline" size={20} color={user?.college ? '#EA580C' : '#8B857E'} />
                <Text className={`font-display uppercase mt-1 ${user?.college ? 'text-ink' : 'text-ink-3'}`} style={{ fontSize: 12 }}>
                  College
                </Text>
                {!!user?.college && (
                  <Text className="font-sans text-ink-2 mt-[2px] px-2 text-center" style={{ fontSize: 10 }} numberOfLines={1}>
                    {user.college}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setOtherOpen(true)}
                className={`flex-1 items-center justify-center rounded-card border-2 border-ink ${otherOpen ? 'bg-brand-500' : 'bg-card'}`}
                style={{ minHeight: 72 }}
                accessibilityRole="button"
                accessibilityState={{ expanded: otherOpen }}
                accessibilityLabel="Enter a different location"
              >
                <Ionicons name="create-outline" size={20} color={C.ink} />
                <Text className="font-display text-ink uppercase mt-1" style={{ fontSize: 12 }}>Other</Text>
                <Text className="font-sans text-ink-2 mt-[2px]" style={{ fontSize: 10 }}>Type a place</Text>
              </TouchableOpacity>
            </View>

            {otherOpen && (
              <View className="flex-row items-center mt-4">
                <View className="flex-1 border-2 border-ink bg-card px-4 rounded-xl mr-2" style={{ minHeight: 48, justifyContent: 'center' }}>
                  <TextInput
                    value={customLocation}
                    onChangeText={setCustomLocation}
                    placeholder="e.g. CS Block, Room 204"
                    placeholderTextColor={C.ink3}
                    maxLength={80}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      const v = customLocation.trim();
                      if (!v) return;
                      setLocation(v);
                      setCustomLocation('');
                      setOtherOpen(false);
                      setLocationOpen(false);
                    }}
                    className="font-sans text-base text-ink"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const v = customLocation.trim();
                    if (!v) return;
                    setLocation(v);
                    setCustomLocation('');
                    setOtherOpen(false);
                    setLocationOpen(false);
                  }}
                  disabled={!customLocation.trim()}
                  className={`items-center justify-center rounded-xl border-2 border-ink ${customLocation.trim() ? 'bg-brand-500' : 'bg-paper'}`}
                  style={{ width: 56, height: 48 }}
                  accessibilityRole="button"
                  accessibilityLabel="Use this location"
                >
                  <Ionicons name="checkmark" size={20} color={customLocation.trim() ? '#12100E' : '#8B857E'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export default CreatePost;
