import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { ACTIVITY_LABELS, DAY_LABELS } from '../db/types';
import { ActivityLogger } from '../components/ActivityLogger';
import { Empty, PageHeader } from '../components/ui';
import { dayKeyOf, fmtDate, fmtDuration, todayISO } from '../lib/dates';
import { useSettings } from '../lib/settings';
import { missedGymDays, planSummary } from '../lib/workout';

export default function WorkoutHub() {
  const s = useSettings();
  const nav = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [missed, setMissed] = useState<{ date: string; templateId: string; label: string }[]>([]);
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().limit(40).toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const live = useLiveQuery(() => db.live.get('live'), []);
  useEffect(() => { void missedGymDays().then(setMissed); }, [sessions?.length]);
  if (!s || !templates || !sessions || !exercises) return null;
  const plan = s.schedule[dayKeyOf(date)];
  const done = sessions.filter((x) => x.status === 'completed' && x.date === date);

  return (
    <div className="page">
      <PageHeader title="Allenamento" />
      {live && <button className="btn primary xl block" onClick={() => nav('/allenamento/live')}>Riprendi allenamento in corso</button>}

      <div className="card">
        <div className="row between">
          <h3>Seduta del giorno</h3>
          <input type="date" className="input" style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Data della seduta" />
        </div>
        <div className="muted small">{DAY_LABELS[dayKeyOf(date)]} · {ACTIVITY_LABELS[plan.type]}</div>
        <h2>{plan.label}</h2>
        {plan.type === 'gym' && plan.templateId && (
          <>
            {done.length > 0 && <span className="badge ok">✓ Già completato in questa data</span>}
            <button className="btn primary xl block" disabled={!!live} onClick={() => nav(`/allenamento/check?tpl=${plan.templateId}&date=${date}`)}>INIZIA ALLENAMENTO</button>
          </>
        )}
        {plan.type !== 'gym' && plan.type !== 'rest' && <ActivityLogger date={date} plan={plan} />}
        <div className="sep" />
        <div className="small muted">Oppure scegli una scheda diversa per questa data:</div>
        <div className="row wrap">
          {templates.map((t) => (
            <button key={t.id} className="btn sm" disabled={!!live} onClick={() => nav(`/allenamento/check?tpl=${t.id}&date=${date}`)}>{t.name}</button>
          ))}
        </div>
      </div>

      {missed.length > 0 && (
        <div className="card">
          <h3>Sedute saltate da recuperare</h3>
          <div className="small muted">Ultime 2 settimane. Il recupero viene registrato oggi e conteggiato per la data saltata.</div>
          {missed.map((m) => (
            <div key={m.date} className="row between">
              <span>{fmtDate(m.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {m.label}</span>
              <button className="btn sm" disabled={!!live} onClick={() => nav(`/allenamento/check?tpl=${m.templateId}&date=${todayISO()}&recover=${m.date}`)}>Recupera</button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-title"><h3>Schede</h3><Link to="/profilo/schede" className="small">Modifica</Link></div>
        {templates.map((t) => (
          <div key={t.id} className="col" style={{ gap: 2 }}>
            <b>{t.name}</b>
            <span className="small muted">{planSummary(t.items)}</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {t.items.map((i) => { const e = exercises.find((x) => x.id === i.exerciseId); return e ? <Link key={i.exerciseId} to={`/esercizi/${e.id}`} className="chip">{e.name}</Link> : null; })}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Storico sedute</h3>
        {sessions.length === 0 && <Empty>Nessuna seduta registrata. Premi "Inizia allenamento" per cominciare.</Empty>}
        <div className="list">
          {sessions.map((x) => (
            <Link key={x.id} to={`/allenamento/seduta/${x.id}`} className="list-item" style={{ color: 'inherit' }}>
              <div className="grow">
                <b>{x.templateName}</b> <span className="muted small">· {fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <div className="small muted">
                  {x.status === 'completed' ? `Completata · ${fmtDuration((x.endedAt ?? x.startedAt) - x.startedAt)}` : x.status === 'in_progress' ? 'In corso' : 'Interrotta'}
                  {x.recoveredFrom ? ` · recupero del ${fmtDate(x.recoveredFrom)}` : ''}
                </div>
              </div>
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
