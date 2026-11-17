// Estrazione del testo dai documenti della dieta. Avviene interamente sul dispositivo:
// nessun documento viene inviato a servizi esterni.
// Nota OCR: Tesseract scarica il proprio motore e il modello di lingua italiana (dal CDN jsDelivr)
// al primo utilizzo; l'immagine NON viene inviata, il riconoscimento è locale.

export type ExtractMethod = 'pdf' | 'docx' | 'ocr' | 'nessuno';

export async function extractPdfText(blob: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // ricostruisce le righe usando la coordinata verticale
    const lines = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as { str: string; transform: number[] }[]) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5]);
      const key = [...lines.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      const arr = lines.get(key) ?? [];
      arr.push({ x: it.transform[4], s: it.str });
      lines.set(key, arr);
    }
    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0]);
    pages.push(sorted.map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
  }
  return pages.join('\n');
}

export async function extractDocxText(blob: Blob): Promise<{ text: string; html: string }> {
  const mammoth = await import('mammoth');
  const buf = await blob.arrayBuffer();
  const [raw, html] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer: buf }),
    mammoth.convertToHtml({ arrayBuffer: buf })
  ]);
  return { text: raw.value, html: html.value };
}

export async function ocrImage(blob: Blob, onProgress?: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('ita', 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') onProgress?.(m.progress); }
  });
  try {
    const { data } = await worker.recognize(blob);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export function detectKind(mime: string, name: string): 'pdf' | 'docx' | 'image' | 'doc' | 'text' | 'other' {
  const n = name.toLowerCase();
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx') || mime.includes('wordprocessingml')) return 'docx';
  if (n.endsWith('.doc') || mime === 'application/msword') return 'doc';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('text/') || n.endsWith('.txt')) return 'text';
  return 'other';
}
