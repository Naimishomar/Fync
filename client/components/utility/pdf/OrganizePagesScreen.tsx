import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import PdfToolShell from './PdfToolShell';
import { PDFDocument, loadDoc, writeDoc, parsePageRanges } from './pdfKit';

export default function OrganizePagesScreen() {
  const [order, setOrder] = useState('');
  const [reverse, setReverse] = useState(false);
  return (
    <PdfToolShell
      title="Organize PDF" icon="swap-vertical-outline" runLabel="Reorder pages"
      blurb="Put pages in the order you want. Any page you leave out is dropped."
      disabledReason={() => (order.trim() || reverse ? null : 'Enter an order, or choose reverse')}
      options={() => (
        <View className="bg-card rounded-card p-5 border border-line shadow-hair mb-5">
          <Text className="text-ink-3 font-display uppercase text-label mb-2">New page order</Text>
          <TextInput
            value={order} onChangeText={(t) => { setOrder(t); if (t) setReverse(false); }}
            placeholder="e.g. 3, 1, 2, 4-6" placeholderTextColor="#8B857E"
            className="bg-card p-4 text-ink border-[1.5px] border-ink rounded-md"
            style={{ minHeight: 50 }} autoCapitalize="none"
          />
          <Text
            onPress={() => { setReverse(!reverse); setOrder(''); }}
            className={`mt-3 font-display uppercase text-label ${reverse ? 'text-accent-text' : 'text-ink-3'}`}
          >
            {reverse ? '✓ Reverse every page' : 'Or reverse every page'}
          </Text>
        </View>
      )}
      run={async (files) => {
        const src = await loadDoc(files[0].uri);
        const total = src.getPageCount();
        let idx: number[];
        if (reverse) {
          idx = src.getPageIndices().reverse();
        } else {
          // order matters here, so keep duplicates and sequence as typed rather
          // than using the deduping range parser on the whole string
          idx = [];
          for (const part of order.split(',')) {
            const got = parsePageRanges(part, total);
            if (!got.length) throw new Error(`Could not read "${part.trim()}". This PDF has ${total} pages.`);
            idx.push(...got);
          }
        }
        const out = await PDFDocument.create();
        (await out.copyPages(src, idx)).forEach((p) => out.addPage(p));
        const uri = await writeDoc(out, 'fync-organized.pdf');
        return { uri, filename: 'fync-organized.pdf', note: `${idx.length} pages in the new order.` };
      }}
    />
  );
}
