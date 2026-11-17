import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function PageHeader({ title, back, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="page-head">
      {back && (
        <button className="back" aria-label="Indietro" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && <div className="row between"><h2>{title}</h2><button className="btn sm ghost" onClick={onClose} aria-label="Chiudi">✕</button></div>}
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, decimals = 0, label, suffix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; decimals?: number; label?: string; suffix?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10 ** decimals) / 10 ** decimals));
  return (
    <div className="col" style={{ gap: 4 }}>
      {label && <span className="small muted">{label}</span>}
      <div className="stepper">
        <button type="button" aria-label="Diminuisci" onClick={() => onChange(clamp(value - step))}>−</button>
        <input
          inputMode="decimal"
          value={text}
          aria-label={label}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { const v = parseFloat(text.replace(',', '.')); if (!isNaN(v)) onChange(clamp(v)); else setText(String(value)); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        {suffix && <span className="muted small" style={{ marginRight: 4 }}>{suffix}</span>}
        <button type="button" aria-label="Aumenta" onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return <div className="stat"><span className="l">{label}</span><span className="v">{value}</span>{sub && <span className="small muted">{sub}</span>}</div>;
}

/** Pulsante che chiede conferma con un secondo tocco. */
export function ConfirmButton({ children, onConfirm, className = 'btn danger', confirmText = 'Tocca di nuovo per confermare' }: {
  children: ReactNode; onConfirm: () => void | Promise<void>; className?: string; confirmText?: string;
}) {
  const [armed, setArmed] = useState(false);
  const t = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <button className={className} onClick={() => {
      if (armed) { setArmed(false); void onConfirm(); return; }
      setArmed(true);
      t.current = window.setTimeout(() => setArmed(false), 3500);
    }}>{armed ? confirmText : children}</button>
  );
}

type ToastFn = (msg: string) => void;
const ToastCtx = createContext<ToastFn>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number>(undefined);
  const show = useCallback<ToastFn>((m) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>;
}
export const useToast = () => useContext(ToastCtx);

export function Empty({ children }: { children: ReactNode }) {
  return <div className="notice center">{children}</div>;
}

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  food: <><path d="M7 2v8a2 2 0 0 0 2 2v10M5 2v6M9 2v6M17 2c-2 0-3 3-3 6s1 4 3 4v10" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  back: <path d="M15 18l-6-6 6-6" />,
  chev: <path d="M9 18l6-6-6-6" />,
  play: <path d="M7 4l13 8-13 8z" />,
  pause: <><path d="M7 4v16M17 4v16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  body: <><circle cx="12" cy="4" r="2" /><path d="M8 22l1-9-3-5h12l-3 5 1 9" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  cloud: <path d="M7 18a5 5 0 0 1 0-10 6 6 0 0 1 11 2 4 4 0 0 1 0 8z" />,
  camera: <><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M8 7l2-3h4l2 3" /></>,
  file: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /></>,
  ball: <><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" /></>,
  cube: <><path d="M12 2l9 5v10l-9 5-9-5V7z" /><path d="M12 22V12M21 7l-9 5-9-5" /></>
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] ?? null}
    </svg>
  );
}

export function NotAvailable({ children }: { children: ReactNode }) {
  return <div className="notice warn"><b>Non ancora disponibile · </b>{children}</div>;
}
