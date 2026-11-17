import { useState } from 'react';
import { setSettingsField, updateSettings, useSettings } from '../lib/settings';
import { Icon } from '../components/ui';

export default function Onboarding() {
  const s = useSettings();
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);
  if (!s) return null;
  const p = s.profile;
  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <div className="page">
        <div className="row" style={{ gap: 12, marginTop: 20 }}>
          <img src="/icons/icon.svg" width={52} height={52} alt="" />
          <div><h1>My Fitness & Futsal</h1><div className="muted small">Il tuo personal trainer digitale</div></div>
        </div>
        {step === 0 && (
          <>
            <div className="card">
              <h2>Benvenuto</h2>
              <p className="muted" style={{ margin: 0 }}>L'app funziona interamente sul tuo telefono, anche offline. Nessun account è necessario: i tuoi dati restano sul dispositivo finché non scegli tu di attivare backup o assistente AI.</p>
              <label className="field">Come ti chiami? (facoltativo)
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
              </label>
            </div>
            <div className="card">
              <h3>Profilo iniziale</h3>
              <div className="small muted">Puoi modificare tutto in qualsiasi momento da Profilo.</div>
              <table className="simple"><tbody>
                <tr><td>Età</td><td>{p.age} anni</td></tr>
                <tr><td>Altezza</td><td>{p.heightCm} cm</td></tr>
                <tr><td>Peso iniziale</td><td>{p.startWeightKg} kg</td></tr>
                <tr><td>Sport</td><td>{p.sport}</td></tr>
                <tr><td>Obiettivo</td><td>{p.mainGoal}</td></tr>
                <tr><td>Periodo</td><td>novembre 2026 – marzo 2027</td></tr>
              </tbody></table>
            </div>
            <button className="btn primary xl block" onClick={async () => { await updateSettings('profile', { name: name.trim() }); setStep(1); }}>Continua</button>
          </>
        )}
        {step === 1 && (
          <>
            <div className="card">
              <h2><Icon name="lock" /> Privacy</h2>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>Foto, misure e documenti della dieta sono salvati solo su questo dispositivo.</li>
                <li>Nessun dato viene inviato a servizi esterni senza il tuo consenso esplicito.</li>
                <li>Puoi proteggere l'app con un PIN o la biometria (Profilo → Sicurezza).</li>
                <li>Puoi esportare o cancellare tutti i dati in qualsiasi momento.</li>
                <li>Consiglio: esporta periodicamente un backup cifrato. Se il browser cancella i dati del sito, senza backup andrebbero persi.</li>
              </ul>
            </div>
            <div className="card">
              <h3>Installa sul telefono</h3>
              <p className="small muted" style={{ margin: 0 }}><b>Android (Chrome):</b> menu ⋮ → "Installa app" o "Aggiungi a schermata Home".<br /><b>iPhone (Safari):</b> pulsante Condividi → "Aggiungi alla schermata Home".</p>
            </div>
            <button className="btn primary xl block" onClick={() => setSettingsField('onboardingDone', true)}>Inizia</button>
          </>
        )}
      </div>
    </div>
  );
}
