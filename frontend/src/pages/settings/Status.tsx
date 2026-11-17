import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { biometricAvailable } from '../../lib/lock';
import { notificationsSupported } from '../../lib/feedback';

interface Check { label: string; ok: boolean | null; note?: string }

export function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  useEffect(() => {
    void (async () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
      const sw = 'serviceWorker' in navigator ? !!(await navigator.serviceWorker.getRegistration()) : false;
      const persisted = (await navigator.storage?.persisted?.()) ?? null;
      let webgl = false;
      try { const c = document.createElement('canvas'); webgl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { /* */ }
      setChecks([
        { label: 'App installata (schermata Home)', ok: standalone, note: standalone ? undefined : 'Aprila dall\'icona sulla schermata Home per lo schermo intero.' },
        { label: 'Funzionamento offline (Service Worker)', ok: sw, note: sw ? undefined : 'Attivo dopo il primo caricamento in produzione (HTTPS).' },
        { label: 'Archivio locale (IndexedDB)', ok: 'indexedDB' in window },
        { label: 'Archiviazione persistente', ok: persisted, note: persisted ? undefined : 'Il browser può liberare lo spazio: esegui backup regolari.' },
        { label: 'Notifiche', ok: notificationsSupported() ? Notification.permission === 'granted' : false, note: notificationsSupported() ? `Permesso: ${Notification.permission}` : 'Non supportate da questo browser' },
        { label: 'Vibrazione', ok: 'vibrate' in navigator, note: 'vibrate' in navigator ? undefined : 'Non supportata (es. iPhone)' },
        { label: 'Schermo sempre acceso', ok: 'wakeLock' in navigator },
        { label: 'Sintesi vocale', ok: 'speechSynthesis' in window },
        { label: 'Biometria', ok: await biometricAvailable() },
        { label: 'Grafica 3D (WebGL)', ok: webgl },
        { label: 'Connessione', ok: navigator.onLine, note: navigator.onLine ? undefined : 'Offline: le funzioni locali restano disponibili' }
      ]);
    })();
  }, []);
  return (
    <div className="page">
      <PageHeader title="Stato funzioni" back="/profilo" />
      <div className="card">
        <h3>Questo dispositivo</h3>
        {checks.map((c) => (
          <div key={c.label} className="row between small">
            <span>{c.label}{c.note && <><br /><span className="tiny muted">{c.note}</span></>}</span>
            <span className={`badge ${c.ok ? 'ok' : c.ok === false ? 'warn' : ''}`}>{c.ok ? 'sì' : c.ok === false ? 'no' : '?'}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Funzionalità</h3>
        <table className="simple"><tbody>
          {[
            ['Programma settimanale, schede A/B, modifica completa', 'Disponibile'],
            ['Allenamento live: contatore manuale, timer, recuperi, carichi', 'Disponibile'],
            ['Doppia progressione con conferma, fasi e scarichi', 'Disponibile'],
            ['Check di recupero e riduzione volume', 'Disponibile'],
            ['Storico, grafici, misure, foto prima/dopo', 'Disponibile'],
            ['Report PDF mensile', 'Disponibile'],
            ['Dieta: caricamento PDF/Word/foto, lettura automatica, diario', 'Disponibile (lettura euristica da verificare; .doc vecchio formato solo consultabile)'],
            ['Assistente locale sui dati', 'Disponibile'],
            ['Assistente Claude', 'Facoltativo: spento di default; richiede una chiave API configurata da te (Vercel o personale)'],
            ['Backup cifrato, esportazione, cancellazione', 'Disponibile'],
            ['Sincronizzazione cloud', 'Facoltativa: richiede il tuo progetto Supabase'],
            ['Manichino 3D dalle misure, muscoli evidenziati, schema del movimento', 'Disponibile (non fotorealistico)'],
            ['Import avatar GLB/GLTF', 'Disponibile'],
            ['Conversione automatica foto → avatar 3D realistico', 'NON disponibile: usare un servizio esterno e importare il GLB'],
            ['Immagini/video degli esercizi', 'Caricabili dall\'utente; nessun contenuto preinstallato'],
            ['Notifiche con app chiusa', 'Non garantite: dipendono dal sistema']
          ].map(([a, b]) => <tr key={a}><td>{a}</td><td className={b.startsWith('NON') ? 'warn-text' : b.startsWith('Disponibile') ? 'accent' : 'muted'}>{b}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
