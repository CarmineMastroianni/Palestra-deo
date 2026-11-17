import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../../db/db';
import type { Phase } from '../../db/types';
import { ConfirmButton, PageHeader, Stepper } from '../../components/ui';
import { addDays, fmtDate, todayISO } from '../../lib/dates';
import { phaseForDate } from '../../lib/progression';

export function PhasesSettings() {
  const phases = useLiveQuery(() => db.phases.orderBy('start').toArray(), []);
  if (!phases) return null;
  const current = phaseForDate(phases, todayISO());
  const upd = (p: Phase, patch: Partial<Phase>) => db.phases.put({ ...p, ...patch });
  const overlaps = phases.some((p, i) => phases.slice(i + 1).some((q) => q.start <= p.end && p.start <= q.end));
  return (
    <div className="page">
      <PageHeader title="Fasi e scarichi" back="/profilo" right={<button className="btn sm primary" onClick={() => {
        const last = phases[phases.length - 1];
        const start = last ? addDays(last.end, 1) : todayISO();
        return db.phases.put({ id: uid('ph-'), name: 'Nuova fase', start, end: addDays(start, 27), targetRir: 2, volumeFactor: 1, notes: '' });
      }}>+ Fase</button>} />
      <div className="small muted">Fase attuale: <b>{current?.name ?? 'nessuna'}</b>. Il fattore volume riduce automaticamente il numero di serie (es. 0,6 = scarico). Il RIR obiettivo è mostrato durante la fase.</div>
      {overlaps && <div className="notice warn small">Alcune fasi si sovrappongono: verrà usata la prima in ordine di data.</div>}
      {phases.map((p) => (
        <div key={p.id} className={`card ${current?.id === p.id ? 'hero' : ''}`}>
          <input className="input" defaultValue={p.name} onBlur={(e) => upd(p, { name: e.target.value })} />
          <div className="grid2">
            <label className="field">Inizio<input type="date" className="input" value={p.start} onChange={(e) => e.target.value && upd(p, { start: e.target.value })} /></label>
            <label className="field">Fine<input type="date" className="input" value={p.end} onChange={(e) => e.target.value && upd(p, { end: e.target.value })} /></label>
          </div>
          <div className="grid2">
            <Stepper label="RIR obiettivo" value={p.targetRir} onChange={(v) => upd(p, { targetRir: v })} max={6} />
            <Stepper label="Fattore volume" value={p.volumeFactor} onChange={(v) => upd(p, { volumeFactor: v, deload: v < 1 })} step={0.1} decimals={1} min={0.3} max={1.5} />
          </div>
          <textarea className="input" defaultValue={p.notes} placeholder="Note" onBlur={(e) => upd(p, { notes: e.target.value })} />
          <div className="row between">
            <span className="tiny muted">{fmtDate(p.start)} → {fmtDate(p.end)}{p.volumeFactor < 1 ? ' · volume ridotto' : ''}</span>
            <ConfirmButton className="btn sm danger" onConfirm={() => db.phases.delete(p.id)}>Elimina</ConfirmButton>
          </div>
        </div>
      ))}
    </div>
  );
}
