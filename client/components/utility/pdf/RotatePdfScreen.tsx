import React, { useState } from 'react';
import PdfToolShell, { OptionCard, Choices } from './PdfToolShell';
import { degrees, loadDoc, writeDoc } from './pdfKit';

const TURNS = [90, 180, 270].map((t) => ({ id: t, label: `${t}°` }));

export default function RotatePdfScreen() {
  const [turn, setTurn] = useState<number>(90);
  return (
    <PdfToolShell
      title="Rotate PDF" icon="refresh-outline" runLabel="Rotate pages"
      blurb="Turn every page — useful for scans that came out sideways."
      options={() => (
        <OptionCard label="Rotation">
          <Choices items={TURNS} value={turn} onChange={setTurn} />
        </OptionCard>
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
