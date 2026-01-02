import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axios from '../context/axiosConfig';

function CreatePost() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

      const res = await axios.post('http://192.168.28.112:3000/post/create', formData);

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Posted successfully!' });
        setDescription('');
        setImages([]);
      } else {
        Toast.show({ type: 'error', text1: res.data.message });
      }
    } catch (error) {
      console.log('Upload failed', error);
      console.log(error?.response?.data?.message);

      Toast.show({ type: 'error', text1: 'Failed to upload' });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <View className="mx-3 my-4 rounded-xl bg-white/5 p-3 border border-pink-300">
      <TextInput
        placeholder="Share your thoughts..."
        placeholderTextColor="#9ca3af"
        value={description}
        onChangeText={setDescription}
        multiline
        className="text-white text-base"
      />

      <View className="mt-3 flex-row items-center justify-between">
        <View className="flex-row gap-5">
          <TouchableOpacity onPress={openGallery}>
            <FontAwesome6 name="image" size={20} color="white" />
          </TouchableOpacity>
          {/* <FontAwesome6 name="globe" size={18} color="white" /> */}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          className="rounded-full bg-pink-400 px-4 py-1"
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text className="font-semibold text-black">Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
          {images.map((uri, index) => (
            <View key={index} className="mr-2 relative">
              <Image source={{ uri }} className="h-20 w-20 rounded-lg" />
              <TouchableOpacity
                onPress={() => removeImage(index)}
                className="absolute top-1 right-1 bg-black/70 h-5 w-5 rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs">✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default CreatePost;
