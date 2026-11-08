import React, { useState } from 'react';
import PdfToolShell, { OptionCard, Choices } from './PdfToolShell';
import { loadDoc, writeDoc } from './pdfKit';

const AMOUNTS = [
  { id: 18, label: 'Light' },
  { id: 36, label: 'Medium' },
  { id: 60, label: 'Heavy' },
] as const;

export default function CropPdfScreen() {
  const [pt, setPt] = useState<number>(36);
  return (
    <PdfToolShell
      title="Crop Margins" icon="crop-outline" runLabel="Crop margins"
      blurb="Trim white margins so more of the text fits on screen when you read on a phone."
      options={() => (
        <OptionCard label="How much to trim">
          <Choices items={AMOUNTS} value={pt} onChange={setPt} />
        </OptionCard>
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
