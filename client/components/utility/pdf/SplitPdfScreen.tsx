import React, { useState } from 'react';
import { FormField } from '../../ui/kit';
import PdfToolShell, { OptionCard } from './PdfToolShell';
import { PDFDocument, loadDoc, writeDoc, parsePageRanges } from './pdfKit';

export default function SplitPdfScreen() {
  const [spec, setSpec] = useState('');
  return (
    <PdfToolShell
      title="Split PDF" icon="cut-outline" runLabel="Extract to new PDF"
      blurb="Pull a page range out of a PDF into its own file. Leave the range blank to keep everything."
      options={() => (
        <OptionCard>
          <FormField label="Pages to keep" value={spec} onChangeText={setSpec} placeholder="e.g. 1-3, 5, 9-" hint="Use commas for single pages and a dash for a range." autoCapitalize="none" />
        </OptionCard>
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
