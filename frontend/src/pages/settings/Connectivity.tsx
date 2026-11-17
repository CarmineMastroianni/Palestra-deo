import { useState } from 'react';
import { PageHeader, useToast } from '../../components/ui';
import { updateSettings, useSettings } from '../../lib/settings';
import { checkServer, downloadLatestBackup, uploadBackup } from '../../lib/sync';
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
          ['server', 'Claude tramite il tuo server', 'Usa il backend Spring Boot configurato in "Cloud e sincronizzazione": la chiave API resta sul server.'],
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
            {a.mode === 'server' && !s.cloud.serverUrl && <div className="notice warn small">Configura prima l'indirizzo del server in Profilo → Cloud e sincronizzazione.</div>}
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
  if (!s) return null;
  const c = s.cloud;
  const set = (p: Partial<typeof c>) => updateSettings('cloud', p);
  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    try { const m = await fn(); setStatus(m); toast(m); } catch (e) { setStatus(`Errore: ${(e as Error).message}`); }
    setBusy('');
  };
  return (
    <div className="page">
      <PageHeader title="Cloud e sincronizzazione" back="/profilo" />
      <div className="notice small">Facoltativo. L'app funziona completamente senza cloud. Se attivi la sincronizzazione, i dati vengono <b>cifrati sul telefono</b> con la tua passphrase (AES-256) prima di essere inviati al tuo server Spring Boot: il server non può leggerli.</div>
      <div className="card">
        <label className="check"><input type="checkbox" checked={c.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> Attiva sincronizzazione</label>
        <label className="field">Indirizzo del server<input className="input" inputMode="url" value={c.serverUrl} onChange={(e) => set({ serverUrl: e.target.value.trim() })} placeholder="https://mio-backend.onrender.com" /></label>
        <label className="field">Token di accesso (APP_TOKEN del server)<input className="input" type="password" value={c.token} onChange={(e) => set({ token: e.target.value.trim() })} autoComplete="off" /></label>
        <label className="field">Passphrase di cifratura<input className="input" type="password" value={c.passphrase} onChange={(e) => set({ passphrase: e.target.value })} autoComplete="new-password" /></label>
        <div className="tiny muted">Se perdi la passphrase i backup sul server non sono recuperabili. Usa la stessa passphrase su ogni dispositivo.</div>
        <label className="check"><input type="checkbox" checked={c.autoSync} onChange={(e) => set({ autoSync: e.target.checked })} /> Backup automatico dopo ogni allenamento e al ritorno della connessione</label>
        <label className="check"><input type="checkbox" checked={c.includePhotos} onChange={(e) => set({ includePhotos: e.target.checked })} /> Includi foto e documenti (cifrati) nel backup</label>
      </div>
      <div className="card">
        <button className="btn block" disabled={!!busy || !c.serverUrl} onClick={() => run('check', async () => { const h = await checkServer(); return `Server raggiungibile · token ${h.tokenConfigured ? 'configurato' : 'NON configurato'} · AI ${h.aiEnabled ? 'attiva' : 'non attiva'}`; })}>{busy === 'check' ? 'Verifica…' : 'Verifica connessione'}</button>
        <button className="btn primary block" disabled={!!busy || !c.serverUrl || !c.passphrase} onClick={() => run('up', uploadBackup)}>{busy === 'up' ? 'Invio…' : 'Invia backup ora'}</button>
        <button className="btn block" disabled={!!busy || !c.serverUrl || !c.passphrase} onClick={() => { if (confirm('Sostituire i dati di questo dispositivo con l\'ultimo backup del server?')) void run('down', downloadLatestBackup); }}>{busy === 'down' ? 'Ripristino…' : 'Ripristina dall\'ultimo backup del server'}</button>
        {status && <div className="small">{status}</div>}
        {c.lastSyncAt && <div className="tiny muted">Ultima sincronizzazione: {new Date(c.lastSyncAt).toLocaleString('it-IT')} · {c.lastSyncResult}</div>}
      </div>
      <div className="tiny muted">La sincronizzazione è di tipo "backup completo": l'ultimo backup inviato sostituisce i dati quando ripristini. Usa un dispositivo principale per registrare gli allenamenti.</div>
    </div>
  );
}
