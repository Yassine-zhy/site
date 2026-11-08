/**
 * État de la démo (portefeuille, pronostics, réglages), conservé sur le téléphone.
 * Dans la vraie appli, ces données viendront de Supabase.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { ACTIVE_LEAGUE, FEED, ME, MY_PICKS, MY_START, MY_TRANSACTIONS, type FeedItem, type MyPick, type Transaction } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { executeOrder, type Holding, type Order } from '../lib/trading';
import type { Choice, Confidence } from '../lib/scoring';

type Theme = 'system' | 'light' | 'dark';
type State = {
  onboarded: boolean;
  leagueId: string;
  theme: Theme;
  cash: number;
  holdings: Holding[];
  transactions: Transaction[];
  picks: Record<string, MyPick>;
  feed: FeedItem[];
  notifications: boolean;
};

const KEY = 'stockleague-demo-v1';
const initial: State = {
  onboarded: false, leagueId: ACTIVE_LEAGUE.id, theme: 'system', cash: MY_START.cash, holdings: MY_START.holdings,
  transactions: MY_TRANSACTIONS, picks: MY_PICKS, feed: FEED, notifications: true,
};

function revive(raw: string | null): State {
  if (!raw) return initial;
  try {
    const s = JSON.parse(raw) as State;
    const date = <T extends { at: Date | string }>(x: T) => ({ ...x, at: new Date(x.at) });
    return {
      ...initial, ...s,
      transactions: s.transactions.map(date),
      feed: s.feed.map(date),
      picks: Object.fromEntries(Object.entries(s.picks).map(([k, v]) => [k, date(v)])),
    };
  } catch {
    return initial;
  }
}

type Action =
  | { type: 'patch'; patch: Partial<State> }
  | { type: 'trade'; cash: number; holdings: Holding[]; tx: Transaction; feed: FeedItem }
  | { type: 'pick'; eventId: string; pick: MyPick; feed: FeedItem }
  | { type: 'reset' };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'patch': return { ...s, ...a.patch };
    case 'trade': return { ...s, cash: a.cash, holdings: a.holdings, transactions: [a.tx, ...s.transactions], feed: [a.feed, ...s.feed] };
    case 'pick': return { ...s, picks: { ...s.picks, [a.eventId]: a.pick }, feed: [a.feed, ...s.feed.filter((f) => f.id !== `p-${a.eventId}`)] };
    case 'reset': return { ...initial, onboarded: true, theme: s.theme };
  }
}

type Store = State & {
  patch: (p: Partial<State>) => void;
  trade: (o: Omit<Order, 'price' | 'fee'>) => { ok: true; total: number; price: number } | { ok: false; error: string };
  pick: (eventId: string, ticker: string, choice: Choice, confidence: Confidence) => void;
  reset: () => void;
};
const Ctx = createContext<Store | null>(null);

const qtyFr = (q: number) => q.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    try { return revive(localStorage.getItem(KEY)); } catch { return initial; }
  });

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible : la démo reste utilisable */ }
  }, [state]);

  const patch = useCallback((p: Partial<State>) => dispatch({ type: 'patch', patch: p }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  const trade = useCallback<Store['trade']>((o) => {
    const price = TICKER_MAP[o.ticker].price;
    const r = executeOrder({ cash: state.cash, holdings: state.holdings }, { ...o, price, fee: ACTIVE_LEAGUE.fee });
    if (!r.ok) return r;
    const at = new Date();
    const name = TICKER_MAP[o.ticker].name;
    const verb = o.side === 'buy' ? 'as acheté' : 'as vendu';
    dispatch({
      type: 'trade', cash: r.portfolio.cash, holdings: r.portfolio.holdings,
      tx: { id: `t${at.getTime()}`, side: o.side, ticker: o.ticker, quantity: o.quantity, price, fee: ACTIVE_LEAGUE.fee, at },
      feed: { id: `f${at.getTime()}`, at, actor: ME, kind: o.side, ticker: o.ticker, text: `${verb} ${qtyFr(o.quantity)} action${o.quantity >= 2 ? 's' : ''} ${name}` },
    });
    return { ok: true, total: r.total, price };
  }, [state.cash, state.holdings]);

  const pick = useCallback<Store['pick']>((eventId, ticker, choice, confidence) => {
    const at = new Date();
    dispatch({
      type: 'pick', eventId, pick: { choice, confidence, at },
      feed: { id: `p-${eventId}`, at, actor: ME, kind: 'predict', ticker, text: `as pronostiqué que ${TICKER_MAP[ticker].name} ${choice === 'beat' ? 'battrait' : 'manquerait'} les attentes` },
    });
  }, []);

  const value = useMemo(() => ({ ...state, patch, trade, pick, reset }), [state, patch, trade, pick, reset]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore hors du StoreProvider');
  return s;
}
