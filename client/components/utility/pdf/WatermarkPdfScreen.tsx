import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { loadDoc, writeDoc, rgb, degrees, StandardFonts } from './pdfKit';

export default function WatermarkPdfScreen() {
  const [text, setText] = useState('');
  return (
    <PdfToolShell
      title="Add Watermark" icon="water-outline" runLabel="Stamp watermark"
      blurb="Stamp text diagonally across every page — DRAFT, your name, a roll number."
      disabledReason={() => (text.trim() ? null : 'Enter watermark text')}
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-2">Watermark text</Text>
          <TextInput
            value={text} onChangeText={setText}
            placeholder="e.g. DRAFT" placeholderTextColor="#8B857E"
            className="bg-card p-4 text-ink border-[1.5px] border-ink rounded-md"
            style={{ minHeight: 50 }}
          />
        </View>
      )}
      run={async (files) => {
        const doc = await loadDoc(files[0].uri);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const label = text.trim();
        doc.getPages().forEach((p) => {
          const { width, height } = p.getSize();
          // scale so the diagonal stamp always fits the page it lands on
          const size = Math.min(60, (width * 1.1) / Math.max(label.length, 1) * 1.6);
          const w = font.widthOfTextAtSize(label, size);
          p.drawText(label, {
            x: width / 2 - (w / 2) * 0.72,
            y: height / 2 - size / 2,
            size, font, color: rgb(0.55, 0.52, 0.49), opacity: 0.28,
            rotate: degrees(45),
          });
        });
        const uri = await writeDoc(doc, 'fync-watermarked.pdf');
        return { uri, filename: 'fync-watermarked.pdf', note: `"${label}" stamped on ${doc.getPageCount()} pages.` };
      }}
    />
  );
}
