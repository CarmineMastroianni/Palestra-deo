import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import type { SetLog } from '../db/types';
import { ConfirmButton, Modal, PageHeader, Stepper, useToast } from '../components/ui';
import { fmtDateLong, fmtDuration } from '../lib/dates';

export default function SessionDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const session = useLiveQuery(() => db.sessions.get(id), [id]);
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(id).toArray(), [id]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [edit, setEdit] = useState<SetLog | null>(null);
  if (!session || !sets || !exercises) return <div className="page"><PageHeader title="Seduta" back /></div>;
  const byEx = new Map<string, SetLog[]>();
  for (const s of [...sets].sort((a, b) => a.timestamp - b.timestamp)) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s]);
  const vol = sets.reduce((a, s) => a + s.reps * s.weightKg, 0);

  return (
    <div className="page">
      <PageHeader title={session.templateName} back />
      <div className="muted small" style={{ textTransform: 'capitalize' }}>{fmtDateLong(session.date)}{session.recoveredFrom ? ` · recupero del ${session.recoveredFrom}` : ''}</div>
      <div className="grid3">
        <div className="stat"><span className="l">Durata</span><span className="v">{fmtDuration((session.endedAt ?? Date.now()) - session.startedAt)}</span></div>
        <div className="stat"><span className="l">Serie</span><span className="v">{sets.length}</span></div>
        <div className="stat"><span className="l">Volume</span><span className="v">{Math.round(vol)}</span></div>
      </div>
      <label className="field">Data della seduta
        <input type="date" className="input" value={session.date} onChange={async (e) => { if (!e.target.value) return; await db.sessions.update(id, { date: e.target.value }); await db.sets.where('sessionId').equals(id).modify({ date: e.target.value }); toast('Data aggiornata'); }} />
      </label>
      {session.readiness && (
        <div className="card flat small">
          <b>Check recupero: {session.readiness.score}/100</b>
          <span className="muted">Sonno {session.readiness.sleepQuality}/5{session.readiness.sleepHours ? ` (${session.readiness.sleepHours} h)` : ''} · stanchezza {session.readiness.fatigue}/10 · gambe {session.readiness.legs}/10{session.readiness.pain ? ` · dolore: ${session.readiness.painNotes}` : ''}</span>
        </div>
      )}
      {[...byEx].map(([exId, list]) => {
        const ex = exercises.find((e) => e.id === exId);
        return (
          <div key={exId} className="card">
            <div className="card-title"><h3>{ex?.name ?? exId}</h3></div>
            <table className="simple"><thead><tr><th>Serie</th><th>{ex?.mode === 'time' ? 'Tempo' : 'Rip.'}</th><th>Kg</th><th>RIR</th><th></th></tr></thead>
              <tbody>{list.map((s) => (
                <tr key={s.id} onClick={() => setEdit(s)} style={{ cursor: 'pointer' }}>
                  <td>{s.setIndex}{s.side ? ` ${s.side}` : ''}</td><td>{s.durationSec ? `${s.durationSec}s` : s.reps}</td><td>{s.weightKg || '—'}</td><td>{s.rir ?? '—'}{!s.techniqueOk ? ' ⚠' : ''}</td><td className="muted">✎</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        );
      })}
      {sets.length === 0 && <div className="notice">Nessuna serie registrata.</div>}
      {session.cardioDone && <div className="card flat small"><b>Cardio:</b> {session.cardioDone.minutes} min · {session.cardioDone.notes}</div>}
      <label className="field">Note personali
        <textarea className="input" defaultValue={session.notes} onBlur={(e) => db.sessions.update(id, { notes: e.target.value })} />
      </label>
      <ConfirmButton onConfirm={async () => { await db.sets.where('sessionId').equals(id).delete(); await db.sessions.delete(id); const l = await db.live.get('live'); if (l?.sessionId === id) await db.live.delete('live'); nav('/allenamento', { replace: true }); }}>Elimina seduta</ConfirmButton>

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Correggi serie">
        {edit && (
          <>
            {edit.durationSec !== undefined
              ? <Stepper label="Durata (s)" value={edit.durationSec} onChange={(v) => setEdit({ ...edit, durationSec: v })} />
              : <Stepper label="Ripetizioni" value={edit.reps} onChange={(v) => setEdit({ ...edit, reps: v })} />}
            <Stepper label="Carico (kg)" value={edit.weightKg} onChange={(v) => setEdit({ ...edit, weightKg: v })} step={0.5} decimals={2} />
            <Stepper label="RIR" value={edit.rir ?? 2} onChange={(v) => setEdit({ ...edit, rir: v })} max={10} />
            <label className="check"><input type="checkbox" checked={edit.techniqueOk} onChange={(e) => setEdit({ ...edit, techniqueOk: e.target.checked })} /> Tecnica corretta</label>
            <input className="input" placeholder="Note" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            <div className="row">
              <button className="btn primary grow" onClick={async () => { await db.sets.put(edit); setEdit(null); }}>Salva</button>
              <ConfirmButton onConfirm={async () => { await db.sets.delete(edit.id); setEdit(null); }}>Elimina</ConfirmButton>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
