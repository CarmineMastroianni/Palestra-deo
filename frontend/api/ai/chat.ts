// Funzione serverless Vercel: proxy verso l'API di Claude.
// NESSUNA chiave nel codice. Si attiva solo se, nelle impostazioni del progetto Vercel, imposti:
//   ANTHROPIC_API_KEY  – la tua chiave API Anthropic
//   SUPABASE_URL, SUPABASE_ANON_KEY – il tuo progetto Supabase (per verificare chi chiama)
//   ALLOWED_EMAILS     – email autorizzate, separate da virgola (obbligatoria: senza, la funzione resta spenta)
//   AI_MODEL           – facoltativo, predefinito claude-opus-5-5
// Ogni richiesta deve avere il token di accesso Supabase di un utente presente in ALLOWED_EMAILS:
// così nessun altro può usare la tua chiave.
import Anthropic from '@anthropic-ai/sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_CHARS = 200_000;

async function verifyUser(token: string): Promise<string | null> {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
  const anon = process.env.SUPABASE_ANON_KEY ?? '';
  if (!url || !anon) return null;
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = (await r.json()) as { email?: string };
  return u.email?.toLowerCase() ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    // stato della configurazione (non rivela valori)
    return res.status(200).json({
      aiEnabled: !!process.env.ANTHROPIC_API_KEY && !!process.env.ALLOWED_EMAILS && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!apiKey || allowed.length === 0) return res.status(503).json({ error: 'Assistente AI non configurato su Vercel' });

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Accesso richiesto' });
  const email = await verifyUser(token).catch(() => null);
  if (!email) return res.status(401).json({ error: 'Sessione non valida: accedi di nuovo' });
  if (!allowed.includes(email)) return res.status(403).json({ error: 'Utente non autorizzato' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { system?: string; messages?: { role: string; content: string }[]; model?: string };
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length || messages.some((m) => (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string')) {
    return res.status(400).json({ error: 'Messaggi non validi' });
  }
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'La conversazione deve iniziare e finire con un messaggio utente' });
  const total = messages.reduce((a, m) => a + m.content.length, 0) + (body.system?.length ?? 0);
  if (total > MAX_CHARS) return res.status(413).json({ error: 'Richiesta troppo lunga' });

  const client = new Anthropic({ apiKey });
  const model = process.env.AI_MODEL || body.model || 'claude-opus-5-5';
  try {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 4000,
      system: body.system ?? '',
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: messages as { role: 'user' | 'assistant'; content: string }[]
    });
    if (response.stop_reason === 'refusal') return res.status(200).json({ text: 'Non posso rispondere a questa richiesta.', stopReason: 'refusal', model: response.model });
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    return res.status(200).json({ text: text || 'Nessuna risposta.', stopReason: response.stop_reason, model: response.model });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Troppe richieste: riprova tra poco' });
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return res.status(502).json({ error: 'Chiave API Anthropic non valida o senza permessi' });
    if (e instanceof Anthropic.APIConnectionError) return res.status(504).json({ error: 'Servizio AI non raggiungibile' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `Errore del servizio AI (${e.status ?? '?'})` });
    return res.status(500).json({ error: 'Errore interno' });
  }
}
