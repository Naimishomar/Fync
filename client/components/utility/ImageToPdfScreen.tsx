import React, { useState } from 'react';
import {View, Text, TouchableOpacity, ScrollView, Platform, Image, ActivityIndicator} from 'react-native'
// SafeAreaView from 'react-native' is iOS-only — on Android it renders as a
// plain View and applies no insets, so content collides with the status bar
// and the gesture bar. The safe-area-context version works on both.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';

// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../ui/AlertModal';

export default function ImageToPdfScreen() {
  const navigation = useNavigation();
  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPdfUri, setGeneratedPdfUri] = useState<string | null>(null);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const selectedUris = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...selectedUris]);
      setGeneratedPdfUri(null); // Reset generated PDF when new images are picked
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setGeneratedPdfUri(null);
  };

  const generatePdf = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please select at least one image to convert.');
      return;
    }

    setIsProcessing(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; }
              .page { width: 100%; height: 100vh; display: flex; justify-content: center; align-items: center; page-break-after: always; }
              img { max-width: 95%; max-height: 95%; object-fit: contain; }
            </style>
          </head>
          <body>
            ${images.map(uri => `
              <div class="page">
                <img src="${uri}" />
              </div>
            `).join('')}
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      setGeneratedPdfUri(uri);
      Alert.alert('Success', 'PDF generated successfully! You can now share or download it.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate PDF. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const sharePdf = async () => {
    if (!generatedPdfUri) return;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(generatedPdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share your PDF',
        UTI: 'com.adobe.pdf'
      });
    } else {
      Alert.alert('Unavailable', 'Sharing is not available on this device.');
    }
  };

  const downloadPdf = async () => {
    if (!generatedPdfUri) return;
    
    if (Platform.OS === "android") {
      try {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const base64 = await FileSystem.readAsStringAsync(generatedPdfUri, { encoding: FileSystem.EncodingType.Base64 });
          const createdUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, 'fync-document.pdf', 'application/pdf');
          await FileSystem.writeAsStringAsync(createdUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          Alert.alert('Success', 'PDF saved to your device.');
        } else {
          Alert.alert('Permission Denied', 'Storage permission is required to save the PDF.');
        }
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not save the file.');
      }
    } else {
      // iOS doesn't have a direct "Save to Downloads" API without user interaction,
      // so sharing with "Save to Files" is the native way.
      sharePdf();
    }
  };

  return (
    <LinearGradient colors={['#ffffff', '#fff7ed', '#ffedd5']} className="flex-1">
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
        {/* Header */}
        <View className="px-5 py-4 flex-row items-center border-b border-orange-100 bg-transparent">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-slate-900 tracking-tight flex-1">Image to PDF</Text>
        <TouchableOpacity onPress={() => setImages([])} className="p-2">
          <Text className="text-sm font-bold text-slate-500">CLEAR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={pickImages}
          className="w-full bg-white border-2 border-dashed border-orange-200 rounded-3xl p-8 items-center justify-center mb-6 shadow-sm"
        >
          <View className="w-16 h-16 bg-orange-50 rounded-full items-center justify-center mb-3">
            <Ionicons name="images-outline" size={32} color="#f97316" />
          </View>
          <Text className="text-lg font-bold text-slate-800 mb-1">Select Images</Text>
          <Text className="text-xs font-medium text-slate-500 text-center">Tap here to choose multiple images from your gallery</Text>
        </TouchableOpacity>

        {images.length > 0 && (
          <View className="flex-row flex-wrap justify-between pb-24">
            {images.map((uri, index) => (
              <View key={index} className="w-[48%] aspect-[3/4] mb-4 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
                <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                <TouchableOpacity 
                  onPress={() => removeImage(index)}
                  className="absolute top-2 right-2 bg-black/50 w-8 h-8 rounded-full items-center justify-center backdrop-blur-md"
                >
                  <Ionicons name="close" size={18} color="white" />
                </TouchableOpacity>
                <View className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded-md backdrop-blur-md">
                  <Text className="text-white text-2xs font-bold">PAGE {index + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {images.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-xl border-t border-slate-200">
          {!generatedPdfUri ? (
            <TouchableOpacity
              onPress={generatePdf}
              disabled={isProcessing}
              className={`w-full py-4 rounded-2xl items-center justify-center flex-row shadow-sm ${isProcessing ? 'bg-orange-400' : 'bg-orange-500'}`}
            >
              {isProcessing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="document-text" size={20} color="white" className="mr-2" />
                  <Text className="text-white font-bold text-base ml-2">Generate PDF ({images.length} pages)</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View className="flex-row justify-between">
              <TouchableOpacity
                onPress={sharePdf}
                className="flex-1 py-4 rounded-2xl items-center justify-center flex-row shadow-sm bg-indigo-500 mr-2"
              >
                <Ionicons name="share-social" size={20} color="white" className="mr-2" />
                <Text className="text-white font-bold text-base ml-2">Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={downloadPdf}
                className="flex-1 py-4 rounded-2xl items-center justify-center flex-row shadow-sm bg-orange-500 ml-2"
              >
                <Ionicons name="download" size={20} color="white" className="mr-2" />
                <Text className="text-white font-bold text-base ml-2">Download</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      </SafeAreaView>
    </LinearGradient>
  );
}
