// Timer basati su riferimenti temporali assoluti (Date.now()):
// se la pagina viene sospesa, al ritorno il tempo trascorso è calcolato correttamente.
import { useEffect, useState } from 'react';

export interface CountdownState {
  endsAt?: number;          // epoch ms se in corsa
  pausedRemaining?: number; // ms residui se in pausa
  totalMs: number;
}

export function remainingMs(t: CountdownState, now = Date.now()): number {
  if (t.pausedRemaining !== undefined) return t.pausedRemaining;
  if (t.endsAt === undefined) return t.totalMs;
  return Math.max(0, t.endsAt - now);
}

export function startCountdown(totalMs: number, now = Date.now()): CountdownState {
  return { endsAt: now + totalMs, totalMs };
}

export function pauseCountdown(t: CountdownState, now = Date.now()): CountdownState {
  if (t.pausedRemaining !== undefined) return t;
  return { totalMs: t.totalMs, pausedRemaining: remainingMs(t, now) };
}

export function resumeCountdown(t: CountdownState, now = Date.now()): CountdownState {
  if (t.pausedRemaining === undefined) return t;
  return { totalMs: t.totalMs, endsAt: now + t.pausedRemaining };
}

export function addTime(t: CountdownState, deltaMs: number, now = Date.now()): CountdownState {
  if (t.pausedRemaining !== undefined) return { ...t, pausedRemaining: Math.max(0, t.pausedRemaining + deltaMs), totalMs: t.totalMs + deltaMs };
  const end = Math.max(now, (t.endsAt ?? now) + deltaMs);
  return { endsAt: end, totalMs: t.totalMs + deltaMs };
}

/** Forza un re-render periodico; si riallinea quando la pagina torna visibile. */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [intervalMs, active]);
  return now;
}

/** Cronometro semplice (stopwatch) con riferimento assoluto. */
export interface Stopwatch { startedAt?: number; accumulated: number; }
export function swElapsed(s: Stopwatch, now = Date.now()): number {
  return s.accumulated + (s.startedAt ? now - s.startedAt : 0);
}
export function swToggle(s: Stopwatch, now = Date.now()): Stopwatch {
  return s.startedAt ? { accumulated: swElapsed(s, now) } : { accumulated: s.accumulated, startedAt: now };
}
