/** Briques d'interface partagées. */
import { ArrowDownRight, ArrowUpRight, CaretLeft, Minus } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { EmojiName } from '../data/emoji-list';
import { ME, PLAYER_MAP } from '../data/demo';
import { useStore } from '../state/store';
import logoDarkBg from '../data/logo-dark-bg.json';
import { TICKER_MAP } from '../data/tickers';
import { formatSignedPercent, formatSignedUSD, trendOf } from '../lib/format';
import { useNav } from '../state/nav';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** Icône d'objet réel (Fluent Emoji, Microsoft, MIT). */
export function Emoji({ name, size = 24, className, label }: { name: EmojiName; size?: number; className?: string; label?: string }) {
  return <img src={asset(`emoji/${name}.svg`)} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} className={cx('inline-block shrink-0 select-none', className)} draggable={false} />;
}

/** Vrai logo de l'entreprise, sur une tuile (sombre pour les logos blancs). */
export function CompanyLogo({ ticker, size = 40, className }: { ticker: string; size?: number; className?: string }) {
  const dark = (logoDarkBg as Record<string, number>)[ticker];
  return (
    <span
      className={cx('grid shrink-0 place-items-center overflow-hidden border', dark ? 'border-transparent bg-[#101826]' : 'border-line bg-white', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}
    >
      <img src={asset(`logos/${ticker}.png`)} alt={TICKER_MAP[ticker]?.name ?? ticker} className="h-[68%] w-[68%] object-contain" draggable={false} />
    </span>
  );
}

/** Avatar d'un joueur : sa photo importée, sinon une illustration (DiceBear Notionists, CC0). Cadre carré arrondi. */
export function Avatar({ id, size = 40, ring, className }: { id: string; size?: number; ring?: 'gold' | 'silver' | 'bronze'; className?: string }) {
  const { photo } = useStore();
  const p = PLAYER_MAP[id] ?? { avatar: id, tint: '#E1E7EF', pseudo: id };
  const own = id === ME && photo;
  return (
    <span
      className={cx('relative block shrink-0 overflow-hidden', className)}
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3), background: p.tint,
        boxShadow: ring ? `0 0 0 2px var(--card), 0 0 0 4px var(--${ring === 'gold' ? 'gold' : ring})` : undefined,
      }}
    >
      {own
        ? <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
        : <img src={asset(`avatars/${p.avatar}.svg`)} alt="" className="absolute inset-x-0 bottom-0 h-[112%] w-full object-cover object-top" draggable={false} />}
    </span>
  );
}

/** Anneau de progression (niveau, objectifs). */
export function Ring({ value, size = 48, stroke = 4, children, color = 'var(--gold)' }: { value: number; size?: number; stroke?: number; children?: ReactNode; color?: string }) {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle className="anim-ring" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, value)))} style={{ ['--len' as string]: len }} />
      </svg>
      {children}
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

/** Sélecteur à onglets rectangulaire. */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="tablist" className={cx('grid gap-1 rounded-btn bg-card-2 p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('h-9 rounded-[9px] text-sm font-semibold transition-colors', value === o.value ? 'bg-card text-ink shadow-card' : 'text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** En-tête d'un écran empilé : retour + titre + actions. */
export function ScreenHeader({ title, right, transparent }: { title?: string; right?: ReactNode; transparent?: boolean }) {
  const { pop } = useNav();
  return (
    <header className={cx('sticky top-0 z-20 flex h-14 items-center gap-2 px-2', !transparent && 'border-b border-line bg-bg/95 backdrop-blur')}>
      <button onClick={pop} aria-label="Retour" className="press grid size-11 place-items-center rounded-btn">
        <CaretLeft size={24} weight="bold" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</h1>
      {right}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-end justify-between px-1">
      <h2 className="display text-[26px]">{children}</h2>
      {action}
    </div>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const C = onClick ? 'button' : 'div';
  return (
    <C onClick={onClick} className={cx('block w-full rounded-tile border border-line bg-card text-left', onClick && 'press', className)}>
      {children}
    </C>
  );
}

export function Button({ children, onClick, variant = 'primary', className, disabled, type = 'button' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'gold' | 'buy' | 'sell' | 'ghost'; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  const styles = {
    primary: 'bg-board text-board-ink dark:bg-ink dark:text-bg',
    secondary: 'border border-line-2 bg-card text-ink',
    gold: 'bg-gold text-gold-ink',
    buy: 'bg-gain text-white dark:text-[#04140d]',
    sell: 'bg-loss text-white dark:text-[#1f0705]',
    ghost: 'text-ink',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cx('press inline-flex h-[52px] items-center justify-center gap-2 rounded-btn px-5 text-[15px] font-bold disabled:opacity-40', styles, className)}>
      {children}
    </button>
  );
}

/** Petite étiquette rectangulaire (jamais en pilule). */
export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'gain' | 'loss' | 'board'; className?: string }) {
  const t = { neutral: 'bg-card-2 text-ink-2 border border-line', gold: 'bg-gold text-gold-ink', gain: 'bg-gain-soft text-gain', loss: 'bg-loss-soft text-loss', board: 'bg-board text-board-ink' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-tag px-1.5 py-0.5 text-[11px] font-bold leading-4', t, className)}>{children}</span>;
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

export function EmptyState({ emoji, title, children, action }: { emoji: EmojiName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-tile border border-dashed border-line-2 px-6 py-10 text-center">
      <Emoji name={emoji} size={48} className="mx-auto" />
      <p className="display mt-4 text-2xl">{title}</p>
      {children ? <p className="mx-auto mt-2 max-w-[30ch] text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Emblème : podium dont les marches sont des barres de graphique. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--board)" />
      <rect x="6.5" y="14" width="5.5" height="11" rx="1" fill="var(--board-ink)" opacity="0.85" />
      <rect x="13.25" y="7" width="5.5" height="18" rx="1" fill="#F2B705" />
      <rect x="20" y="18" width="5.5" height="7" rx="1" fill="var(--board-ink)" opacity="0.6" />
    </svg>
  );
}
