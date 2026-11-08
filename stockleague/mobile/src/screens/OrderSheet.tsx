import { Backspace, Warning } from '@phosphor-icons/react';
import { useState } from 'react';
import { SheetFrame } from '../components/sheet';
import { Button, CompanyLogo, Glyph, Segmented, cx } from '../components/ui';
import { ACTIVE_LEAGUE } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatQuantity, formatUSD } from '../lib/format';
import { isMarketOpen } from '../lib/market-time';
import { roundQty } from '../lib/trading';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

type Mode = 'usd' | 'qty';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const;

/** Ordre au marché : montant en $ ou en nombre d'actions, pavé numérique intégré. */
export function OrderSheet({ ticker, side: initialSide }: { ticker: string; side: 'buy' | 'sell' }) {
  const t = TICKER_MAP[ticker];
  const store = useStore();
  const { closeSheet, reset } = useNav();
  const [side, setSide] = useState(initialSide);
  const [mode, setMode] = useState<Mode>('usd');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ quantity: number; total: number; price: number } | null>(null);

  const held = store.holdings.find((h) => h.ticker === ticker)?.quantity ?? 0;
  const amount = Number(input.replace(',', '.')) || 0;
  const quantity = mode === 'qty' ? roundQty(amount) : roundQty(amount / t.price);
  const gross = Math.round(quantity * t.price * 100) / 100;
  const fee = ACTIVE_LEAGUE.fee;
  const total = side === 'buy' ? gross + fee : gross - fee;
  const maxQty = side === 'buy' ? roundQty((store.cash - fee) / t.price) : held;
  const open = isMarketOpen();

  const press = (k: (typeof KEYS)[number]) => {
    setError(null);
    setInput((v) => {
      if (k === 'del') return v.slice(0, -1);
      if (k === ',') return v.includes(',') ? v : (v || '0') + ',';
      const [, dec] = v.split(',');
      if (dec !== undefined && dec.length >= 2) return v;
      if (v === '0') return k;
      return (v + k).slice(0, 9);
    });
  };
  const preset = (ratio: number) => {
    const q = roundQty(maxQty * ratio);
    setError(null);
    setInput(mode === 'qty' ? String(q).replace('.', ',') : (Math.floor(q * t.price * 100) / 100).toFixed(2).replace('.', ','));
  };
  const submit = () => {
    const r = store.trade({ side, ticker, quantity });
    if (!r.ok) return setError(r.error);
    setDone({ quantity, total: r.total, price: r.price });
  };

  if (done) {
    return (
      <SheetFrame title="Ordre exécuté">
        <div className="px-5 pt-4 pb-2 text-center">
          <Glyph name={side === 'buy' ? 'party-popper' : 'money-bag'} size={72} className="anim-pop mx-auto" />
          <p className="display mt-4 text-[34px]">Ordre exécuté</p>
          <p className="mt-2 text-[15px] text-ink-2">
            {side === 'buy' ? 'Tu as acheté' : 'Tu as vendu'} <b className="text-ink nums">{formatQuantity(done.quantity)}</b> action{done.quantity >= 2 ? 's' : ''} {t.name} à <b className="text-ink nums">{formatUSD(done.price)}</b>.
          </p>
          <div className="mx-auto mt-5 max-w-xs space-y-1.5 rounded-[2px] border border-line bg-card-2 p-3 text-left text-sm">
            <Line label={side === 'buy' ? 'Débité' : 'Crédité'} value={formatUSD(done.total)} />
            <Line label="Cash restant" value={formatUSD(store.cash)} />
          </div>
          <div className="mt-6 grid gap-2">
            <Button onClick={() => reset('portefeuille')}>Voir mon portefeuille</Button>
            <Button variant="ghost" onClick={closeSheet}>Fermer</Button>
          </div>
        </div>
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title={`${side === 'buy' ? 'Acheter' : 'Vendre'} ${t.name}`}>
      <div className="px-4 pt-2">
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={ticker} size={40} />
          <div className="flex-1">
            <p className="text-[17px] font-bold">{side === 'buy' ? 'Acheter' : 'Vendre'} {t.name}</p>
            <p className="text-xs text-muted nums">Cours {formatUSD(t.price)}, ordre au marché</p>
          </div>
        </div>

        {held > 0 ? (
          <Segmented className="mt-3" value={side} onChange={(s) => { setSide(s); setInput(''); setError(null); }} options={[{ value: 'buy', label: 'Acheter' }, { value: 'sell', label: 'Vendre' }]} />
        ) : null}

        <div className="mt-4 text-center">
          <p className={cx('display text-[56px] nums', !input && 'text-muted')}>
            {input || '0'}<span className="ml-1 text-[32px]">{mode === 'usd' ? '$' : 'act.'}</span>
          </p>
          <button onClick={() => { setMode(mode === 'usd' ? 'qty' : 'usd'); setInput(''); }} className="mt-1 rounded-[2px] border border-line px-2.5 py-1 text-xs font-semibold text-ink-2">
            {mode === 'usd' ? `≈ ${formatQuantity(quantity)} action${quantity >= 2 ? 's' : ''}` : `≈ ${formatUSD(gross)}`}, saisir en {mode === 'usd' ? 'actions' : 'dollars'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <button key={r} onClick={() => preset(r)} className="press h-9 rounded-[2px] border border-line bg-card-2 text-xs font-bold">{r === 1 ? 'Max' : `${r * 100} %`}</button>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted nums">
          {side === 'buy' ? `Cash disponible ${formatUSD(store.cash)}` : `Tu détiens ${formatQuantity(held)} action${held >= 2 ? 's' : ''}`}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-1">
          {KEYS.map((k) => (
            <button key={k} onClick={() => press(k)} className="press grid h-12 place-items-center rounded-[2px] text-[22px] font-semibold active:bg-card-2" aria-label={k === 'del' ? 'Effacer' : k}>
              {k === 'del' ? <Backspace size={24} /> : k}
            </button>
          ))}
        </div>

        <div className="mt-2 space-y-1.5 rounded-[2px] border border-line bg-card-2 p-3 text-sm">
          <Line label="Quantité" value={`${formatQuantity(quantity)} action${quantity >= 2 ? 's' : ''}`} />
          <Line label="Frais fictifs" value={formatUSD(fee)} />
          <Line label={side === 'buy' ? 'Total débité' : 'Total crédité'} value={formatUSD(Math.max(0, total))} strong />
        </div>
        {!open ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2"><Warning size={16} className="mt-px shrink-0 text-gold" weight="fill" /> Marché fermé : l’ordre s’exécute au dernier cours de clôture.</p>
        ) : null}
        {error ? <p role="alert" className="mt-2 rounded-[2px] bg-loss-soft p-2.5 text-sm font-semibold text-loss">{error}</p> : null}

        <Button variant={side === 'buy' ? 'buy' : 'sell'} className="mt-3 w-full" disabled={quantity <= 0} onClick={submit}>
          {side === 'buy' ? 'Confirmer l’achat' : 'Confirmer la vente'}
        </Button>
      </div>
    </SheetFrame>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={cx('nums', strong ? 'font-bold' : 'font-semibold')}>{value}</span>
    </div>
  );
}
