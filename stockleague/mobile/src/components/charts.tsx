import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatUSD } from '../lib/format';

type Point = { label: string; value: number };

/** Courbe de valeur : une seule série, couleur selon le sens, ligne de référence au départ. */
export function ValueChart({ data, baseline, height = 180, id, label = 'Valeur' }: { data: Point[]; baseline?: number; height?: number; id: string; label?: string }) {
  const first = baseline ?? data[0]?.value ?? 0;
  const up = (data.at(-1)?.value ?? 0) >= first;
  const color = up ? 'var(--gain)' : 'var(--loss)';
  const values = data.map((d) => d.value);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || 1;
  return (
    <div style={{ height }} className="-mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis domain={[Math.min(...values, first) - pad, Math.max(...values, first) + pad]} hide />
          {baseline !== undefined ? <ReferenceLine y={baseline} stroke="var(--line-2)" strokeDasharray="3 4" /> : null}
          <Tooltip
            cursor={{ stroke: 'var(--line-2)' }}
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12, color: 'var(--ink)' }}
            labelStyle={{ color: 'var(--muted)' }}
            formatter={(v) => [formatUSD(Number(v)), label]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.25} fill={`url(#fill-${id})`} isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Mini-courbe sans axes pour les listes. */
export function Sparkline({ values, width = 64, height = 26 }: { values: number[]; width?: number; height?: number }) {
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / (max - min || 1)) * (height - 2) - 1}`).join(' ');
  const up = values.at(-1)! >= values[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke={up ? 'var(--gain)' : 'var(--loss)'} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
