import { useRef, useState } from 'react';
import { useMediaUrl } from '../lib/media';

export function BeforeAfter({ beforeId, afterId, beforeLabel, afterLabel }: { beforeId: string; afterId: string; beforeLabel: string; afterLabel: string }) {
  const b = useMediaUrl(beforeId);
  const a = useMediaUrl(afterId);
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div className="col">
      <div
        ref={ref}
        className="ba"
        style={{ ['--pos' as string]: `${pos}%` }}
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) move(e.clientX); }}
      >
        {b && <img src={b} alt={`Prima – ${beforeLabel}`} />}
        {a && <img className="after" src={a} alt={`Dopo – ${afterLabel}`} />}
        <div className="handle" />
        <span className="lbl" style={{ left: 8 }}>{beforeLabel}</span>
        <span className="lbl" style={{ right: 8 }}>{afterLabel}</span>
      </div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Confronto prima/dopo" />
    </div>
  );
}

export function MediaImg({ id, alt, style }: { id?: string; alt: string; style?: React.CSSProperties }) {
  const u = useMediaUrl(id);
  if (!u) return null;
  return <img src={u} alt={alt} style={style} />;
}
