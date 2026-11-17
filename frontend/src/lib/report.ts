// Report PDF mensile generato sul dispositivo (jsPDF). Nessun invio a server.
import { db } from '../db/db';
import { ACTIVITY_LABELS, MEASURE_FIELDS, VIEW_LABELS, type PhotoView } from '../db/types';
import { addDays, fmtDate, fmtMonth, todayISO } from './dates';
import { getSettings } from './settings';
import { adherence, exerciseStats, measurementDelta, valueAt } from './stats';

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}

export async function generateMonthlyReport(month: string, opts: { includePhotos: boolean; includeDiet: boolean }): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const settings = await getSettings();
  const [exercises, sessions, sets, activities, measurements, photos] = await Promise.all([
    db.exercises.toArray(), db.sessions.toArray(), db.sets.toArray(), db.activities.toArray(), db.measurements.toArray(), db.photos.toArray()
  ]);
  const from = `${month}-01`;
  const [yy, mm] = month.split('-').map(Number);
  const lastDay = todayISO(new Date(yy, mm, 0, 12));
  const monthEnd = month === todayISO().slice(0, 7) ? todayISO() : lastDay;
  const p = settings.profile;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(11, 13, 14); doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(57, 255, 136); doc.setFontSize(18); doc.text('My Fitness & Futsal', 14, 13);
  doc.setTextColor(255, 255, 255); doc.setFontSize(11);
  doc.text(`Report mensile – ${fmtMonth(month)}${p.name ? ` – ${p.name}` : ''}`, 14, 21);
  doc.setTextColor(30, 30, 30);
  let y = 36;
  doc.setFontSize(10);
  doc.text(`Profilo: ${p.age} anni, ${p.heightCm} cm, peso iniziale ${p.startWeightKg} kg. ${p.sport}.`, 14, y); y += 5;
  doc.text(`Obiettivo: ${p.mainGoal}.`, 14, y, { maxWidth: W - 28 }); y += 8;

  const adh = adherence(settings, sessions, activities, from, monthEnd);
  const monthSessions = sessions.filter((s) => s.status === 'completed' && s.date >= from && s.date <= monthEnd);
  const monthActs = activities.filter((a) => a.done && a.date >= from && a.date <= monthEnd);
  autoTable(doc, {
    startY: y,
    head: [['Riepilogo del mese', 'Valore']],
    body: [
      ['Sedute in palestra completate', String(monthSessions.length)],
      ['Altre attività registrate', monthActs.length ? Object.entries(monthActs.reduce<Record<string, number>>((a, x) => { a[ACTIVITY_LABELS[x.type]] = (a[ACTIVITY_LABELS[x.type]] ?? 0) + 1; return a; }, {})).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'],
      ['Aderenza al programma', adh.pct !== null ? `${adh.pct}% (${adh.done}/${adh.planned})` : '—'],
      ['Durata media seduta', monthSessions.length ? `${Math.round(monthSessions.reduce((a, s) => a + ((s.endedAt ?? s.startedAt) - s.startedAt), 0) / monthSessions.length / 60000)} min` : '—']
    ],
    theme: 'grid', headStyles: { fillColor: [30, 34, 36] }, styles: { fontSize: 9 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  const mRows = MEASURE_FIELDS.map((f) => {
    const start = valueAt(measurements, f.key, addDays(from, -1)) ?? measurementDelta(measurements.filter((m) => m.date >= from && m.date <= monthEnd), f.key).first;
    const end = valueAt(measurements, f.key, monthEnd);
    const all = measurementDelta(measurements, f.key);
    if (start === undefined && end === undefined) return null;
    const d = start !== undefined && end !== undefined ? Math.round((end - start) * 10) / 10 : undefined;
    return [f.label, start !== undefined ? `${start} ${f.unit}` : '—', end !== undefined ? `${end} ${f.unit}` : '—', d !== undefined ? `${d > 0 ? '+' : ''}${d}` : '—', all.delta !== undefined ? `${all.delta > 0 ? '+' : ''}${all.delta}` : '—'];
  }).filter(Boolean) as string[][];
  autoTable(doc, {
    startY: y,
    head: [['Misura', 'Inizio mese', 'Fine mese', 'Var. mese', 'Var. totale']],
    body: mRows.length ? mRows : [['Nessuna misurazione registrata', '', '', '', '']],
    theme: 'grid', headStyles: { fillColor: [30, 34, 36] }, styles: { fontSize: 9 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  const exRows = exercises.filter((e) => e.usesLoad).map((e) => {
    const all = sets.filter((s) => s.exerciseId === e.id && s.date <= monthEnd);
    const inMonth = all.filter((s) => s.date >= from);
    if (!inMonth.length) return null;
    const st = exerciseStats(e, inMonth);
    const stAll = exerciseStats(e, all);
    return [e.name, String(st.sessions), `${st.series[0]?.topWeight ?? '—'} kg`, `${st.lastWeight ?? '—'} kg`, `${stAll.bestWeight ?? '—'} kg`];
  }).filter(Boolean) as string[][];
  autoTable(doc, {
    startY: y,
    head: [['Esercizio', 'Sedute', 'Carico inizio mese', 'Carico fine mese', 'Miglior carico']],
    body: exRows.length ? exRows : [['Nessuna serie registrata nel mese', '', '', '', '']],
    theme: 'grid', headStyles: { fillColor: [30, 34, 36] }, styles: { fontSize: 9 }
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  if (opts.includeDiet) {
    const days = new Set<string>();
    const logs = await db.mealLogs.where('date').between(from, monthEnd, true, true).toArray();
    logs.forEach((l) => days.add(l.date));
    const done = logs.filter((l) => l.done).length;
    autoTable(doc, {
      startY: y,
      head: [['Diario alimentare', 'Valore']],
      body: [['Giorni con pasti registrati', String(days.size)], ['Pasti segnati come effettuati', String(done)]],
      theme: 'grid', headStyles: { fillColor: [30, 34, 36] }, styles: { fontSize: 9 }
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  if (opts.includePhotos) {
    const views: PhotoView[] = ['front', 'side', 'back'];
    const monthPhotos = photos.filter((ph) => ph.purpose === 'progress' && ph.date >= from && ph.date <= monthEnd);
    if (monthPhotos.length) {
      doc.addPage(); y = 16;
      doc.setFontSize(13); doc.text('Evoluzione fotografica del mese', 14, y); y += 6;
      for (const v of views) {
        const list = monthPhotos.filter((ph) => ph.view === v).sort((a, b) => a.date.localeCompare(b.date));
        if (!list.length) continue;
        const pair = list.length > 1 ? [list[0], list[list.length - 1]] : [list[0]];
        doc.setFontSize(10); doc.text(VIEW_LABELS[v], 14, y + 4); y += 6;
        let x = 14;
        for (const ph of pair) {
          const m = await db.media.get(ph.mediaId);
          if (!m) continue;
          const url = await blobToDataUrl(m.blob);
          const props = doc.getImageProperties(url);
          const h = 70; const w = (props.width / props.height) * h;
          doc.addImage(url, props.fileType, x, y, Math.min(w, 85), h);
          doc.text(fmtDate(ph.date, { day: 'numeric', month: 'long' }), x, y + h + 4);
          x += 92;
        }
        y += 80;
        if (y > 220) { doc.addPage(); y = 16; }
      }
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Generato il ${fmtDate(todayISO(), { day: 'numeric', month: 'long', year: 'numeric' })} – dati registrati dall'utente; nessuna stima della massa grassa. Pag. ${i}/${pages}`, 14, 290);
  }
  return doc.output('blob');
}
