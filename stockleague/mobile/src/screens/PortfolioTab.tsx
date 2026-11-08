import { ArrowsLeftRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { ValueChart } from '../components/charts';
import { Button, Card, CompanyLogo, EmptyState, Glyph, Segmented, Tag, Trend, cx } from '../components/ui';
import { ACTIVE_LEAGUE, STARTING_CASH, simulatedSeries } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatDayShort, formatPoints, formatQuantity, formatRelative, formatSignedPercent, formatUSD } from '../lib/format';
import { isMarketOpen } from '../lib/market-time';
import { portfolioPoints } from '../lib/scoring';
import { useCountUp } from '../lib/use-count-up';
import { myPortfolio, priceOf } from '../state/derived';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

type Period = '1S' | '1M' | 'saison';
const ALLOC_COLORS = ['#1d4e89', '#f2b705', '#0f6e5c', '#7a3e9d', '#c0692b', '#4a6fa5', '#8a2846', '#5b7f1e'];

export function PortfolioTab() {
  const { cash, holdings, transactions } = useStore();
  const { push } = useNav();
  const [period, setPeriod] = useState<Period>('saison');
  const p = myPortfolio(cash, holdings);
  const open = isMarketOpen();
  const animatedValue = useCountUp(p.value);

  const series = useMemo(() => {
    const days = Math.round((Date.now() - ACTIVE_LEAGUE.start.getTime()) / 86400000);
    const values = simulatedSeries('alex-portfolio', days + 1, STARTING_CASH, p.value, 0.009);
    const full = values.map((value, i) => ({ value, label: formatDayShort(new Date(ACTIVE_LEAGUE.start.getTime() + i * 86400000)) }));
    return period === '1S' ? full.slice(-7) : period === '1M' ? full.slice(-30) : full;
  }, [p.value, period]);

  const sortedHoldings = [...holdings].sort((a, b) => b.quantity * priceOf(b.ticker) - a.quantity * priceOf(a.ticker));
  const alloc = [...sortedHoldings.map((h, i) => ({ key: h.ticker, value: h.quantity * priceOf(h.ticker), color: ALLOC_COLORS[i % ALLOC_COLORS.length] })), { key: 'Cash', value: cash, color: 'var(--line-2)' }];

  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28">
      <header className="flex items-center justify-between pt-2">
        <h1 className="display text-[40px]">Portefeuille</h1>
        <Tag tone={open ? 'gain' : 'neutral'}>
          <span className={cx('size-1.5 rounded-[14px]', open ? 'bg-gain' : 'bg-muted')} />
          {open ? 'Marché ouvert' : 'Marché fermé'}
        </Tag>
      </header>

      <section className="grad-blue relative mt-4 overflow-hidden rounded-[22px] p-5 text-white shadow-[0_14px_30px_-14px_rgb(46_139_255/0.8)]">
        <Glyph name="money-bag" size={92} className="absolute -right-3 -bottom-3 rotate-12 opacity-95" />
        <p className="text-[13px] font-semibold opacity-85">Valeur totale</p>
        <p className="display mt-1 text-[48px] nums">{formatUSD(animatedValue)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-[9px] bg-white/20 px-2 py-1 font-bold nums">{p.dayChange >= 0 ? '▲' : '▼'} {formatSignedPercent(p.dayChangePct)} aujourd’hui</span>
          <span className="rounded-[9px] bg-white/20 px-2 py-1 font-bold nums">{p.returnPct >= 0 ? '▲' : '▼'} {formatSignedPercent(p.returnPct)} depuis le début</span>
        </div>
      </section>

      <Card className="mt-4 p-3">
        <ValueChart id="portfolio" data={series} baseline={period === 'saison' ? STARTING_CASH : undefined} />
        <Segmented className="mt-2" value={period} onChange={setPeriod} options={[{ value: '1S', label: '1 sem.' }, { value: '1M', label: '1 mois' }, { value: 'saison', label: 'Saison' }]} />
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Cash disponible" value={formatUSD(cash)} />
        <Stat label="Investi" value={formatUSD(p.invested)} />
        <Stat label="Points" value={formatPoints(portfolioPoints(p.returnPct))} gold />
      </div>

      {/* ------------------------------------------------ répartition */}
      <div className="mt-3 rounded-[18px] bg-card shadow-card p-3">
        <p className="text-[13px] font-semibold text-muted">Répartition</p>
        <div className="mt-2 flex h-3 overflow-hidden rounded-[14px]" role="img" aria-label="Répartition du portefeuille">
          {alloc.map((a) => <span key={a.key} style={{ width: `${(a.value / p.value) * 100}%`, background: a.color }} />)}
        </div>
        <ul className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
          {alloc.map((a) => (
            <li key={a.key} className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-[14px]" style={{ background: a.color }} />
              <span className="font-semibold">{a.key}</span>
              <span className="ml-auto text-muted nums">{Math.round((a.value / p.value) * 100)} %</span>
            </li>
          ))}
        </ul>
      </div>

      <Button className="mt-4 w-full" onClick={() => push({ name: 'market' })}>
        <MagnifyingGlass size={20} weight="bold" /> Acheter une action
      </Button>

      {/* ------------------------------------------------ positions */}
      <div className="mb-2 mt-7 flex items-end justify-between px-1">
        <h2 className="display text-[26px]">Mes positions</h2>
        <span className="text-xs text-muted">{holdings.length} action{holdings.length > 1 ? 's' : ''}</span>
      </div>
      {holdings.length === 0 ? (
        <EmptyState emoji="seedling" title="Aucune position" action={<Button variant="secondary" onClick={() => push({ name: 'market' })}>Trouver une action</Button>}>
          Tout ton capital est en cash. À toi de jouer.
        </EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-[20px] bg-card shadow-card">
          {sortedHoldings.map((h) => {
            const t = TICKER_MAP[h.ticker];
            const value = h.quantity * t.price;
            const pl = (t.price - h.avgCost) * h.quantity;
            return (
              <li key={h.ticker}>
                <button onClick={() => push({ name: 'stock', ticker: h.ticker })} className="press flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left last:border-b-0">
                  <CompanyLogo ticker={h.ticker} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{t.name}</span>
                    <span className="block text-xs text-muted nums">{formatQuantity(h.quantity)} × PRU {formatUSD(h.avgCost)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold nums">{formatUSD(value)}</span>
                    <Trend value={pl} format="usd" className="text-xs" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------------ transactions */}
      <div className="mb-2 mt-7 flex items-end justify-between px-1">
        <h2 className="display text-[26px]">Derniers ordres</h2>
        <button onClick={() => push({ name: 'history' })} className="text-sm font-semibold underline underline-offset-4">Tout voir</button>
      </div>
      <TransactionList items={transactions.slice(0, 3)} />

      <p className="mt-6 px-1 text-[11px] leading-relaxed text-muted">
        Cours différés d’environ 15 minutes. Hors des heures de marché, l’ordre s’exécute au dernier cours de clôture. Argent fictif, à but ludique et éducatif, ceci n’est pas un conseil en investissement.
      </p>
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={cx('rounded-[14px] border p-3', gold ? 'border-gold/50 bg-gold/10' : 'border-line bg-card')}>
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-1 truncate text-[15px] font-bold nums">{value}</p>
    </div>
  );
}

export function TransactionList({ items }: { items: { id: string; side: 'buy' | 'sell'; ticker: string; quantity: number; price: number; at: Date }[] }) {
  if (!items.length) return <EmptyState emoji="receipt" title="Aucun ordre pour l’instant">À toi de jouer.</EmptyState>;
  return (
    <ul className="overflow-hidden rounded-[20px] bg-card shadow-card">
      {items.map((t) => (
        <li key={t.id} className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0">
          <span className="relative">
            <CompanyLogo ticker={t.ticker} size={38} />
            <span className={cx('absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-[14px] border-2 border-card', t.side === 'buy' ? 'bg-gain' : 'bg-loss')}>
              <ArrowsLeftRight size={10} weight="bold" className="text-white" />
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{t.side === 'buy' ? 'Achat' : 'Vente'} {TICKER_MAP[t.ticker].name}</span>
            <span className="block text-xs text-muted nums">{formatQuantity(t.quantity)} à {formatUSD(t.price)}, {formatRelative(t.at)}</span>
          </span>
          <span className={cx('text-sm font-bold nums', t.side === 'buy' ? 'text-ink' : 'text-gain')}>
            {t.side === 'buy' ? '-' : '+'}{formatUSD(t.quantity * t.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}
