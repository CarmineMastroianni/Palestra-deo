import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { ACTIVITY_LABELS, DAY_KEYS, MEASURE_FIELDS } from '../db/types';
import { ActivityLogger } from '../components/ActivityLogger';
import { Icon, Stat } from '../components/ui';
import { addDays, dayKeyOf, fmtDateLong, todayISO, daysBetween } from '../lib/dates';
import { phaseForDate } from '../lib/progression';
import { useSettings } from '../lib/settings';
import { weekRange } from '../lib/stats';
import { planSummary } from '../lib/workout';

export default function Home() {
  const s = useSettings();
  const nav = useNavigate();
  const today = todayISO();
  const data = useLiveQuery(async () => {
    const { from, to } = weekRange(today);
    const [sessions, activities, phases, live, measurements, templates] = await Promise.all([
      db.sessions.toArray(), db.activities.where('date').between(from, to, true, true).toArray(), db.phases.toArray(),
      db.live.get('live'), db.measurements.toArray(), db.templates.toArray()
    ]);
    return { sessions, activities, phases, live, measurements, templates, from };
  }, [today]);
  if (!s || !data) return null;
  const plan = s.schedule[dayKeyOf(today)];
  const tomorrow = s.schedule[dayKeyOf(addDays(today, 1))];
  const tpl = data.templates.find((t) => t.id === plan.templateId);
  const phase = phaseForDate(data.phases, today);
  const completed = data.sessions.filter((x) => x.status === 'completed');
  const doneToday = completed.find((x) => x.date === today);
  const liveSession = data.live ? data.sessions.find((x) => x.id === data.live!.sessionId && x.status === 'in_progress') : undefined;
  const lastWeight = [...data.measurements].filter((m) => m.weight).sort((a, b) => b.date.localeCompare(a.date))[0];
  const daysLeft = daysBetween(today, s.profile.programEnd);
  const lastMeasureDate = [...data.measurements].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

  const dayStatus = (d: string) => {
    const p = s.schedule[dayKeyOf(d)];
    if (p.type === 'rest') return 'rest';
    const done = p.type === 'gym'
      ? data.sessions.some((x) => x.status === 'completed' && (x.date === d || x.recoveredFrom === d))
      : data.activities.some((a) => a.date === d && a.type === p.type && a.done);
    if (done) return 'done';
    return d < today ? 'missed' : '';
  };

  return (
    <div className="page">
      <div className="row between">
        <div>
          <div className="muted small" style={{ textTransform: 'capitalize' }}>{fmtDateLong(today)}</div>
          <h1>{s.profile.name ? `Ciao ${s.profile.name}` : 'Oggi'}</h1>
        </div>
        <Link to="/assistente" className="btn sm" aria-label="Assistente"><Icon name="chat" size={18} /> Coach</Link>
      </div>

      {liveSession && (
        <button className="card hero" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => nav('/allenamento/live')}>
          <span className="badge ok">IN CORSO</span>
          <h2>{liveSession.templateName}</h2>
          <span className="accent">Riprendi l'allenamento →</span>
        </button>
      )}

      <div className="card hero">
        <div className="row between">
          <span className="badge ok">{ACTIVITY_LABELS[plan.type].toUpperCase()}</span>
          {phase && <span className="badge">{phase.name}{phase.deload ? ' · scarico' : ''}</span>}
        </div>
        <h2 style={{ fontSize: '1.5em' }}>{plan.label}</h2>
        {tpl && <div className="muted small">{planSummary(tpl.items)} · cardio: {tpl.cardio}</div>}
        {plan.durationMin && plan.type !== 'gym' && <div className="muted small">Durata prevista: {plan.durationMin} min</div>}
        {plan.notes && <div className="muted small">{plan.notes}</div>}
        {tpl?.protectLegs && <div className="notice warn small">{tpl.notes ?? 'Proteggi le gambe: domani calcio a 5.'}</div>}
        {plan.type === 'gym' && plan.templateId && !liveSession && (
          doneToday
            ? <div className="row between"><span className="badge ok">✓ Completato</span><Link to={`/allenamento/seduta/${doneToday.id}`} className="small">Dettagli</Link></div>
            : <button className="btn primary xl block" onClick={() => nav(`/allenamento/check?tpl=${plan.templateId}&date=${today}`)}>INIZIA ALLENAMENTO</button>
        )}
        {(plan.type === 'futsal' || plan.type === 'match' || plan.type === 'active_recovery' || plan.type === 'other') && <ActivityLogger date={today} plan={plan} />}
        {plan.type === 'rest' && <div className="muted small">Giornata di riposo: sonno, idratazione e alimentazione secondo il piano del nutrizionista.</div>}
      </div>

      <div className="card">
        <div className="card-title"><h3>Questa settimana</h3><Link to="/allenamento" className="small">Programma</Link></div>
        <div className="week">
          {DAY_KEYS.map((k, i) => {
            const d = addDays(data.from, i);
            const st = dayStatus(d);
            return (
              <div key={k} className={`d ${d === today ? 'today' : ''}`} title={s.schedule[k].label}>
                <b>{k.toUpperCase()}</b>
                <span className={`dot ${st}`} />
                <span className="muted" style={{ fontSize: '.85em' }}>{s.schedule[k].type === 'gym' ? (data.templates.find((t) => t.id === s.schedule[k].templateId)?.name.replace('Scheda ', '') ?? 'G') : s.schedule[k].type === 'futsal' ? 'C5' : s.schedule[k].type === 'match' ? 'P' : s.schedule[k].type === 'rest' ? '–' : 'R'}</span>
              </div>
            );
          })}
        </div>
        <div className="small muted">Domani: <b>{tomorrow.label}</b></div>
      </div>

      <div className="grid2">
        <Stat label="Allenamenti" value={completed.length} sub="in palestra completati" />
        <Stat label="Peso attuale" value={lastWeight ? `${lastWeight.weight} kg` : '—'} sub={lastWeight ? `iniziale ${s.profile.startWeightKg} kg` : 'nessuna pesata registrata'} />
        <Stat label="Giorni a fine programma" value={daysLeft > 0 ? daysLeft : 0} sub={`fino al ${new Date(s.profile.programEnd).toLocaleDateString('it-IT')}`} />
        <Stat label="Ultime misure" value={lastMeasureDate ? new Date(lastMeasureDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '—'} sub={<Link to="/corpo">{MEASURE_FIELDS.length} misure → Il mio corpo</Link>} />
      </div>
    </div>
  );
}
