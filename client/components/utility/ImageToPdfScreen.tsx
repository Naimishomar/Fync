import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { BottomBar, Button, IconBtn } from '../ui/kit';
import { ToolScreen, PickZone, Thumb } from './pdf/PdfToolShell';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';

export default function ImageToPdfScreen() {
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
    <ToolScreen
      title="Image to PDF"
      right={images.length ? (
        <IconBtn name="trash-outline" color={C.ink3} onPress={() => setImages([])} accessibilityLabel="Remove all images" />
      ) : undefined}
      footer={images.length > 0 ? (
        <BottomBar>
          {!generatedPdfUri ? (
            <Button
              variant="primary" icon="document-text-outline" title={`Generate PDF (${images.length} pages)`}
              onPress={generatePdf} loading={isProcessing} style={{ flex: 1 }}
            />
          ) : (
            <>
              <Button variant="solid" icon="share-social-outline" title="Share" onPress={sharePdf} style={{ flex: 1 }} />
              <Button icon="download-outline" title="Download" onPress={downloadPdf} style={{ flex: 1 }} />
            </>
          )}
        </BottomBar>
      ) : undefined}
    >
      <PickZone icon="images-outline" label="Select images" onPress={pickImages} />

      {images.length > 0 && (
        <View className="flex-row flex-wrap justify-between">
          {images.map((uri, index) => (
            <Thumb
              key={`${uri}-${index}`} uri={uri} style={GRID_CELL}
              caption={`Page ${index + 1}`}
              onRemove={() => removeImage(index)} removeLabel={`Remove page ${index + 1}`}
            />
          ))}
        </View>
      )}
    </ToolScreen>
  );
}

const GRID_CELL = { width: '48%', aspectRatio: 3 / 4, marginBottom: 12 } as const;
