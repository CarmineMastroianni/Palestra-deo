import { useEffect, useState } from 'react';
import { verifyBiometric, verifyPin } from '../lib/lock';
import { useSettings } from '../lib/settings';
import { Icon } from './ui';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const settings = useSettings();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const hasBio = !!settings?.security.biometricCredentialId;

  const tryBio = async () => { if (await verifyBiometric()) onUnlock(); };
  useEffect(() => { if (hasBio) void tryBio(); /* eslint-disable-next-line */ }, [hasBio]);

  const press = async (d: string) => {
    setErr('');
    const next = (pin + d).slice(0, 8);
    setPin(next);
    if (next.length >= 4 && (await verifyPin(next))) onUnlock();
    else if (next.length >= 8) { setErr('PIN errato'); setPin(''); }
  };

  return (
    <div className="lock">
      <Icon name="lock" size={40} />
      <h2>Inserisci il PIN</h2>
      <div className="pin-dots">{Array.from({ length: Math.max(4, pin.length) }, (_, i) => <span key={i} className={i < pin.length ? 'f' : ''} />)}</div>
      {err && <div className="danger-text small">{err}</div>}
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <button onClick={() => setPin('')} aria-label="Cancella" style={{ fontSize: '1em' }}>C</button>
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Indietro" style={{ fontSize: '1em' }}>⌫</button>
      </div>
      {hasBio && <button className="btn" onClick={tryBio}>Sblocca con biometria</button>}
      <p className="tiny muted center" style={{ maxWidth: 320 }}>PIN dimenticato? Puoi solo cancellare i dati dell'app dalle impostazioni del browser e ripristinare da un backup.</p>
    </div>
  );
}
