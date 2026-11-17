import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, uid } from '../db/db';
import { ConfirmButton, PageHeader } from '../components/ui';
import { buildDataContext } from '../lib/assistant/context';
import { askClaude } from '../lib/assistant/llm';
import { answerLocally, SUGGESTED_QUESTIONS } from '../lib/assistant/local';
import { useSettings } from '../lib/settings';
import { loadSnapshot } from '../lib/stats';

export default function Assistant() {
  const s = useSettings();
  const msgs = useLiveQuery(() => db.chat.orderBy('at').toArray(), []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs?.length, busy]);
  if (!s || !msgs) return null;
  const aiConfigured = s.ai.mode !== 'local' && (s.ai.mode === 'server' ? !!s.cloud.serverUrl : !!s.ai.apiKey);
  const aiActive = aiConfigured && useAi;

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setText('');
    setBusy(true);
    const userMsg = { id: uid('c-'), role: 'user' as const, text: q.trim(), at: Date.now(), source: 'locale' as const };
    await db.chat.put(userMsg);
    let answer: string; let source: 'locale' | 'ai' = 'locale';
    try {
      const snap = await loadSnapshot(s);
      if (aiActive) {
        if (!navigator.onLine) throw new Error('offline');
        const ctx = await buildDataContext(snap, { training: s.ai.consentTrainingData, body: s.ai.consentBodyData, diet: s.ai.consentDietText });
        answer = await askClaude(s, msgs, q.trim(), ctx);
        source = 'ai';
      } else {
        answer = await answerLocally(q, snap);
      }
    } catch (e) {
      const snap = await loadSnapshot(s);
      const local = await answerLocally(q, snap);
      answer = `${(e as Error).message === 'offline' ? 'Sei offline: rispondo con l\'assistente locale.' : `Assistente AI non disponibile (${(e as Error).message}). Risposta dall'assistente locale:`}\n\n${local}`;
    }
    await db.chat.put({ id: uid('c-'), role: 'assistant', text: answer, at: Date.now(), source });
    setBusy(false);
  };

  return (
    <div className="page" style={{ minHeight: 'calc(100vh - 90px)' }}>
      <PageHeader title="Coach" back right={msgs.length > 0 ? <ConfirmButton className="btn sm ghost" confirmText="Svuota?" onConfirm={() => db.chat.clear()}>Svuota</ConfirmButton> : undefined} />
      <div className="row between small">
        <span className={`badge ${aiActive ? 'ok' : ''}`}>{aiActive ? `AI Claude (${s.ai.mode === 'server' ? 'tramite server' : 'diretto'})` : 'Assistente locale · offline'}</span>
        {aiConfigured ? <label className="check small"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> usa AI</label> : <Link to="/profilo/ai" className="small">Configura AI</Link>}
      </div>
      {aiActive && <div className="tiny muted">Vengono inviati solo i dati testuali per cui hai dato il consenso ({[s.ai.consentTrainingData && 'allenamenti', s.ai.consentBodyData && 'misure', s.ai.consentDietText && 'dieta'].filter(Boolean).join(', ') || 'nessuno, solo profilo e programma'}). Mai foto o documenti.</div>}
      <div className="chat">
        {msgs.length === 0 && <div className="muted small">Fammi una domanda sui tuoi allenamenti, carichi e misure. Rispondo solo in base ai dati registrati nell'app.</div>}
        {msgs.map((m) => <div key={m.id} className={`msg ${m.role}`}>{m.text.replace(/\*\*/g, '')}</div>)}
        {busy && <div className="msg assistant muted">Sto analizzando i tuoi dati…</div>}
        <div ref={end} />
      </div>
      <div className="scroll-x">
        {SUGGESTED_QUESTIONS.map((q) => <button key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void ask(text); }}>
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Scrivi una domanda…" />
        <button className="btn primary" disabled={busy || !text.trim()}>Invia</button>
      </form>
      <div className="tiny muted">Suggerimenti generali e prudenti, non sostituiscono medico, nutrizionista o preparatore.</div>
    </div>
  );
}
