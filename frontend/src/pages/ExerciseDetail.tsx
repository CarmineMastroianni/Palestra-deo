import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { CATEGORY_LABELS, MUSCLE_LABELS } from '../db/types';
import { TrendChart } from '../components/Charts';
import { PageHeader, Stat } from '../components/ui';
import { useBodyParams } from '../lib/avatar';
import { fmtDate } from '../lib/dates';
import { useMediaUrl } from '../lib/media';
import { exerciseStats } from '../lib/stats';

const Body3D = lazy(() => import('../components/Body3D').then((m) => ({ default: m.Body3D })));

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const ex = useLiveQuery(() => db.exercises.get(id), [id]);
  const sets = useLiveQuery(() => db.sets.where('exerciseId').equals(id).toArray(), [id]);
  const body = useBodyParams();
  const img = useMediaUrl(ex?.imageId);
  const [metric, setMetric] = useState<'topWeight' | 'e1rm' | 'volume' | 'reps'>('topWeight');
  if (!ex || !sets) return <div className="page"><PageHeader title="Esercizio" back /></div>;
  const st = exerciseStats(ex, sets);
  const labels = { topWeight: 'Carico massimo (kg)', e1rm: '1RM stimato (kg)', volume: 'Volume (kg×rip)', reps: 'Ripetizioni totali' };

  return (
    <div className="page">
      <PageHeader title={ex.name} back right={<Link className="btn sm" to={`/profilo/esercizi/${ex.id}`}>Modifica</Link>} />
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="badge">{CATEGORY_LABELS[ex.category]}</span>
        {ex.primaryMuscles.map((m) => <span key={m} className="badge ok">{MUSCLE_LABELS[m]}</span>)}
        {ex.secondaryMuscles.map((m) => <span key={m} className="badge">{MUSCLE_LABELS[m]}</span>)}
      </div>
      {img && <div className="media-box"><img src={img} alt={ex.name} /></div>}
      {ex.notes && <div className="card flat small" style={{ whiteSpace: 'pre-wrap' }}>{ex.notes}</div>}
      {ex.videoUrl && <a className="btn" href={ex.videoUrl} target="_blank" rel="noreferrer">Apri video illustrativo</a>}

      {ex.usesLoad && ex.mode === 'reps' && (
        <>
          <div className="grid2">
            <Stat label="Ultimo carico" value={st.lastWeight !== undefined ? `${st.lastWeight} kg` : '—'} sub={st.lastDate ? fmtDate(st.lastDate) : 'mai eseguito'} />
            <Stat label="Miglior carico" value={st.bestWeight !== undefined ? `${st.bestWeight} kg` : '—'} sub={st.bestWeightDate ? fmtDate(st.bestWeightDate) : ''} />
            <Stat label="Sedute" value={st.sessions} />
            <Stat label="Ripetizioni totali" value={st.totalReps} />
          </div>
          <div className="card">
            <h3>Progressione</h3>
            <div className="scroll-x">
              {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => <button key={k} className={`chip ${metric === k ? 'on' : ''}`} onClick={() => setMetric(k)}>{labels[k]}</button>)}
            </div>
            <TrendChart data={st.series} lines={[{ key: metric, label: labels[metric] }]} />
            {metric === 'e1rm' && <div className="tiny muted">1RM stimato con la formula di Epley: valore indicativo, non un test massimale.</div>}
          </div>
        </>
      )}
      {ex.mode === 'time' && (
        <div className="card">
          <h3>Durata delle serie</h3>
          <TrendChart unit=" s" data={st.series.map((p) => ({ date: p.date, sec: Math.max(...sets.filter((x) => x.date === p.date).map((x) => x.durationSec ?? 0)) }))} lines={[{ key: 'sec', label: 'Secondi (max)' }]} />
        </div>
      )}

      <div className="card">
        <h3>Muscoli coinvolti{ex.movement && ex.movement !== 'none' ? ' e movimento' : ''}</h3>
        {body ? (
          <Suspense fallback={<div className="canvas3d" />}>
            <Body3D params={body.params} primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} movement={ex.movement ?? 'none'} height={340} />
          </Suspense>
        ) : null}
        <div className="tiny muted">Verde: muscoli principali · Azzurro: secondari. Manichino parametrico basato sulle tue misure, con schema semplificato del movimento.</div>
      </div>

      <div className="card">
        <h3>Storico serie</h3>
        <table className="simple"><thead><tr><th>Data</th><th>Serie</th><th>Rip/Tempo</th><th>Kg</th><th>RIR</th></tr></thead>
          <tbody>{[...sets].sort((a, b) => b.timestamp - a.timestamp).slice(0, 60).map((s) => (
            <tr key={s.id}><td>{fmtDate(s.date)}</td><td>{s.setIndex}{s.side ? ` ${s.side}` : ''}</td><td>{s.durationSec ? `${s.durationSec}s` : s.reps}</td><td>{s.weightKg || '—'}</td><td>{s.rir ?? '—'}</td></tr>
          ))}</tbody>
        </table>
        {sets.length === 0 && <div className="muted small">Nessuna serie registrata.</div>}
      </div>
    </div>
  );
}
