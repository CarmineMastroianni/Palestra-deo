// Feedback sonoro, vibrazione, voce e notifiche. Ogni funzione degrada in modo silenzioso
// se il dispositivo non la supporta: nessuna garanzia di funzionamento in background.

let ctx: AudioContext | null = null;

/** Da chiamare in risposta a un tocco dell'utente (sblocca l'audio su iOS/Android). */
export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { ctx = null; }
}

export function beep(freq = 880, durationMs = 180, times = 1, gap = 120): void {
  try {
    unlockAudio();
    if (!ctx) return;
    const c = ctx;
    for (let i = 0; i < times; i++) {
      const start = c.currentTime + (i * (durationMs + gap)) / 1000;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + durationMs / 1000 + 0.02);
    }
  } catch { /* audio non disponibile */ }
}

export function vibrate(pattern: number | number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* non supportato */ }
}

export function speak(text: string): void {
  try {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch { /* non supportato */ }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function notify(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: 'timer', badge: '/icons/icon-192.png' }); return true; }
    new Notification(title, { body, icon: '/icons/icon-192.png' });
    return true;
  } catch { return false; }
}

/** Mantiene lo schermo acceso durante l'allenamento, se supportato. */
export class ScreenWake {
  private lock: { release: () => Promise<void> } | null = null;
  supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  async acquire(): Promise<boolean> {
    if (!this.supported) return false;
    try {
      this.lock = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
      return true;
    } catch { return false; }
  }
  async release(): Promise<void> {
    try { await this.lock?.release(); } catch { /* ignore */ }
    this.lock = null;
  }
}
