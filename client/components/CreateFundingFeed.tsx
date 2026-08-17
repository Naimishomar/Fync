import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import axios from '../context/axiosConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { RAZORPAY_KEY_ID } from '../constants/keys';
import { WebView } from "react-native-webview";
import { useAuth } from '../context/auth.context';
import { Video, ResizeMode } from "expo-av";

export default function CreateFundingFeed() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const project = route.params?.project;
  const isEditing = !!project;

  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [deployedUrl, setDeployedUrl] = useState(project?.deployed_url || "");
  const [githubUrl, setGithubUrl] = useState(project?.github_url || "");

  const [images, setImages] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);
  const [oldImages, setOldImages] = useState<string[]>(project?.image || []);
  const [oldVideo, setOldVideo] = useState<string | null>(project?.video || null);

  const [submitting, setSubmitting] = useState(false);
  const [showPaymentParams, setShowPaymentParams] = useState<any>(null);

  const pickImages = async () => {
    if (images.length >= 5) return Alert.alert("Limit reached", "Max 5 images allowed");

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add images.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });

    if (!res.canceled) {
      setOldImages([]);
      setImages((prev) => [...prev, ...res.assets].slice(0, 5));
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add a video.');
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!res.canceled) {
      setOldVideo(null);
      setVideo(res.assets[0]);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };


  const handleFinalSubmit = async (paymentData?: { paymentRefId: string, razorpay_order_id: string, razorpay_signature: string }) => {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("deployed_url", deployedUrl);
      formData.append("github_url", githubUrl);

      images.forEach((img, index) => {
        formData.append("image", { uri: img.uri, name: `image_${index}.jpg`, type: "image/jpeg" } as any);
      });
      if (video) {
        formData.append("video", { uri: video.uri, name: "video.mp4", type: "video/mp4" } as any);
      }

      if (paymentData) {
        formData.append("paymentRefId", paymentData.paymentRefId);
        formData.append("razorpay_order_id", paymentData.razorpay_order_id);
        formData.append("razorpay_signature", paymentData.razorpay_signature);
      } else if (!isEditing) {
        formData.append("isEditing", "false");
      }

      if (isEditing && project._id) {
        formData.append("isEditing", "true");
        await axios.post(`/funding/update/${project._id}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
        Toast.show({ type: 'success', text1: 'Project updated successfully' });
      } else {
        await axios.post("/funding/create", formData, { headers: { "Content-Type": "multipart/form-data" } });
        Toast.show({ type: 'success', text1: 'Project posted successfully 🎉' });
      }

      navigation.goBack();
    } catch (error) {
      console.error("Submit error", error);
      Toast.show({ type: 'error', text1: 'Failed to save project' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInitiateProjectPost = async () => {
    if (!title || !description || !deployedUrl) {
      return Alert.alert("Missing fields", "Fill all required fields");
    }

    if (images.length === 0 && !video && oldImages.length === 0 && !oldVideo) {
      return Alert.alert("Add media", "Add at least one image or video");
    }

    if (isEditing) {
      handleFinalSubmit();
    } else {
      setSubmitting(true);
      try {
        const orderRes = await axios.post('/payment/order', {
          purpose: 'funding_listing',
        });
        const currentOrder = orderRes.data;

        const content = `
        <html>
        <body style="background-color: #F5F7FA;">
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
            <script>
            var options = {
                key: "${RAZORPAY_KEY_ID}",
                amount: "${currentOrder.amount}",
                currency: "INR",
                name: "Fync",
                description: "Post Startup Project Fee",
                order_id: "${currentOrder.id}",
                prefill: {
                    name: "${user?.name || ''}",
                    email: "${user?.email || ''}",
                    contact: "${user?.mobileNumber || ''}"
                },
                theme: { color: "#ec4899" },
                handler: function (response) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        event: "SUCCESS",
                        data: response
                    }));
                },
                modal: {
                    ondismiss: function () {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            event: "FAILED"
                        }));
                    }
                }
            };
            var rzp1 = new Razorpay(options);
            rzp1.open();
            </script>
        </body>
        </html>
        `;
        setShowPaymentParams({ html: content });
      } catch (err) {
        console.error("Order error", err);
        Alert.alert("Oops!", "Could not initiate payment.");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleWebViewMessage = (event: any) => {
    const msg = JSON.parse(event.nativeEvent.data);
    if (msg.event === "SUCCESS") {
      setShowPaymentParams(null);
      handleFinalSubmit({
        paymentRefId: msg.data.razorpay_payment_id,
        razorpay_order_id: msg.data.razorpay_order_id,
        razorpay_signature: msg.data.razorpay_signature
      });
    } else {
      setShowPaymentParams(null);
      Alert.alert("Payment Cancelled", "Payment is required to post a project.");
    }
  };


  return (
    <SafeAreaView className='flex-1 bg-[#F0F4F8]'>
      <View className='flex-row items-center px-5 py-3'>
        <Pressable onPress={() => navigation.goBack()} className="bg-white w-10 h-10 items-center justify-center rounded-full shadow-sm shadow-black/5">
          <Ionicons name="arrow-back-outline" size={20} color="#1A1A1A" />
        </Pressable>
        <View className="flex-1 items-center pr-10">
          <Text className='text-2xl font-bold text-slate-900'>{isEditing ? 'Edit' : 'Post'} <Text className="text-pink-500">Project</Text></Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 mt-2" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Basic Info */}
        <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5 mb-5 relative z-50">
          <Text className="text-base font-bold text-slate-900 mb-4">Project Overview</Text>
          <TextInput
            placeholder="Project Title"
            placeholderTextColor="#808080ff"
            value={title}
            multiline
            onChangeText={setTitle}
            className="text-slate-800 text-base font-semibold pb-4 border-b border-slate-100"
          />
          <TextInput
            placeholder="Tell everyone about your project..."
            placeholderTextColor="#808080ff"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            className="text-slate-800 text-base min-h-[150px]"
          />
        </View>

        {/* Links Card */}
        <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5 mb-5">
          <Text className="text-base font-bold text-slate-900 mb-4">Live Links</Text>
          <View className="flex-row items-center border-b border-slate-100 pb-2 mb-4">
            <Ionicons name="link-outline" size={20} color="#ec4899" />
            <TextInput
              placeholder="Deployed URL (Required)"
              placeholderTextColor="#cbd5e1"
              value={deployedUrl}
              onChangeText={setDeployedUrl}
              className="text-slate-800 font-bold flex-1 ml-3"
              autoCapitalize="none"
            />
          </View>
          <View className="flex-row items-center">
            <Ionicons name="logo-github" size={20} color="#1A1A1A" />
            <TextInput
              placeholder="Github URL (Optional)"
              placeholderTextColor="#cbd5e1"
              value={githubUrl}
              onChangeText={setGithubUrl}
              className="text-slate-800 font-bold flex-1 ml-3"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Media Card */}
        <View className="bg-white rounded-2xl p-5 shadow-sm shadow-black/5 mb-5">
          <Text className="text-base font-bold text-slate-900 mb-1">Showcase Media</Text>
          <Text className="text-slate-500 text-xs mb-4 font-medium ">High quality media helps you stand out!</Text>

          {(images.length > 0 || video || oldImages.length > 0 || oldVideo) && (
            <View className="mb-4">
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2 flex-grow-0">
                  {images.map((img, index) => (
                    <View key={index} className="mr-3 relative">
                      <Image source={{ uri: img.uri }} className="h-20 w-20 rounded-xl bg-slate-100" />
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

              {video && (
                <View className="mb-4 relative w-full h-40 shadow-sm rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                  <Video source={{ uri: video.uri }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} isMuted />
                  <TouchableOpacity onPress={() => setVideo(null)} className="absolute top-2 right-2 bg-black/70 rounded-full h-8 w-8 items-center justify-center z-10">
                    <Ionicons name="close" size={18} color="white" />
                  </TouchableOpacity>
                </View>
              )}

              {images.length === 0 && oldImages.length > 0 && (
                <View className="mb-4">
                  <Text className="text-slate-900 text-2xs font-bold mb-2 uppercase tracking-tight">Active Images:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {oldImages.map((uri, idx) => (
                      <Image key={idx} source={{ uri: uri.replace(/^http:\/\//i, 'https://') }} className="h-20 w-20 rounded-xl bg-slate-100 mr-2 border border-slate-200" />
                    ))}
                  </ScrollView>
                </View>
              )}
              {!video && oldVideo && (
                <View className="mb-4 relative w-full h-40 shadow-sm rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                  <Text className="text-white absolute top-2 left-2 z-10 bg-black/50 px-2 py-1 rounded">Active Video</Text>
                  <Video source={{ uri: oldVideo.replace(/^http:\/\//i, 'https://') }} style={{ width: '100%', height: '100%' }} resizeMode={ResizeMode.COVER} isMuted />
                </View>
              )}
            </View>
          )}

          <View className="flex-row items-center justify-start gap-4 mt-2">
            <Pressable onPress={pickImages} className="flex-row items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-slate-50/50">
              <Ionicons name="images-outline" size={18} color="#ec4899" />
              <Text className="text-slate-500 text-xs font-bold">Add Images</Text>
            </Pressable>
            <Pressable onPress={pickVideo} className="flex-row items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-slate-50/50">
              <Ionicons name="videocam-outline" size={18} color="#ec4899" />
              <Text className="text-slate-500 text-xs font-bold">Add Video</Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>

      <View className="px-5 py-4 bg-[#F0F4F8]">
        <TouchableOpacity
          onPress={handleInitiateProjectPost}
          disabled={submitting}
          className={`py-4 rounded-full items-center shadow-lg shadow-black/30 ${submitting ? 'bg-black' : 'bg-black/90'}`}
        >
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-lg  tracking-tighter uppercase">{isEditing ? "Update Project" : "Post Project • ₹249"}</Text>}
        </TouchableOpacity>
      </View>

      {/* PAYMENT MODAL */}
      <Modal visible={!!showPaymentParams} animationType="slide" transparent={false} onRequestClose={() => setShowPaymentParams(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F7FA' }}>
          <View className="flex-row items-center px-4 py-3 bg-white border-b border-slate-100">
            <TouchableOpacity onPress={() => setShowPaymentParams(null)} className="p-2">
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text className="ml-4 font-black  tracking-tighter text-lg">Secure Gateway</Text>
          </View>
          <WebView
            source={showPaymentParams}
            onMessage={handleWebViewMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => <ActivityIndicator color="#f97316" size="large" style={{ position: 'absolute', top: '50%', left: '45%' }} />}
          />
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}
