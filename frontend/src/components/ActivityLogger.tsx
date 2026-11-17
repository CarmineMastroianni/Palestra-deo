import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { ACTIVITY_LABELS, type DayPlan } from '../db/types';
import { setActivityDone } from '../lib/workout';
import { Stepper, useToast } from './ui';

/** Registrazione di allenamento calcio / partita / recupero attivo per una data. */
export function ActivityLogger({ date, plan }: { date: string; plan: DayPlan }) {
  const toast = useToast();
  const existing = useLiveQuery(() => db.activities.where('date').equals(date).toArray().then((a) => a.find((x) => x.type === plan.type)), [date, plan.type]);
  const [open, setOpen] = useState(false);
  const [dur, setDur] = useState(plan.durationMin ?? (plan.type === 'match' ? 60 : 90));
  const [rpe, setRpe] = useState(6);
  const [notes, setNotes] = useState('');
  if (existing?.done && !open) {
    return (
      <div className="row between">
        <span className="badge ok">✓ Registrato{existing.durationMin ? ` · ${existing.durationMin} min` : ''}{existing.rpe ? ` · RPE ${existing.rpe}` : ''}</span>
        <button className="btn sm ghost" onClick={() => { setDur(existing.durationMin ?? dur); setRpe(existing.rpe ?? rpe); setNotes(existing.notes); setOpen(true); }}>Modifica</button>
      </div>
    );
  }
  if (!open) return <button className="btn primary block" onClick={() => setOpen(true)}>Segna come svolto</button>;
  return (
    <div className="col">
      <div className="grid2">
        <Stepper label="Durata (min)" value={dur} onChange={setDur} step={5} max={300} />
        <Stepper label="Fatica percepita RPE 1-10" value={rpe} onChange={setRpe} min={1} max={10} />
      </div>
      <input className="input" placeholder="Note (facoltative)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="row">
        <button className="btn primary grow" onClick={async () => { await setActivityDone(date, plan.type, { done: true, durationMin: dur, rpe, notes }); setOpen(false); toast(`${ACTIVITY_LABELS[plan.type]} registrato`); }}>Salva</button>
        {existing?.done && <button className="btn danger" onClick={async () => { await setActivityDone(date, plan.type, { done: false }); setOpen(false); }}>Annulla registrazione</button>}
        <button className="btn ghost" onClick={() => setOpen(false)}>Chiudi</button>
      </div>
    </div>
  );
}
