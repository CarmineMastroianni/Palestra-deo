// Sincronizzazione opzionale tramite Supabase Storage (bucket privato "backups").
// I dati vengono cifrati SUL DISPOSITIVO (AES-256-GCM) prima dell'invio: Supabase conserva
// solo file illeggibili senza la tua passphrase. Ogni utente accede solo alla propria cartella (RLS).
import { getSettings, updateSettings } from './settings';
import { buildExport, restoreExport } from './backup';
import { decryptString, encryptString, type EncryptedEnvelope } from './crypto';
import { getSupabase } from './supabase';

const BUCKET = 'backups';
const KEEP_VERSIONS = 10;

async function session() {
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('Accedi con il tuo account Supabase (Profilo → Cloud)');
  return { sb, uid: data.session.user.id };
}

export async function listBackups(): Promise<{ name: string; created_at?: string; size?: number }[]> {
  const { sb, uid } = await session();
  const { data, error } = await sb.storage.from(BUCKET).list(uid, { limit: 100, sortBy: { column: 'name', order: 'desc' } });
  if (error) throw new Error(storageError(error.message));
  return (data ?? []).filter((f) => f.name.endsWith('.mffbackup')).map((f) => ({ name: f.name, created_at: f.created_at ?? undefined, size: (f.metadata as { size?: number } | null)?.size }));
}

export async function uploadBackup(): Promise<string> {
  const s = await getSettings();
  if (!s.cloud.passphrase) throw new Error('Imposta la passphrase di cifratura prima di sincronizzare');
  const { sb, uid } = await session();
  const data = await buildExport({ includeMedia: s.cloud.includePhotos });
  const env = await encryptString(JSON.stringify(data), s.cloud.passphrase);
  const payload = new Blob([JSON.stringify(env)], { type: 'application/octet-stream' });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}_${s.cloud.deviceId}.mffbackup`;
  const { error } = await sb.storage.from(BUCKET).upload(`${uid}/${name}`, payload, { upsert: false, contentType: 'application/octet-stream' });
  if (error) throw new Error(storageError(error.message));
  // conserva solo le ultime versioni
  try {
    const all = await listBackups();
    const old = all.slice(KEEP_VERSIONS).map((f) => `${uid}/${f.name}`);
    if (old.length) await sb.storage.from(BUCKET).remove(old);
  } catch { /* non bloccante */ }
  const msg = `Backup cifrato inviato (${(payload.size / 1024 / 1024).toFixed(1)} MB)`;
  await updateSettings('cloud', { lastSyncAt: new Date().toISOString(), lastSyncResult: msg });
  return msg;
}

export async function downloadLatestBackup(): Promise<string> {
  const s = await getSettings();
  if (!s.cloud.passphrase) throw new Error('Imposta la passphrase di cifratura');
  const { sb, uid } = await session();
  const latest = (await listBackups())[0];
  if (!latest) throw new Error('Nessun backup presente');
  const { data, error } = await sb.storage.from(BUCKET).download(`${uid}/${latest.name}`);
  if (error || !data) throw new Error(storageError(error?.message ?? 'download non riuscito'));
  const env = JSON.parse(await data.text()) as EncryptedEnvelope;
  const plain = await decryptString(env, s.cloud.passphrase);
  await restoreExport(JSON.parse(plain));
  const msg = `Dati ripristinati dal backup ${latest.name.slice(0, 16).replace('T', ' ')}`;
  await updateSettings('cloud', { lastSyncAt: new Date().toISOString(), lastSyncResult: msg });
  return msg;
}

export async function deleteAllCloudBackups(): Promise<number> {
  const { sb, uid } = await session();
  const all = await listBackups();
  if (!all.length) return 0;
  const { error } = await sb.storage.from(BUCKET).remove(all.map((f) => `${uid}/${f.name}`));
  if (error) throw new Error(storageError(error.message));
  return all.length;
}

function storageError(m: string): string {
  if (/bucket not found/i.test(m)) return 'Bucket "backups" non trovato: esegui supabase/setup.sql nel tuo progetto Supabase';
  if (/row-level security|unauthorized|not allowed/i.test(m)) return 'Accesso negato: controlla di aver eseguito supabase/setup.sql e di aver fatto l\'accesso';
  if (/payload too large|exceeded the maximum/i.test(m)) return 'Backup troppo grande per il limite di Supabase: disattiva "Includi foto" o aumenta il limite del bucket';
  return m;
}

let pending = false;
/** Backup automatico quando c'è connessione (dopo un allenamento o al ritorno online). */
export async function autoSync(): Promise<void> {
  const s = await getSettings();
  if (!s.cloud.enabled || !s.cloud.autoSync || !s.cloud.passphrase) return;
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

let debounce: number | undefined;
/** Segnala modifiche: il backup parte 20 s dopo l'ultima modifica (evita invii ripetuti). */
export function markPendingSync(): void {
  pending = true;
  window.clearTimeout(debounce);
  debounce = window.setTimeout(() => void autoSync(), 20000);
}
