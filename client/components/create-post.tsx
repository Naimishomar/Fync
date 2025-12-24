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
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home1: undefined;
};

function CreatePost() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
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
    const token = await AsyncStorage.getItem('token');
    try {
      const formData = new FormData();
      formData.append('description', description);
      images.forEach((uri, index) => {
        const filename = uri.split('/').pop() || `image_${index}.jpg`;
        const type = `image/${filename.split('.').pop()}`;
        formData.append('image', {
          uri,
          name: filename,
          type,
        } as any);
      });
      const response = await fetch('http://10.21.97.246:3000/post/create', {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        Toast.show({
          type: 'success',
          text1: 'Posted successfully!',
        });
        navigation.navigate('Home1');
      } else {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: data.message,
        });
      }
    } catch (error) {
      console.log('Error uploading', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to upload',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="h-screen w-full bg-black p-2 text-white">
      <Text className="p-4 text-3xl text-white">Create Post</Text>

      <View className="mt-2 rounded-xl border border-pink-300 p-2">
        <TextInput
          className="text-md min-h-56 rounded-xl text-pink-300 placeholder:text-white"
          placeholder="Share your thoughts..."
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <View className="mx-3 my-2 flex-row items-center gap-5">
          <TouchableOpacity onPress={openGallery}>
            <FontAwesome6 name="image" size={24} color="white" />
          </TouchableOpacity>
          <FontAwesome6 name="globe" size={22} color="white" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {images.map((uri, index) => (
            <View key={index} className="relative mr-2">
              <Image source={{ uri }} className="h-24 w-24 rounded-lg" />

              <TouchableOpacity
                onPress={() => removeImage(index)}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-400">
                <Text className="text-xs text-white">✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      <View className="mt-3 flex-row items-center justify-end gap-4">
        <TouchableOpacity className="rounded-full border border-pink-300 px-4 py-2">
          <Text className="text-md text-white">Save Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity className="rounded-full bg-pink-300 px-8 py-2" onPress={handleSubmit}>
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-md text-white">Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default CreatePost;
