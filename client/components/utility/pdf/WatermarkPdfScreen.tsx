import React, { useState } from 'react';
import { FormField } from '../../ui/kit';
import PdfToolShell, { OptionCard } from './PdfToolShell';
import { loadDoc, writeDoc, rgb, degrees, StandardFonts } from './pdfKit';

export default function WatermarkPdfScreen() {
  const [text, setText] = useState('');
  return (
    <PdfToolShell
      title="Add Watermark" icon="water-outline" runLabel="Stamp watermark"
      blurb="Stamp text diagonally across every page — DRAFT, your name, a roll number."
      disabledReason={() => (text.trim() ? null : 'Enter watermark text')}
      options={() => (
        <OptionCard>
          <FormField label="Watermark text" value={text} onChangeText={setText} placeholder="e.g. DRAFT" />
        </OptionCard>
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
