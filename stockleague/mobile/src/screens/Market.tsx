import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Sparkline } from '../components/charts';
import { CompanyLogo, ScreenHeader, Segmented, Trend } from '../components/ui';
import { simulatedSeries } from '../data/demo';
import { TICKERS } from '../data/tickers';
import { formatUSD } from '../lib/format';
import { useNav } from '../state/nav';

type Sort = 'popular' | 'up' | 'down';

export function MarketScreen() {
  const { push } = useNav();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('popular');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const found = TICKERS.filter((t) => !s || t.ticker.toLowerCase().startsWith(s) || t.name.toLowerCase().includes(s));
    if (sort === 'up') return [...found].sort((a, b) => b.changePct - a.changePct);
    if (sort === 'down') return [...found].sort((a, b) => a.changePct - b.changePct);
    return found;
  }, [q, sort]);

  return (
    <div className="pb-10">
      <ScreenHeader title="Acheter une action" />
      <div className="px-4 pt-3">
        <label className="flex h-12 items-center gap-2 rounded-btn border border-line-2 bg-card px-3 focus-within:border-ink">
          <MagnifyingGlass size={20} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou symbole : Apple, NKE…" className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted" autoCapitalize="characters" aria-label="Rechercher une action" />
          {q ? <button onClick={() => setQ('')} aria-label="Effacer"><X size={18} className="text-muted" /></button> : null}
        </label>
        <Segmented className="mt-3" value={sort} onChange={setSort} options={[{ value: 'popular', label: 'Populaires' }, { value: 'up', label: 'En hausse' }, { value: 'down', label: 'En baisse' }]} />
        <p className="mt-3 px-1 text-[11px] text-muted">Marché américain, cours différés d’environ 15 min.</p>
        {list.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">Aucune action ne correspond à « {q} ». Essaie le symbole boursier (ex. AAPL).</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-tile border border-line bg-card">
            {list.map((t) => (
              <li key={t.ticker}>
                <button onClick={() => push({ name: 'stock', ticker: t.ticker })} className="press flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0">
                  <CompanyLogo ticker={t.ticker} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{t.name}</span>
                    <span className="block truncate text-xs text-muted">{t.ticker}, {t.sector}</span>
                  </span>
                  <Sparkline values={simulatedSeries(t.ticker, 20, t.price / (1 + t.changePct / 100) * 0.98, t.price, 0.01)} />
                  <span className="w-[84px] text-right">
                    <span className="block text-sm font-bold nums">{formatUSD(t.price)}</span>
                    <Trend value={t.changePct} className="text-xs" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
