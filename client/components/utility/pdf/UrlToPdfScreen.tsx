import React, { useState } from 'react';
import { Button, FormField } from '../../ui/kit';
import * as Print from 'expo-print';
import { Alert } from '../../ui/AlertModal';
import { ToolScreen, OptionCard, PdfResult } from './PdfToolShell';

export default function UrlToPdfScreen() {
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
    <ToolScreen title="Web Page to PDF" blurb="Save a syllabus page, notice or article as a PDF you can read offline.">
      <OptionCard>
        <FormField
          label="Page address" hint="Pages that need a login will not save."
          value={url} onChangeText={(t) => { setUrl(t); setPdf(null); }}
          placeholder="college.ac.in/notices" autoCapitalize="none" keyboardType="url" autoCorrect={false}
        />
      </OptionCard>

      <Button
        variant="primary" block title="Save as PDF" onPress={build}
        loading={busy} disabled={!url.trim()} style={{ marginBottom: 12 }}
      />

      {pdf && <PdfResult uri={pdf} filename="fync-page.pdf" note="The page was saved as a PDF." />}
    </ToolScreen>
  );
}
