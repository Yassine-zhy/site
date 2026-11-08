/** Briques d'interface partagées : angles nets, filets fins, accent or unique. */
import { ArrowDownRight, ArrowUpRight, CaretLeft, Minus } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { GlyphName } from '../data/glyphs';
import { ME, PLAYER_MAP } from '../data/demo';
import logoDarkBg from '../data/logo-dark-bg.json';
import { TICKER_MAP } from '../data/tickers';
import { formatSignedPercent, formatSignedUSD, trendOf } from '../lib/format';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';
import { Glyph } from './glyph';

export { Glyph, Medallion } from './glyph';
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** Vrai logo de l'entreprise, sur une tuile carrée (sombre pour les logos blancs). */
export function CompanyLogo({ ticker, size = 40, className }: { ticker: string; size?: number; className?: string }) {
  const dark = (logoDarkBg as Record<string, number>)[ticker];
  return (
    <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-[2px]', dark ? 'bg-[#111720]' : 'bg-white', className)} style={{ width: size, height: size }}>
      <img src={asset(`logos/${ticker}.png`)} alt={TICKER_MAP[ticker]?.name ?? ticker} className="h-[70%] w-[70%] object-contain" draggable={false} />
    </span>
  );
}

const RING = { gold: 'var(--gold)', silver: 'var(--silver)', bronze: 'var(--bronze)' } as const;

/** Photo d'un joueur, carrée à angles nets (la mienne vient de mon profil). */
export function Avatar({ id, size = 40, ring, className }: { id: string; size?: number; ring?: keyof typeof RING; className?: string }) {
  const { photo } = useStore();
  const p = PLAYER_MAP[id] ?? { avatar: id, pseudo: id };
  const src = id === ME && photo ? photo : asset(`avatars/${p.avatar}.jpg`);
  return (
    <span
      className={cx('relative block shrink-0 overflow-hidden rounded-[2px] bg-card-2', className)}
      style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 4px ${RING[ring]}` : undefined }}
    >
      <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
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
    <span className={cx('block h-1 overflow-hidden bg-line-2', className)}>
      <span className="block h-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
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

/** Onglets soulignés (filet or sous l'onglet actif). */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('flex border-b border-line', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button key={o.value} role="tab" aria-selected={active} onClick={() => onChange(o.value)} className={cx('relative h-11 flex-1 px-1 text-[15px] font-semibold transition-colors', active ? 'text-ink' : 'text-muted')}>
            {o.label}
            <span className={cx('absolute inset-x-2 -bottom-px h-[3px] bg-gold transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-line bg-bg/95 px-1 backdrop-blur">
      <button onClick={pop} aria-label="Retour" className="press grid size-12 place-items-center">
        <CaretLeft size={24} weight="bold" />
      </button>
      <h1 className="display min-w-0 flex-1 truncate text-[24px]">{title}</h1>
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
    <C onClick={onClick} className={cx('block w-full rounded-[2px] border border-line bg-card text-left', onClick && 'press', className)}>
      {children}
    </C>
  );
}

export function Button({ children, onClick, variant = 'primary', className, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'gold' | 'buy' | 'sell' | 'ghost'; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  const styles = {
    primary: 'bg-ink text-bg',
    secondary: 'border border-line-2 bg-transparent text-ink',
    gold: 'bg-gold text-gold-ink',
    buy: 'bg-gain text-white dark:text-[#03140b]',
    sell: 'bg-loss text-white dark:text-[#1f0705]',
    ghost: 'text-ink',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cx('press inline-flex h-[52px] items-center justify-center gap-2 rounded-[2px] px-5 text-[16px] font-bold disabled:opacity-35', styles, className)}>
      {children}
    </button>
  );
}

/** Étiquette d'habillage télé : bloc incliné, jamais arrondi. */
export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'gain' | 'loss' | 'board'; className?: string }) {
  const t = { neutral: 'bg-card-2 text-ink-2', gold: 'bg-gold text-gold-ink', gain: 'bg-gain text-white dark:text-[#03140b]', loss: 'bg-loss text-white dark:text-[#1f0705]', board: 'bg-ink text-bg' }[tone];
  return (
    <span className={cx('slant inline-block px-2 py-[3px]', t, className)}>
      <span className="unslant inline-flex items-center gap-1 text-[11px] font-bold leading-4 whitespace-nowrap">{children}</span>
    </span>
  );
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
    <div className="border-t-2 border-gold bg-card px-6 py-10 text-center">
      <Glyph name={emoji} size={44} className="mx-auto" />
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
      <rect width="32" height="32" rx="2" fill="#0A0D12" />
      <rect x="6.5" y="14" width="5.5" height="11" fill="#F3F5F8" opacity="0.9" />
      <rect x="13.25" y="7" width="5.5" height="18" fill="#F2B705" />
      <rect x="20" y="18" width="5.5" height="7" fill="#F3F5F8" opacity="0.6" />
    </svg>
  );
}
