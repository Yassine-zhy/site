/**
 * État de la démo (profil, portefeuille, pronostics, progression), conservé sur le téléphone.
 * Dans la vraie appli, ces données viendront de Supabase.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { ACTIVE_LEAGUE, FEED, ME, PLAYER_MAP, MY_PICKS, MY_START, MY_TRANSACTIONS, type FeedItem, type MyPick, type Transaction } from '../data/demo';
import type { GlyphName } from '../data/glyphs';
import { TICKER_MAP } from '../data/tickers';
import { haptic } from '../lib/haptics';
import { executeOrder, type Holding, type Order } from '../lib/trading';
import type { Choice, Confidence } from '../lib/scoring';
import { levelOf, nextVisitStreak, todayKey, XP, yesterdayKey } from '../lib/xp';

type Theme = 'system' | 'light' | 'dark';
export type Reaction = 'fire' | 'laugh' | 'clap' | 'shock';
export type Mission = 'pred' | 'order' | 'react';

type State = {
  onboarded: boolean; profileDone: boolean; tutorialDone: boolean;
  pseudo: string; photo: string | null; theme: Theme; notifications: boolean;
  cash: number; holdings: Holding[]; transactions: Transaction[];
  picks: Record<string, MyPick>; feed: FeedItem[];
  xp: number; visitStreak: number; lastVisit: string | null; visitDays: string[];
  reactions: Record<string, Reaction>;
  missions: Record<string, Partial<Record<Mission, boolean>>>;
  chests: Record<string, number>;
  flash: Record<string, 'up' | 'down'>;
};

export type Celebration = { id: number; xp: number; label: string; emoji: GlyphName; levelUp?: number; confetti?: boolean };

const KEY = 'stockleague-demo-v2';
const daysAgo = (n: number) => todayKey(new Date(Date.now() - n * 86400000));
const initial: State = {
  onboarded: false, profileDone: false, tutorialDone: false,
  pseudo: 'Alex', photo: null, theme: 'dark', notifications: true,
  cash: MY_START.cash, holdings: MY_START.holdings, transactions: MY_TRANSACTIONS, picks: MY_PICKS, feed: FEED,
  // Progression de départ : 80 % du niveau 3, série de 5 jours (la visite d'aujourd'hui la prolonge).
  xp: 540, visitStreak: 5, lastVisit: yesterdayKey(), visitDays: [5, 4, 3, 2, 1].map(daysAgo),
  reactions: { f4: 'fire' }, missions: {}, chests: {}, flash: { [yesterdayKey()]: 'up' },
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
  | { type: 'reset' };

function reducer(s: State, a: Action): State {
  if (a.type === 'patch') return { ...s, ...a.patch };
  return { ...initial, onboarded: true, profileDone: true, tutorialDone: true, theme: s.theme, pseudo: s.pseudo, photo: s.photo };
}

type Store = State & {
  celebrations: Celebration[];
  dismissCelebration: (id: number) => void;
  patch: (p: Partial<State>) => void;
  trade: (o: Omit<Order, 'price' | 'fee'>) => { ok: true; total: number; price: number } | { ok: false; error: string };
  pick: (eventId: string, ticker: string, choice: Choice, confidence: Confidence) => void;
  react: (feedId: string, r: Reaction) => void;
  flashPick: (choice: 'up' | 'down') => void;
  openChest: () => number;
  reset: () => void;
};
const Ctx = createContext<Store | null>(null);

const qtyFr = (q: number) => q.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    try { return revive(localStorage.getItem(KEY)); } catch { return initial; }
  });
  const [celebrations, setCelebrations] = useReducerState<Celebration[]>([]);
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* stockage indisponible : la démo reste utilisable */ }
  }, [state]);

  const patch = useCallback((p: Partial<State>) => dispatch({ type: 'patch', patch: p }), []);

  /** Ajoute de l'XP et déclenche la célébration (et le passage de niveau éventuel). */
  const reward = useCallback((xp: number, label: string, emoji: GlyphName, extra: Partial<State> = {}, confetti = false) => {
    const s = ref.current;
    const before = levelOf(s.xp).level, after = levelOf(s.xp + xp).level;
    dispatch({ type: 'patch', patch: { ...extra, xp: s.xp + xp } });
    setCelebrations((c) => [...c, { id: Date.now() + Math.random(), xp, label, emoji, levelUp: after > before ? after : undefined, confetti: confetti || after > before }]);
    haptic(after > before ? 'success' : 'tap');
  }, [setCelebrations]);

  const completeMission = useCallback((m: Mission, s: State): Partial<State> | null => {
    const day = todayKey();
    if (s.missions[day]?.[m]) return null;
    return { missions: { ...s.missions, [day]: { ...s.missions[day], [m]: true } } };
  }, []);

  // Visite du jour : prolonge la série et rapporte un peu d'XP (une fois par jour).
  useEffect(() => {
    if (!state.onboarded || !state.profileDone || !state.tutorialDone) return;
    const { streak, isNewDay } = nextVisitStreak(state.lastVisit, state.visitStreak);
    if (!isNewDay) return;
    const day = todayKey();
    const t = setTimeout(() => reward(XP.dailyVisit, `Série de ${streak} jour${streak > 1 ? 's' : ''}`, 'fire', { visitStreak: streak, lastVisit: day, visitDays: [...state.visitDays.filter((d) => d !== day), day].slice(-30) }), 900);
    return () => clearTimeout(t);
  }, [state.onboarded, state.profileDone, state.tutorialDone, state.lastVisit, state.visitStreak, state.visitDays, reward]);

  const trade = useCallback<Store['trade']>((o) => {
    const s = ref.current;
    const price = TICKER_MAP[o.ticker].price;
    const r = executeOrder({ cash: s.cash, holdings: s.holdings }, { ...o, price, fee: ACTIVE_LEAGUE.fee });
    if (!r.ok) { haptic('error'); return r; }
    const at = new Date();
    const verb = o.side === 'buy' ? 'as acheté' : 'as vendu';
    const base: Partial<State> = {
      cash: r.portfolio.cash, holdings: r.portfolio.holdings,
      transactions: [{ id: `t${at.getTime()}`, side: o.side, ticker: o.ticker, quantity: o.quantity, price, fee: ACTIVE_LEAGUE.fee, at }, ...s.transactions],
      feed: [{ id: `f${at.getTime()}`, at, actor: ME, kind: o.side, ticker: o.ticker, text: `${verb} ${qtyFr(o.quantity)} action${o.quantity >= 2 ? 's' : ''} ${TICKER_MAP[o.ticker].name}` }, ...s.feed],
    };
    const mission = completeMission('order', s);
    if (mission) reward(XP.order, 'Mission : passer un ordre', 'check-mark-button', { ...base, ...mission }, true);
    else { dispatch({ type: 'patch', patch: base }); haptic('success'); }
    return { ok: true, total: r.total, price };
  }, [completeMission, reward]);

  const pick = useCallback<Store['pick']>((eventId, ticker, choice, confidence) => {
    const s = ref.current;
    const at = new Date();
    const isNew = !s.picks[eventId];
    const base: Partial<State> = {
      picks: { ...s.picks, [eventId]: { choice, confidence, at } },
      feed: [{ id: `p-${eventId}`, at, actor: ME, kind: 'predict', ticker, text: `as pronostiqué que ${TICKER_MAP[ticker].name} ${choice === 'beat' ? 'battrait' : 'manquerait'} les attentes` }, ...s.feed.filter((f) => f.id !== `p-${eventId}`)],
    };
    if (!isNew) { dispatch({ type: 'patch', patch: base }); haptic('tap'); return; }
    const mission = completeMission('pred', s);
    reward(XP.prediction, mission ? 'Mission : faire un pronostic' : 'Pronostic enregistré', 'bullseye', { ...base, ...(mission ?? {}) }, !!mission);
  }, [completeMission, reward]);

  const react = useCallback<Store['react']>((feedId, r) => {
    const s = ref.current;
    const reactions = { ...s.reactions };
    if (reactions[feedId] === r) delete reactions[feedId];
    else reactions[feedId] = r;
    const mission = reactions[feedId] ? completeMission('react', s) : null;
    if (mission) reward(XP.reaction, 'Mission : réagir à un ami', 'clapping-hands', { reactions, ...mission });
    else { dispatch({ type: 'patch', patch: { reactions } }); haptic('tap'); }
  }, [completeMission, reward]);

  const flashPick = useCallback<Store['flashPick']>((choice) => {
    const s = ref.current;
    dispatch({ type: 'patch', patch: { flash: { ...s.flash, [todayKey()]: choice } } });
    haptic('tap');
  }, []);

  /** Coffre du jour : récompense variable une fois les 3 missions faites. */
  const openChest = useCallback(() => {
    const s = ref.current;
    const day = todayKey();
    if (s.chests[day]) return s.chests[day];
    const amount = [30, 40, 50, 60, 80][Math.floor(Math.random() * 5)];
    reward(amount, 'Coffre du jour', 'wrapped-gift', { chests: { ...s.chests, [day]: amount } }, true);
    return amount;
  }, [reward]);

  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const dismissCelebration = useCallback((id: number) => setCelebrations((c) => c.filter((x) => x.id !== id)), [setCelebrations]);

  const value = useMemo(
    () => ({ ...state, celebrations, dismissCelebration, patch, trade, pick, react, flashPick, openChest, reset }),
    [state, celebrations, dismissCelebration, patch, trade, pick, react, flashPick, openChest, reset],
  );
  return <Ctx value={value}>{children}</Ctx>;
}

/** useState minimal basé sur useReducer (setter stable). */
function useReducerState<T>(init: T) {
  return useReducer((s: T, f: (s: T) => T) => f(s), init);
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore hors du StoreProvider');
  return s;
}

/** Nom affiché d'un joueur (le mien vient du profil). */
export function useName() {
  const { pseudo } = useStore();
  return useCallback((id: string) => (id === ME ? pseudo : PLAYER_MAP[id]?.pseudo ?? id), [pseudo]);
}
