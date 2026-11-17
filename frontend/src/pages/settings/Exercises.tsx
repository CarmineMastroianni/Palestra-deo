import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, uid } from '../../db/db';
import { CATEGORY_LABELS, MOVEMENT_LABELS, MUSCLE_LABELS, type Exercise, type ExerciseCategory, type ExerciseMode, type MovementPattern, type MuscleId } from '../../db/types';
import { ConfirmButton, PageHeader, Stepper, useToast } from '../../components/ui';
import { compressImage, deleteMedia, saveMedia, useMediaUrl } from '../../lib/media';

export function ExercisesList() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  if (!exercises) return null;
  const list = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <PageHeader title="Libreria esercizi" back="/profilo" right={<Link className="btn sm primary" to="/profilo/esercizi/nuovo">+ Nuovo</Link>} />
      <input className="input" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card"><div className="list">
        {list.map((e) => (
          <Link key={e.id} to={`/profilo/esercizi/${e.id}`} className="list-item" style={{ color: 'inherit', opacity: e.archived ? 0.5 : 1 }}>
            <span className="grow"><b>{e.name}</b><br /><span className="small muted">{CATEGORY_LABELS[e.category]} · {e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}{e.archived ? ' · archiviato' : ''}</span></span>
            <span className="chev">›</span>
          </Link>
        ))}
      </div></div>
    </div>
  );
}

const blank = (): Exercise => ({ id: uid('ex-'), name: '', category: 'complementary', mode: 'reps', primaryMuscles: [], secondaryMuscles: [], notes: '', perSide: false, usesLoad: true, loadIncrementKg: 2.5, movement: 'none' });

export function ExerciseEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const isNew = id === 'nuovo';
  const stored = useLiveQuery(async () => (isNew ? null : (await db.exercises.get(id)) ?? null), [id]);
  const [e, setE] = useState<Exercise | null>(null);
  useEffect(() => { if (isNew && !e) setE(blank()); else if (stored && (!e || e.id !== stored.id)) setE(stored); }, [stored, isNew, e]);
  const img = useMediaUrl(e?.imageId);
  if (!e) return <div className="page"><PageHeader title="Esercizio" back /></div>;
  const upd = (p: Partial<Exercise>) => setE({ ...e, ...p });
  const toggleMuscle = (m: MuscleId, kind: 'primaryMuscles' | 'secondaryMuscles') => {
    const other = kind === 'primaryMuscles' ? 'secondaryMuscles' : 'primaryMuscles';
    const has = e[kind].includes(m);
    upd({ [kind]: has ? e[kind].filter((x) => x !== m) : [...e[kind], m], [other]: e[other].filter((x) => x !== m) } as Partial<Exercise>);
  };
  const save = async () => {
    if (!e.name.trim()) { toast('Inserisci il nome'); return; }
    await db.exercises.put({ ...e, name: e.name.trim() });
    toast('Esercizio salvato');
    if (isNew) nav(`/profilo/esercizi/${e.id}`, { replace: true });
  };

  return (
    <div className="page">
      <PageHeader title={isNew ? 'Nuovo esercizio' : 'Modifica esercizio'} back right={<button className="btn sm primary" onClick={save}>Salva</button>} />
      <div className="card">
        <label className="field">Nome<input className="input" value={e.name} onChange={(x) => upd({ name: x.target.value })} /></label>
        <div className="grid2">
          <label className="field">Categoria
            <select className="input" value={e.category} onChange={(x) => upd({ category: x.target.value as ExerciseCategory })}>
              {(Object.keys(CATEGORY_LABELS) as ExerciseCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
          </label>
          <label className="field">Tipo
            <select className="input" value={e.mode} onChange={(x) => upd({ mode: x.target.value as ExerciseMode, usesLoad: x.target.value === 'reps' ? e.usesLoad : false })}>
              <option value="reps">Ripetizioni</option><option value="time">Isometrico a tempo</option><option value="cardio">Cardio a tempo</option>
            </select>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={e.perSide} onChange={(x) => upd({ perSide: x.target.checked })} /> Esecuzione per lato (destro e sinistro)</label>
        {e.mode === 'reps' && <label className="check"><input type="checkbox" checked={e.usesLoad} onChange={(x) => upd({ usesLoad: x.target.checked })} /> Prevede un carico in kg</label>}
        {e.usesLoad && <Stepper label="Incremento minimo disponibile (kg)" value={e.loadIncrementKg} onChange={(v) => upd({ loadIncrementKg: v })} step={0.5} decimals={2} min={0.25} max={20} />}
      </div>

      <div className="card">
        <h3>Note tecniche</h3>
        <textarea className="input" value={e.notes} onChange={(x) => upd({ notes: x.target.value })} placeholder="Esecuzione, errori da evitare, regolazioni della macchina…" />
      </div>

      <div className="card">
        <h3>Muscoli</h3>
        <div className="small muted">Tocca una volta per "principale" (verde), usa la seconda riga per "secondario".</div>
        <div className="small"><b>Principali</b></div>
        <div className="row wrap" style={{ gap: 6 }}>{(Object.keys(MUSCLE_LABELS) as MuscleId[]).map((m) => <button key={m} className={`chip ${e.primaryMuscles.includes(m) ? 'on' : ''}`} onClick={() => toggleMuscle(m, 'primaryMuscles')}>{MUSCLE_LABELS[m]}</button>)}</div>
        <div className="small"><b>Secondari</b></div>
        <div className="row wrap" style={{ gap: 6 }}>{(Object.keys(MUSCLE_LABELS) as MuscleId[]).map((m) => <button key={m} className={`chip ${e.secondaryMuscles.includes(m) ? 'on' : ''}`} style={e.secondaryMuscles.includes(m) ? { background: 'var(--info)' } : undefined} onClick={() => toggleMuscle(m, 'secondaryMuscles')}>{MUSCLE_LABELS[m]}</button>)}</div>
      </div>

      <div className="card">
        <h3>Immagine, video e animazione</h3>
        {img && <div className="media-box"><img src={img} alt={e.name} /></div>}
        <div className="row">
          <label className="btn sm">{e.imageId ? 'Sostituisci immagine/GIF' : 'Carica immagine/GIF'}
            <input type="file" accept="image/*" hidden onChange={async (x) => {
              const f = x.target.files?.[0]; x.target.value = '';
              if (!f) return;
              if (e.imageId) await deleteMedia(e.imageId);
              upd({ imageId: await saveMedia(await compressImage(f, 1200), f.name) });
            }} />
          </label>
          {e.imageId && <button className="btn sm danger" onClick={async () => { await deleteMedia(e.imageId); upd({ imageId: undefined }); }}>Rimuovi</button>}
        </div>
        <label className="field">Link a un video illustrativo (YouTube o altro, si apre online)
          <input className="input" inputMode="url" value={e.videoUrl ?? ''} onChange={(x) => upd({ videoUrl: x.target.value.trim() || undefined })} placeholder="https://…" />
        </label>
        <label className="field">Schema di movimento per la dimostrazione 3D
          <select className="input" value={e.movement ?? 'none'} onChange={(x) => upd({ movement: x.target.value as MovementPattern })}>
            {(Object.keys(MOVEMENT_LABELS) as MovementPattern[]).map((m) => <option key={m} value={m}>{MOVEMENT_LABELS[m]}</option>)}
          </select>
        </label>
        <div className="tiny muted">L'app non include immagini o video preconfezionati: puoi caricare le tue foto/GIF o collegare video che ritieni corretti.</div>
      </div>

      <button className="btn primary block xl" onClick={save}>Salva esercizio</button>
      {!isNew && (
        <>
          <button className="btn block" onClick={async () => { await db.exercises.update(e.id, { archived: !e.archived }); upd({ archived: !e.archived }); }}>{e.archived ? 'Ripristina dalla libreria' : 'Archivia (nasconde dalle nuove schede)'}</button>
          <ConfirmButton onConfirm={async () => {
            const used = (await db.templates.toArray()).some((t) => t.items.some((i) => i.exerciseId === e.id));
            const logged = await db.sets.where('exerciseId').equals(e.id).count();
            if (used || logged) { toast('Esercizio usato in schede o nello storico: archivialo invece di eliminarlo'); return; }
            await deleteMedia(e.imageId);
            await db.exercises.delete(e.id);
            nav('/profilo/esercizi', { replace: true });
          }}>Elimina esercizio</ConfirmButton>
        </>
      )}
    </div>
  );
}
