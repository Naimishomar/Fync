import React, { useState } from 'react';
import { FormField } from '../../ui/kit';
import PdfToolShell, { OptionCard } from './PdfToolShell';
import { PDFDocument, loadDoc, writeDoc, parsePageRanges } from './pdfKit';

export default function RemovePagesScreen() {
  const [spec, setSpec] = useState('');
  return (
    <PdfToolShell
      title="Remove Pages" icon="trash-outline" runLabel="Remove pages"
      blurb="Delete the pages you don't need and keep the rest."
      disabledReason={() => (spec.trim() ? null : 'Enter pages to remove')}
      options={() => (
        <OptionCard>
          <FormField label="Pages to remove" value={spec} onChangeText={setSpec} placeholder="e.g. 2, 6-8" autoCapitalize="none" />
        </OptionCard>
      )}
      run={async (files) => {
        const src = await loadDoc(files[0].uri);
        const total = src.getPageCount();
        const drop = new Set(parsePageRanges(spec, total));
        if (!drop.size) throw new Error(`Could not read that range. This PDF has ${total} pages.`);
        const keep = src.getPageIndices().filter((i) => !drop.has(i));
        if (!keep.length) throw new Error('That would remove every page.');
        const out = await PDFDocument.create();
        (await out.copyPages(src, keep)).forEach((p) => out.addPage(p));
        const uri = await writeDoc(out, 'fync-trimmed.pdf');
        return { uri, filename: 'fync-trimmed.pdf', note: `${drop.size} pages removed, ${keep.length} kept.` };
      }}
    />
  );
}
