import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { degrees, loadDoc, writeDoc } from './pdfKit';

const TURNS = [90, 180, 270] as const;

export default function RotatePdfScreen() {
  const [turn, setTurn] = useState<number>(90);
  return (
    <PdfToolShell
      title="Rotate PDF" icon="refresh-outline" runLabel="Rotate pages"
      blurb="Turn every page — useful for scans that came out sideways."
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-3">Rotation</Text>
          <View className="flex-row" style={{ gap: 10 }}>
            {TURNS.map((t) => (
              <TouchableOpacity
                key={t} onPress={() => setTurn(t)}
                className={`flex-1 items-center justify-center rounded-md border-2 ${turn === t ? 'bg-brand-500 border-ink' : 'bg-card border-line'}`}
                style={{ minHeight: 48 }} accessibilityRole="button"
              >
                <Text className={`font-display ${turn === t ? 'text-ink' : 'text-ink-2'}`}>{t}°</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      run={async (files) => {
        const doc = await loadDoc(files[0].uri);
        // existing rotation is preserved, so the turn is additive
        doc.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + turn) % 360)));
        const uri = await writeDoc(doc, 'fync-rotated.pdf');
        return { uri, filename: 'fync-rotated.pdf', note: `${doc.getPageCount()} pages turned ${turn}°.` };
      }}
    />
  );
}
