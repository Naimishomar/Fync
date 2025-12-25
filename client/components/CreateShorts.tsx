import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  // useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import axios from "../context/axiosConfig";

const CreateShorts = () => {
  // const { width, height } = useWindowDimensions();
  const navigation = useNavigation<any>();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------- PICK VIDEO ---------------- */
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Toast.show({ type: "error", text1: "Permission required" });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
    }
  };

  /* ---------------- UPLOAD SHORT ---------------- */
const uploadShort = async () => {
  if (!videoUri || !title || !description) {
    Toast.show({ type: "error", text1: "All fields are required" });
    return;
  }

  setLoading(true);

  try {
    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("description", description.trim());

    const filename = videoUri.split("/").pop() || "short.mp4";

    formData.append("video", {
      uri: videoUri,
      name: filename,
      type: "video/mp4",
    } as any);

    const res = await axios.post(
      "http://192.168.28.139:3000/shorts/create",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (res.data.success) {
      Toast.show({ type: "success", text1: "Short uploaded!" });
      setTitle('');
      setDescription('');
      setVideoUri(null);
      navigation.goBack();
    } else {
      Toast.show({ type: "error", text1: res.data.message });
    }
  } catch (err) {
    console.log(err);
    Toast.show({ type: "error", text1: "Upload failed" });
  } finally {
    setLoading(false);
  }
};

return (
  <SafeAreaView className="flex-1 bg-white">
    {/* HEADER */}
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={26} color="#111827" />
      </TouchableOpacity>

      <Text className="text-gray-900 text-lg font-semibold">
        Create Short
      </Text>

      <View style={{ width: 26 }} />
    </View>

    {/* CONTENT */}
    <View className="flex-1 px-4">
      {/* VIDEO PREVIEW / PICKER */}
      <View className="mt-4 h-[60%] w-full rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
        {!videoUri ? (
          <View className="flex-1 items-center justify-center">
            {/* ONLY ICON IS TOUCHABLE */}
            <TouchableOpacity
              onPress={pickVideo}
              activeOpacity={0.7}
              className="bg-gray-200 w-40 h-40 rounded-full items-center justify-center"
            >
              <Ionicons name="videocam-outline" size={44} color="#374151" />
            </TouchableOpacity>

            <Text className="text-gray-500 mt-4 text-md">
              Select a video
            </Text>
          </View>
        ) : (
          <View className="flex-1">
            <Video
              source={{ uri: videoUri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isLooping
            />

            {/* REMOVE VIDEO BUTTON */}
            <TouchableOpacity
              onPress={() => setVideoUri(null)}
              className="absolute top-3 right-3 bg-white/90 h-8 w-8 rounded-full items-center justify-center shadow"
            >
              <Ionicons name="close" size={16} color="#111827" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* TITLE */}
        <TextInput
            placeholder="Title"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
            className="mt-5 text-gray-900 text-base border border-pink-300 rounded-xl p-3"
        />

      {/* DESCRIPTION */}
        <TextInput
        placeholder="Description"
        placeholderTextColor="#9ca3af"
        value={description}
        onChangeText={setDescription}
        multiline
        textAlignVertical="top"
        className="mt-4 text-gray-900 text-base min-h-[80px] border border-pink-300 rounded-xl p-3"
        />
    </View>

    {/* FOOTER */}
    <View className="px-4 py-4 border-t border-gray-200 mb-14">
      <TouchableOpacity
        onPress={uploadShort}
        disabled={loading}
        className={`h-12 rounded-full items-center justify-center ${
          loading
            ? "bg-pink-300/60"
            : "bg-pink-400"
        }`}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-base">
            Upload Short
          </Text>
        )}
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

};

export default CreateShorts;
