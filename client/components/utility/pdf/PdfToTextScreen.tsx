import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../../ui/AlertModal';
import { pickPdf, readBase64, type PickedPdf } from './pdfKit';
import { usePdfJs } from './usePdfJs';

export default function PdfToTextScreen() {
  const navigation = useNavigation<any>();
  const { run, Host, prepare } = usePdfJs();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');

  const choose = async () => {
    const picked = await pickPdf(false);
    if (picked.length) { setFile(picked[0]); setText(''); prepare(); }
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await run(await readBase64(file.uri), 'text');
      if (res.kind === 'error') throw new Error(res.message);
      if (res.kind !== 'text') throw new Error('Unexpected result.');
      if (!res.text.trim()) {
        throw new Error('No text found. This looks like a scanned PDF — the pages are images, not text.');
      }
      setText(res.text);
    } catch (e: any) {
      Alert.alert('Could not extract text', e?.message ?? 'This PDF could not be read.');
    } finally { setBusy(false); }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <Host />
      <SafeAreaView style={{ flex: 1 }}>
        <View className="px-5 py-4 flex-row items-center border-b border-line bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back" style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">Extract Text</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <Text className="text-ink-2 text-sm mb-5">Pull the text out of a PDF so you can paste it into notes. Scanned pages will not work — they are images.</Text>

          <TouchableOpacity onPress={choose}
            className="w-full bg-card border-2 border-dashed border-ink-4 rounded-card p-card-pad items-center justify-center mb-5 shadow-hair"
            accessibilityRole="button">
            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-3">
              <Ionicons name="text-outline" size={32} color="#57534E" />
            </View>
            <Text className="text-ink font-display uppercase text-label">{file ? 'Choose a different PDF' : 'Choose PDF'}</Text>
          </TouchableOpacity>

          {file && (
            <View className="flex-row items-center bg-card rounded-card p-4 border border-line mb-5">
              <Ionicons name="document-text-outline" size={20} color="#57534E" />
              <Text className="text-ink text-sm ml-3 flex-1" numberOfLines={1}>{file.name}</Text>
            </View>
          )}

          {file && (
            <TouchableOpacity onPress={extract} disabled={busy}
              className={`w-full py-4 rounded-md items-center justify-center border-2 border-ink mb-3 ${busy ? 'bg-paper-2' : 'bg-brand-500'}`}
              accessibilityRole="button">
              {busy ? <ActivityIndicator color="#12100E" />
                : <Text className="font-display uppercase text-base text-ink">Extract text</Text>}
            </TouchableOpacity>
          )}

          {!!text && (
            <>
              <View className="flex-row items-center mt-4 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Extracted</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                <Text className="text-ink-3 font-mono text-label">{text.length}</Text>
              </View>
              <View className="bg-card rounded-card p-card-pad border border-line mb-4" style={{ maxHeight: 320 }}>
                <ScrollView nestedScrollEnabled>
                  <Text className="text-ink-2 text-sm" selectable>{text}</Text>
                </ScrollView>
              </View>
              <View className="flex-row mb-10" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={async () => { await Clipboard.setStringAsync(text); Alert.alert('Copied', 'The text is on your clipboard.'); }}
                  className="flex-1 flex-row items-center justify-center bg-ink border-2 border-ink rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button">
                  <Ionicons name="copy-outline" size={16} color="#F5F2EC" style={{ marginRight: 7 }} />
                  <Text className="font-display text-paper uppercase" style={{ fontSize: 12 }}>Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Share.share({ message: text })}
                  className="flex-1 flex-row items-center justify-center bg-card border-[1.5px] border-line rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button">
                  <Ionicons name="share-outline" size={16} color="#12100E" style={{ marginRight: 7 }} />
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 12 }}>Share</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
