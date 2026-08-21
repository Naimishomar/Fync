import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Print from 'expo-print';
import { Alert } from '../../ui/AlertModal';
import { sharePdf, savePdfToDevice } from './pdfKit';

export default function UrlToPdfScreen() {
  const navigation = useNavigation<any>();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);

  const build = async () => {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
    let parsed: URL;
    try { parsed = new URL(target); } catch { Alert.alert('Check the link', 'That does not look like a valid web address.'); return; }

    setBusy(true);
    try {
      const res = await fetch(target);
      if (!res.ok) throw new Error(`The page returned ${res.status}.`);
      let html = await res.text();
      // relative <img>/<link> paths resolve against the app bundle otherwise,
      // so the printed page loses all of its styling and images
      if (!/<base\s/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${parsed.origin}${parsed.pathname}">`);
      }
      const { uri } = await Print.printToFileAsync({ html });
      setPdf(uri);
    } catch (e: any) {
      Alert.alert('Could not save the page', e?.message ?? 'The page could not be fetched.');
    } finally { setBusy(false); }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="px-5 py-4 flex-row items-center border-b border-line bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back" style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">Web Page to PDF</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <Text className="text-ink-2 text-sm mb-5">Save a syllabus page, notice or article as a PDF you can read offline.</Text>

          <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
            <Text className="text-ink-3 font-display uppercase text-label mb-2">Page address</Text>
            <TextInput
              value={url} onChangeText={(t) => { setUrl(t); setPdf(null); }}
              placeholder="college.ac.in/notices" placeholderTextColor="#8B857E"
              className="bg-card p-4 text-ink border-[1.5px] border-ink rounded-md"
              style={{ minHeight: 50 }} autoCapitalize="none" keyboardType="url" autoCorrect={false}
            />
            <Text className="text-ink-3 text-label mt-2">Pages that need a login will not save.</Text>
          </View>

          <TouchableOpacity onPress={build} disabled={busy || !url.trim()}
            className={`w-full py-4 rounded-md items-center justify-center border-2 border-ink mb-3 ${busy || !url.trim() ? 'bg-paper-2' : 'bg-brand-500'}`}
            accessibilityRole="button">
            {busy ? <ActivityIndicator color="#12100E" />
              : <Text className={`font-display uppercase text-base ${url.trim() ? 'text-ink' : 'text-ink-3'}`}>Save as PDF</Text>}
          </TouchableOpacity>

          {pdf && (
            <View className="bg-card rounded-card p-card-pad border-2 border-ink mb-10" style={{ marginTop: 8 }}>
              <Text className="text-ink font-display uppercase text-label mb-1">Done</Text>
              <Text className="text-ink-2 text-sm mb-4">The page was saved as a PDF.</Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity onPress={() => sharePdf(pdf).catch((e) => Alert.alert('Error', e.message))}
                  className="flex-1 flex-row items-center justify-center bg-ink border-2 border-ink rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button">
                  <Ionicons name="share-outline" size={16} color="#F5F2EC" style={{ marginRight: 7 }} />
                  <Text className="font-display text-paper uppercase" style={{ fontSize: 12 }}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => savePdfToDevice(pdf, 'fync-page.pdf')
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
