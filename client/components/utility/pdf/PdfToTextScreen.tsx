import React, { useState } from 'react';
import { View, Text, ScrollView, Share } from 'react-native';
import { Button, Card, ListRow, SectionHeader } from '../../ui/kit';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../../ui/AlertModal';
import { pickPdf, readBase64, type PickedPdf } from './pdfKit';
import { usePdfJs } from './usePdfJs';
import { ToolScreen, PickZone } from './PdfToolShell';

export default function PdfToTextScreen() {
  const { run, Host, prepare } = usePdfJs();
  const [file, setFile] = useState<PickedPdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');

  const choose = async () => {
    let picked: PickedPdf[];
    try { picked = await pickPdf(false); } catch { Alert.alert('Error', 'Could not open that file.'); return; }
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
    <ToolScreen
      title="Extract Text" before={<Host />}
      blurb="Pull the text out of a PDF so you can paste it into notes. Scanned pages will not work — they are images."
    >
      <PickZone icon="text-outline" label={file ? 'Choose a different PDF' : 'Choose PDF'} onPress={choose} />

      {file && <ListRow icon="document-text-outline" title={file.name} style={{ marginBottom: 12 }} />}

      {file && (
        <Button variant="primary" block title="Extract text" onPress={extract} loading={busy} style={{ marginBottom: 12 }} />
      )}

      {!!text && (
        <>
          <SectionHeader title="Extracted" count={`${text.length} chars`} />
          <Card padded style={{ maxHeight: 320, marginBottom: 16 }}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text className="text-ink-2 text-sm" selectable>{text}</Text>
            </ScrollView>
          </Card>
          <View className="flex-row" style={{ gap: 12 }}>
            <Button
              variant="solid" icon="copy-outline" title="Copy" style={{ flex: 1 }}
              onPress={async () => { await Clipboard.setStringAsync(text); Alert.alert('Copied', 'The text is on your clipboard.'); }}
            />
            <Button icon="share-outline" title="Share" style={{ flex: 1 }} onPress={() => Share.share({ message: text })} />
          </View>
        </>
      )}
    </ToolScreen>
  );
}
