import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { loadDoc, writeDoc, rgb, StandardFonts } from './pdfKit';

const SPOTS = [
  { id: 'bc', label: 'Bottom centre' },
  { id: 'br', label: 'Bottom right' },
  { id: 'tr', label: 'Top right' },
] as const;

export default function PageNumbersScreen() {
  const [spot, setSpot] = useState<string>('bc');
  return (
    <PdfToolShell
      title="Page Numbers" icon="list-outline" runLabel="Add page numbers"
      blurb="Number every page — most assignment and thesis rules ask for it."
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-3">Position</Text>
          {SPOTS.map((s) => (
            <TouchableOpacity
              key={s.id} onPress={() => setSpot(s.id)}
              className={`flex-row items-center rounded-md border-2 px-4 mb-2 ${spot === s.id ? 'bg-brand-500 border-ink' : 'bg-card border-line'}`}
              style={{ minHeight: 48 }} accessibilityRole="button"
            >
              <Text className={`font-display uppercase text-label ${spot === s.id ? 'text-ink' : 'text-ink-2'}`}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      run={async (files) => {
        const doc = await loadDoc(files[0].uri);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const size = 10;
        doc.getPages().forEach((p, i) => {
          const label = `${i + 1}`;
          const w = font.widthOfTextAtSize(label, size);
          const { width, height } = p.getSize();
          const pos = spot === 'bc' ? { x: width / 2 - w / 2, y: 24 }
            : spot === 'br' ? { x: width - w - 36, y: 24 }
            : { x: width - w - 36, y: height - 36 };
          p.drawText(label, { ...pos, size, font, color: rgb(0.07, 0.06, 0.05) });
        });
        const uri = await writeDoc(doc, 'fync-numbered.pdf');
        return { uri, filename: 'fync-numbered.pdf', note: `${doc.getPageCount()} pages numbered.` };
      }}
    />
  );
}
