import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  Modal,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import axios from "../context/axiosConfig";
import { useAuth } from "../context/auth.context";

const { width } = Dimensions.get("window");

/* ---------- TYPES ---------- */

interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
}

interface Project {
  _id: string;
  title: string;
  description: string;
  image?: string[];
  video?: string;
  likes: number;
  liked_by: string[];
  user: User;
}

interface Comment {
  _id: string;
  text: string;
  commentor: User;
}

/* ---------- COMPONENT ---------- */

export default function FundingFeed() {
  const { user } = useAuth();
  const userId = user?.id || user?._id;

  const [projects, setProjects] = useState<Project[]>([]);

  /* CREATE PROJECT */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deployedUrl, setDeployedUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");

  const [images, setImages] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);

  /* COMMENTS */
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [commentModal, setCommentModal] = useState(false);

  /* ---------- FETCH PROJECTS ---------- */

  const fetchProjects = async () => {
    const res = await axios.get("/funding/get/all");
    if (res.data.success) setProjects(res.data.projects || []);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  /* ---------- IMAGE PICKER (MULTIPLE, MAX 5) ---------- */

  const pickImages = async () => {
    if (images.length >= 5) {
      Alert.alert("Limit reached", "You can upload max 5 images");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });

    if (!res.canceled) {
      setImages(prev => [...prev, ...res.assets].slice(0, 5));
    }
  };

  /* ---------- VIDEO PICKER ---------- */

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!res.canceled) {
      setVideo(res.assets[0]);
    }
  };

  /* ---------- REMOVE MEDIA ---------- */

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideo(null);
  };

  /* ---------- CREATE PROJECT ---------- */

  const createProject = async () => {
    if (!title || !description || !deployedUrl) {
      return Alert.alert("Missing fields", "Fill all required fields");
    }

    if (images.length === 0 && !video) {
      return Alert.alert("Add media", "Add at least one image or video");
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("deployed_url", deployedUrl);
    formData.append("github_url", githubUrl);

    images.forEach((img, index) => {
      formData.append("image", {
        uri: img.uri,
        name: `image_${index}.jpg`,
        type: "image/jpeg",
      } as any);
    });

    if (video) {
      formData.append("video", {
        uri: video.uri,
        name: "video.mp4",
        type: "video/mp4",
      } as any);
    }

    await axios.post("/funding/create", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    setTitle("");
    setDescription("");
    setDeployedUrl("");
    setGithubUrl("");
    setImages([]);
    setVideo(null);

    fetchProjects();
  };

  /* ---------- LIKE ---------- */

  const toggleLike = async (project: Project) => {
    const liked = project.liked_by.includes(userId!);

    setProjects(prev =>
      prev.map(p =>
        p._id === project._id
          ? {
              ...p,
              likes: liked ? p.likes - 1 : p.likes + 1,
              liked_by: liked
                ? p.liked_by.filter(id => id !== userId)
                : [...p.liked_by, userId!],
            }
          : p
      )
    );

    await axios.post(`/funding/like/${project._id}`);
  };

  /* ---------- COMMENTS ---------- */

  const openComments = async (id: string) => {
    setActiveProjectId(id);
    setCommentModal(true);
    const res = await axios.get(`/funding/comment/all/${id}`);
    if (res.data.success) setComments(res.data.comments);
  };

  const postComment = async () => {
    if (!commentText || !activeProjectId) return;

    await axios.post(`/funding/comment/add/${activeProjectId}`, {
      text: commentText,
    });

    setCommentText("");
    openComments(activeProjectId);
  };

  /* ---------- HEADER ---------- */

  const Header = () => (
    <View className="flex-row items-center justify-between px-4 pt-10 bg-white">
      <Text className="text-3xl font-semibold text-black">Fync</Text>
      <Ionicons name="notifications-outline" size={26} color="black" />
    </View>
  );

  /* ---------- CREATE PROJECT CARD ---------- */

  const CreateProject = () => (
    <View className="mx-4 my-4 rounded-xl bg-white border border-gray-200 p-4">
      <View className="flex-row items-center mb-3">
        <Image source={{ uri: user?.avatar }} className="h-10 w-10 rounded-full mr-3" />
        <Text className="text-gray-500">Share your project</Text>
      </View>

      <TextInput
        placeholder="Project title"
        value={title}
        onChangeText={setTitle}
        className="border-b border-gray-300 mb-2 text-black"
      />

      <TextInput
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        className="border-b border-gray-300 mb-2 text-black"
      />

      <TextInput
        placeholder="Deployed URL"
        value={deployedUrl}
        onChangeText={setDeployedUrl}
        className="border-b border-gray-300 mb-2 text-black"
      />

      <TextInput
        placeholder="Github URL (optional)"
        value={githubUrl}
        onChangeText={setGithubUrl}
        className="border-b border-gray-300 mb-3 text-black"
      />

      {/* IMAGE PREVIEW */}
      {images.length > 0 && (
        <FlatList
          horizontal
          data={images}
          keyExtractor={(_, i) => i.toString()}
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          renderItem={({ item, index }) => (
            <View className="mr-3 relative">
              <Image source={{ uri: item.uri }} className="h-28 w-28 rounded-lg" />
              <Pressable
                onPress={() => removeImage(index)}
                className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
                <Ionicons name="close" size={14} color="white" />
              </Pressable>
            </View>
          )}
        />
      )}

      {/* VIDEO PREVIEW */}
      {video && (
        <View className="mb-3 relative">
          <Video
            source={{ uri: video.uri }}
            style={{ height: 180, borderRadius: 10 }}
            useNativeControls
          />
          <Pressable
            onPress={removeVideo}
            className="absolute top-2 right-2 bg-black/60 rounded-full p-2">
            <Ionicons name="close" size={16} color="white" />
          </Pressable>
        </View>
      )}

      <View className="flex-row justify-between items-center mt-3">
        <View className="flex-row gap-4">
          <Pressable onPress={pickImages} className="flex-row items-center">
            <Ionicons name="images-outline" size={22} color="black" />
            <Text className="ml-1 text-black">Photos</Text>
          </Pressable>

          <Pressable onPress={pickVideo} className="flex-row items-center">
            <Ionicons name="videocam-outline" size={22} color="black" />
            <Text className="ml-1 text-black">Video</Text>
          </Pressable>
        </View>

        <Pressable onPress={createProject}>
          <Text className="text-pink-500 font-semibold">Post</Text>
        </Pressable>
      </View>
    </View>
  );

  /* ---------- PROJECT CARD ---------- */

  const renderItem = ({ item }: { item: Project }) => {
    const isLiked = item.liked_by.includes(userId || "");

    return (
      <View className="mx-4 mb-5 rounded-xl bg-white border border-gray-200">
        <View className="flex-row items-center px-4 py-3">
          <Image source={{ uri: item.user.avatar }} className="h-10 w-10 rounded-full mr-3" />
          <Text className="font-semibold text-black">{item.user.username}</Text>
        </View>

        {item.video ? (
          <Video source={{ uri: item.video }} style={{ height: 260 }} useNativeControls />
        ) : (
          <Image source={{ uri: item.image?.[0] }} className="h-64 w-full" />
        )}

        <View className="px-4 py-2">
          <Text className="font-semibold text-black">{item.title}</Text>
          <Text className="text-gray-600">{item.description}</Text>
        </View>

        <View className="flex-row items-center px-4 pb-3">
          <Pressable onPress={() => toggleLike(item)}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={22}
              color={isLiked ? "#ec4899" : "black"}
            />
          </Pressable>

          <Pressable onPress={() => openComments(item._id)} className="ml-4">
            <Ionicons name="chatbubble-outline" size={22} color="black" />
          </Pressable>

          <Text className="ml-4 text-gray-500">{item.likes} upvotes</Text>
        </View>
      </View>
    );
  };

  /* ---------- UI ---------- */

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <CreateProject />
      <FlatList
        data={projects}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        showsVerticalScrollIndicator={false}
      />

      {/* COMMENTS MODAL */}
      <Modal visible={commentModal} animationType="slide">
        <View className="flex-1 bg-white">
          <FlatList
            data={comments}
            keyExtractor={i => i._id}
            renderItem={({ item }) => (
              <View className="flex-row p-4">
                <Image
                  source={{ uri: item.commentor.avatar }}
                  className="h-8 w-8 rounded-full mr-3"
                />
                <Text className="text-black">
                  <Text className="font-semibold">
                    {item.commentor.username}{" "}
                  </Text>
                  {item.text}
                </Text>
              </View>
            )}
          />

          <View className="flex-row items-center border-t border-gray-300 p-3">
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment..."
              className="flex-1 text-black"
            />
            <Pressable onPress={postComment}>
              <Text className="text-pink-500 ml-3">Post</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setCommentModal(false)} className="p-4">
            <Text className="text-center text-black">Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
