/**
 * Camera -> multi-page PDF. Uses expo-print's HTML renderer rather than
 * pdf-lib: the pages are photos, and one <img> per page is both simpler and
 * smaller than embedding JPEGs by hand.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, SectionHeader } from '../../ui/kit';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from '../../ui/AlertModal';
import { ToolScreen, PickZone, Thumb, PdfResult } from './PdfToolShell';

export default function ScanToPdfScreen() {
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
    <ToolScreen title="Scan to PDF" blurb="Photograph notes or handouts page by page, then save them as one PDF.">
      <PickZone icon="camera-outline" label={shots.length ? 'Scan another page' : 'Scan first page'} onPress={capture} />

      {shots.length > 0 && (
        <>
          <SectionHeader title="Pages" count={shots.length} style={{ marginTop: 0 }} />
          <View className="flex-row flex-wrap mb-5" style={{ gap: 12 }}>
            {shots.map((uri, i) => (
              <Thumb
                key={`${uri}-${i}`} uri={uri}
                onRemove={() => { setShots(shots.filter((_, j) => j !== i)); setPdf(null); }}
                removeLabel={`Remove page ${i + 1}`}
              />
            ))}
          </View>

          <Button
            variant="primary" block title={`Build PDF (${shots.length} pages)`} onPress={build}
            loading={busy} style={{ marginBottom: 12 }}
          />
        </>
      )}

      {pdf && <PdfResult uri={pdf} filename="fync-scan.pdf" note={`${shots.length} scanned pages.`} />}
    </ToolScreen>
  );
}
