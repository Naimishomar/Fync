import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { loadDoc, writeDoc } from './pdfKit';

const AMOUNTS = [
  { pt: 18, label: 'Light' },
  { pt: 36, label: 'Medium' },
  { pt: 60, label: 'Heavy' },
] as const;

export default function CropPdfScreen() {
  const [pt, setPt] = useState<number>(36);
  return (
    <PdfToolShell
      title="Crop Margins" icon="crop-outline" runLabel="Crop margins"
      blurb="Trim white margins so more of the text fits on screen when you read on a phone."
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-3">How much to trim</Text>
          <View className="flex-row" style={{ gap: 10 }}>
            {AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a.pt} onPress={() => setPt(a.pt)}
                className={`flex-1 items-center justify-center rounded-md border-2 ${pt === a.pt ? 'bg-brand-500 border-ink' : 'bg-card border-line'}`}
                style={{ minHeight: 48 }} accessibilityRole="button"
              >
                <Text className={`font-display uppercase text-label ${pt === a.pt ? 'text-ink' : 'text-ink-2'}`}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      run={async (files) => {
        const doc = await loadDoc(files[0].uri);
        doc.getPages().forEach((p) => {
          const { width, height } = p.getSize();
          // never crop past the page: cap the trim at 40% of each dimension
          const dx = Math.min(pt, width * 0.4), dy = Math.min(pt, height * 0.4);
          p.setCropBox(dx, dy, width - dx * 2, height - dy * 2);
        });
        const uri = await writeDoc(doc, 'fync-cropped.pdf');
        return { uri, filename: 'fync-cropped.pdf', note: `Margins trimmed on ${doc.getPageCount()} pages.` };
      }}
    />
  );
}
