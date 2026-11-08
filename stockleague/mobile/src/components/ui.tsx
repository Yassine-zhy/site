/** Briques d'interface partagées : angles nets, filets fins, accent or unique. */
import { ArrowDownRight, ArrowUpRight, CaretLeft, Minus } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import type { GlyphName } from '../data/glyphs';
import { FRAMES, ME, PLAYER_MAP } from '../data/demo';
import logoDarkBg from '../data/logo-dark-bg.json';
import { TICKER_MAP } from '../data/tickers';
import { formatSignedPercent, formatSignedUSD, trendOf } from '../lib/format';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';
import { Glyph } from './glyph';

export { Glyph, Medallion, Sticker } from './glyph';
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** Vrai logo de l'entreprise, sur une tuile carrée (sombre pour les logos blancs). */
export function CompanyLogo({ ticker, size = 40, className }: { ticker: string; size?: number; className?: string }) {
  const dark = (logoDarkBg as Record<string, number>)[ticker];
  return (
    <span className={cx('grid shrink-0 place-items-center overflow-hidden shadow-[0_1px_2px_rgb(23_19_43/0.08),inset_0_0_0_1px_rgb(23_19_43/0.06)]', dark ? 'bg-[#15121f]' : 'bg-white', className)} style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}>
      <img src={asset(`logos/${ticker}.png`)} alt={TICKER_MAP[ticker]?.name ?? ticker} className="h-[70%] w-[70%] object-contain" draggable={false} />
    </span>
  );
}

const RING = { gold: 'var(--gold)', silver: 'var(--silver)', bronze: 'var(--bronze)' } as const;

/** Photo d'un joueur, carrée à angles nets (la mienne vient de mon profil). */
export function Avatar({ id, size = 40, ring, className }: { id: string; size?: number; ring?: keyof typeof RING; className?: string }) {
  const { photo, frame } = useStore();
  const p = PLAYER_MAP[id] ?? { avatar: id, pseudo: id };
  const src = id === ME && photo ? photo : asset(`avatars/${p.avatar}.jpg`);
  // Cadre débloqué dans le passe de saison (visible par tous sur ma photo).
  const f = id === ME && frame && !ring ? FRAMES[frame] : null;
  const pad = f ? Math.max(2, Math.round(size * 0.07)) : 0;
  return (
    <span
      className={cx('relative block shrink-0 overflow-hidden bg-card-2', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: f?.css, boxShadow: ring ? `0 0 0 2.5px var(--card), 0 0 0 5px ${RING[ring]}` : undefined }}
    >
      <img src={src} alt="" decoding="async" className="absolute h-[calc(100%-var(--p)*2)] w-[calc(100%-var(--p)*2)] object-cover" style={{ top: pad, left: pad, borderRadius: Math.round(size * 0.24), ['--p' as string]: `${pad}px` }} draggable={false} />
    </span>
  );
}

/** Jauge de progression (niveau). */
export function Ring({ value, size = 48, stroke = 4, children, color = 'var(--gold)' }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={stroke} />
        <circle className="anim-ring" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, value)))} style={{ ['--len' as string]: len }} />
      </svg>
      {children}
    </span>
  );
}

/** Barre de progression plate. */
export function Bar({ value, className, color = 'var(--gold)' }: { value: number; className?: string; color?: string }) {
  return (
    <span className={cx('block h-2 overflow-hidden rounded-[4px] bg-line', className)}>
      <span className="block h-full rounded-[4px] transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </span>
  );
}

/** Gain / perte : couleur + signe + flèche. */
export function Trend({ value, format = 'percent', className, icon = true }: { value: number; format?: 'percent' | 'usd'; className?: string; icon?: boolean }) {
  const t = trendOf(value);
  const Icon = t === 'up' ? ArrowUpRight : t === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={cx('nums inline-flex items-center gap-0.5 font-semibold', t === 'up' ? 'text-gain' : t === 'down' ? 'text-loss' : 'text-muted', className)}>
      {icon ? <Icon weight="bold" className="size-[0.95em]" aria-hidden /> : null}
      {format === 'percent' ? formatSignedPercent(value) : formatSignedUSD(value)}
    </span>
  );
}

/** Sélecteur à onglets avec indicateur qui glisse (animation à ressort). */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  const id = useId();
  return (
    <div role="tablist" className={cx('flex gap-1 rounded-[14px] bg-card-2 p-1', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)} className={cx('relative h-10 flex-1 px-1 text-[14px] font-bold transition-colors', active ? 'text-ink' : 'text-muted')}>
            {active ? <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[11px] bg-card shadow-[0_2px_0_rgb(76_45_180/0.12),0_4px_12px_-6px_rgb(76_45_180/0.35)]" transition={{ type: 'spring', stiffness: 520, damping: 38 }} /> : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** En-tête d'un écran empilé : retour + titre + actions. */
export function ScreenHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const { pop } = useNav();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-bg px-2">
      <button onClick={pop} aria-label="Retour" className="press grid size-11 place-items-center rounded-[12px] bg-card shadow-card">
        <CaretLeft size={24} weight="bold" />
      </button>
      <h1 className="display min-w-0 flex-1 truncate px-1 text-[24px]">{title}</h1>
      {right}
    </header>
  );
}

/** Titre de section : gros titre condensé + filet. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mt-8 mb-3 flex items-end justify-between', className)}>
      <h2 className="display text-[28px]">{children}</h2>
      {action}
    </div>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={cx('block w-full rounded-[18px] bg-card text-left shadow-card', onClick && 'press', className)}>
      {children}
    </C>
  );
}

const BTN = {
  primary: ['bg-violet text-white', '#4219d6'],
  secondary: ['bg-card text-ink border-2 border-line', 'var(--line-2)'],
  gold: ['bg-gold text-gold-ink', '#e09e00'],
  buy: ['bg-gain text-white', '#0a8048'],
  sell: ['bg-loss text-white', '#c01d37'],
  ghost: ['text-ink', 'transparent'],
} as const;

/** Bouton « jeu » en relief : s'enfonce quand on appuie. */
export function Button({ children, onClick, variant = 'primary', className, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: keyof typeof BTN; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  const [style, lip] = BTN[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ ['--lip' as string]: lip }} className={cx('inline-flex h-[54px] items-center justify-center gap-2 rounded-[14px] px-5 text-[16px] font-extrabold disabled:opacity-40', variant !== 'ghost' && 'btn-3d', style, className)}>
      {children}
    </button>
  );
}

/** Petite étiquette colorée. */
export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'gain' | 'loss' | 'board'; className?: string }) {
  const t = { neutral: 'bg-card-2 text-ink-2', gold: 'bg-gold text-gold-ink', gain: 'bg-gain-soft text-gain', loss: 'bg-loss-soft text-loss', board: 'bg-violet text-white' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-[7px] px-2 py-[3px] text-[11px] font-extrabold leading-4 whitespace-nowrap', t, className)}>{children}</span>;
}

/** Évolution du rang depuis la veille : ▲2 / ▼1 / —. */
export function RankMove({ delta }: { delta: number }) {
  if (delta === 0) return <span className="w-7 text-center text-xs text-muted" aria-label="Position stable">—</span>;
  const up = delta > 0;
  return (
    <span className={cx('nums flex w-7 items-center justify-center gap-0.5 text-xs font-bold', up ? 'text-gain' : 'text-loss')} aria-label={`${Math.abs(delta)} place${Math.abs(delta) > 1 ? 's' : ''} ${up ? 'gagnée' : 'perdue'}${Math.abs(delta) > 1 ? 's' : ''} depuis hier`}>
      <svg viewBox="0 0 10 8" className={cx('size-2.5', !up && 'rotate-180')} aria-hidden><path d="M5 0l5 8H0z" fill="currentColor" /></svg>
      {Math.abs(delta)}
    </span>
  );
}

export function EmptyState({ emoji, title, children, action }: { emoji: GlyphName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[18px] bg-card px-6 py-10 text-center shadow-card">
      <Glyph name={emoji} size={72} className="mx-auto" />
      <p className="display mt-4 text-[28px]">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-[30ch] text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Emblème : podium dont les marches sont des barres de graphique. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="shrink-0">
      <defs><linearGradient id="lm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5B2EFF" /><stop offset=".55" stopColor="#A43BFF" /><stop offset="1" stopColor="#FF3D8B" /></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="url(#lm)" />
      <rect x="6.5" y="14" width="5.5" height="11" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="13.25" y="7" width="5.5" height="18" rx="1.5" fill="#FFC531" />
      <rect x="20" y="18" width="5.5" height="7" rx="1.5" fill="#fff" opacity="0.7" />
    </svg>
  );
}
