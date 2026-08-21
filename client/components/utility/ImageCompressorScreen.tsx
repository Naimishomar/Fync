import React, { useState } from 'react';
import {View, Text, TouchableOpacity, ScrollView, Platform, Image, ActivityIndicator} from 'react-native'
// SafeAreaView from 'react-native' is iOS-only — on Android it renders as a
// plain View and applies no insets, so content collides with the status bar
// and the gesture bar. The safe-area-context version works on both.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageCompressor } from 'react-native-compressor';
import * as Sharing from 'expo-sharing';
// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../ui/AlertModal';

export default function ImageCompressorScreen() {
  const navigation = useNavigation();
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [compressedUri, setCompressedUri] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('medium');

  const getFileSize = async (uri: string) => {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      // FileInfo is a union: `size` only exists on the branch where exists is true.
      return info.exists ? info.size : 0;
    } catch (e) {
      return 0;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1, // Get original
    });

    if (!result.canceled && result.assets) {
      const uri = result.assets[0].uri;
      setOriginalUri(uri);
      setCompressedUri(null);
      const size = await getFileSize(uri);
      setOriginalSize(size);
    }
  };

  const compressImage = async () => {
    if (!originalUri) return;
    setIsProcessing(true);
    
    try {
      let q = 0.7; // Medium
      let maxDim = 1200;
      
      if (quality === 'low') {
        q = 0.4;
        maxDim = 800;
      } else if (quality === 'high') {
        q = 0.9;
        maxDim = 1920;
      }

      const result = await ImageCompressor.compress(originalUri, {
        compressionMethod: 'auto',
        quality: q,
        maxWidth: maxDim,
        maxHeight: maxDim,
      });

      setCompressedUri(result);
      const newSize = await getFileSize(result);
      setCompressedSize(newSize);
    } catch (error) {
      Alert.alert('Error', 'Failed to compress image.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const shareCompressed = async () => {
    if (!compressedUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(compressedUri, {
        dialogTitle: 'Share compressed image',
      });
    } else {
      Alert.alert('Notice', 'Sharing is not available on this device.');
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
        <View className="px-5 py-4 flex-row items-center border-b border-brand-100 bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">Compress Image</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          {!originalUri ? (
            <TouchableOpacity
              onPress={pickImage}
              className="w-full bg-card border-2 border-dashed border-fam-career/25 rounded-card p-card-pad items-center justify-center mb-6 shadow-hair"
            >
              <View className="w-16 h-16 bg-fam-career/10 rounded-full items-center justify-center mb-3">
                <Ionicons name="image-outline" size={32} color="#0891B2" />
              </View>
              <Text className="text-lg font-display text-ink mb-1">Select Image</Text>
              <Text className="text-xs font-medium text-ink-3 text-center">Tap to choose a large image</Text>
            </TouchableOpacity>
          ) : (
            <View className="mb-6">
              <View className="w-full aspect-[4/3] bg-paper-2 rounded-card overflow-hidden mb-4 border border-line">
                <Image source={{ uri: compressedUri || originalUri }} className="w-full h-full" resizeMode="contain" />
                <TouchableOpacity 
                  onPress={() => { setOriginalUri(null); setCompressedUri(null); }}
                  className="absolute top-2 right-2 bg-black/50 w-8 h-8 rounded-full items-center justify-center backdrop-blur-md"
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center justify-between bg-card p-4 rounded-card border border-line shadow-hair mb-6">
                <View>
                  <Text className="text-xs text-ink-3 font-semibold mb-1 uppercase">Original Size</Text>
                  <Text className="text-base font-display text-ink">{formatSize(originalSize)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#C4BEB6" />
                <View className="items-end">
                  <Text className="text-xs text-fam-career font-semibold mb-1 uppercase">Compressed Size</Text>
                  <Text className={`text-base font-display ${compressedUri ? 'text-fam-career' : 'text-ink-4'}`}>
                    {compressedUri ? formatSize(compressedSize) : '---'}
                  </Text>
                </View>
              </View>

              {!compressedUri ? (
                <View className="bg-card p-5 rounded-card border border-line shadow-hair mb-6">
                  <Text className="text-sm font-semibold text-ink mb-4">Compression Quality</Text>
                  <View className="flex-row justify-between mb-6">
                    {['high', 'medium', 'low'].map((q) => (
                      <TouchableOpacity
                        key={q}
                        onPress={() => setQuality(q as any)}
                        className={`flex-1 mx-1 py-2 rounded-xl items-center justify-center border ${quality === q ? 'bg-fam-career/10 border-fam-career' : 'bg-card border-line'}`}
                      >
                        <Text className={`text-xs font-semibold capitalize ${quality === q ? 'text-fam-career' : 'text-ink-3'}`}>{q}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <TouchableOpacity
                    onPress={compressImage}
                    disabled={isProcessing}
                    className={`w-full py-4 rounded-xl items-center justify-center flex-row ${isProcessing ? 'bg-fam-career' : 'bg-fam-career'}`}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Ionicons name="contract" size={20} color="white" className="mr-2" />
                        <Text className="text-white font-semibold text-base ml-2">Compress Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={shareCompressed}
                  className="w-full py-4 items-center justify-center flex-row bg-ink border-2 border-ink rounded-md"
                >
                  <Ionicons name="share-outline" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-semibold text-base ml-2">Save / Share Image</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
