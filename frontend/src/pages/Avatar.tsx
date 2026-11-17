import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useState } from 'react';
import { db, uid } from '../db/db';
import { MUSCLE_LABELS, VIEW_LABELS, type AvatarConfig, type MuscleId, type PhotoView } from '../db/types';
import { Body3D } from '../components/Body3D';
import { MediaImg } from '../components/BeforeAfter';
import { ConfirmButton, PageHeader, useToast } from '../components/ui';
import { bodyParamsFrom } from '../lib/avatar';
import { todayISO } from '../lib/dates';
import { compressImage, deleteMedia, fmtBytes, saveMedia, useMediaUrl } from '../lib/media';

export default function Avatar() {
  const toast = useToast();
  const avatar = useLiveQuery(() => db.avatar.get('avatar'), []);
  const measurements = useLiveQuery(() => db.measurements.toArray(), []);
  const photos = useLiveQuery(() => db.photos.where('purpose').equals('avatar').toArray(), []);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const glbMedia = useLiveQuery(async () => (avatar?.glbMediaId ? (await db.media.get(avatar.glbMediaId)) ?? null : null), [avatar?.glbMediaId]);
  const glbUrl = useMediaUrl(avatar?.glbMediaId);
  const [step, setStep] = useState(0);
  const [exId, setExId] = useState('');
  const [useGlb, setUseGlb] = useState(true);
  if (!avatar || !measurements || !photos || !exercises) return null;
  const { params, measured } = bodyParamsFrom(avatar, measurements);
  const ex = exercises.find((e) => e.id === exId);
  const set = (p: Partial<AvatarConfig>) => db.avatar.put({ ...avatar, ...p, updatedAt: Date.now() });
  const slider = (label: string, key: keyof AvatarConfig, min: number, max: number, stepV = 0.01) => (
    <label className="field">{label}: {String(avatar[key])}
      <input type="range" min={min} max={max} step={stepV} value={avatar[key] as number} onChange={(e) => set({ [key]: Number(e.target.value) })} />
    </label>
  );

  return (
    <div className="page">
      <PageHeader title="Avatar 3D" back />
      <div className="notice warn small">
        <b>Trasparenza:</b> questo è un <b>manichino parametrico</b> costruito con altezza, proporzioni e circonferenze che hai registrato. <b>Non è una riproduzione fotorealistica di te.</b> La conversione automatica da fotografie a modello 3D non è disponibile nell'app: per un avatar realistico puoi creare un modello GLB/GLTF con un servizio o un'app di scansione 3D specializzata e importarlo qui sotto.
      </div>

      <Suspense fallback={<div className="canvas3d" />}>
        <Body3D params={params} glbUrl={useGlb ? glbUrl : undefined} primary={ex?.primaryMuscles ?? []} secondary={ex?.secondaryMuscles ?? []} movement={ex?.movement ?? 'none'} />
      </Suspense>
      <label className="field">Evidenzia i muscoli di un esercizio
        <select className="input" value={exId} onChange={(e) => setExId(e.target.value)}>
          <option value="">— nessuno —</option>
          {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>
      {ex && <div className="small muted">{ex.primaryMuscles.map((m: MuscleId) => MUSCLE_LABELS[m]).join(', ')}{ex.secondaryMuscles.length ? ` · secondari: ${ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}` : ''}</div>}
      {measured.length > 0 && avatar.useMeasurements && <div className="tiny muted">Proporzioni dalle tue misure reali: {measured.join(', ')}.</div>}

      <div className="row wrap">
        {['Proporzioni', 'Fotografie', 'Modello GLB'].map((l, i) => <button key={l} className={`chip ${step === i ? 'on' : ''}`} onClick={() => setStep(i)}>{i + 1}. {l}</button>)}
      </div>

      {step === 0 && (
        <div className="card">
          <h3>Proporzioni corporee</h3>
          <div className="grid2">
            <label className="field">Altezza (cm)<input className="input" inputMode="numeric" value={avatar.heightCm} onChange={(e) => set({ heightCm: Number(e.target.value) || avatar.heightCm })} /></label>
            <label className="field">Peso (kg)<input className="input" inputMode="decimal" value={avatar.weightKg} onChange={(e) => set({ weightKg: Number(e.target.value) || avatar.weightKg })} /></label>
          </div>
          <label className="check"><input type="checkbox" checked={avatar.useMeasurements} onChange={(e) => set({ useMeasurements: e.target.checked })} /> Usa le circonferenze registrate in "Il mio corpo" (si aggiorna a ogni nuova misurazione)</label>
          {slider('Corporatura (0 esile – 1 robusta)', 'build', 0, 1)}
          {slider('Larghezza spalle', 'shoulders', 0.8, 1.25)}
          {slider('Torace', 'chest', 0.8, 1.25)}
          {slider('Vita', 'waist', 0.8, 1.25)}
          {slider('Fianchi', 'hips', 0.8, 1.25)}
          {slider('Braccia', 'arms', 0.8, 1.25)}
          {slider('Gambe', 'legs', 0.8, 1.25)}
          <label className="field">Tonalità pelle<input type="color" className="input" style={{ height: 46, padding: 4 }} value={avatar.skinTone} onChange={(e) => set({ skinTone: e.target.value })} /></label>
          <div className="tiny muted">I cursori valgono solo per le misure non registrate. Il modello non simula trasformazioni future: riflette solo i dati inseriti.</div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h3>Fotografie di riferimento</h3>
          <div className="small muted">Caricamento volontario. Le foto restano solo su questo dispositivo, non vengono inviate a nessun servizio e puoi eliminarle in qualsiasi momento. Servono come riferimento per te o per un servizio di modellazione 3D che sceglierai.</div>
          <label className="check"><input type="checkbox" checked={avatar.photoConsent} onChange={(e) => set({ photoConsent: e.target.checked })} /> Acconsento a salvare foto personali sul dispositivo per l'avatar</label>
          {avatar.photoConsent && (['front', 'side', 'back'] as PhotoView[]).map((v) => {
            const p = photos.filter((x) => x.view === v).sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <div key={v} className="row">
                <div style={{ width: 80 }}>{p ? <MediaImg id={p.mediaId} alt={VIEW_LABELS[v]} style={{ width: 80, borderRadius: 8 }} /> : <div className="icon-circle" style={{ width: 80, height: 100 }}>—</div>}</div>
                <div className="grow col">
                  <b>{VIEW_LABELS[v]}</b>
                  <div className="row">
                    <label className="btn sm">{p ? 'Sostituisci' : 'Carica'}<input type="file" accept="image/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]; e.target.value = '';
                      if (!f) return;
                      if (p) { await deleteMedia(p.mediaId); await db.photos.delete(p.id); }
                      const mediaId = await saveMedia(await compressImage(f), f.name);
                      await db.photos.put({ id: uid('ph-'), date: todayISO(), view: v, purpose: 'avatar', mediaId });
                    }} /></label>
                    {p && <ConfirmButton className="btn sm danger" onConfirm={async () => { await deleteMedia(p.mediaId); await db.photos.delete(p.id); }}>Elimina</ConfirmButton>}
                  </div>
                </div>
              </div>
            );
          })}
          {!avatar.photoConsent && photos.length > 0 && (
            <ConfirmButton onConfirm={async () => { for (const p of photos) { await deleteMedia(p.mediaId); await db.photos.delete(p.id); } }}>Elimina tutte le foto avatar</ConfirmButton>
          )}
          <div className="notice small"><b>Conversione foto → modello 3D:</b> non disponibile nell'app. Nessuna foto viene inviata a servizi esterni. Quando avrai il modello GLB creato con uno strumento specializzato, importalo al passo 3.</div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h3>Importa modello 3D (GLB/GLTF)</h3>
          <div className="small muted">Formati: .glb (consigliato, file unico) o .gltf con risorse incorporate. Il modello viene scalato alla tua altezza. Se contiene animazioni, la prima viene riprodotta. Per l'evidenziazione dei muscoli, le mesh devono avere nel nome l'identificativo del muscolo (es. "pettorali", "dorsali", "quadricipiti").</div>
          {glbMedia ? (
            <>
              <div className="row between"><span>{avatar.glbName} · {fmtBytes(glbMedia.size)}</span><span className="badge ok">importato</span></div>
              <label className="check"><input type="checkbox" checked={useGlb} onChange={(e) => setUseGlb(e.target.checked)} /> Mostra il modello importato (invece del manichino)</label>
              <ConfirmButton onConfirm={async () => { await deleteMedia(avatar.glbMediaId); await set({ glbMediaId: undefined, glbName: undefined }); toast('Modello rimosso'); }}>Rimuovi modello</ConfirmButton>
            </>
          ) : <div className="notice">Nessun modello importato: viene mostrato il manichino parametrico.</div>}
          <label className="btn primary block">Scegli file .glb / .gltf
            <input type="file" hidden accept=".glb,.gltf,model/gltf-binary,model/gltf+json" onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = '';
              if (!f) return;
              if (!/\.(glb|gltf)$/i.test(f.name)) { toast('Formato non supportato'); return; }
              if (avatar.glbMediaId) await deleteMedia(avatar.glbMediaId);
              const id = await saveMedia(new Blob([await f.arrayBuffer()], { type: f.name.toLowerCase().endsWith('.glb') ? 'model/gltf-binary' : 'model/gltf+json' }), f.name);
              await set({ glbMediaId: id, glbName: f.name });
              setUseGlb(true);
              toast('Modello importato');
            }} />
          </label>
        </div>
      )}
    </div>
  );
}
