// Esportazione, importazione, backup cifrato e cancellazione dei dati.
import { db, DATA_TABLES, type DataTable } from '../db/db';
import type { AppSettings, MediaBlob } from '../db/types';
import { decryptString, encryptString, type EncryptedEnvelope } from './crypto';

export interface ExportFile {
  format: 'mff-export-v1';
  app: 'My Fitness & Futsal';
  exportedAt: string;
  tables: Partial<Record<DataTable, unknown[]>>;
}

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

async function dataUrlToBlob(u: string): Promise<Blob> {
  const res = await fetch(u);
  return res.blob();
}

/** Rimuove i segreti (chiavi API, token, passphrase, PIN) dalle impostazioni esportate. */
function stripSecrets(s: AppSettings): AppSettings {
  return {
    ...s,
    ai: { ...s.ai, apiKey: '' },
    cloud: { ...s.cloud, passphrase: '' },
    security: { autoLockMin: s.security.autoLockMin }
  };
}

export async function buildExport(opts: { includeMedia: boolean } = { includeMedia: true }): Promise<ExportFile> {
  const tables: ExportFile['tables'] = {};
  for (const t of DATA_TABLES) {
    if (t === 'live') continue;
    let rows = await (db[t] as unknown as { toArray: () => Promise<unknown[]> }).toArray();
    if (t === 'settings') rows = (rows as AppSettings[]).map(stripSecrets);
    if (t === 'media') {
      if (!opts.includeMedia) { rows = []; }
      else {
        rows = await Promise.all((rows as MediaBlob[]).map(async (m) => ({ ...m, blob: await blobToDataUrl(m.blob) })));
      }
    }
    tables[t] = rows;
  }
  return { format: 'mff-export-v1', app: 'My Fitness & Futsal', exportedAt: new Date().toISOString(), tables };
}

export async function restoreExport(file: ExportFile, opts: { keepLocalSecrets: boolean } = { keepLocalSecrets: true }): Promise<void> {
  if (file.format !== 'mff-export-v1') throw new Error('File non valido: formato non riconosciuto');
  const current = await db.settings.get('app');
  const media = await Promise.all(((file.tables.media ?? []) as (Omit<MediaBlob, 'blob'> & { blob: string })[]).map(async (m) => ({ ...m, blob: await dataUrlToBlob(m.blob) })));
  await db.transaction('rw', DATA_TABLES.map((t) => db[t]), async () => {
    for (const t of DATA_TABLES) {
      const rows = t === 'media' ? media : file.tables[t];
      if (!rows) continue;
      const table = db[t] as unknown as { clear: () => Promise<void>; bulkPut: (r: unknown[]) => Promise<unknown> };
      await table.clear();
      if (t === 'settings' && current && opts.keepLocalSecrets) {
        const s = (rows as AppSettings[])[0];
        if (s) await table.bulkPut([{ ...s, ai: { ...s.ai, apiKey: current.ai.apiKey }, cloud: { ...s.cloud, passphrase: current.cloud.passphrase, deviceId: current.cloud.deviceId }, security: current.security }]);
        continue;
      }
      await table.bulkPut(rows);
    }
  });
}

export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportPlainJson(includeMedia: boolean): Promise<void> {
  const data = await buildExport({ includeMedia });
  downloadText(`my-fitness-futsal-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
}

export async function exportEncrypted(passphrase: string): Promise<void> {
  const data = await buildExport({ includeMedia: true });
  const env = await encryptString(JSON.stringify(data), passphrase);
  downloadText(`my-fitness-futsal-backup-${new Date().toISOString().slice(0, 10)}.mffbackup`, JSON.stringify(env));
}

export async function importFile(file: File, passphrase?: string): Promise<void> {
  const text = await file.text();
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Il file non è un backup valido'); }
  const obj = parsed as { format?: string };
  if (obj.format === 'mff-enc-v1') {
    if (!passphrase) throw new Error('Questo backup è cifrato: inserisci la passphrase');
    const plain = await decryptString(parsed as EncryptedEnvelope, passphrase);
    await restoreExport(JSON.parse(plain));
    return;
  }
  await restoreExport(parsed as ExportFile);
}

export async function exportCsv(): Promise<void> {
  const [sets, exercises, measurements] = await Promise.all([db.sets.toArray(), db.exercises.toArray(), db.measurements.toArray()]);
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const setsCsv = ['data;esercizio;serie;ripetizioni;carico_kg;rir;durata_s;lato;tecnica_ok;note',
    ...sets.sort((a, b) => a.timestamp - b.timestamp).map((s) => [s.date, names.get(s.exerciseId) ?? s.exerciseId, s.setIndex, s.reps, s.weightKg, s.rir ?? '', s.durationSec ?? '', s.side ?? '', s.techniqueOk ? 'si' : 'no', s.notes ?? ''].map(esc).join(';'))].join('\n');
  const mCsv = ['data;peso;girovita;addome;fianchi;torace;braccio_dx;braccio_sx;coscia_dx;coscia_sx;polpaccio;note',
    ...measurements.sort((a, b) => a.date.localeCompare(b.date)).map((m) => [m.date, m.weight, m.waist, m.abdomen, m.hips, m.chest, m.armR, m.armL, m.thighR, m.thighL, m.calf, m.notes].map(esc).join(';'))].join('\n');
  downloadText('allenamenti.csv', '﻿' + setsCsv, 'text/csv');
  setTimeout(() => downloadText('misurazioni.csv', '﻿' + mCsv, 'text/csv'), 400);
}

export async function wipeAllData(): Promise<void> {
  await db.delete();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
}
