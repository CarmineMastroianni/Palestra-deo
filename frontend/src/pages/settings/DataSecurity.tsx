import { useEffect, useState } from 'react';
import { ConfirmButton, PageHeader, useToast } from '../../components/ui';
import { exportCsv, exportEncrypted, exportPlainJson, importFile, wipeAllData } from '../../lib/backup';
import { biometricAvailable, registerBiometric, removePin, setPin } from '../../lib/lock';
import { fmtBytes } from '../../lib/media';
import { updateSettings, useSettings } from '../../lib/settings';

export function DataSettings() {
  const toast = useToast();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [importPass, setImportPass] = useState('');
  const [busy, setBusy] = useState('');
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);
  const run = async (label: string, fn: () => Promise<void>, ok: string) => {
    setBusy(label);
    try { await fn(); toast(ok); } catch (e) { toast(`Errore: ${(e as Error).message}`); }
    setBusy('');
  };
  return (
    <div className="page">
      <PageHeader title="I miei dati" back="/profilo" />
      {usage && <div className="small muted">Spazio usato: {fmtBytes(usage.used)}{usage.quota ? ` su ${fmtBytes(usage.quota)} disponibili` : ''} · archiviazione {persisted ? 'persistente ✓' : 'non persistente (il browser potrebbe liberarla se manca spazio: fai backup regolari)'}</div>}

      <div className="card">
        <h3>Backup cifrato</h3>
        <div className="small muted">Tutti i dati, foto e documenti inclusi, cifrati con AES-256 e la tua passphrase. Chiavi API, token e PIN non vengono inclusi.</div>
        <input className="input" type="password" placeholder="Passphrase (min. 8 caratteri)" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
        <input className="input" type="password" placeholder="Ripeti passphrase" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        <button className="btn primary block" disabled={!!busy || pass.length < 8 || pass !== pass2} onClick={() => run('enc', () => exportEncrypted(pass), 'Backup cifrato scaricato')}>{busy === 'enc' ? 'Cifratura…' : 'Scarica backup cifrato'}</button>
      </div>

      <div className="card">
        <h3>Esportazione leggibile</h3>
        <button className="btn block" disabled={!!busy} onClick={() => run('json', () => exportPlainJson(true), 'Esportazione completata')}>Esporta tutto in JSON (non cifrato)</button>
        <button className="btn block" disabled={!!busy} onClick={() => run('csv', exportCsv, 'File CSV scaricati')}>Esporta allenamenti e misure in CSV</button>
        <div className="tiny muted">I file non cifrati contengono dati personali: conservali con cura.</div>
      </div>

      <div className="card">
        <h3>Importa / ripristina</h3>
        <div className="small muted">Sostituisce i dati attuali con quelli del file (.mffbackup cifrato o .json).</div>
        <input className="input" type="password" placeholder="Passphrase (solo per backup cifrati)" value={importPass} onChange={(e) => setImportPass(e.target.value)} autoComplete="off" />
        <label className="btn block">{busy === 'imp' ? 'Ripristino…' : 'Scegli file di backup'}
          <input type="file" hidden accept=".json,.mffbackup,application/json" onChange={(e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f || !confirm('I dati attuali verranno sostituiti. Continuare?')) return;
            void run('imp', () => importFile(f, importPass), 'Dati ripristinati');
          }} />
        </label>
      </div>

      <div className="card">
        <h3 className="danger-text">Cancella tutti i dati</h3>
        <div className="small muted">Elimina definitivamente allenamenti, misure, foto, documenti e impostazioni da questo dispositivo. Non elimina i backup sul server (puoi cancellarli dal server).</div>
        <ConfirmButton onConfirm={async () => { await wipeAllData(); location.href = '/'; }} confirmText="Confermi? Tocca di nuovo per cancellare tutto">Cancella tutti i dati</ConfirmButton>
      </div>
    </div>
  );
}

export function SecuritySettingsPage() {
  const s = useSettings();
  const toast = useToast();
  const [pin, setPinV] = useState('');
  const [pin2, setPin2] = useState('');
  const [bio, setBio] = useState(false);
  useEffect(() => { void biometricAvailable().then(setBio); }, []);
  if (!s) return null;
  const sec = s.security;
  return (
    <div className="page">
      <PageHeader title="Sicurezza" back="/profilo" />
      <div className="card">
        <h3>PIN di accesso</h3>
        <div className="small muted">{sec.pinHash ? 'PIN attivo.' : 'Nessun PIN impostato.'} Da 4 a 8 cifre.</div>
        <input className="input" inputMode="numeric" type="password" placeholder="Nuovo PIN" value={pin} onChange={(e) => setPinV(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        <input className="input" inputMode="numeric" type="password" placeholder="Ripeti PIN" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))} />
        <button className="btn primary block" disabled={pin.length < 4 || pin !== pin2} onClick={async () => { await setPin(pin); setPinV(''); setPin2(''); toast('PIN impostato'); }}>{sec.pinHash ? 'Cambia PIN' : 'Imposta PIN'}</button>
        {sec.pinHash && <ConfirmButton onConfirm={async () => { await removePin(); toast('PIN rimosso'); }}>Rimuovi PIN</ConfirmButton>}
      </div>
      {sec.pinHash && (
        <div className="card">
          <h3>Biometria</h3>
          {bio ? (
            sec.biometricCredentialId
              ? <><div className="small">Sblocco biometrico attivo.</div><button className="btn" onClick={() => updateSettings('security', { biometricCredentialId: undefined })}>Disattiva</button></>
              : <button className="btn block" onClick={async () => { try { await registerBiometric(); toast('Biometria attivata'); } catch (e) { toast(`Non riuscito: ${(e as Error).message}`); } }}>Attiva impronta / volto</button>
          ) : <div className="notice small">Biometria non disponibile su questo dispositivo o browser.</div>}
        </div>
      )}
      <div className="card">
        <h3>Blocco automatico</h3>
        <label className="field">Blocca dopo che l'app resta in background per
          <select className="input" value={sec.autoLockMin} onChange={(e) => updateSettings('security', { autoLockMin: Number(e.target.value) })}>
            {[0, 1, 5, 15, 30, 60].map((m) => <option key={m} value={m}>{m === 0 ? 'subito' : `${m} minuti`}</option>)}
          </select>
        </label>
      </div>
      <div className="notice small">Il PIN protegge l'accesso all'interfaccia dell'app. I dati sono salvati nell'archivio del browser del telefono: per una protezione completa usa anche il blocco schermo del dispositivo. I backup esportati e quelli inviati al server sono cifrati.</div>
    </div>
  );
}
