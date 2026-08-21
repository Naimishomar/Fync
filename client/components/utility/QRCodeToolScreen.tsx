import React, { useState, useRef } from 'react';
import {View, Text, TouchableOpacity, ScrollView, Platform, TextInput} from 'react-native'
// SafeAreaView from 'react-native' is iOS-only — on Android it renders as a
// plain View and applies no insets, so content collides with the status bar
// and the gesture bar. The safe-area-context version works on both.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../ui/AlertModal';

export default function QRCodeToolScreen() {
  const navigation = useNavigation();
  const [inputText, setInputText] = useState('');
  const [qrValue, setQrValue] = useState('');
  const qrRef = useRef<any>(null);

  const generateQR = () => {
    if (!inputText.trim()) {
      Alert.alert('Empty Text', 'Please enter some text or a URL to generate a QR code.');
      return;
    }
    setQrValue(inputText.trim());
  };

  const shareQR = () => {
    if (qrRef.current) {
      qrRef.current.toDataURL(async (data: string) => {
        try {
          const fileUri = FileSystem.documentDirectory + 'qrcode.png';
          await FileSystem.writeAsStringAsync(fileUri, data, { encoding: FileSystem.EncodingType.Base64 });
          
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'image/png',
              dialogTitle: 'Share QR Code',
            });
          } else {
            Alert.alert('Notice', 'Sharing is not available on this device.');
          }
        } catch (e) {
          console.error(e);
          Alert.alert('Error', 'Failed to share QR code.');
        }
      });
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
        {/* Header */}
        <View className="px-5 py-4 flex-row items-center border-b border-brand-100 bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">QR Generator</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-6">
          <Text className="text-sm font-semibold text-ink mb-2">Content or URL</Text>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="https://fync.app or any text..."
            placeholderTextColor="#8B857E"
            className="bg-card p-4 text-ink border-[1.5px] border-ink mb-4 rounded-md"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TouchableOpacity
            onPress={generateQR}
            className="w-full py-4 rounded-xl items-center justify-center bg-fam-study shadow-hair"
          >
            <Text className="text-white font-semibold text-base">Generate QR Code</Text>
          </TouchableOpacity>
        </View>

        {qrValue !== '' && (
          <View className="items-center bg-card rounded-card p-card-pad border border-line shadow-hair mb-10">
            <View className="bg-card p-4 shadow-hair border border-line rounded-card mb-6">
              <QRCode
                value={qrValue}
                size={200}
                color="black"
                backgroundColor="white"
                getRef={(c) => (qrRef.current = c)}
              />
            </View>
            <TouchableOpacity
              onPress={shareQR}
              className="w-full py-4 items-center justify-center flex-row bg-ink border-2 border-ink rounded-md"
            >
              <Ionicons name="share-outline" size={20} color="white" className="mr-2" />
              <Text className="text-white font-semibold text-base ml-2">Save / Share QR</Text>
            </TouchableOpacity>
          </View>
        )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
