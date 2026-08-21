import React from 'react';
import PdfToolShell from './PdfToolShell';
import { PDFDocument, loadDoc, writeDoc } from './pdfKit';

export default function MergePdfScreen() {
  return (
    <PdfToolShell
      title="Merge PDF" icon="git-merge-outline" multiple runLabel="Merge files"
      blurb="Combine several PDFs into one file, in the order you add them."
      disabledReason={(f) => (f.length < 2 ? 'Add at least two PDFs' : null)}
      run={async (files) => {
        const out = await PDFDocument.create();
        for (const f of files) {
          const src = await loadDoc(f.uri);
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach((p) => out.addPage(p));
        }
        const uri = await writeDoc(out, 'fync-merged.pdf');
        return { uri, filename: 'fync-merged.pdf', note: `${files.length} files joined into ${out.getPageCount()} pages.` };
      }}
    />
  );
}
