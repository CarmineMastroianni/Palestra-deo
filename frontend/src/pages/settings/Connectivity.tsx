import { useEffect, useState } from 'react';
import { ConfirmButton, PageHeader, useToast } from '../../components/ui';
import { fmtBytes } from '../../lib/media';
import { currentUser, envSupabase, signIn, signOut, signUp } from '../../lib/supabase';
import { updateSettings, useSettings } from '../../lib/settings';
import { deleteAllCloudBackups, downloadLatestBackup, listBackups, uploadBackup } from '../../lib/sync';
import type { AiMode } from '../../db/types';

export function AiSettingsPage() {
  const s = useSettings();
  const [showKey, setShowKey] = useState(false);
  if (!s) return null;
  const a = s.ai;
  const set = (p: Partial<typeof a>) => updateSettings('ai', p);
  return (
    <div className="page">
      <PageHeader title="Assistente AI" back="/profilo" />
      <div className="card">
        <h3>Modalità</h3>
        {([
          ['local', 'Locale (consigliata, offline)', 'Risposte calcolate sul telefono dai dati registrati. Nessun dato esce dal dispositivo.'],
          ['server', 'Claude tramite Vercel', 'Usa la funzione /api/ai/chat del tuo progetto Vercel: la chiave API sta nelle variabili d\'ambiente di Vercel, non nel telefono. Richiede l\'accesso con il tuo account (Cloud e sincronizzazione).'],
          ['direct', 'Claude con la tua chiave API', 'Il telefono chiama direttamente l\'API di Anthropic con la tua chiave, salvata solo su questo dispositivo.']
        ] as [AiMode, string, string][]).map(([m, l, d]) => (
          <label key={m} className="check"><input type="radio" name="mode" checked={a.mode === m} onChange={() => set({ mode: m })} /><span><b>{l}</b><br /><span className="small muted">{d}</span></span></label>
        ))}
      </div>
      {a.mode !== 'local' && (
        <>
          <div className="card">
            <label className="field">Modello Claude
              <input className="input" value={a.model} onChange={(e) => set({ model: e.target.value.trim() })} />
            </label>
            <div className="tiny muted">Predefinito: claude-opus-5-5. Puoi indicare un altro modello disponibile sul tuo account.</div>
            {a.mode === 'direct' && (
              <>
                <label className="field">Chiave API Anthropic
                  <div className="row"><input className="input grow" type={showKey ? 'text' : 'password'} value={a.apiKey} onChange={(e) => set({ apiKey: e.target.value.trim() })} placeholder="sk-ant-…" autoComplete="off" />
                    <button className="btn sm" onClick={() => setShowKey((v) => !v)}>{showKey ? 'Nascondi' : 'Mostra'}</button></div>
                </label>
                <div className="notice warn small">La chiave è salvata solo su questo dispositivo e non è inclusa nei backup. Chiunque abbia accesso al telefono sbloccato potrebbe leggerla: proteggi l'app con il PIN. Per maggiore sicurezza usa la modalità "tramite server".</div>
              </>
            )}
            {a.mode === 'server' && <ServerAiStatus />}
          </div>
          <div className="card">
            <h3>Consenso ai dati inviati</h3>
            <div className="small muted">Per rispondere, l'assistente invia a Anthropic un riepilogo testuale. Profilo e programma sono sempre inclusi. Foto e documenti originali non vengono mai inviati.</div>
            <label className="check"><input type="checkbox" checked={a.consentTrainingData} onChange={(e) => set({ consentTrainingData: e.target.checked })} /> Allenamenti, carichi, check di recupero</label>
            <label className="check"><input type="checkbox" checked={a.consentBodyData} onChange={(e) => set({ consentBodyData: e.target.checked })} /> Peso e misure corporee</label>
            <label className="check"><input type="checkbox" checked={a.consentDietText} onChange={(e) => set({ consentDietText: e.target.checked })} /> Testo del piano alimentare (lettura automatica)</label>
          </div>
        </>
      )}
      <div className="tiny muted">L'assistente non inventa dati, non prescrive terapie e non modifica la dieta del nutrizionista. Senza connessione si usa automaticamente l'assistente locale.</div>
    </div>
  );
}

export function CloudSettingsPage() {
  const s = useSettings();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [backups, setBackups] = useState<{ name: string; size?: number }[] | null>(null);
  const env = envSupabase();
  useEffect(() => { void currentUser().then(setUser); }, [s?.cloud.supabaseUrl, s?.cloud.supabaseAnonKey]);
  if (!s) return null;
  const c = s.cloud;
  const set = (p: Partial<typeof c>) => updateSettings('cloud', p);
  const configured = !!((c.supabaseUrl || env.url) && (c.supabaseAnonKey || env.anonKey));
  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    try { const m = await fn(); if (m) { setStatus(m); toast(m); } } catch (e) { setStatus(`Errore: ${(e as Error).message}`); }
    setBusy('');
  };
  return (
    <div className="page">
      <PageHeader title="Cloud e sincronizzazione" back="/profilo" />
      <div className="notice small">Facoltativo: l'app funziona completamente senza cloud. Se lo attivi, i dati vengono <b>cifrati sul telefono</b> con la tua passphrase (AES-256) e salvati nel <b>tuo</b> progetto Supabase, in una cartella privata leggibile solo dal tuo account. Supabase non può leggerli.</div>

      <div className="card">
        <h3>1. Progetto Supabase</h3>
        {env.url && env.anonKey ? <div className="small accent">Configurato dalle variabili d'ambiente di Vercel.</div> : null}
        <label className="field">Project URL<input className="input" inputMode="url" value={c.supabaseUrl} onChange={(e) => set({ supabaseUrl: e.target.value.trim() })} placeholder={env.url || 'https://xxxx.supabase.co'} /></label>
        <label className="field">Chiave pubblica (anon / publishable)<input className="input" value={c.supabaseAnonKey} onChange={(e) => set({ supabaseAnonKey: e.target.value.trim() })} placeholder={env.anonKey ? 'da variabile Vercel' : 'eyJ… oppure sb_publishable_…'} autoComplete="off" /></label>
        <div className="tiny muted">Supabase → Project Settings → API. Usa solo la chiave pubblica: <b>mai</b> la "service_role"/secret.</div>
      </div>

      <div className="card">
        <h3>2. Account</h3>
        {user ? (
          <>
            <div className="small">Accesso effettuato come <b>{user.email}</b></div>
            <button className="btn" onClick={() => run('out', async () => { await signOut(); setUser(null); return 'Disconnesso'; })}>Esci</button>
          </>
        ) : (
          <>
            <label className="field">Email<input className="input" type="email" value={c.email} onChange={(e) => set({ email: e.target.value.trim() })} autoComplete="username" /></label>
            <label className="field">Password<input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            <div className="grid2">
              <button className="btn primary" disabled={!configured || !c.email || password.length < 6 || !!busy} onClick={() => run('in', async () => { await signIn(c.email, password); setPassword(''); setUser(await currentUser()); return 'Accesso effettuato'; })}>Accedi</button>
              <button className="btn" disabled={!configured || !c.email || password.length < 8 || !!busy} onClick={() => run('up', async () => { const m = await signUp(c.email, password); setUser(await currentUser()); return m; })}>Crea account</button>
            </div>
            <div className="tiny muted">Dopo aver creato il tuo account, in Supabase disattiva le nuove registrazioni (Authentication → Sign In / Providers → "Allow new users to sign up").</div>
          </>
        )}
      </div>

      <div className="card">
        <h3>3. Cifratura e backup</h3>
        <label className="field">Passphrase di cifratura (resta solo su questo dispositivo)<input className="input" type="password" value={c.passphrase} onChange={(e) => set({ passphrase: e.target.value })} autoComplete="new-password" /></label>
        <div className="tiny muted">Se perdi la passphrase i backup nel cloud non sono recuperabili. Usa la stessa su ogni dispositivo.</div>
        <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Attiva sincronizzazione</label>
        <label className="check"><input type="checkbox" checked={c.autoSync} onChange={(e) => set({ autoSync: e.target.checked })} /> Backup automatico dopo le modifiche e al ritorno della connessione</label>
        <label className="check"><input type="checkbox" checked={c.includePhotos} onChange={(e) => set({ includePhotos: e.target.checked })} /> Includi foto e documenti (cifrati) nel backup</label>
        <button className="btn primary block" disabled={!!busy || !user || !c.passphrase} onClick={() => run('send', uploadBackup)}>{busy === 'send' ? 'Invio…' : 'Invia backup ora'}</button>
        <button className="btn block" disabled={!!busy || !user || !c.passphrase} onClick={() => { if (confirm('Sostituire i dati di questo dispositivo con l\'ultimo backup nel cloud?')) void run('down', downloadLatestBackup); }}>{busy === 'down' ? 'Ripristino…' : 'Ripristina dall\'ultimo backup'}</button>
        <button className="btn block" disabled={!!busy || !user} onClick={() => run('list', async () => { const l = await listBackups(); setBackups(l); return `${l.length} backup nel cloud`; })}>Mostra backup nel cloud</button>
        {backups && backups.map((b) => <div key={b.name} className="tiny muted">{b.name.slice(0, 19).replace('T', ' ')} · {b.size ? fmtBytes(b.size) : ''}</div>)}
        {user && <ConfirmButton onConfirm={() => run('del', async () => `${await deleteAllCloudBackups()} backup eliminati dal cloud`)}>Elimina tutti i backup dal cloud</ConfirmButton>}
        {status && <div className="small">{status}</div>}
        {c.lastSyncAt && <div className="tiny muted">Ultima sincronizzazione: {new Date(c.lastSyncAt).toLocaleString('it-IT')} · {c.lastSyncResult}</div>}
      </div>
      <div className="tiny muted">Sincronizzazione di tipo "backup completo": il ripristino sostituisce i dati del dispositivo con l'ultimo backup. Usa un dispositivo principale per registrare gli allenamenti. Vengono conservate le ultime 10 versioni.</div>
    </div>
  );
}

function ServerAiStatus() {
  const [st, setSt] = useState<string>('Verifica…');
  useEffect(() => {
    fetch('/api/ai/chat').then((r) => r.json()).then((j: { aiEnabled?: boolean }) => setSt(j.aiEnabled ? 'Funzione AI attiva su Vercel ✓' : 'Funzione AI non configurata: imposta ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY e ALLOWED_EMAILS nelle variabili d\'ambiente di Vercel.'))
      .catch(() => setSt('Funzione AI non raggiungibile (disponibile solo sul sito pubblicato su Vercel).'));
  }, []);
  return <div className="notice small">{st}</div>;
}
