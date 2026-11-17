// Sincronizzazione opzionale con il backend Spring Boot.
// Il server riceve SOLO dati cifrati sul dispositivo (AES-GCM): non può leggerli.
import { getSettings, updateSettings } from './settings';
import { buildExport, restoreExport } from './backup';
import { decryptString, encryptString, sha256Hex, type EncryptedEnvelope } from './crypto';

function base(url: string): string { return url.replace(/\/+$/, ''); }

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const s = await getSettings();
  if (!s.cloud.serverUrl) throw new Error('Indirizzo del server non configurato');
  const res = await fetch(base(s.cloud.serverUrl) + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.cloud.token}`, ...(init.headers ?? {}) }
  });
  if (!res.ok) {
    let msg = `Errore ${res.status}`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res;
}

export async function checkServer(): Promise<{ status: string; aiEnabled: boolean; tokenConfigured: boolean }> {
  const s = await getSettings();
  if (!s.cloud.serverUrl) throw new Error('Indirizzo del server non configurato');
  const res = await fetch(base(s.cloud.serverUrl) + '/api/health');
  if (!res.ok) throw new Error(`Server non raggiungibile (${res.status})`);
  return res.json();
}

export async function uploadBackup(): Promise<string> {
  const s = await getSettings();
  if (!s.cloud.passphrase) throw new Error('Imposta la passphrase di cifratura prima di sincronizzare');
  const data = await buildExport({ includeMedia: s.cloud.includePhotos });
  const env = await encryptString(JSON.stringify(data), s.cloud.passphrase);
  const payload = JSON.stringify(env);
  await call('/api/backup', {
    method: 'PUT',
    body: JSON.stringify({ deviceId: s.cloud.deviceId, createdAt: new Date().toISOString(), payload, checksum: await sha256Hex(payload) })
  });
  const msg = `Backup cifrato inviato (${(payload.length / 1024 / 1024).toFixed(1)} MB)`;
  await updateSettings('cloud', { lastSyncAt: new Date().toISOString(), lastSyncResult: msg });
  return msg;
}

export async function downloadLatestBackup(): Promise<string> {
  const s = await getSettings();
  if (!s.cloud.passphrase) throw new Error('Imposta la passphrase di cifratura');
  const res = await call('/api/backup/latest');
  const rec = await res.json();
  const env = JSON.parse(rec.payload) as EncryptedEnvelope;
  const plain = await decryptString(env, s.cloud.passphrase);
  await restoreExport(JSON.parse(plain));
  const msg = `Dati ripristinati dal backup del ${new Date(rec.createdAt).toLocaleString('it-IT')}`;
  await updateSettings('cloud', { lastSyncAt: new Date().toISOString(), lastSyncResult: msg });
  return msg;
}

let pending = false;
/** Backup automatico quando c'è connessione (dopo un allenamento o al ritorno online). */
export async function autoSync(): Promise<void> {
  const s = await getSettings();
  if (!s.cloud.enabled || !s.cloud.autoSync || !s.cloud.serverUrl || !s.cloud.passphrase) return;
  if (!navigator.onLine) { pending = true; return; }
  try {
    await uploadBackup();
    pending = false;
  } catch (e) {
    pending = true;
    await updateSettings('cloud', { lastSyncResult: `Sincronizzazione non riuscita: ${(e as Error).message}` });
  }
}

export function installSyncListeners(): void {
  window.addEventListener('online', () => { if (pending) void autoSync(); });
}

export function markPendingSync(): void { pending = true; void autoSync(); }
