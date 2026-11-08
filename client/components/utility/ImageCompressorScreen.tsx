import React, { useState } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Label, Num } from '../ui/kit';
import { ToolScreen, PickZone, Thumb, OptionCard, Choices } from './pdf/PdfToolShell';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageCompressor } from 'react-native-compressor';
import * as Sharing from 'expo-sharing';
// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';

export default function ImageCompressorScreen() {
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
    <ToolScreen title="Compress Image" blurb="Shrink a photo to fit upload limits. It never leaves your phone.">
      {!originalUri ? (
        <PickZone icon="image-outline" label="Select image" onPress={pickImage} />
      ) : (
        <View className="mb-6">
          <Thumb
            uri={compressedUri || originalUri} contain style={PREVIEW}
            onRemove={() => { setOriginalUri(null); setCompressedUri(null); }} removeLabel="Remove image"
          />

          <Card padded style={{ marginBottom: 20 }}>
            <View className="flex-row items-center justify-between">
              <View>
                <Label>Original size</Label>
                <Num style={{ fontSize: 19, lineHeight: 24, marginTop: 4 }}>{formatSize(originalSize)}</Num>
              </View>
              <Ionicons name="arrow-forward" size={20} color={C.ink4} />
              <View className="items-end">
                <Label>Compressed size</Label>
                <Num style={{ fontSize: 19, lineHeight: 24, marginTop: 4, color: compressedUri ? C.accentText : C.ink4 }}>
                  {compressedUri ? formatSize(compressedSize) : '—'}
                </Num>
              </View>
            </View>
          </Card>

          {!compressedUri ? (
            <>
              <OptionCard label="Compression quality">
                <Choices items={QUALITIES} value={quality} onChange={setQuality} />
              </OptionCard>
              <Button variant="primary" block icon="contract-outline" title="Compress now" onPress={compressImage} loading={isProcessing} />
            </>
          ) : (
            <Button variant="solid" block icon="share-outline" title="Save / share image" onPress={shareCompressed} />
          )}
        </View>
      )}
    </ToolScreen>
  );
}

const PREVIEW = { width: '100%', aspectRatio: 4 / 3, marginBottom: 16 } as const;
const QUALITIES = [
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
] as const;
