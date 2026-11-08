import React, { useState } from 'react';
import PdfToolShell, { OptionCard, Choices } from './PdfToolShell';
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
        <OptionCard label="Position">
          <Choices items={SPOTS} value={spot} onChange={setSpot} />
        </OptionCard>
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
