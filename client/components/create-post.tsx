import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

function CreatePost() {
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const navigation = useNavigation();
  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert("Permission required!");
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
    const token = await AsyncStorage.getItem("token");
    try {
      const formData = new FormData();
      formData.append("description", description);
      images.forEach((uri, index) => {
        const filename = uri.split("/").pop() || `image_${index}.jpg`;
        const type = `image/${filename.split(".").pop()}`;
        formData.append("image", {
          uri,
          name: filename,
          type,
        } as any);
      });
      const response = await fetch("http://192.168.28.228:3000/post/create", {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        Toast.show({
          type: "success",
          text1: "Posted successfully!",
        });
        navigation.navigate("Home1");
      } else {
        Toast.show({
          type: "error",
          text1: "Error",
          text2: data.message,
        });
      }
    } catch (error) {
      console.log("Error uploading", error);
      Toast.show({
        type: "error",
        text1: "Failed to upload",
      });
    }
  };

  return (
    <SafeAreaView className="w-full bg-black h-screen text-white p-2">
      <Text className="text-white text-3xl p-4">Create Post</Text>

      <View className="mt-2 border border-pink-300 rounded-xl p-2">
        <TextInput
          className="text-pink-300 placeholder:text-white text-md rounded-xl min-h-56"
          placeholder="Share your thoughts..."
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        <View className="flex-row gap-5 items-center mx-3 my-2">
          <TouchableOpacity onPress={openGallery}>
            <FontAwesome6 name="image" size={24} color="white" />
          </TouchableOpacity>
          <FontAwesome6 name="globe" size={22} color="white" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {images.map((uri, index) => (
            <View key={index} className="relative mr-2">
              <Image source={{ uri }} className="w-24 h-24 rounded-lg" />

              <TouchableOpacity
                onPress={() => removeImage(index)}
                className="absolute right-1 top-1 bg-pink-400 w-5 h-5 rounded-full flex items-center justify-center"
              >
                <Text className="text-white text-xs">✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      <View className="flex-row justify-end items-center gap-4 mt-3">
        <TouchableOpacity className="px-4 py-2 border border-pink-300 rounded-full">
          <Text className="text-white text-md">Save Draft</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-pink-300 rounded-full px-8 py-2"
          onPress={handleSubmit}
        >
          <Text className="text-white text-md">Post</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default CreatePost;
