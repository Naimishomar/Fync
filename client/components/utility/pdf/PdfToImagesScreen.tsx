import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppBar } from '../../ui/kit';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from '../../ui/AlertModal';
import { pickPdf, readBase64, type PickedPdf } from './pdfKit';
import { usePdfJs } from './usePdfJs';
import { C } from '../../../constants/colors';

export default function PdfToImagesScreen() {
  const navigation = useNavigation<any>();
  const { run, Host, prepare } = usePdfJs();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<string[]>([]);

  const choose = async () => {
    let picked: PickedPdf[];
    try { picked = await pickPdf(false); } catch { Alert.alert('Error', 'Could not open that file.'); return; }
    if (picked.length) { setFile(picked[0]); setPages([]); prepare(); }
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await run(await readBase64(file.uri), 'pages', 1.5);
      if (res.kind === 'error') throw new Error(res.message);
      if (res.kind !== 'pages') throw new Error('Unexpected result.');
      const uris: string[] = [];
      // Unique per run: a reused path showed the previous PDF's cached thumbnails.
      const stamp = Date.now();
      for (let i = 0; i < res.pages.length; i++) {
        const uri = `${FileSystem.cacheDirectory}fync-page-${stamp}-${i + 1}.jpg`;
        await FileSystem.writeAsStringAsync(uri, res.pages[i], { encoding: FileSystem.EncodingType.Base64 });
        uris.push(uri);
      }
      setPages(uris);
    } catch (e: any) {
      Alert.alert('Could not convert', e?.message ?? 'This PDF could not be read.');
    } finally { setBusy(false); }
  };

  const saveAll = async () => {
    const perm = await MediaLibrary.requestPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to save the images.'); return; }
    try {
      for (const uri of pages) await MediaLibrary.createAssetAsync(uri);
      Alert.alert('Saved', `${pages.length} images saved to your gallery.`);
    } catch { Alert.alert('Error', 'Could not save the images.'); }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <Host />
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <AppBar title="PDF to Images" onBack={() => navigation.goBack()} />

        <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <Text className="text-ink-2 text-sm mb-5">Turn each page into a JPG you can drop into slides or share on chat.</Text>

          <TouchableOpacity onPress={choose}
            className="w-full bg-card border-2 border-dashed border-ink-4 rounded-card p-card-pad items-center justify-center mb-5 shadow-hair"
            accessibilityRole="button">
            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-3">
              <Ionicons name="image-outline" size={32} color={C.ink2} />
            </View>
            <Text className="text-ink font-display uppercase text-label">{file ? 'Choose a different PDF' : 'Choose PDF'}</Text>
          </TouchableOpacity>

          {file && (
            <View className="flex-row items-center bg-card rounded-card p-4 border border-line mb-5">
              <Ionicons name="document-text-outline" size={20} color={C.ink2} />
              <Text className="text-ink text-sm ml-3 flex-1" numberOfLines={1}>{file.name}</Text>
            </View>
          )}

          {file && (
            <TouchableOpacity onPress={convert} disabled={busy}
              className={`w-full py-4 rounded-md items-center justify-center border-2 border-ink mb-3 ${busy ? 'bg-paper-2' : 'bg-brand-500'}`}
              accessibilityRole="button">
              {busy ? <ActivityIndicator color={C.ink} />
                : <Text className="font-display uppercase text-base text-ink">Convert to images</Text>}
            </TouchableOpacity>
          )}

          {pages.length > 0 && (
            <>
              <View className="flex-row items-center mt-4 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Pages</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                <Text className="text-ink-3 font-mono text-label">{pages.length}</Text>
              </View>
              <View className="flex-row flex-wrap mb-5" style={{ gap: 10 }}>
                {pages.map((uri, i) => (
                  <View key={uri} className="rounded-card overflow-hidden border-2 border-ink" style={{ width: 84, height: 110 }}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={saveAll}
                className="w-full py-4 rounded-md items-center justify-center border-2 border-ink bg-ink mb-10"
                accessibilityRole="button">
                <Text className="font-display uppercase text-base text-paper">Save all to gallery</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
