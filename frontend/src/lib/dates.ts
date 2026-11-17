import type { DayKey } from '../db/types';
import { DAY_KEYS } from '../db/types';

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

export function dayKeyOf(iso: string): DayKey {
  const js = parseISO(iso).getDay(); // 0 = domenica
  return DAY_KEYS[(js + 6) % 7];
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** lunedì della settimana che contiene la data */
export function weekStart(iso: string): string {
  const idx = DAY_KEYS.indexOf(dayKeyOf(iso));
  return addDays(iso, -idx);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('it-IT', opts);
}

export function fmtDateLong(iso: string): string {
  return fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function fmtMonth(key: string): string {
  return parseISO(key + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}
