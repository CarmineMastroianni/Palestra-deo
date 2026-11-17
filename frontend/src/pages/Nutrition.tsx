import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db, uid } from '../db/db';
import { MEAL_KEYS, MEAL_LABELS, type DietDoc, type MealKey } from '../db/types';
import { ConfirmButton, Modal, PageHeader, useToast } from '../components/ui';
import { addDays, dayKeyOf, fmtDate, todayISO } from '../lib/dates';
import { parseDietText } from '../lib/dietParser';
import { detectKind, extractDocxText, extractPdfText, ocrImage } from '../lib/docExtract';
import { deleteMedia, saveMedia, useMediaUrl } from '../lib/media';
import { useSettings } from '../lib/settings';
import { markPendingSync } from '../lib/sync';

export default function Nutrition() {
  const s = useSettings();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const docs = useLiveQuery(() => db.dietDocs.orderBy('uploadedAt').reverse().toArray(), []);
  const active = docs?.find((d) => d.active);
  const plan = useLiveQuery(async () => (active ? (await db.dietPlans.get(active.id)) ?? null : null), [active?.id]);
  const logs = useLiveQuery(() => db.mealLogs.where('date').equals(date).toArray(), [date]);
  const recent = useLiveQuery(() => db.mealLogs.where('date').between(addDays(todayISO(), -13), todayISO(), true, true).toArray(), []);
  const [viewDoc, setViewDoc] = useState<DietDoc | null>(null);
  const [editDoc, setEditDoc] = useState<DietDoc | null>(null);
  const [busy, setBusy] = useState('');
  if (!s || !docs || logs === undefined || !recent) return null;
  const dayPlan = s.schedule[dayKeyOf(date)];

  const upload = async (file: File) => {
    const kind = detectKind(file.type, file.name);
    setBusy('Salvataggio del documento…');
    try {
      const mediaId = await saveMedia(file, file.name);
      let text = ''; let method: DietDoc['extractionMethod'] = 'nessuno';
      try {
        if (kind === 'pdf') { setBusy('Lettura del PDF…'); text = await extractPdfText(file); method = 'pdf'; }
        else if (kind === 'docx') { setBusy('Lettura del documento Word…'); text = (await extractDocxText(file)).text; method = 'docx'; }
        else if (kind === 'text') { text = await file.text(); method = 'manuale'; }
      } catch (e) { toast(`Testo non estratto automaticamente: ${(e as Error).message}`); }
      const id = uid('diet-');
      const doc: DietDoc = { id, title: file.name.replace(/\.[^.]+$/, ''), mediaId, mime: file.type || 'application/octet-stream', uploadedAt: Date.now(), validFrom: todayISO(), active: true, extractedText: text, extractionMethod: method };
      await db.transaction('rw', db.dietDocs, db.dietPlans, async () => {
        await db.dietDocs.toCollection().modify({ active: false });
        await db.dietDocs.put(doc);
        await db.dietPlans.put(parseDietText(text, id));
      });
      markPendingSync();
      toast(text ? 'Piano caricato: verifica la lettura automatica' : kind === 'image' ? 'Foto salvata: usa "Riconosci testo" per la lettura automatica' : kind === 'doc' ? 'File .doc salvato: per la lettura automatica salvalo come .docx o PDF' : 'Documento salvato');
    } finally { setBusy(''); }
  };

  const toggleMeal = async (meal: MealKey) => {
    const id = `${date}|${meal}`;
    const cur = logs.find((l) => l.id === id);
    await db.mealLogs.put({ id, date, meal, done: !cur?.done, at: Date.now(), notes: cur?.notes });
  };

  const daysLogged = new Set(recent.filter((l) => l.done).map((l) => l.date)).size;
  const mealsInPlan = plan?.meals.length ?? 0;

  return (
    <div className="page">
      <PageHeader title="La mia alimentazione" />
      <div className="notice small">Il piano è quello del tuo nutrizionista: l'app non modifica alimenti, quantità, calorie o macronutrienti. I documenti restano sul dispositivo.</div>

      <div className="card">
        <div className="row between">
          <h3>Diario del giorno</h3>
          <input type="date" className="input" style={{ width: 'auto', minHeight: 38, padding: '6px 10px' }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="small muted">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · {dayPlan.label}</div>
        {!plan && <div className="notice">Carica il piano del nutrizionista per vedere i pasti previsti. Puoi comunque segnare i pasti effettuati.</div>}
        {MEAL_KEYS.map((k) => {
          const meal = plan?.meals.find((m) => m.key === k);
          const done = logs.find((l) => l.meal === k)?.done;
          return (
            <div key={k} className="card flat" style={{ gap: 6 }}>
              <div className="row between">
                <b>{MEAL_LABELS[k]}{meal?.time ? <span className="muted small"> · {meal.time}</span> : null}</b>
                <button className={`chip ${done ? 'on' : ''}`} onClick={() => toggleMeal(k)}>{done ? '✓ Fatto' : 'Segna fatto'}</button>
              </div>
              {meal && meal.foods.map((f, i) => (
                <div key={i} className="small">• {f.quantity ? <b>{f.quantity} </b> : null}{f.food || f.text}{f.alternatives.length ? <span className="muted"> — oppure: {f.alternatives.join(' / ')}</span> : null}</div>
              ))}
              {meal?.notes.map((n, i) => <div key={i} className="tiny muted">{n}</div>)}
            </div>
          );
        })}
        {plan && (dayPlan.type === 'gym' || dayPlan.type === 'futsal') && plan.trainingNotes.length > 0 && (
          <div className="notice ok small"><b>Indicazioni per l'allenamento (dal piano):</b><br />{plan.trainingNotes.join('\n')}</div>
        )}
        {plan && dayPlan.type === 'match' && plan.matchNotes.length > 0 && (
          <div className="notice ok small"><b>Indicazioni giorno partita (dal piano):</b><br />{plan.matchNotes.join('\n')}</div>
        )}
        <div className="tiny muted">Ultimi 14 giorni: pasti segnati in {daysLogged} giorni{mealsInPlan ? ` · ${mealsInPlan} pasti nel piano` : ''}.</div>
      </div>

      <div className="card">
        <h3>Piano del nutrizionista</h3>
        <label className="btn primary block">
          {busy || '+ Carica piano (PDF, Word, foto)'}
          <input type="file" hidden accept=".pdf,.doc,.docx,.txt,image/*,application/pdf" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        </label>
        <div className="tiny muted">Ogni nuovo caricamento diventa il piano attivo; i precedenti restano consultabili come storico degli aggiornamenti.</div>
        {docs.length === 0 && <div className="notice">Nessun documento caricato.</div>}
        <div className="list">
          {docs.map((d) => (
            <div key={d.id} className="list-item" style={{ cursor: 'default' }}>
              <div className="grow">
                <b>{d.title}</b> {d.active && <span className="badge ok">attivo</span>}
                <div className="tiny muted">Caricato il {new Date(d.uploadedAt).toLocaleDateString('it-IT')} · lettura: {d.extractionMethod === 'nessuno' ? 'non eseguita' : d.extractionMethod}</div>
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  <button className="btn sm" onClick={() => setViewDoc(d)}>Originale</button>
                  <button className="btn sm" onClick={() => setEditDoc(d)}>Lettura automatica</button>
                  {!d.active && <button className="btn sm" onClick={async () => { await db.dietDocs.toCollection().modify({ active: false }); await db.dietDocs.update(d.id, { active: true }); }}>Rendi attivo</button>}
                  <ConfirmButton className="btn sm danger" onConfirm={async () => { await deleteMedia(d.mediaId); await db.dietPlans.delete(d.id); await db.dietDocs.delete(d.id); }}>Elimina</ConfirmButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <DocViewer doc={viewDoc} onClose={() => setViewDoc(null)} />
      <ParseEditor doc={editDoc} onClose={() => setEditDoc(null)} />
    </div>
  );
}

function DocViewer({ doc, onClose }: { doc: DietDoc | null; onClose: () => void }) {
  const url = useMediaUrl(doc?.mediaId);
  const [html, setHtml] = useState('');
  useEffect(() => {
    setHtml('');
    if (!doc || detectKind(doc.mime, doc.title) !== 'docx') return;
    void db.media.get(doc.mediaId).then(async (m) => { if (m) setHtml((await extractDocxText(m.blob)).html); });
  }, [doc]);
  if (!doc) return null;
  const kind = detectKind(doc.mime, doc.title);
  return (
    <Modal open onClose={onClose} title={doc.title}>
      <div className="tiny muted">Documento originale, non modificato.</div>
      {url && doc.mime === 'application/pdf' && <iframe className="doc-frame" src={url} title={doc.title} />}
      {url && doc.mime.startsWith('image/') && <img src={url} alt={doc.title} style={{ width: '100%', borderRadius: 12 }} />}
      {html && <div className="doc-html" dangerouslySetInnerHTML={{ __html: html }} />}
      {url && <a className="btn block" href={url} download={doc.title}>Apri / scarica il file</a>}
      {kind === 'other' && !html && <div className="small muted">Anteprima non disponibile per questo formato.</div>}
    </Modal>
  );
}

function ParseEditor({ doc, onClose }: { doc: DietDoc | null; onClose: () => void }) {
  const toast = useToast();
  const plan = useLiveQuery(async () => (doc ? (await db.dietPlans.get(doc.id)) ?? null : null), [doc?.id]);
  const [text, setText] = useState('');
  const [ocr, setOcr] = useState<number | null>(null);
  const [key, setKey] = useState<string>();
  if (doc && key !== doc.id) { setKey(doc.id); setText(doc.extractedText); }
  if (!doc) return null;

  const runOcr = async () => {
    const m = await db.media.get(doc.mediaId);
    if (!m) return;
    setOcr(0);
    try {
      const t = await ocrImage(m.blob, (p) => setOcr(Math.round(p * 100)));
      setText(t);
      toast('Testo riconosciuto: verificalo prima di salvare');
    } catch (e) { toast(`OCR non riuscito: ${(e as Error).message}`); }
    setOcr(null);
  };
  const save = async () => {
    await db.dietDocs.update(doc.id, { extractedText: text, extractionMethod: doc.extractionMethod === 'nessuno' ? 'manuale' : doc.extractionMethod });
    await db.dietPlans.put({ ...parseDietText(text, doc.id), reviewedByUser: true });
    toast('Lettura aggiornata');
  };

  return (
    <Modal open onClose={() => { setKey(undefined); onClose(); }} title="Lettura automatica">
      <div className="notice small">Riconoscimento automatico di pasti, quantità, alternative, orari e indicazioni per allenamento/partita. È una lettura del testo, non una modifica del piano: verificala sempre con l'originale.</div>
      {doc.mime.startsWith('image/') && (
        <button className="btn block" disabled={ocr !== null} onClick={runOcr}>{ocr !== null ? `Riconoscimento in corso… ${ocr}%` : 'Riconosci testo dalla foto (OCR sul dispositivo)'}</button>
      )}
      {doc.mime.startsWith('image/') && <div className="tiny muted">La prima volta viene scaricato il motore OCR con la lingua italiana (alcuni MB). La foto non lascia il telefono.</div>}
      <label className="field">Testo del piano (puoi correggere errori di lettura o incollare il testo)
        <textarea className="input" style={{ minHeight: 200, fontSize: '.85em' }} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <button className="btn primary block" onClick={save}>Aggiorna lettura</button>
      {plan && (
        <div className="col">
          {plan.meals.length === 0 && <div className="notice warn small">Nessun pasto riconosciuto. Il testo deve contenere intestazioni come "Colazione", "Spuntino", "Pranzo", "Merenda", "Cena".</div>}
          {plan.meals.map((m) => (
            <div key={m.key} className="card flat small">
              <b>{MEAL_LABELS[m.key]}{m.time ? ` · ${m.time}` : ''}</b>
              {m.foods.map((f, i) => <div key={i}>• <span className="accent">{f.quantity ?? ''}</span> {f.food}{f.alternatives.length ? <span className="muted"> | alt: {f.alternatives.join(' / ')}</span> : ''}</div>)}
            </div>
          ))}
          {plan.trainingNotes.length > 0 && <div className="card flat small"><b>Allenamento</b>{plan.trainingNotes.map((n, i) => <div key={i}>{n}</div>)}</div>}
          {plan.matchNotes.length > 0 && <div className="card flat small"><b>Partita</b>{plan.matchNotes.map((n, i) => <div key={i}>{n}</div>)}</div>}
          {plan.otherNotes.length > 0 && <div className="card flat small"><b>Altre indicazioni</b>{plan.otherNotes.map((n, i) => <div key={i}>{n}</div>)}</div>}
          {plan.unassigned.length > 0 && <div className="card flat small"><b className="muted">Righe non assegnate</b>{plan.unassigned.slice(0, 30).map((n, i) => <div key={i} className="muted">{n}</div>)}</div>}
        </div>
      )}
    </Modal>
  );
}
