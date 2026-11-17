import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { MEASURE_FIELDS } from '../db/types';
import { BarsChart, TrendChart } from '../components/Charts';
import { PageHeader, Stat, useToast } from '../components/ui';
import { addDays, fmtDate, fmtMonth, monthKey, todayISO, weekStart } from '../lib/dates';
import { workloadRatio } from '../lib/readiness';
import { downloadBlob } from '../lib/backup';
import { generateMonthlyReport } from '../lib/report';
import { useSettings } from '../lib/settings';
import { adherence, exerciseStats, measurementDelta } from '../lib/stats';

export default function Progress() {
  const s = useSettings();
  const toast = useToast();
  const data = useLiveQuery(async () => {
    const [exercises, sessions, sets, activities, measurements, photos] = await Promise.all([
      db.exercises.toArray(), db.sessions.toArray(), db.sets.toArray(), db.activities.toArray(), db.measurements.toArray(), db.photos.count()
    ]);
    return { exercises, sessions, sets, activities, measurements, photos };
  }, []);
  const [exId, setExId] = useState<string>('');
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [incPhotos, setIncPhotos] = useState(false);
  const [incDiet, setIncDiet] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!s || !data) return null;
  const today = todayISO();
  const completed = data.sessions.filter((x) => x.status === 'completed');
  const w = measurementDelta(data.measurements, 'weight');
  const waist = measurementDelta(data.measurements, 'waist');
  const adh = adherence(s, data.sessions, data.activities, s.profile.programStart, today);
  const wl = workloadRatio(data.sessions, data.activities, today);
  const loadEx = data.exercises.filter((e) => e.usesLoad && e.mode === 'reps' && data.sets.some((x) => x.exerciseId === e.id));
  const selEx = loadEx.find((e) => e.id === exId) ?? loadEx[0];
  const selStats = selEx ? exerciseStats(selEx, data.sets.filter((x) => x.exerciseId === selEx.id)) : undefined;

  // allenamenti per settimana (ultime 10)
  const weeks: { label: string; n: number }[] = [];
  for (let i = 9; i >= 0; i--) {
    const ws = weekStart(addDays(today, -7 * i));
    const we = addDays(ws, 6);
    weeks.push({ label: fmtDate(ws, { day: 'numeric', month: 'numeric' }), n: completed.filter((x) => x.date >= ws && x.date <= we).length });
  }
  const months = Array.from(new Set([monthKey(today), ...completed.map((x) => monthKey(x.date)), ...data.measurements.map((m) => monthKey(m.date))])).sort().reverse();

  const makeReport = async () => {
    setBusy(true);
    try {
      const blob = await generateMonthlyReport(month, { includePhotos: incPhotos, includeDiet: incDiet });
      const name = `report-${month}.pdf`;
      const file = new File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `Report ${fmtMonth(month)}` }); } catch { downloadBlob(name, blob); }
      } else downloadBlob(name, blob);
    } catch (e) { toast(`Errore nella generazione: ${(e as Error).message}`); }
    setBusy(false);
  };

  return (
    <div className="page">
      <PageHeader title="I miei progressi" right={<Link to="/corpo" className="btn sm">Il mio corpo</Link>} />
      <div className="grid2">
        <Stat label="Peso iniziale" value={`${s.profile.startWeightKg} kg`} sub="dichiarato nel profilo" />
        <Stat label="Peso attuale" value={w.last !== undefined ? `${w.last} kg` : '—'} sub={w.last !== undefined ? `${Math.round((w.last - s.profile.startWeightKg) * 10) / 10 > 0 ? '+' : ''}${Math.round((w.last - s.profile.startWeightKg) * 10) / 10} kg dall'inizio` : 'registra il peso in Il mio corpo'} />
        <Stat label="Girovita" value={waist.last !== undefined ? `${waist.last} cm` : '—'} sub={waist.delta !== undefined && waist.firstDate !== waist.lastDate ? `${waist.delta > 0 ? '+' : ''}${waist.delta} cm dal ${fmtDate(waist.firstDate!)}` : 'servono 2 misurazioni'} />
        <Stat label="Allenamenti" value={completed.length} sub="sedute palestra completate" />
        <Stat label="Aderenza" value={adh.pct !== null ? `${adh.pct}%` : '—'} sub={`${adh.done}/${adh.planned} attività programmate`} />
        <Stat label="Foto" value={data.photos} sub={<Link to="/corpo">evoluzione fotografica</Link>} />
      </div>

      <div className="card">
        <h3>Carico di lavoro</h3>
        <div className="small">{wl.note}</div>
        {wl.ratio !== null && <div className="tiny muted">Rapporto ultimi 7 giorni / media 4 settimane: {wl.ratio}</div>}
      </div>

      <div className="card">
        <h3>Allenamenti per settimana</h3>
        <BarsChart data={weeks} dataKey="n" />
      </div>

      <div className="card">
        <h3>Progressione dei carichi</h3>
        {loadEx.length === 0 ? <div className="notice">Nessun carico registrato finora.</div> : (
          <>
            <select className="input" value={selEx?.id} onChange={(e) => setExId(e.target.value)}>
              {loadEx.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {selStats && <TrendChart data={selStats.series} lines={[{ key: 'topWeight', label: 'Carico (kg)' }, { key: 'e1rm', label: '1RM stimato' }]} unit=" kg" />}
            <table className="simple"><thead><tr><th>Esercizio</th><th>Primo</th><th>Ultimo</th><th>Migliore</th></tr></thead>
              <tbody>{loadEx.map((e) => { const st = exerciseStats(e, data.sets.filter((x) => x.exerciseId === e.id)); return (
                <tr key={e.id}><td><Link to={`/esercizi/${e.id}`}>{e.name}</Link></td><td>{st.series[0]?.topWeight ?? '—'}</td><td>{st.lastWeight ?? '—'}</td><td>{st.bestWeight ?? '—'}</td></tr>
              ); })}</tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <h3>Variazione circonferenze</h3>
        <table className="simple"><thead><tr><th>Misura</th><th>Prima</th><th>Ultima</th><th>Var.</th></tr></thead>
          <tbody>{MEASURE_FIELDS.map((f) => { const d = measurementDelta(data.measurements, f.key); if (d.first === undefined) return null; return (
            <tr key={f.key}><td>{f.label}</td><td>{d.first}</td><td>{d.last}</td><td className={d.delta! < 0 ? 'accent' : d.delta! > 0 ? 'warn-text' : ''}>{d.delta! > 0 ? '+' : ''}{d.delta} {f.unit}</td></tr>
          ); })}</tbody>
        </table>
        {data.measurements.length === 0 && <div className="small muted">Nessuna misurazione registrata.</div>}
      </div>

      <div className="card">
        <h3>Report PDF mensile</h3>
        <div className="small muted">Da condividere con il nutrizionista o il preparatore atletico. Il PDF è generato sul telefono.</div>
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={incPhotos} onChange={(e) => setIncPhotos(e.target.checked)} /> Includi foto di progresso (dati sensibili)</label>
        <label className="check"><input type="checkbox" checked={incDiet} onChange={(e) => setIncDiet(e.target.checked)} /> Includi riepilogo diario alimentare</label>
        <button className="btn primary block" disabled={busy} onClick={makeReport}>{busy ? 'Generazione…' : 'Genera PDF'}</button>
      </div>
      <Link to="/assistente" className="btn block">Chiedi al coach come sto procedendo</Link>
    </div>
  );
}
