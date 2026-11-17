import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { MUSCLE_LABELS, type Exercise, type LiveState, type SetLog, type TemplateItem } from '../db/types';
import { Modal, Stepper } from '../components/ui';
import { fmtDuration } from '../lib/dates';
import { beep, notify, ScreenWake, speak, unlockAudio, vibrate } from '../lib/feedback';
import { useMediaUrl } from '../lib/media';
import { defaultRestSec, suggestLoad } from '../lib/progression';
import { useSettings } from '../lib/settings';
import { addTime, pauseCountdown, remainingMs, resumeCountdown, startCountdown, useNow } from '../lib/timer';
import { abandonSession, finishSession, logSet } from '../lib/workout';
import { useBodyParams } from '../lib/avatar';

const Body3D = lazy(() => import('../components/Body3D').then((m) => ({ default: m.Body3D })));

const patch = (p: Partial<LiveState>) => db.live.update('live', { ...p, updatedAt: Date.now() });
/** incremento atomico: tocchi rapidi non perdono ripetizioni */
const bumpReps = (d: number) => db.live.where('id').equals('live').modify((l) => { l.reps = Math.max(0, (l.reps ?? 0) + d); l.updatedAt = Date.now(); });

function targetText(item: TemplateItem, ex: Exercise): string {
  if (ex.mode === 'time' || ex.mode === 'cardio') {
    const a = item.secMin ?? 0; const b = item.secMax ?? a;
    return a === b ? `${a} s` : `${a}-${b} s`;
  }
  return item.repsMin === item.repsMax ? `${item.repsMax}` : `${item.repsMin}-${item.repsMax}`;
}

export default function LiveWorkout() {
  const nav = useNavigate();
  const s = useSettings();
  const live = useLiveQuery(() => db.live.get('live').then((x) => x ?? null), []);
  const session = useLiveQuery(async () => (live ? (await db.sessions.get(live.sessionId)) ?? null : null), [live?.sessionId]);
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const tpl = useLiveQuery(async () => (session ? (await db.templates.get(session.templateId)) ?? null : null), [session?.templateId]);
  const sessionSets = useLiveQuery(async () => (live ? db.sets.where('sessionId').equals(live.sessionId).toArray() : []), [live?.sessionId]);
  const item = session && live ? session.plan[live.itemIndex] : undefined;
  const ex = useMemo(() => exercises?.find((e) => e.id === item?.exerciseId), [exercises, item?.exerciseId]);
  const historyRes = useLiveQuery(async () => (ex && live ? { exId: ex.id, sets: (await db.sets.where('exerciseId').equals(ex.id).toArray()).filter((x) => x.sessionId !== live.sessionId) } : undefined), [ex?.id, live?.sessionId]);
  const history = historyRes && historyRes.exId === ex?.id ? historyRes.sets : undefined;
  const now = useNow(200, !!live);
  const [showMenu, setShowMenu] = useState(false);
  const [showList, setShowList] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [finalNotes, setFinalNotes] = useState('');
  const [cardioMin, setCardioMin] = useState<number | null>(null);
  const alerted = useRef<number | undefined>(undefined);
  const isoBeeps = useRef<{ min?: boolean; max?: boolean; start?: boolean }>({});
  const wake = useRef(new ScreenWake());
  const imageUrl = useMediaUrl(ex?.imageId);
  const body = useBodyParams();

  const suggestion = useMemo(() => (ex && item && history && s ? suggestLoad(ex, item, history, s.progression) : undefined), [ex, item, history, s]);

  // carico iniziale per l'esercizio corrente (mai modificato senza che l'utente lo veda)
  useEffect(() => {
    if (!live || !suggestion || live.weightSetForItem === live.itemIndex) return;
    void patch({ weightKg: suggestion.weightKg ?? suggestion.lastWeightKg ?? 0, weightSetForItem: live.itemIndex });
  }, [live, suggestion]);

  // schermo sempre acceso
  useEffect(() => {
    if (!s?.timers.keepScreenOn) return;
    const w = wake.current;
    void w.acquire();
    const onVis = () => { if (!document.hidden) void w.acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void w.release(); };
  }, [s?.timers.keepScreenOn]);

  // notifica di fine recupero quando l'app è in background (non garantita: dipende dal sistema)
  useEffect(() => {
    if (!live?.timer?.endsAt || live.phase !== 'rest' || !s?.timers.notifications) return;
    let id: number | undefined;
    const onVis = () => {
      window.clearTimeout(id);
      if (document.hidden && live.timer?.endsAt) {
        id = window.setTimeout(() => void notify('Recupero terminato', 'Inizia la prossima serie'), Math.max(0, live.timer.endsAt - Date.now()));
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearTimeout(id); document.removeEventListener('visibilitychange', onVis); };
  }, [live?.timer?.endsAt, live?.phase, s?.timers.notifications]);

  const restLeft = live?.timer ? remainingMs(live.timer, now) : 0;
  const restOver = live?.phase === 'rest' && live.timer && restLeft <= 0;

  useEffect(() => {
    if (!restOver || !live?.timer || !s) return;
    const key = live.timer.endsAt ?? 0;
    if (alerted.current === key) return;
    alerted.current = key;
    if (s.timers.sound) beep(990, 220, 3);
    if (s.timers.vibration) vibrate([300, 150, 300, 150, 500]);
    if (s.timers.voice) speak('Recupero terminato. Inizia la prossima serie.');
  }, [restOver, live?.timer, s]);

  // isometrico: tempo trascorso e segnali acustici
  const isoElapsed = live ? (live.isoAccumulated ?? 0) + (live.isoStartedAt ? Math.max(0, now - live.isoStartedAt) : 0) : 0;
  const isoCountdown = live?.isoStartedAt && now < live.isoStartedAt ? Math.ceil((live.isoStartedAt - now) / 1000) : 0;
  useEffect(() => {
    if (!live?.isoStartedAt || !item || !s) return;
    const sec = isoElapsed / 1000;
    if (!isoBeeps.current.start && now >= live.isoStartedAt) { isoBeeps.current.start = true; if (s.timers.sound) beep(660, 150); }
    if (item.secMin && sec >= item.secMin && !isoBeeps.current.min) { isoBeeps.current.min = true; if (s.timers.sound) beep(880, 160, 2); if (s.timers.vibration) vibrate(200); }
    if (item.secMax && sec >= item.secMax && !isoBeeps.current.max) { isoBeeps.current.max = true; if (s.timers.sound) beep(990, 250, 3); if (s.timers.vibration) vibrate([300, 100, 300]); if (s.timers.voice) speak('Tempo'); }
  }, [isoElapsed, live?.isoStartedAt, item, s, now]);

  if (live === undefined || session === undefined || !exercises || !s || sessionSets === undefined) return <div className="live muted">Caricamento…</div>;
  if (!live || !session) {
    return (
      <div className="live">
        <h2>Nessun allenamento in corso</h2>
        <Link to="/allenamento" className="btn primary">Vai ad Allenamento</Link>
      </div>
    );
  }

  const plan = session.plan;
  const totalSets = plan.reduce((a, i) => a + i.sets, 0);
  const doneSets = new Set(sessionSets.map((x) => `${x.exerciseId}|${x.setIndex}`)).size;
  const elapsed = now - session.startedAt;
  const setsFor = (exId: string) => sessionSets.filter((x) => x.exerciseId === exId);

  const restMsFor = (it: TemplateItem, e: Exercise) => (it.restSec ?? defaultRestSec(e, s.timers)) * 1000;

  const completeSet = async () => {
    if (!item || !ex) return;
    unlockAudio();
    const isTime = ex.mode === 'time';
    const durationSec = isTime ? Math.round(isoElapsed / 1000) : undefined;
    const rec = await logSet({
      sessionId: session.id, exerciseId: ex.id, setIndex: live.setIndex, reps: isTime ? 0 : live.reps,
      weightKg: ex.usesLoad ? live.weightKg : 0, durationSec, side: ex.perSide ? (live.side ?? 'dx') : undefined,
      techniqueOk: true, timestamp: Date.now(), date: session.date
    });
    isoBeeps.current = {};
    const undo = { itemIndex: live.itemIndex, setIndex: live.setIndex, side: live.side, reps: live.reps, weightKg: live.weightKg, isoAccumulated: isoElapsed };
    if (ex.perSide && (live.side ?? 'dx') === 'dx') {
      if (s.timers.sound) beep(700, 120);
      await patch({ side: 'sx', reps: 0, isoStartedAt: undefined, isoAccumulated: undefined, lastSetIds: [rec.id], undo });
      return;
    }
    const lastIds = ex.perSide ? [...(live.lastSetIds ?? []), rec.id] : [rec.id];
    let next: Partial<LiveState>;
    if (live.setIndex < item.sets) next = { setIndex: live.setIndex + 1, side: ex.perSide ? 'dx' : undefined };
    else if (live.itemIndex < plan.length - 1) {
      const nextEx = exercises.find((e) => e.id === plan[live.itemIndex + 1].exerciseId);
      next = { itemIndex: live.itemIndex + 1, setIndex: 1, side: nextEx?.perSide ? 'dx' : undefined };
    } else {
      await patch({ phase: 'cardio', timer: undefined, reps: 0, isoStartedAt: undefined, isoAccumulated: undefined, lastSetIds: lastIds, undo });
      return;
    }
    await patch({ ...next, phase: 'rest', timer: startCountdown(restMsFor(item, ex)), reps: 0, isoStartedAt: undefined, isoAccumulated: undefined, lastSetIds: lastIds, undo });
  };

  const undoLastSet = async () => {
    if (!live.undo || !live.lastSetIds?.length) return;
    const lastId = live.lastSetIds[live.lastSetIds.length - 1];
    await db.sets.delete(lastId);
    await patch({ ...live.undo, phase: 'work', timer: undefined, isoStartedAt: undefined, lastSetIds: live.lastSetIds.slice(0, -1), undo: undefined, weightSetForItem: live.undo.itemIndex });
  };

  const updateLastSets = async (p: Partial<SetLog>) => {
    for (const id of live.lastSetIds ?? []) await db.sets.update(id, p);
  };

  const jumpTo = async (idx: number) => {
    const it = plan[idx];
    const e = exercises.find((x) => x.id === it.exerciseId);
    const done = setsFor(it.exerciseId).filter((x) => !e?.perSide || x.side === 'sx').length;
    await patch({ itemIndex: idx, setIndex: Math.min(it.sets, done + 1), side: e?.perSide ? 'dx' : undefined, phase: 'work', timer: undefined, reps: 0, isoStartedAt: undefined, isoAccumulated: undefined });
    setShowList(false);
  };

  const finish = async () => {
    const minutes = cardioMin ?? tpl?.cardioMin ?? 0;
    const cardio = live.phase === 'done' && minutes > 0 && live.timer ? { minutes: Math.round(((live.timer.totalMs - remainingMs(live.timer, Date.now())) / 60000) * 10) / 10, notes: tpl?.cardio ?? '' } : undefined;
    await finishSession(session.id, finalNotes, cardio);
    nav(`/allenamento/seduta/${session.id}`, { replace: true });
  };

  const header = (
    <>
      <div className="live-top">
        <button className="back" onClick={() => setShowMenu(true)} aria-label="Menu">✕</button>
        <div className="grow">
          <div className="small muted">{session.templateName}{session.phaseName ? ` · ${session.phaseName}` : ''}</div>
          <div className="clock">⏱ {fmtDuration(elapsed)}</div>
        </div>
        <button className="btn sm" onClick={() => setShowList(true)}>Esercizi {Math.min(live.itemIndex + 1, plan.length)}/{plan.length}</button>
      </div>
      <div className="progress-bar"><div style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} /></div>
    </>
  );

  const modals = (
    <>
      <Modal open={showMenu} onClose={() => setShowMenu(false)} title="Allenamento">
        <button className="btn block" onClick={() => nav('/')}>Continua più tardi (resta salvato)</button>
        <button className="btn primary block" onClick={async () => { await patch({ phase: 'done', timer: undefined }); setShowMenu(false); }}>Termina ora e salva</button>
        <button className="btn danger block" onClick={async () => { await abandonSession(session.id); nav('/allenamento', { replace: true }); }}>Interrompi seduta</button>
        <p className="tiny muted">"Interrompi" conserva le serie già registrate (seduta segnata come interrotta); se non hai registrato serie la seduta viene eliminata.</p>
      </Modal>
      <Modal open={showList} onClose={() => setShowList(false)} title="Esercizi della seduta">
        {plan.map((it, i) => {
          const e = exercises.find((x) => x.id === it.exerciseId);
          const logged = setsFor(it.exerciseId);
          const count = e?.perSide ? logged.filter((x) => x.side === 'sx').length : logged.length;
          return (
            <div key={i} className="col" style={{ gap: 4 }}>
              <button className="list-item" onClick={() => jumpTo(i)}>
                <span className={`badge ${count >= it.sets ? 'ok' : ''}`}>{count}/{it.sets}</span>
                <span className="grow"><b>{e?.name}</b><br /><span className="small muted">{it.sets} × {e ? targetText(it, e) : ''}</span></span>
                {i === live.itemIndex && <span className="accent small">attuale</span>}
              </button>
              {logged.length > 0 && (
                <div className="row wrap" style={{ gap: 6, paddingLeft: 8 }}>
                  {logged.sort((a, b) => a.timestamp - b.timestamp).map((x) => (
                    <span key={x.id} className="chip">S{x.setIndex}{x.side ? ` ${x.side}` : ''}: {x.durationSec ? `${x.durationSec}s` : `${x.reps}×${x.weightKg}kg`}{x.rir !== undefined ? ` RIR${x.rir}` : ''}
                      <button className="btn sm ghost" style={{ minHeight: 0, padding: '0 0 0 6px' }} aria-label="Elimina serie" onClick={() => db.sets.delete(x.id)}>✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button className="btn block" onClick={async () => { await patch({ phase: 'cardio', timer: undefined }); setShowList(false); }}>Vai al cardio finale</button>
      </Modal>
      <Modal open={show3D} onClose={() => setShow3D(false)} title={ex?.name}>
        {body && ex && (
          <Suspense fallback={<div className="canvas3d" />}>
            <Body3D params={body.params} primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} movement={ex.movement ?? 'none'} height={340} />
          </Suspense>
        )}
        <p className="tiny muted">Schema semplificato del movimento su manichino parametrico: non sostituisce le indicazioni di un istruttore.</p>
      </Modal>
    </>
  );

  // ---------- CARDIO ----------
  if (live.phase === 'cardio' || live.phase === 'done') {
    const minutes = cardioMin ?? tpl?.cardioMin ?? 10;
    const left = live.timer ? remainingMs(live.timer, now) : minutes * 60000;
    const running = live.timer && live.timer.pausedRemaining === undefined && left > 0;
    if (live.phase === 'done') {
      const vol = sessionSets.reduce((a, x) => a + x.reps * x.weightKg, 0);
      return (
        <div className="live">
          {header}
          <h1>Allenamento completato 💪</h1>
          <div className="grid2">
            <div className="stat"><span className="l">Durata</span><span className="v">{fmtDuration(elapsed)}</span></div>
            <div className="stat"><span className="l">Serie</span><span className="v">{sessionSets.length}</span></div>
            <div className="stat"><span className="l">Volume</span><span className="v">{Math.round(vol)} kg</span></div>
            <div className="stat"><span className="l">Cardio</span><span className="v">{live.timer ? `${Math.round((live.timer.totalMs - remainingMs(live.timer, now)) / 60000)} min` : '—'}</span></div>
          </div>
          <label className="field">Note personali sulla seduta
            <textarea className="input" value={finalNotes} onChange={(e) => setFinalNotes(e.target.value)} placeholder="Sensazioni, tecnica, fastidi…" />
          </label>
          <button className="btn primary xl block" onClick={finish}>SALVA E TERMINA</button>
          <button className="btn block" onClick={() => patch({ phase: 'cardio' })}>Torna al cardio</button>
          {modals}
        </div>
      );
    }
    return (
      <div className="live">
        {header}
        <div className="small muted upper">Cardio finale</div>
        <div className="ex-name">{tpl?.cardio ?? 'Cardio'}</div>
        {!live.timer && <Stepper label="Durata (minuti)" value={minutes} onChange={setCardioMin} min={1} max={90} />}
        <div className="rest-ring">
          <Ring frac={live.timer ? left / live.timer.totalMs : 1} />
          <div className="t">{fmtDuration(left)}</div>
        </div>
        {left <= 0 && live.timer && <div className="rest-done">CARDIO COMPLETATO</div>}
        {!live.timer && <button className="btn primary xl block" onClick={() => { unlockAudio(); void patch({ timer: startCountdown(minutes * 60000) }); }}>AVVIA CARDIO</button>}
        {live.timer && left > 0 && (
          <div className="grid3">
            <button className="btn" onClick={() => patch({ timer: running ? pauseCountdown(live.timer!) : resumeCountdown(live.timer!) })}>{running ? 'Pausa' : 'Riprendi'}</button>
            <button className="btn" onClick={() => patch({ timer: addTime(live.timer!, 60000) })}>+1 min</button>
            <button className="btn" onClick={() => patch({ timer: addTime(live.timer!, -60000) })}>−1 min</button>
          </div>
        )}
        <button className="btn primary block" onClick={() => patch({ phase: 'done', timer: live.timer ? pauseCountdown(live.timer) : undefined })}>{live.timer ? 'Completa cardio' : 'Salta cardio'}</button>
        {modals}
        <CardioDoneBeep left={left} active={!!live.timer} sound={s.timers.sound} vib={s.timers.vibration} />
      </div>
    );
  }

  if (!item || !ex) {
    return <div className="live">{header}<div className="notice danger">Esercizio non trovato nella libreria. Controlla la scheda nelle impostazioni.</div>{modals}</div>;
  }

  const lastWeight = suggestion?.lastWeightKg;
  const target = targetText(item, ex);
  const nextItem = plan[live.itemIndex];
  const nextEx = exercises.find((e) => e.id === nextItem?.exerciseId);

  // ---------- RECUPERO ----------
  if (live.phase === 'rest' && live.timer) {
    const paused = live.timer.pausedRemaining !== undefined;
    const lastSets = (live.lastSetIds ?? []).map((id) => sessionSets.find((x) => x.id === id)).filter(Boolean) as SetLog[];
    const lastRir = lastSets[0]?.rir;
    const techOk = lastSets.every((x) => x.techniqueOk);
    return (
      <div className="live">
        {header}
        {restOver ? (
          <button className="rest-done" onClick={() => patch({ phase: 'work', timer: undefined })}>RECUPERO TERMINATO<br />INIZIA LA PROSSIMA SERIE</button>
        ) : (
          <>
            <div className="small muted upper center">Recupero</div>
            <div className="rest-ring">
              <Ring frac={restLeft / live.timer.totalMs} />
              <div className="t">{fmtDuration(restLeft)}</div>
            </div>
            <div className="grid3">
              <button className="btn" onClick={() => patch({ timer: paused ? resumeCountdown(live.timer!) : pauseCountdown(live.timer!) })}>{paused ? 'Riprendi' : 'Pausa'}</button>
              <button className="btn" onClick={() => patch({ timer: addTime(live.timer!, 15000) })}>+15 s</button>
              <button className="btn" onClick={() => patch({ timer: addTime(live.timer!, 30000) })}>+30 s</button>
            </div>
            <button className="btn block" onClick={() => patch({ phase: 'work', timer: undefined })}>Salta recupero</button>
          </>
        )}
        <div className="card">
          <div className="small muted">Serie appena completata: RIR (ripetizioni di riserva)</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <button key={r} className={`chip ${lastRir === r ? 'on' : ''}`} style={{ minWidth: 44 }} onClick={() => updateLastSets({ rir: r })}>{r === 5 ? '5+' : r}</button>
            ))}
          </div>
          <label className="check"><input type="checkbox" checked={techOk} onChange={(e) => updateLastSets({ techniqueOk: e.target.checked })} /> Tecnica corretta</label>
          <button className="btn danger sm" onClick={undoLastSet}>Annulla serie</button>
        </div>
        <div className="card flat">
          <div className="small muted">Prossima serie</div>
          <b>{nextEx?.name} · serie {live.setIndex} di {nextItem.sets}{live.side ? ` · lato ${live.side}` : ''}</b>
          {nextEx?.usesLoad && <Stepper label="Carico prossima serie (kg)" value={live.weightKg} onChange={(v) => patch({ weightKg: v })} step={nextEx.loadIncrementKg || 1} decimals={2} max={500} />}
        </div>
        {modals}
      </div>
    );
  }

  // ---------- LAVORO ----------
  const isTime = ex.mode === 'time';
  const isoRunning = !!live.isoStartedAt;
  return (
    <div className="live">
      {header}
      <div className="col" style={{ gap: 4 }}>
        <div className="ex-name">{ex.name}</div>
        <div className="row between">
          <span className="upper small"><b className="accent">Serie {live.setIndex} di {item.sets}</b>{ex.perSide ? ` · lato ${live.side === 'sx' ? 'sinistro' : 'destro'}` : ''}</span>
          <span className="small muted">Recupero {Math.round(restMsFor(item, ex) / 1000)} s</span>
        </div>
      </div>

      {isTime ? (
        <>
          <div className="big-counter">
            <div className="n">{isoCountdown ? <span className="warn-text">{isoCountdown}</span> : <>{Math.floor(isoElapsed / 1000)}<small>s / {target}</small></>}</div>
          </div>
          {!isoRunning ? (
            <button className="plus-btn" onClick={() => { unlockAudio(); isoBeeps.current = {}; void patch({ isoStartedAt: Date.now() + s.timers.countdownBeforeIsoSec * 1000 }); }}>{isoElapsed > 0 ? 'RIPRENDI' : 'AVVIA'}</button>
          ) : (
            <button className="plus-btn" style={{ background: 'var(--warn)' }} onClick={() => patch({ isoAccumulated: isoElapsed, isoStartedAt: undefined })}>STOP</button>
          )}
          {!isoRunning && isoElapsed > 0 && (
            <div className="grid3">
              <button className="btn" onClick={() => patch({ isoAccumulated: Math.max(0, isoElapsed - 5000) })}>−5 s</button>
              <button className="btn" onClick={() => patch({ isoAccumulated: 0 })}>Azzera</button>
              <button className="btn" onClick={() => patch({ isoAccumulated: isoElapsed + 5000 })}>+5 s</button>
            </div>
          )}
          <button className="btn primary xl block" disabled={isoRunning || isoElapsed < 1000} onClick={completeSet}>COMPLETA SERIE</button>
        </>
      ) : (
        <>
          <div className="big-counter">
            <div className="small muted upper">Ripetizioni</div>
            <div className="n">{live.reps}<small> / {target}</small></div>
            {ex.usesLoad && <div className="small"><b>CARICO: {live.weightKg} KG</b></div>}
          </div>
          <button className="plus-btn" onClick={() => { unlockAudio(); if (s.timers.vibration) vibrate(25); void bumpReps(1); }}>+1</button>
          <div className="grid2">
            <button className="btn xl" onClick={() => bumpReps(-1)}>−1</button>
            <button className="btn primary xl" onClick={completeSet}>COMPLETA SERIE</button>
          </div>
        </>
      )}

      {ex.usesLoad && (
        <div className="card">
          <Stepper label="Carico della seduta (kg)" value={live.weightKg} onChange={(v) => patch({ weightKg: v })} step={ex.loadIncrementKg || 1} decimals={2} max={500} />
          <div className="row between small">
            <span className="muted">Ultimo carico: <b>{lastWeight !== null && lastWeight !== undefined ? `${lastWeight} kg` : '—'}</b></span>
            {suggestion?.kind === 'increase' && suggestion.weightKg !== live.weightKg && (
              <button className="btn sm primary" onClick={() => patch({ weightKg: suggestion.weightKg! })}>Usa {suggestion.weightKg} kg</button>
            )}
          </div>
          {suggestion && <div className={`notice ${suggestion.kind === 'increase' ? 'ok' : suggestion.kind === 'decrease' ? 'warn' : ''} small`}>{suggestion.reason}</div>}
        </div>
      )}

      <div className="card">
        <div className="row between">
          <div className="row wrap" style={{ gap: 6 }}>
            {ex.primaryMuscles.map((m) => <span key={m} className="badge ok">{MUSCLE_LABELS[m]}</span>)}
            {ex.secondaryMuscles.map((m) => <span key={m} className="badge">{MUSCLE_LABELS[m]}</span>)}
          </div>
        </div>
        {imageUrl && <div className="media-box"><img src={imageUrl} alt={`Dimostrazione ${ex.name}`} /></div>}
        <div className="row wrap">
          <button className="btn sm" onClick={() => setShowNotes((v) => !v)}>{showNotes ? 'Nascondi note' : 'Note tecniche'}</button>
          <button className="btn sm" onClick={() => setShow3D(true)}>Muscoli 3D{ex.movement && ex.movement !== 'none' ? ' e movimento' : ''}</button>
          {ex.videoUrl && <a className="btn sm" href={ex.videoUrl} target="_blank" rel="noreferrer">Video</a>}
          <Link className="btn sm ghost" to={`/profilo/esercizi/${ex.id}`}>Modifica esercizio</Link>
        </div>
        {showNotes && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{ex.notes || 'Nessuna nota tecnica. Puoi aggiungerla modificando l\'esercizio.'}{item.notes ? `\n\n${item.notes}` : ''}</div>}
        {!imageUrl && !ex.videoUrl && <div className="tiny muted">Nessuna immagine o video caricati per questo esercizio: puoi aggiungerli da "Modifica esercizio".</div>}
        {tpl?.protectLegs && ex.primaryMuscles.some((m) => ['quadricipiti', 'femorali', 'glutei', 'polpacci', 'adduttori'].includes(m)) && (
          <div className="notice warn small">Domani calcio a 5: resta ad almeno 3 ripetizioni dal cedimento.</div>
        )}
      </div>
      {live.undo && live.lastSetIds?.length ? <button className="btn ghost sm" onClick={undoLastSet}>↶ Annulla ultima serie registrata</button> : null}
      {modals}
    </div>
  );
}

function Ring({ frac }: { frac: number }) {
  const r = 110; const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <svg width="240" height="240" viewBox="0 0 240 240">
      <circle cx="120" cy="120" r={r} stroke="#1f2528" strokeWidth="14" fill="none" />
      <circle cx="120" cy="120" r={r} stroke="var(--accent)" strokeWidth="14" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - f)} style={{ transition: 'stroke-dashoffset .2s linear' }} />
    </svg>
  );
}

function CardioDoneBeep({ left, active, sound, vib }: { left: number; active: boolean; sound: boolean; vib: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!active) { done.current = false; return; }
    if (left <= 0 && !done.current) { done.current = true; if (sound) beep(990, 300, 3); if (vib) vibrate([400, 150, 400]); }
  }, [left, active, sound, vib]);
  return null;
}
