import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, uid } from '../db/db';
import { MEASURE_FIELDS, VIEW_LABELS, type Measurement, type PhotoView } from '../db/types';
import { BeforeAfter, MediaImg } from '../components/BeforeAfter';
import { TrendChart } from '../components/Charts';
import { ConfirmButton, Modal, PageHeader, useToast } from '../components/ui';
import { addDays, fmtDate, todayISO } from '../lib/dates';
import { compressImage, deleteMedia, saveMedia } from '../lib/media';
import { useSettings } from '../lib/settings';
import { valueAt } from '../lib/stats';
import { markPendingSync } from '../lib/sync';

type FieldKey = (typeof MEASURE_FIELDS)[number]['key'];

export default function Body() {
  const s = useSettings();
  const toast = useToast();
  const measurements = useLiveQuery(() => db.measurements.toArray(), []);
  const photos = useLiveQuery(() => db.photos.where('purpose').equals('progress').toArray(), []);
  const [editing, setEditing] = useState<Measurement | null>(null);
  const [field, setField] = useState<FieldKey>('weight');
  const [view, setView] = useState<PhotoView>('front');
  const [cmp, setCmp] = useState<{ a?: string; b?: string }>({});
  const sorted = useMemo(() => [...(measurements ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [measurements]);
  if (!measurements || !photos || !s) return null;
  const visibleFields = MEASURE_FIELDS.filter((f) => !s.ui.hiddenMeasurements.includes(f.key as string));
  const today = todayISO();
  const fieldDef = MEASURE_FIELDS.find((f) => f.key === field)!;
  const chartData = sorted.filter((m) => typeof m[field] === 'number').map((m) => ({ date: m.date, v: m[field] as number }));

  const cmpRow = (label: string, from: string) => {
    return visibleFields.map((f) => {
      const now = valueAt(sorted, f.key, today);
      const before = valueAt(sorted, f.key, from);
      return { f, now, before, d: now !== undefined && before !== undefined ? Math.round((now - before) * 10) / 10 : undefined, label };
    });
  };
  const start = s.profile.programStart;
  const firstRow = (k: FieldKey) => sorted.find((m) => typeof m[k] === 'number');
  const comparisons = [
    { label: 'Sett. su sett.', rows: cmpRow('7 giorni', addDays(today, -7)) },
    { label: 'Mese su mese', rows: cmpRow('30 giorni', addDays(today, -30)) },
    {
      label: 'Dall\'inizio', rows: visibleFields.map((f) => {
        const now = valueAt(sorted, f.key, today);
        const first = f.key === 'weight' && !firstRow('weight') ? s.profile.startWeightKg : (valueAt(sorted, f.key, start) ?? (firstRow(f.key)?.[f.key] as number | undefined));
        return { f, now, before: first, d: now !== undefined && first !== undefined ? Math.round((now - first) * 10) / 10 : undefined, label: 'inizio' };
      })
    }
  ];
  const viewPhotos = photos.filter((p) => p.view === view).sort((a, b) => a.date.localeCompare(b.date));
  const ca = viewPhotos.find((p) => p.id === cmp.a) ?? viewPhotos[0];
  const cb = viewPhotos.find((p) => p.id === cmp.b) ?? viewPhotos[viewPhotos.length - 1];

  const addPhoto = async (file: File, v: PhotoView, date: string) => {
    const blob = await compressImage(file);
    const mediaId = await saveMedia(blob, file.name);
    await db.photos.put({ id: uid('ph-'), date, view: v, purpose: 'progress', mediaId });
    markPendingSync();
    toast('Foto salvata sul dispositivo');
  };

  return (
    <div className="page">
      <PageHeader title="Il mio corpo" back right={<button className="btn sm primary" onClick={() => setEditing({ id: uid('ms-'), date: today })}>+ Misure</button>} />

      <div className="card">
        <h3>Andamento</h3>
        <div className="scroll-x">
          {visibleFields.map((f) => <button key={f.key} className={`chip ${field === f.key ? 'on' : ''}`} onClick={() => setField(f.key)}>{f.label}</button>)}
        </div>
        <TrendChart data={chartData} lines={[{ key: 'v', label: fieldDef.label }]} unit={` ${fieldDef.unit}`} />
      </div>

      <div className="card">
        <h3>Confronti</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="simple">
            <thead><tr><th>Misura</th><th>Attuale</th>{comparisons.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
            <tbody>
              {visibleFields.map((f, i) => (
                <tr key={f.key}>
                  <td>{f.label}</td>
                  <td className="num">{comparisons[0].rows[i].now ?? '—'}</td>
                  {comparisons.map((c) => {
                    const d = c.rows[i].d;
                    return <td key={c.label} className={`num ${d === undefined ? 'muted' : d < 0 ? 'accent' : d > 0 ? 'warn-text' : ''}`}>{d === undefined ? '—' : `${d > 0 ? '+' : ''}${d}`}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tiny muted">Differenze calcolate tra l'ultimo valore registrato e il valore registrato alla data di riferimento. Nessuna stima della massa grassa.</div>
      </div>

      <div className="card">
        <h3>Misurazioni registrate</h3>
        {sorted.length === 0 && <div className="notice">Nessuna misurazione. Premi "+ Misure" per registrare la prima.</div>}
        <div className="list">
          {[...sorted].reverse().map((m) => (
            <button key={m.id} className="list-item" onClick={() => setEditing(m)}>
              <span className="grow"><b>{fmtDate(m.date, { day: 'numeric', month: 'long', year: 'numeric' })}</b><br />
                <span className="small muted">{visibleFields.filter((f) => m[f.key] !== undefined).map((f) => `${f.label} ${m[f.key]}`).join(' · ')}</span></span>
              <span className="chev">›</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><h3>Foto di progresso</h3><span className="badge">private · solo sul dispositivo</span></div>
        <div className="row">
          {(['front', 'side', 'back'] as PhotoView[]).map((v) => <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => { setView(v); setCmp({}); }}>{VIEW_LABELS[v]}</button>)}
        </div>
        <label className="btn block">
          + Aggiungi foto {VIEW_LABELS[view].toLowerCase()}
          <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) await addPhoto(f, view, today); e.target.value = ''; }} />
        </label>
        {viewPhotos.length >= 2 && ca && cb ? (
          <>
            <BeforeAfter beforeId={ca.mediaId} afterId={cb.mediaId} beforeLabel={fmtDate(ca.date)} afterLabel={fmtDate(cb.date)} />
            <div className="grid2">
              <label className="field">Prima<select className="input" value={ca.id} onChange={(e) => setCmp({ ...cmp, a: e.target.value })}>{viewPhotos.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</option>)}</select></label>
              <label className="field">Dopo<select className="input" value={cb.id} onChange={(e) => setCmp({ ...cmp, b: e.target.value })}>{viewPhotos.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</option>)}</select></label>
            </div>
          </>
        ) : <div className="small muted">Servono almeno due foto della stessa vista per il confronto prima/dopo.</div>}
        <div className="thumbs">
          {[...viewPhotos].reverse().map((p) => (
            <div key={p.id} className="col" style={{ gap: 2 }}>
              <MediaImg id={p.mediaId} alt={`${VIEW_LABELS[p.view]} ${p.date}`} />
              <div className="row between tiny"><span>{fmtDate(p.date)}</span>
                <ConfirmButton className="btn sm ghost" confirmText="Elimina?" onConfirm={async () => { await deleteMedia(p.mediaId); await db.photos.delete(p.id); }}>🗑</ConfirmButton>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Link to="/avatar" className="btn block">Avatar 3D</Link>

      <MeasureModal m={editing} onClose={() => setEditing(null)} fields={visibleFields} onSaved={() => toast('Misure salvate')} />
    </div>
  );
}

function MeasureModal({ m, onClose, fields, onSaved }: { m: Measurement | null; onClose: () => void; fields: typeof MEASURE_FIELDS; onSaved: () => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [date, setDate] = useState('');
  const [key, setKey] = useState<string | null>(null);
  if (m && key !== m.id) {
    setKey(m.id);
    setDate(m.date);
    setDraft(Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, m[f.key] !== undefined ? String(m[f.key]) : ''])));
  }
  if (!m) return null;
  const save = async () => {
    const rec: Measurement = { id: m.id, date, notes: m.notes };
    for (const f of MEASURE_FIELDS) {
      const v = parseFloat((draft[f.key] ?? '').replace(',', '.'));
      if (!isNaN(v) && v > 0) (rec as unknown as Record<string, number>)[f.key] = v;
    }
    await db.measurements.put(rec);
    markPendingSync();
    onSaved();
    setKey(null);
    onClose();
  };
  return (
    <Modal open onClose={() => { setKey(null); onClose(); }} title="Misurazioni">
      <label className="field">Data<input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <div className="grid2">
        {fields.map((f) => (
          <label key={f.key} className="field">{f.label} ({f.unit})
            <input className="input" inputMode="decimal" value={draft[f.key] ?? ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} placeholder="—" />
          </label>
        ))}
      </div>
      <div className="tiny muted">Compila solo le misure che hai rilevato. Consiglio: misura sempre alla stessa ora, a digiuno, nello stesso punto.</div>
      <button className="btn primary block" onClick={save} disabled={!date}>Salva</button>
      <ConfirmButton onConfirm={async () => { await db.measurements.delete(m.id); setKey(null); onClose(); }}>Elimina registrazione</ConfirmButton>
    </Modal>
  );
}
