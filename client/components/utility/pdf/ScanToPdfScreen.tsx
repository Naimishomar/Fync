/**
 * Camera -> multi-page PDF. Uses expo-print's HTML renderer rather than
 * pdf-lib: the pages are photos, and one <img> per page is both simpler and
 * smaller than embedding JPEGs by hand.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../../ui/AlertModal';
import { sharePdf, savePdfToDevice } from './pdfKit';

export default function ScanToPdfScreen() {
  const navigation = useNavigation<any>();
  const [shots, setShots] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);

  const capture = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Camera needed', 'Allow camera access to scan pages.'); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled) { setShots([...shots, res.assets[0].uri]); setPdf(null); }
  };

  const build = async () => {
    setBusy(true);
    try {
      const pages = await Promise.all(shots.map(async (uri) => {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        return `<div style="page-break-after:always;text-align:center"><img src="data:image/jpeg;base64,${b64}" style="width:100%"/></div>`;
      }));
      const { uri } = await Print.printToFileAsync({
        html: `<html><body style="margin:0;padding:0">${pages.join('')}</body></html>`,
      });
      setPdf(uri);
    } catch { Alert.alert('Error', 'Could not build the PDF. Try fewer or smaller pages.'); }
    finally { setBusy(false); }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="px-5 py-4 flex-row items-center border-b border-line bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back" style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">Scan to PDF</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <Text className="text-ink-2 text-sm mb-5">Photograph notes or handouts page by page, then save them as one PDF.</Text>

          <TouchableOpacity onPress={capture}
            className="w-full bg-card border-2 border-dashed border-ink-4 rounded-card p-card-pad items-center justify-center mb-5 shadow-hair"
            accessibilityRole="button">
            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-3">
              <Ionicons name="camera-outline" size={32} color="#57534E" />
            </View>
            <Text className="text-ink font-display uppercase text-label">
              {shots.length ? 'Scan another page' : 'Scan first page'}
            </Text>
          </TouchableOpacity>

          {shots.length > 0 && (
            <>
              <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Pages</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                <Text className="text-ink-3 font-mono text-label">{shots.length}</Text>
              </View>
              <View className="flex-row flex-wrap mb-5" style={{ gap: 10 }}>
                {shots.map((uri, i) => (
                  <View key={`${uri}-${i}`} className="rounded-card overflow-hidden border-2 border-ink" style={{ width: 84, height: 110 }}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => { setShots(shots.filter((_, j) => j !== i)); setPdf(null); }}
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-ink items-center justify-center"
                      accessibilityRole="button" accessibilityLabel={`Remove page ${i + 1}`}>
                      <Ionicons name="close" size={14} color="#F5F2EC" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <TouchableOpacity onPress={build} disabled={busy}
                className={`w-full py-4 rounded-md items-center justify-center border-2 border-ink mb-3 ${busy ? 'bg-paper-2' : 'bg-brand-500'}`}
                accessibilityRole="button">
                {busy ? <ActivityIndicator color="#12100E" />
                  : <Text className="font-display uppercase text-base text-ink">Build PDF ({shots.length} pages)</Text>}
              </TouchableOpacity>
            </>
          )}

          {pdf && (
            <View className="bg-card rounded-card p-card-pad border-2 border-ink mb-10">
              <Text className="text-ink font-display uppercase text-label mb-1">Done</Text>
              <Text className="text-ink-2 text-sm mb-4">{shots.length} scanned pages.</Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity onPress={() => sharePdf(pdf).catch((e) => Alert.alert('Error', e.message))}
                  className="flex-1 flex-row items-center justify-center bg-ink border-2 border-ink rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button">
                  <Ionicons name="share-outline" size={16} color="#F5F2EC" style={{ marginRight: 7 }} />
                  <Text className="font-display text-paper uppercase" style={{ fontSize: 12 }}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => savePdfToDevice(pdf, 'fync-scan.pdf')
                    .then(() => Alert.alert('Saved', 'The file was saved to your device.'))
                    .catch((e) => Alert.alert('Error', e.message))}
                  className="flex-1 flex-row items-center justify-center bg-card border-[1.5px] border-line rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button">
                  <Ionicons name="download-outline" size={16} color="#12100E" style={{ marginRight: 7 }} />
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 12 }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
