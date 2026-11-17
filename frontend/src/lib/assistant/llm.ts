// Assistente AI (Claude). Due modalità configurabili dall'utente:
//  - "server": tramite il backend Spring Boot (la chiave API resta sul server)
//  - "direct": dal browser con la chiave API dell'utente salvata solo su questo dispositivo
// Si inviano solo il riepilogo testuale dei dati per cui c'è consenso: mai foto o documenti originali.
import Anthropic from '@anthropic-ai/sdk';
import type { AppSettings, ChatMessage } from '../../db/types';

export const SYSTEM_PROMPT = `Sei il personal trainer digitale dell'utente nell'app "My Fitness & Futsal". Rispondi sempre in italiano, in modo conciso e pratico.
Regole:
- Basati esclusivamente sui dati forniti nel blocco DATI. Se un dato non c'è, dillo chiaramente: non inventare numeri, date o carichi.
- Dai suggerimenti prudenti. Non aumentare il volume o l'intensità quando il recupero è insufficiente.
- Non fare diagnosi, non prescrivere terapie o farmaci: in presenza di dolore suggerisci di rivolgersi a un professionista sanitario.
- Non modificare la dieta del nutrizionista: non cambiare alimenti, quantità, calorie o macronutrienti. Puoi solo richiamare ciò che è scritto nel piano e dare indicazioni generali coerenti con esso.
- Non stimare la percentuale di massa grassa da foto o dal solo BMI.
- I carichi si cambiano solo con conferma dell'utente.`;

function buildMessages(history: ChatMessage[], question: string, context: string) {
  // la conversazione deve iniziare e finire con un messaggio "user"
  const recent = history.slice(-10).filter((m) => m.text.trim());
  while (recent.length && recent[0].role !== 'user') recent.shift();
  const msgs: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of recent) {
    const last = msgs[msgs.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.text;
    else msgs.push({ role: m.role, content: m.text });
  }
  const finalUser = `DATI (aggiornati al momento della domanda):\n${context}\n\nDOMANDA: ${question}`;
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'user') last.content += '\n\n' + finalUser;
  else msgs.push({ role: 'user', content: finalUser });
  return msgs;
}

export async function askClaude(settings: AppSettings, history: ChatMessage[], question: string, context: string): Promise<string> {
  const messages = buildMessages(history, question, context);
  if (settings.ai.mode === 'server') {
    const url = settings.cloud.serverUrl.replace(/\/+$/, '');
    if (!url) throw new Error('Configura l\'indirizzo del server in Profilo → Cloud e sincronizzazione');
    const res = await fetch(`${url}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.cloud.token}` },
      body: JSON.stringify({ system: SYSTEM_PROMPT, messages, model: settings.ai.model || undefined })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? `Errore del server (${res.status})`);
    return j.text as string;
  }
  if (!settings.ai.apiKey) throw new Error('Inserisci la tua chiave API in Profilo → Assistente AI');
  const client = new Anthropic({ apiKey: settings.ai.apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.beta.messages.create({
      model: settings.ai.model || 'claude-opus-5-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages
    });
    if (response.stop_reason === 'refusal') return 'Non posso rispondere a questa richiesta.';
    return response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim() || 'Nessuna risposta.';
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Chiave API non valida');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Troppe richieste: riprova tra poco');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Connessione non disponibile');
    if (e instanceof Anthropic.APIError) throw new Error(`Errore del servizio AI (${e.status ?? '?'})`);
    throw e;
  }
}
