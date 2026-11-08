import React, { useState } from 'react';
import { Chip, FormField } from '../../ui/kit';
import PdfToolShell, { OptionCard } from './PdfToolShell';
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
        <OptionCard>
          <FormField
            label="New page order" value={order} onChangeText={(t) => { setOrder(t); if (t) setReverse(false); }}
            placeholder="e.g. 3, 1, 2, 4-6" autoCapitalize="none"
          />
          <Chip
            icon={reverse ? 'checkmark' : 'swap-vertical-outline'}
            label={reverse ? 'Reversing every page' : 'Or reverse every page'}
            active={reverse}
            onPress={() => { setReverse(!reverse); setOrder(''); }}
            style={{ alignSelf: 'flex-start' }}
          />
        </OptionCard>
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
