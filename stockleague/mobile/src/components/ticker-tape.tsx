import { TICKERS } from '../data/tickers';
import { formatSignedPercent } from '../lib/format';
import { cx } from './ui';

/** Bandeau des cours qui défile, façon chaîne d'info financière. */
export function TickerTape() {
  const items = TICKERS.slice(0, 18);
  const row = items.map((t) => (
    <span key={t.ticker} className="flex items-center gap-1.5 px-3 text-[12px]">
      <span className="font-bold text-white">{t.ticker}</span>
      <span className="nums text-white/70">{t.price.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <span className={cx('nums font-semibold', t.changePct >= 0 ? 'text-[#4ade9b]' : 'text-[#ff8a7d]')}>
        {t.changePct >= 0 ? '▲' : '▼'} {formatSignedPercent(t.changePct).replace(/^[+-]/, '')}
      </span>
    </span>
  ));
  return (
    <div className="overflow-hidden border-y border-white/10 bg-white/15 py-1.5" aria-label="Cours des actions (différés de 15 min)">
      <div className="anim-tape flex w-max" aria-hidden>
        {row}
        {row}
      </div>
    </div>
  );
}
