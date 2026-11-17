import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { ACTIVITY_LABELS, DAY_KEYS, DAY_LABELS, MEASURE_FIELDS, type ActivityType, type DayPlan, type Profile } from '../../db/types';
import { PageHeader, Stepper, useToast } from '../../components/ui';
import { notificationsSupported, requestNotificationPermission, beep, speak, vibrate } from '../../lib/feedback';
import { updateSettings, useSettings } from '../../lib/settings';

export function PersonalSettings() {
  const s = useSettings();
  if (!s) return null;
  const p = s.profile;
  const set = (patch: Partial<Profile>) => updateSettings('profile', patch);
  const text = (label: string, key: keyof Profile, multiline = false) => (
    <label className="field">{label}
      {multiline
        ? <textarea className="input" defaultValue={String(p[key])} onBlur={(e) => set({ [key]: e.target.value })} />
        : <input className="input" defaultValue={String(p[key])} onBlur={(e) => set({ [key]: e.target.value })} />}
    </label>
  );
  return (
    <div className="page">
      <PageHeader title="Dati personali" back="/profilo" />
      <div className="card">
        {text('Nome', 'name')}
        <div className="grid2">
          <Stepper label="Età" value={p.age} onChange={(v) => set({ age: v })} min={10} max={99} />
          <Stepper label="Altezza (cm)" value={p.heightCm} onChange={(v) => { void set({ heightCm: v }); void db.avatar.update('avatar', { heightCm: v }); }} min={120} max={230} />
        </div>
        <Stepper label="Peso iniziale (kg)" value={p.startWeightKg} onChange={(v) => set({ startWeightKg: v })} step={0.1} decimals={1} min={30} max={250} />
        <label className="field">Sesso (per le proporzioni dell'avatar)
          <select className="input" value={p.sex} onChange={(e) => set({ sex: e.target.value as 'M' | 'F' })}><option value="M">Maschile</option><option value="F">Femminile</option></select>
        </label>
      </div>
      <div className="card">
        {text('Sport', 'sport')}
        {text('Ruoli', 'roles')}
        {text('Esperienza in palestra', 'gymExperience')}
        {text('Infortuni dichiarati', 'injuries', true)}
      </div>
      <div className="card">
        {text('Obiettivo principale', 'mainGoal', true)}
        {text('Obiettivi secondari', 'secondaryGoals', true)}
        <div className="grid2">
          <label className="field">Inizio programma<input type="date" className="input" value={p.programStart} onChange={(e) => e.target.value && set({ programStart: e.target.value })} /></label>
          <label className="field">Fine programma<input type="date" className="input" value={p.programEnd} onChange={(e) => e.target.value && set({ programEnd: e.target.value })} /></label>
        </div>
      </div>
      <div className="tiny muted">Le modifiche vengono salvate automaticamente.</div>
    </div>
  );
}

export function ScheduleSettings() {
  const s = useSettings();
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  if (!s || !templates) return null;
  const setDay = (k: keyof typeof s.schedule, patch: Partial<DayPlan>) => updateSettings('schedule', { [k]: { ...s.schedule[k], ...patch } });
  return (
    <div className="page">
      <PageHeader title="Programma settimanale" back="/profilo" />
      <div className="small muted">L'app riconosce il giorno della settimana e propone automaticamente l'attività programmata.</div>
      {DAY_KEYS.map((k) => {
        const d = s.schedule[k];
        return (
          <div key={k} className="card">
            <b>{DAY_LABELS[k]}</b>
            <div className="grid2">
              <label className="field">Attività
                <select className="input" value={d.type} onChange={(e) => {
                  const type = e.target.value as ActivityType;
                  const tpl = type === 'gym' ? (d.templateId ?? templates[0]?.id) : undefined;
                  void setDay(k, { type, templateId: tpl, label: type === 'gym' ? `Palestra – ${templates.find((t) => t.id === tpl)?.name ?? ''}` : ACTIVITY_LABELS[type] });
                }}>
                  {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map((t) => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}
                </select>
              </label>
              {d.type === 'gym' ? (
                <label className="field">Scheda
                  <select className="input" value={d.templateId} onChange={(e) => setDay(k, { templateId: e.target.value, label: `Palestra – ${templates.find((t) => t.id === e.target.value)?.name}` })}>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
              ) : (
                <label className="field">Durata (min)<input className="input" inputMode="numeric" defaultValue={d.durationMin ?? ''} onBlur={(e) => setDay(k, { durationMin: Number(e.target.value) || undefined })} /></label>
              )}
            </div>
            <label className="field">Nome mostrato<input className="input" key={d.label} defaultValue={d.label} onBlur={(e) => setDay(k, { label: e.target.value || ACTIVITY_LABELS[d.type] })} /></label>
            <label className="field">Note<input className="input" defaultValue={d.notes ?? ''} onBlur={(e) => setDay(k, { notes: e.target.value })} /></label>
          </div>
        );
      })}
    </div>
  );
}

export function TimerSettingsPage() {
  const s = useSettings();
  const toast = useToast();
  if (!s) return null;
  const t = s.timers;
  const set = (p: Partial<typeof t>) => updateSettings('timers', p);
  return (
    <div className="page">
      <PageHeader title="Timer e avvisi" back="/profilo" />
      <div className="card">
        <h3>Recuperi predefiniti (secondi)</h3>
        <div className="small muted">Usati quando un esercizio della scheda non ha un recupero specifico.</div>
        <div className="grid2">
          <Stepper label="Esercizi principali" value={t.restMainSec} onChange={(v) => set({ restMainSec: v })} step={15} max={600} />
          <Stepper label="Complementari" value={t.restComplementarySec} onChange={(v) => set({ restComplementarySec: v })} step={15} max={600} />
          <Stepper label="Core" value={t.restCoreSec} onChange={(v) => set({ restCoreSec: v })} step={5} max={600} />
          <Stepper label="Cardio/altro" value={t.restCardioSec} onChange={(v) => set({ restCardioSec: v })} step={15} max={600} />
        </div>
        <Stepper label="Conto alla rovescia prima degli isometrici (s)" value={t.countdownBeforeIsoSec} onChange={(v) => set({ countdownBeforeIsoSec: v })} max={15} />
      </div>
      <div className="card">
        <h3>Avvisi</h3>
        <label className="check"><input type="checkbox" checked={t.sound} onChange={(e) => set({ sound: e.target.checked })} /> Segnali sonori</label>
        <label className="check"><input type="checkbox" checked={t.vibration} onChange={(e) => set({ vibration: e.target.checked })} /> Vibrazione (non supportata su iPhone)</label>
        <label className="check"><input type="checkbox" checked={t.voice} onChange={(e) => set({ voice: e.target.checked })} /> Avviso vocale</label>
        <label className="check"><input type="checkbox" checked={t.keepScreenOn} onChange={(e) => set({ keepScreenOn: e.target.checked })} /> Mantieni lo schermo acceso durante l'allenamento</label>
        <label className="check"><input type="checkbox" checked={t.notifications} disabled={!notificationsSupported()} onChange={async (e) => {
          if (e.target.checked) {
            const r = await requestNotificationPermission();
            if (r !== 'granted') { toast(r === 'unsupported' ? 'Notifiche non supportate su questo dispositivo/browser' : 'Permesso negato'); return; }
          }
          await set({ notifications: e.target.checked });
        }} /> Notifica di fine recupero con app in background</label>
        <button className="btn" onClick={() => { beep(990, 220, 3); vibrate([300, 100, 300]); if (t.voice) speak('Prova avviso'); }}>Prova avviso</button>
        <div className="notice small">I timer usano l'orario assoluto: se blocchi il telefono o cambi app, al ritorno il tempo è calcolato correttamente. Suoni e notifiche in background <b>non sono garantiti</b>: dipendono dal sistema operativo (su iPhone le notifiche web richiedono iOS 16.4+ e l'app installata sulla schermata Home). In mancanza, l'avviso compare appena riapri l'app.</div>
      </div>
    </div>
  );
}

export function ProgressionSettingsPage() {
  const s = useSettings();
  if (!s) return null;
  const p = s.progression;
  const set = (x: Partial<typeof p>) => updateSettings('progression', x);
  return (
    <div className="page">
      <PageHeader title="Progressione e recupero" back="/profilo" />
      <div className="card">
        <h3>Doppia progressione</h3>
        <div className="small muted">Quando completi tutte le serie al massimo delle ripetizioni previste, con tecnica corretta e RIR almeno pari alla soglia, l'app propone un aumento del carico. Il carico non cambia mai senza la tua conferma.</div>
        <div className="grid2">
          <Stepper label="Aumento minimo (%)" value={p.minIncreasePct} onChange={(v) => set({ minIncreasePct: v })} step={0.5} decimals={1} max={20} />
          <Stepper label="Aumento massimo (%)" value={p.maxIncreasePct} onChange={(v) => set({ maxIncreasePct: v })} step={0.5} decimals={1} max={20} />
        </div>
        <Stepper label="RIR minimo per aumentare" value={p.rirThreshold} onChange={(v) => set({ rirThreshold: v })} max={5} />
        <div className="tiny muted">L'incremento effettivo è arrotondato all'incremento minimo disponibile per ogni esercizio (impostabile nella libreria esercizi).</div>
      </div>
      <div className="card">
        <h3>Recupero e scarico</h3>
        <Stepper label="Soglia di recupero sotto cui ridurre il volume (0-100)" value={p.readinessReduceThreshold} onChange={(v) => set({ readinessReduceThreshold: v })} step={5} max={100} />
        <div className="tiny muted">Le settimane di scarico si gestiscono come fasi con volume ridotto in "Fasi e scarichi".</div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const s = useSettings();
  if (!s) return null;
  const colors = ['#39ff88', '#2ee6d6', '#ffd23f', '#ff7a45', '#7c9cff', '#ff5ca8'];
  return (
    <div className="page">
      <PageHeader title="Aspetto" back="/profilo" />
      <div className="card">
        <h3>Colore di evidenza</h3>
        <div className="row wrap">
          {colors.map((c) => <button key={c} aria-label={c} onClick={() => updateSettings('ui', { accent: c })} style={{ width: 44, height: 44, borderRadius: 12, background: c, border: s.ui.accent === c ? '3px solid #fff' : '1px solid #333', cursor: 'pointer' }} />)}
          <input type="color" value={s.ui.accent} onChange={(e) => updateSettings('ui', { accent: e.target.value })} style={{ width: 44, height: 44, background: 'none', border: 0 }} aria-label="Colore personalizzato" />
        </div>
      </div>
      <div className="card">
        <h3>Dimensione testo</h3>
        <input type="range" min={0.85} max={1.3} step={0.05} value={s.ui.fontScale} onChange={(e) => updateSettings('ui', { fontScale: Number(e.target.value) })} />
      </div>
      <div className="card">
        <h3>Misure corporee visibili</h3>
        {MEASURE_FIELDS.map((f) => (
          <label key={f.key} className="check"><input type="checkbox" checked={!s.ui.hiddenMeasurements.includes(f.key as string)} onChange={(e) => updateSettings('ui', { hiddenMeasurements: e.target.checked ? s.ui.hiddenMeasurements.filter((x) => x !== f.key) : [...s.ui.hiddenMeasurements, f.key as string] })} /> {f.label}</label>
        ))}
      </div>
    </div>
  );
}
