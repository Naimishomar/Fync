import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, ListRow, SectionHeader } from '../../ui/kit';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from '../../ui/AlertModal';
import { pickPdf, readBase64, type PickedPdf } from './pdfKit';
import { usePdfJs } from './usePdfJs';
import { ToolScreen, PickZone, Thumb } from './PdfToolShell';

export default function PdfToImagesScreen() {
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
    <ToolScreen title="PDF to Images" before={<Host />} blurb="Turn each page into a JPG you can drop into slides or share on chat.">
      <PickZone icon="image-outline" label={file ? 'Choose a different PDF' : 'Choose PDF'} onPress={choose} />

      {file && <ListRow icon="document-text-outline" title={file.name} style={{ marginBottom: 12 }} />}

      {file && (
        <Button variant="primary" block title="Convert to images" onPress={convert} loading={busy} style={{ marginBottom: 12 }} />
      )}

      {pages.length > 0 && (
        <>
          <SectionHeader title="Pages" count={pages.length} />
          <View className="flex-row flex-wrap mb-5" style={{ gap: 12 }}>
            {pages.map((uri) => <Thumb key={uri} uri={uri} />)}
          </View>
          <Button variant="solid" block icon="download-outline" title="Save all to gallery" onPress={saveAll} />
        </>
      )}
    </ToolScreen>
  );
}
