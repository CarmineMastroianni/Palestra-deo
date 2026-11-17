import { Link } from 'react-router-dom';
import { Icon } from '../components/ui';
import { useSettings } from '../lib/settings';

const SECTIONS: { title: string; items: { to: string; icon: string; label: string; sub: string }[] }[] = [
  {
    title: 'Io', items: [
      { to: '/profilo/dati-personali', icon: 'user', label: 'Dati personali e obiettivi', sub: 'Età, altezza, peso, sport, obiettivi, periodo' },
      { to: '/corpo', icon: 'body', label: 'Il mio corpo', sub: 'Misure, grafici, foto prima/dopo' },
      { to: '/avatar', icon: 'cube', label: 'Avatar 3D', sub: 'Manichino dalle tue misure, import GLB' }
    ]
  },
  {
    title: 'Programma di allenamento', items: [
      { to: '/profilo/programma', icon: 'dumbbell', label: 'Programma settimanale', sub: 'Cosa fare ogni giorno' },
      { to: '/profilo/schede', icon: 'file', label: 'Schede', sub: 'Esercizi, serie, ripetizioni, recuperi, riscaldamento, cardio' },
      { to: '/profilo/esercizi', icon: 'dumbbell', label: 'Libreria esercizi', sub: 'Note tecniche, muscoli, immagini, video' },
      { to: '/profilo/fasi', icon: 'chart', label: 'Fasi e scarichi', sub: 'Adattamento, forza, consolidamento, transizione' },
      { to: '/profilo/progressione', icon: 'chart', label: 'Progressione e recupero', sub: 'Doppia progressione, soglie RIR, riduzioni' },
      { to: '/profilo/timer', icon: 'timer', label: 'Timer, suoni e notifiche', sub: 'Recuperi predefiniti, vibrazione, voce' }
    ]
  },
  {
    title: 'Assistente e dati', items: [
      { to: '/profilo/ai', icon: 'chat', label: 'Assistente AI', sub: 'Locale o Claude, consensi sui dati' },
      { to: '/profilo/cloud', icon: 'cloud', label: 'Cloud e sincronizzazione', sub: 'Backup cifrato sul tuo server (facoltativo)' },
      { to: '/profilo/dati', icon: 'file', label: 'Esporta, importa, cancella', sub: 'Backup cifrato, JSON, CSV' },
      { to: '/profilo/sicurezza', icon: 'lock', label: 'Sicurezza', sub: 'PIN, biometria, blocco automatico' },
      { to: '/profilo/aspetto', icon: 'settings', label: 'Aspetto', sub: 'Colore, dimensione testo, misure visibili' },
      { to: '/profilo/stato', icon: 'settings', label: 'Stato funzioni e collaudo', sub: 'Cosa è disponibile su questo dispositivo' }
    ]
  }
];

export default function Profile() {
  const s = useSettings();
  if (!s) return null;
  const p = s.profile;
  return (
    <div className="page">
      <div className="row" style={{ gap: 12 }}>
        <div className="icon-circle" style={{ width: 56, height: 56, fontSize: '1.6em' }}>{(p.name || 'Io').slice(0, 1).toUpperCase()}</div>
        <div className="grow">
          <h1>{p.name || 'Profilo'}</h1>
          <div className="small muted">{p.age} anni · {p.heightCm} cm · {p.sport}</div>
        </div>
      </div>
      {SECTIONS.map((sec) => (
        <div key={sec.title} className="card">
          <div className="small muted upper">{sec.title}</div>
          <div className="list">
            {sec.items.map((i) => (
              <Link key={i.to} to={i.to} className="list-item" style={{ color: 'inherit' }}>
                <span className="icon-circle"><Icon name={i.icon} size={20} /></span>
                <span className="grow"><b>{i.label}</b><br /><span className="small muted">{i.sub}</span></span>
                <span className="chev">›</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      <div className="tiny muted center">My Fitness & Futsal · v1.0 · dati salvati sul dispositivo</div>
    </div>
  );
}
