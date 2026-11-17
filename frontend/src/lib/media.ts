import { useEffect, useState } from 'react';
import { db, uid } from '../db/db';

export async function saveMedia(file: Blob, name = 'file'): Promise<string> {
  const id = uid('m-');
  await db.media.put({ id, name, mime: file.type || 'application/octet-stream', size: file.size, createdAt: Date.now(), blob: file });
  return id;
}

export async function deleteMedia(id?: string): Promise<void> {
  if (id) await db.media.delete(id);
}

/** Riduce le foto per risparmiare spazio (lato lungo max 1600px, JPEG 0.85). Restano sul dispositivo. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** URL temporaneo per visualizzare un media salvato. */
export function useMediaUrl(id?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let revoked = false;
    let u: string | undefined;
    if (!id) { setUrl(undefined); return; }
    void db.media.get(id).then((m) => {
      if (!m || revoked) return;
      u = URL.createObjectURL(m.blob);
      setUrl(u);
    });
    return () => { revoked = true; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  return url;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
