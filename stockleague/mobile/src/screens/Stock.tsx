import { useMemo, useState } from 'react';
import { ValueChart } from '../components/charts';
import { Button, CompanyLogo, Glyph, ScreenHeader, Segmented, Tag, Trend, cx } from '../components/ui';
import { EARNINGS, simulatedSeries } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatCountdown, formatDayLong, formatDayShort, formatQuantity, formatUSD } from '../lib/format';
import { isMarketOpen } from '../lib/market-time';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

type Range = '1M' | '3M' | '1A';

export function StockScreen({ ticker }: { ticker: string }) {
  const t = TICKER_MAP[ticker];
  const { holdings } = useStore();
  const { openSheet } = useNav();
  const [range, setRange] = useState<Range>('3M');
  const held = holdings.find((h) => h.ticker === ticker);
  const next = EARNINGS.find((e) => e.ticker === ticker && e.lockAt.getTime() > Date.now());
  const open = isMarketOpen();

  const data = useMemo(() => {
    const n = range === '1M' ? 22 : range === '3M' ? 64 : 252;
    const startFactor = range === '1M' ? 0.95 : range === '3M' ? 0.88 : 0.74;
    return simulatedSeries(`${ticker}-${range}`, n, t.price * startFactor, t.price, 0.014).map((value, i) => ({
      value, label: formatDayShort(new Date(Date.now() - (n - 1 - i) * 86400000 * (365 / 252))),
    }));
  }, [range, t.price, ticker]);
  const rangeChange = ((t.price - data[0].value) / data[0].value) * 100;

  return (
    <div className="pb-32">
      <ScreenHeader title={t.ticker} />
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={ticker} size={56} />
          <div>
            <h1 className="display text-[34px]">{t.name}</h1>
            <p className="text-[13px] text-muted">{t.ticker}, {t.sector}</p>
          </div>
        </div>
        <p className="display mt-5 text-[48px] nums">{formatUSD(t.price)}</p>
        <div className="mt-1 flex items-center gap-3 text-[13px]">
          <span className="flex items-center gap-1"><Trend value={t.changePct} /> <span className="text-muted">aujourd’hui</span></span>
          <span className="flex items-center gap-1"><Trend value={rangeChange} /> <span className="text-muted">sur {range === '1A' ? '1 an' : range === '3M' ? '3 mois' : '1 mois'}</span></span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <span className={cx('size-1.5 rounded-[2px]', open ? 'bg-gain' : 'bg-muted')} />
          {open ? 'Marché ouvert, cours différé de 15 min' : 'Marché fermé : un ordre s’exécute au dernier cours de clôture'}
        </p>

        <div className="mt-4 rounded-[2px] border border-line bg-card p-3">
          <ValueChart id={`stock-${ticker}`} data={data} label="Cours" />
          <Segmented className="mt-2" value={range} onChange={setRange} options={[{ value: '1M', label: '1 mois' }, { value: '3M', label: '3 mois' }, { value: '1A', label: '1 an' }]} />
        </div>

        {held ? (
          <div className="mt-3 rounded-[2px] border border-line bg-card p-4">
            <p className="text-[13px] font-semibold text-muted">Ta position</p>
            <div className="mt-2 grid grid-cols-2 gap-y-3 text-sm">
              <div><p className="text-xs text-muted">Quantité</p><p className="font-bold nums">{formatQuantity(held.quantity)} action{held.quantity >= 2 ? 's' : ''}</p></div>
              <div><p className="text-xs text-muted">Valeur</p><p className="font-bold nums">{formatUSD(held.quantity * t.price)}</p></div>
              <div><p className="text-xs text-muted">Prix moyen d’achat</p><p className="font-bold nums">{formatUSD(held.avgCost)}</p></div>
              <div><p className="text-xs text-muted">Plus-value latente</p><Trend value={(t.price - held.avgCost) * held.quantity} format="usd" /></div>
            </div>
          </div>
        ) : null}

        {next ? (
          <button onClick={() => openSheet({ name: 'predict', eventId: next.id })} className="press mt-3 flex w-full items-center gap-3 rounded-[2px] border border-gold/60 bg-gold/10 p-4 text-left">
            <Glyph name="crystal-ball" size={36} />
            <span className="flex-1">
              <span className="block text-sm font-bold">Résultats le {formatDayLong(new Date(`${next.date}T12:00:00Z`))}</span>
              <span className="block text-xs text-ink-2 nums">BPA attendu {formatUSD(next.estimate)}, verrouillage dans {formatCountdown(next.lockAt.getTime() - Date.now())}</span>
            </span>
            <Tag tone="board">Pronostiquer</Tag>
          </button>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Info label="BPA estimé (trimestre)" value={formatUSD(t.eps)} />
          <Info label="Secteur" value={t.sector} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        {held ? <Button variant="sell" className="flex-1" onClick={() => openSheet({ name: 'order', ticker, side: 'sell' })}>Vendre</Button> : null}
        <Button variant="buy" className="flex-1" onClick={() => openSheet({ name: 'order', ticker, side: 'buy' })}>Acheter</Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] border border-line bg-card p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-1 font-bold nums">{value}</p>
    </div>
  );
}
