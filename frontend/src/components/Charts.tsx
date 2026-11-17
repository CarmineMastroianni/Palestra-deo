import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { fmtDate } from '../lib/dates';

export interface Point { date: string; [k: string]: number | string | undefined }

const tooltipStyle = { background: '#171c1f', border: '1px solid #2a3236', borderRadius: 10, color: '#f2f5f4' };

export function TrendChart({ data, lines, height = 200, unit = '' }: {
  data: Point[]; lines: { key: string; label: string; color?: string }[]; height?: number; unit?: string;
}) {
  if (data.length === 0) return <div className="notice center">Nessun dato registrato</div>;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#2a3236" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} stroke="#2a3236" minTickGap={20} />
          <YAxis domain={['auto', 'auto']} stroke="#2a3236" width={48} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => fmtDate(String(d), { day: 'numeric', month: 'long', year: 'numeric' })} formatter={(v) => [`${v}${unit}`]} />
          {lines.map((l, i) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color ?? (i === 0 ? 'var(--accent)' : '#5cc8ff')} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({ data, dataKey, height = 160, labelKey = 'label' }: { data: Record<string, number | string>[]; dataKey: string; height?: number; labelKey?: string }) {
  if (data.length === 0) return <div className="notice center">Nessun dato registrato</div>;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="#2a3236" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={labelKey} stroke="#2a3236" />
          <YAxis allowDecimals={false} stroke="#2a3236" />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
          <Bar dataKey={dataKey} fill="var(--accent)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
