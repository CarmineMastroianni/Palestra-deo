import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, uid } from '../../db/db';
import { restoreDefaultProgram } from '../../db/seed';
import type { TemplateItem, WorkoutTemplate } from '../../db/types';
import { ConfirmButton, PageHeader, Stepper, useToast } from '../../components/ui';
import { defaultRestSec } from '../../lib/progression';
import { useSettings } from '../../lib/settings';
import { planSummary } from '../../lib/workout';

export function TemplatesList() {
  const nav = useNavigate();
  const toast = useToast();
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  if (!templates) return null;
  return (
    <div className="page">
      <PageHeader title="Schede" back="/profilo" right={<button className="btn sm primary" onClick={async () => {
        const id = uid('tpl-');
        await db.templates.put({ id, name: `Scheda ${String.fromCharCode(65 + templates.length)}`, warmup: [], items: [], cardio: '' });
        nav(`/profilo/schede/${id}`);
      }}>+ Nuova</button>} />
      {templates.map((t) => (
        <Link key={t.id} to={`/profilo/schede/${t.id}`} className="card" style={{ color: 'inherit' }}>
          <div className="row between"><b>{t.name}</b><span className="chev">›</span></div>
          <span className="small muted">{planSummary(t.items)}{t.protectLegs ? ' · protezione gambe' : ''}</span>
        </Link>
      ))}
      <div className="card">
        <h3>Ripristina il programma originale</h3>
        <div className="small muted">Ripristina Scheda A, Scheda B, esercizi e fasi iniziali. Lo storico degli allenamenti non viene toccato; le schede create da te restano.</div>
        <ConfirmButton className="btn" onConfirm={async () => { await restoreDefaultProgram(); toast('Programma originale ripristinato'); }}>Ripristina</ConfirmButton>
      </div>
    </div>
  );
}

export function TemplateEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const s = useSettings();
  const stored = useLiveQuery(() => db.templates.get(id), [id]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [t, setT] = useState<WorkoutTemplate | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (stored && (!t || t.id !== stored.id)) setT(stored); }, [stored, t]);
  if (!t || !exercises || !s) return <div className="page"><PageHeader title="Scheda" back /></div>;
  const upd = (p: Partial<WorkoutTemplate>) => { setT({ ...t, ...p }); setDirty(true); };
  const updItem = (i: number, p: Partial<TemplateItem>) => upd({ items: t.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
  const move = (i: number, d: number) => {
    const items = [...t.items]; const j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    upd({ items });
  };
  const save = async () => { await db.templates.put(t); setDirty(false); toast('Scheda salvata'); };
  const available = exercises.filter((e) => !e.archived);

  return (
    <div className="page">
      <PageHeader title="Modifica scheda" back="/profilo/schede" right={<button className="btn sm primary" disabled={!dirty} onClick={save}>Salva</button>} />
      <div className="card">
        <label className="field">Nome<input className="input" value={t.name} onChange={(e) => upd({ name: e.target.value })} /></label>
        <label className="field">Riscaldamento (una voce per riga)
          <textarea className="input" value={t.warmup.join('\n')} onChange={(e) => upd({ warmup: e.target.value.split('\n') })} onBlur={() => upd({ warmup: t.warmup.map((x) => x.trim()).filter(Boolean) })} />
        </label>
        <label className="check"><input type="checkbox" checked={!!t.protectLegs} onChange={(e) => upd({ protectLegs: e.target.checked })} /> Proteggi le gambe (il giorno dopo c'è calcio): avvisi RIR ≥ 3 e riduzione prioritaria degli esercizi per le gambe</label>
        <label className="field">Note della scheda<input className="input" value={t.notes ?? ''} onChange={(e) => upd({ notes: e.target.value })} /></label>
      </div>

      {t.items.map((it, i) => {
        const ex = exercises.find((e) => e.id === it.exerciseId);
        const timed = ex?.mode === 'time' || ex?.mode === 'cardio';
        return (
          <div key={i} className="card">
            <div className="row between">
              <b>{i + 1}. {ex?.name ?? 'Esercizio mancante'}</b>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn sm" onClick={() => move(i, -1)} aria-label="Sposta su">↑</button>
                <button className="btn sm" onClick={() => move(i, 1)} aria-label="Sposta giù">↓</button>
                <button className="btn sm danger" onClick={() => upd({ items: t.items.filter((_, j) => j !== i) })} aria-label="Rimuovi">✕</button>
              </div>
            </div>
            <select className="input" value={it.exerciseId} onChange={(e) => updItem(i, { exerciseId: e.target.value })}>
              {available.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <Stepper label="Serie" value={it.sets} onChange={(v) => updItem(i, { sets: v })} min={1} max={10} />
            {timed ? (
              <div className="grid2">
                <Stepper label="Secondi min" value={it.secMin ?? 30} onChange={(v) => updItem(i, { secMin: v })} step={5} max={3600} />
                <Stepper label="Secondi max" value={it.secMax ?? 30} onChange={(v) => updItem(i, { secMax: v })} step={5} max={3600} />
              </div>
            ) : (
              <div className="grid2">
                <Stepper label={`Ripetizioni min${ex?.perSide ? ' (per lato)' : ''}`} value={it.repsMin} onChange={(v) => updItem(i, { repsMin: v, repsMax: Math.max(v, it.repsMax) })} min={1} max={50} />
                <Stepper label="Ripetizioni max" value={it.repsMax} onChange={(v) => updItem(i, { repsMax: v, repsMin: Math.min(v, it.repsMin) })} min={1} max={50} />
              </div>
            )}
            <Stepper label={`Recupero (s) – vuoto = predefinito ${ex ? defaultRestSec(ex, s.timers) : ''}s`} value={it.restSec ?? (ex ? defaultRestSec(ex, s.timers) : 60)} onChange={(v) => updItem(i, { restSec: v })} step={15} max={600} />
            {it.restSec !== undefined && <button className="btn sm ghost" onClick={() => updItem(i, { restSec: undefined })}>Usa recupero predefinito</button>}
            <input className="input" placeholder="Note per questo esercizio nella scheda" value={it.notes ?? ''} onChange={(e) => updItem(i, { notes: e.target.value })} />
          </div>
        );
      })}
      <button className="btn block" onClick={() => {
        const ex = available[0];
        upd({ items: [...t.items, { exerciseId: ex?.id ?? '', sets: 3, repsMin: 10, repsMax: 10, secMin: ex?.mode !== 'reps' ? 30 : undefined, secMax: ex?.mode !== 'reps' ? 40 : undefined }] });
      }}>+ Aggiungi esercizio</button>
      <Link to="/profilo/esercizi/nuovo" className="small center">Crea un nuovo esercizio nella libreria</Link>

      <div className="card">
        <h3>Cardio finale</h3>
        <label className="field">Descrizione<input className="input" value={t.cardio} onChange={(e) => upd({ cardio: e.target.value })} /></label>
        <Stepper label="Durata predefinita (min)" value={t.cardioMin ?? 10} onChange={(v) => upd({ cardioMin: v })} max={120} />
      </div>
      <button className="btn primary block xl" disabled={!dirty} onClick={save}>Salva scheda</button>
      <ConfirmButton onConfirm={async () => { await db.templates.delete(t.id); nav('/profilo/schede', { replace: true }); }}>Elimina scheda</ConfirmButton>
      <div className="tiny muted">Eliminare una scheda non cancella lo storico delle sedute già svolte. Ricordati di aggiornare il programma settimanale se la scheda era assegnata a un giorno.</div>
    </div>
  );
}
