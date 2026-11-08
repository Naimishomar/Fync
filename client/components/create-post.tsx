import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter,
  Switch,
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
import { AppBar, Button, Card, Divider, IconBtn, Label, ListRow, Sheet, FormField } from './ui/kit';
import Avatar from './Avatar';
import { Image as ExpoImage } from 'expo-image';
import { getFullUrl } from '../utils/imageUtils';

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
      Toast.show({ type: 'error', text1: 'Photo access needed', text2: 'Allow photo access in Settings to add images.' });
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
        Toast.show({ type: 'success', text1: 'Posted' });
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

  const applyCustomLocation = () => {
    const v = customLocation.trim();
    if (!v) return;
    setLocation(v);
    setCustomLocation('');
    setOtherOpen(false);
    setLocationOpen(false);
  };

  return (
    <View className='flex-1 bg-paper'>
      <StatusBar barStyle={C.barStyle} />

      <KeyboardAvoidingView 
        behavior="padding"
        style={{ flex: 1 }}
      >
        <SafeAreaView className='flex-1' edges={['bottom']}>
          <AppBar title="Create post" onBack={() => navigation.goBack()} />

          <ScrollView className="flex-1 px-gutter mt-2" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Main Input Card */}
            <View className="bg-card rounded-2xl p-4 border border-line min-h-[320px] relative z-50">
              <TextInput
                placeholder="What's on your mind? Use @ to tag friends…"
                placeholderTextColor={C.ink3}
                value={description}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.start)}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Post text"
                className="text-ink text-base font-sans flex-1 min-h-[180px]"
              />

              {showSuggestions && suggestions.length > 0 && (
                <View className="absolute top-32 left-4 right-4 bg-card border border-line rounded-2xl shadow-hair max-h-56 z-[100] overflow-hidden">
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12 }}>
                        {suggestions.map((user) => (
                            <ListRow
                                key={user._id}
                                onPress={() => handleSelection(user)}
                                leading={<Avatar user={user as any} size={40} showBadge={false} />}
                                title={user.name}
                                subtitle={`@${user.username}`}
                                chevron={false}
                            />
                        ))}
                    </ScrollView>
                </View>
              )}

              {images.length > 0 && (
                <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} className="mt-3 pt-3">
                  {images.map((uri, index) => (
                    <View key={index} className="mr-3 relative">
                      <ExpoImage source={{ uri }} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: C.paper2 }} />
                      <Pressable
                        onPress={() => removeImage(index)}
                        hitSlop={12}
                        className="absolute -top-2 -right-2 bg-ink h-7 w-7 rounded-full items-center justify-center active:opacity-85"
                        accessibilityRole="button"
                        accessibilityLabel="Remove photo"
                      >
                        <Ionicons name="close" size={14} color={C.paper} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Card Footer: Add Image Button */}
              <View className="flex-row items-center mt-4 pt-4 border-t border-line">
                <Button small icon="image-outline" title="Add photos" onPress={openGallery} />
              </View>
            </View>

            {/* Settings Section */}
            <Label style={{ marginTop: 24, marginBottom: 8 }}>Post settings</Label>

            <Card style={{ paddingHorizontal: 16 }}>
              {/* This had no onPress at all — it looked tappable and did
                  nothing. */}
              <ListRow
                onPress={() => { setOtherOpen(false); setCustomLocation(''); setLocationOpen(true); }}
                icon="location-outline"
                title={location ? 'Location' : 'Add location'}
                subtitle={location || undefined}
                accessibilityLabel={location ? `Location: ${location}. Change it.` : 'Add a location'}
                right={location ? (
                  <Pressable
                    onPress={() => setLocation(null)}
                    hitSlop={12}
                    className="active:opacity-85"
                    accessibilityRole="button"
                    accessibilityLabel="Remove location"
                  >
                    <Ionicons name="close-circle" size={20} color={C.ink3} />
                  </Pressable>
                ) : undefined}
                chevron={!location}
              />
              <Divider />
              <ListRow
                onPress={() => setIsPrivate(!isPrivate)}
                icon={isPrivate ? 'lock-closed-outline' : 'earth-outline'}
                title="Visibility"
                subtitle={isPrivate ? 'Private — only you can see it' : 'Public'}
                accessibilityLabel={`Visibility: ${isPrivate ? 'private' : 'public'}. Toggle.`}
                right={<Switch value={isPrivate} onValueChange={setIsPrivate} trackColor={{ true: C.brand[500], false: C.line }} thumbColor={C.white} />}
              />
            </Card>

            <View className="h-4" />
          </ScrollView>

          {/* Action Button: an ordinary footer under the ScrollView. Floating it
              absolutely covered the caption while typing. The SafeAreaView
              already supplies the bottom inset. */}
          <View className="px-gutter pt-3 pb-3">
            <Button variant="primary" block icon="send" title="Post" loading={isLoading} onPress={handleSubmit} />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Campus places, not coordinates.
          A GPS fix reverse-geocodes to the campus postcode — "Sector 62" tells
          a classmate nothing about where you actually are. These are the names
          students use, with free text for everywhere else. */}
      <Sheet visible={locationOpen} onClose={() => { setOtherOpen(false); setLocationOpen(false); }} title="Add location">
        <View className="flex-row" style={{ gap: 12 }}>
          <Pressable
            onPress={() => {
              if (!user?.college) return;
              setLocation(user.college);
              setOtherOpen(false);
              setLocationOpen(false);
            }}
            disabled={!user?.college}
            className={`flex-1 items-center justify-center rounded-2xl border border-line active:opacity-85 ${user?.college ? 'bg-card' : 'bg-paper-2 opacity-60'}`}
            style={{ minHeight: 72 }}
            accessibilityRole="button"
            accessibilityLabel={user?.college ? `Use ${user.college}` : 'No college on your profile'}
          >
            <Ionicons name="school-outline" size={20} color={user?.college ? C.accentText : C.ink3} />
            <Text className={`font-semibold text-sm mt-1 ${user?.college ? 'text-ink' : 'text-ink-3'}`}>College</Text>
            {!!user?.college && (
              <Text className="font-sans text-ink-3 text-xs mt-0.5 px-2 text-center" numberOfLines={1}>
                {user.college}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setOtherOpen(true)}
            className={`flex-1 items-center justify-center rounded-2xl border active:opacity-85 ${otherOpen ? 'bg-card border-brand-500' : 'bg-card border-line'}`}
            style={{ minHeight: 72 }}
            accessibilityRole="button"
            accessibilityState={{ expanded: otherOpen, selected: otherOpen }}
            accessibilityLabel="Enter a different location"
          >
            <Ionicons name="create-outline" size={20} color={C.ink} />
            <Text className="font-semibold text-sm text-ink mt-1">Other</Text>
            <Text className="font-sans text-ink-3 text-xs mt-0.5">Type a place</Text>
          </Pressable>
        </View>

        {otherOpen && (
          <View className="flex-row items-center mt-4" style={{ gap: 8 }}>
            <FormField
              containerStyle={{ flex: 1 }}
              value={customLocation}
              onChangeText={setCustomLocation}
              placeholder="e.g. CS Block, Room 204"
              accessibilityLabel="Location"
              maxLength={80}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={applyCustomLocation}
            />
            <IconBtn
              name="checkmark"
              boxed
              disabled={!customLocation.trim()}
              onPress={applyCustomLocation}
              accessibilityLabel="Use this location"
              style={{ width: 48, height: 48, borderRadius: 24 }}
            />
          </View>
        )}
      </Sheet>
    </View>
  );
}

export default CreatePost;
