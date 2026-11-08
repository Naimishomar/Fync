import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { Button, Card, FormField } from '../ui/kit';
import { ToolScreen, OptionCard } from './pdf/PdfToolShell';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../ui/AlertModal';

export default function QRCodeToolScreen() {
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
    <ToolScreen title="QR Generator">
      <OptionCard>
        <FormField
          label="Content or URL" value={inputText} onChangeText={setInputText}
          placeholder="https://fync.app or any text..." multiline numberOfLines={3}
        />
        <Button variant="primary" block title="Generate QR code" onPress={generateQR} />
      </OptionCard>

      {qrValue !== '' && (
        <Card padded style={{ alignItems: 'center', gap: 20 }}>
          {/* QR stays black on white in both themes so every scanner reads it. */}
          <View className="p-4 rounded-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <QRCode
              value={qrValue}
              size={200}
              color="black"
              backgroundColor="white"
              getRef={(c) => (qrRef.current = c)}
            />
          </View>
          <Button variant="solid" block icon="share-outline" title="Save / share QR" onPress={shareQR} />
        </Card>
      )}
    </ToolScreen>
  );
}
