import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { PDFDocument, loadDoc, writeDoc, parsePageRanges } from './pdfKit';

export default function SplitPdfScreen() {
  const [spec, setSpec] = useState('');
  return (
    <PdfToolShell
      title="Split PDF" icon="cut-outline" runLabel="Extract to new PDF"
      blurb="Pull a page range out of a PDF into its own file. Leave the range blank to keep everything."
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-2">Pages to keep</Text>
          <TextInput
            value={spec} onChangeText={setSpec}
            placeholder="e.g. 1-3, 5, 9-" placeholderTextColor="#8B857E"
            className="bg-card p-4 text-ink border-[1.5px] border-ink rounded-md"
            style={{ minHeight: 50 }} autoCapitalize="none"
          />
          <Text className="text-ink-3 text-label mt-2">Use commas for single pages and a dash for a range.</Text>
        </View>
      )}
      run={async (files) => {
        const src = await loadDoc(files[0].uri);
        const total = src.getPageCount();
        const idx = spec.trim() ? parsePageRanges(spec, total) : src.getPageIndices();
        if (!idx.length) throw new Error(`Could not read that range. This PDF has ${total} pages.`);
        const out = await PDFDocument.create();
        (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
        const uri = await writeDoc(out, 'fync-split.pdf');
        return { uri, filename: 'fync-split.pdf', note: `${idx.length} of ${total} pages kept.` };
      }}
    />
  );
}
