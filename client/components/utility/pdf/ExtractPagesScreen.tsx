import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { PDFDocument, loadDoc, writeDoc, parsePageRanges } from './pdfKit';

export default function ExtractPagesScreen() {
  const [spec, setSpec] = useState('');
  return (
    <PdfToolShell
      title="Extract Pages" icon="documents-outline" runLabel="Extract pages"
      blurb="Pick out specific pages — a chapter, a question paper section — as a new PDF."
      disabledReason={() => (spec.trim() ? null : 'Enter pages to extract')}
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-2">Pages to extract</Text>
          <TextInput
            value={spec} onChangeText={setSpec}
            placeholder="e.g. 4, 10-14" placeholderTextColor="#8B857E"
            className="bg-card p-4 text-ink border-[1.5px] border-ink rounded-md"
            style={{ minHeight: 50 }} autoCapitalize="none"
          />
        </View>
      )}
      run={async (files) => {
        const src = await loadDoc(files[0].uri);
        const total = src.getPageCount();
        const idx = parsePageRanges(spec, total);
        if (!idx.length) throw new Error(`Could not read that range. This PDF has ${total} pages.`);
        const out = await PDFDocument.create();
        (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
        const uri = await writeDoc(out, 'fync-extract.pdf');
        return { uri, filename: 'fync-extract.pdf', note: `${idx.length} pages extracted.` };
      }}
    />
  );
}
