import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { PageHeader, Stepper } from '../components/ui';
import { addDays, dayKeyOf, fmtDateLong, todayISO } from '../lib/dates';
import { buildSessionPlan, phaseForDate } from '../lib/progression';
import { evaluateReadiness } from '../lib/readiness';
import { useSettings } from '../lib/settings';
import { startSession } from '../lib/workout';
import { unlockAudio } from '../lib/feedback';

const SLEEP = ['Pessimo', 'Scarso', 'Discreto', 'Buono', 'Ottimo'];

export default function ReadinessCheck() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const s = useSettings();
  const tplId = q.get('tpl') ?? '';
  const date = q.get('date') ?? todayISO();
  const recover = q.get('recover') ?? undefined;
  const tpl = useLiveQuery(() => db.templates.get(tplId), [tplId]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const phases = useLiveQuery(() => db.phases.toArray(), []);
  const [sleepQuality, setSleep] = useState(4);
  const [sleepHours, setHours] = useState(7);
  const [fatigue, setFatigue] = useState(4);
  const [legs, setLegs] = useState(4);
  const [pain, setPain] = useState(false);
  const [painNotes, setPainNotes] = useState('');
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);

  const nextDay = s?.schedule[dayKeyOf(addDays(date, 1))];
  const readiness = useMemo(() => s ? evaluateReadiness({ sleepQuality, sleepHours, fatigue, legs, pain, painNotes }, { reduceThreshold: s.progression.readinessReduceThreshold, nextDay, protectLegs: tpl?.protectLegs }) : null,
    [s, sleepQuality, sleepHours, fatigue, legs, pain, painNotes, nextDay, tpl?.protectLegs]);
  if (!s || !tpl || !exercises || !phases || !readiness) return null;
  const phase = phaseForDate(phases, date);
  const reduce = readiness.applied !== 'full';
  const preview = buildSessionPlan(tpl.items, new Map(exercises.map((e) => [e.id, e])), {
    volumeFactor: phase?.volumeFactor ?? 1,
    reduceAll: apply && reduce && (readiness.applied === 'light' || fatigue >= 7),
    reduceLegs: apply && reduce && (legs >= 7 || readiness.applied === 'light' || ((nextDay?.type === 'futsal' || nextDay?.type === 'match') && legs >= 6))
  });

  const go = async () => {
    unlockAudio();
    setBusy(true);
    await startSession({ templateId: tpl.id, date: recover ? todayISO() : date, readiness, recoveredFrom: recover, applyReduction: apply });
    nav('/allenamento/live', { replace: true });
  };

  const scale = (v: number, set: (n: number) => void, low: string, high: string) => (
    <div className="col" style={{ gap: 4 }}>
      <div className="row wrap" style={{ gap: 6 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`chip ${v === n ? 'on' : ''}`} style={{ minWidth: 38 }} onClick={() => set(n)}>{n}</button>
        ))}
      </div>
      <div className="row between tiny muted"><span>{low}</span><span>{high}</span></div>
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="Come stai oggi?" back />
      <div className="muted small">{tpl.name} · {fmtDateLong(date)}{recover ? ` · recupero della seduta del ${recover}` : ''}{phase ? ` · fase ${phase.name}` : ''}</div>

      <div className="card">
        <h3>Come hai dormito?</h3>
        <div className="row wrap" style={{ gap: 6 }}>
          {SLEEP.map((l, i) => <button key={l} className={`chip ${sleepQuality === i + 1 ? 'on' : ''}`} onClick={() => setSleep(i + 1)}>{l}</button>)}
        </div>
        <Stepper label="Ore di sonno" value={sleepHours} onChange={setHours} step={0.5} min={0} max={14} decimals={1} />
      </div>
      <div className="card"><h3>Quanto ti senti stanco? (1-10)</h3>{scale(fatigue, setFatigue, '1 = per niente', '10 = esausto')}</div>
      <div className="card"><h3>Come senti le gambe? (1-10)</h3>{scale(legs, setLegs, '1 = fresche', '10 = molto pesanti')}</div>
      <div className="card">
        <h3>Hai dolori o fastidi?</h3>
        <div className="row"><button className={`chip ${!pain ? 'on' : ''}`} onClick={() => setPain(false)}>No</button><button className={`chip ${pain ? 'on' : ''}`} onClick={() => setPain(true)}>Sì</button></div>
        {pain && <input className="input" placeholder="Dove e che tipo di fastidio?" value={painNotes} onChange={(e) => setPainNotes(e.target.value)} />}
      </div>

      <div className={`card ${readiness.applied === 'full' ? '' : 'flat'}`}>
        <div className="row between"><h3>Valutazione recupero</h3><span className={`badge ${readiness.score >= s.progression.readinessReduceThreshold ? 'ok' : 'warn'}`}>{readiness.score}/100</span></div>
        {readiness.advice.map((a, i) => <div key={i} className={`notice ${readiness.applied === 'full' && !pain ? 'ok' : 'warn'}`}>{a}</div>)}
        {(preview.changes.length > 0 || reduce) && (
          <label className="check"><input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} /> Applica le riduzioni di volume suggerite</label>
        )}
        {preview.changes.length > 0 && <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{preview.changes.map((c) => <li key={c}>{c}</li>)}</ul>}
        {phase && phase.volumeFactor < 1 && <div className="small muted">Fase "{phase.name}": volume al {Math.round(phase.volumeFactor * 100)}%.</div>}
      </div>

      <button className="btn primary xl block" disabled={busy} onClick={go}>INIZIA ALLENAMENTO</button>
      {readiness.applied === 'light' && <button className="btn block" onClick={() => nav('/')}>Oggi riposo</button>}
    </div>
  );
}
