// Client Supabase. NESSUNA credenziale è scritta nel codice:
// l'indirizzo e la chiave pubblica "anon" del progetto si inseriscono nell'app
// (Profilo → Cloud) oppure come variabili d'ambiente di Vercel VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
// La chiave "anon" è pubblica per progettazione: la protezione dei dati è data dal login
// e dalle regole RLS (vedi supabase/setup.sql). La chiave "service_role" non va MAI usata qui.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSettings } from './settings';

let cached: { key: string; client: SupabaseClient } | null = null;

export function envSupabase(): { url: string; anonKey: string } {
  return {
    url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
  };
}

export async function supabaseConfig(): Promise<{ url: string; anonKey: string }> {
  const s = await getSettings();
  const env = envSupabase();
  return { url: (s.cloud.supabaseUrl || env.url).replace(/\/+$/, ''), anonKey: s.cloud.supabaseAnonKey || env.anonKey };
}

export async function getSupabase(): Promise<SupabaseClient> {
  const { url, anonKey } = await supabaseConfig();
  if (!url || !anonKey) throw new Error('Supabase non configurato (Profilo → Cloud e sincronizzazione)');
  if (anonKey.startsWith('sb_secret_') || /service_role/.test(atobSafe(anonKey.split('.')[1] ?? ''))) {
    throw new Error('Hai inserito una chiave segreta (service_role): usa solo la chiave pubblica "anon"/"publishable"');
  }
  const key = `${url}|${anonKey}`;
  if (cached?.key === key) return cached.client;
  const client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mff-supabase-auth' } });
  cached = { key, client };
  return client;
}

function atobSafe(s: string): string {
  try { return atob(s.replace(/-/g, '+').replace(/_/g, '/')); } catch { return ''; }
}

export async function currentUser(): Promise<{ id: string; email?: string } | null> {
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    return data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
  } catch { return null; }
}

export async function accessToken(): Promise<string | null> {
  try {
    const sb = await getSupabase();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  } catch { return null; }
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = await getSupabase();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email o password errati' : error.message);
}

export async function signUp(email: string, password: string): Promise<string> {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
  if (error) throw new Error(error.message);
  return data.session ? 'Account creato e accesso effettuato' : 'Account creato: conferma l\'indirizzo dalla email ricevuta, poi accedi';
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  await sb.auth.signOut();
}
