/**
 * État de la démo (profil, portefeuille, pronostics, progression), conservé sur le téléphone.
 * Dans la vraie appli, ces données viendront de Supabase.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { ACTIVE_LEAGUE, applyReveals, EARNINGS, FEED, LIVE_RESULTS, ME, PASS, PLAYER_MAP, MY_PICKS, MY_START, MY_TRANSACTIONS, type FeedItem, type FrameKey, type MyPick, type Transaction } from '../data/demo';
import type { GlyphName } from '../data/glyphs';
import { TICKER_MAP } from '../data/tickers';
import { haptic } from '../lib/haptics';
import { executeOrder, type Holding, type Order } from '../lib/trading';
import { outcomeOf, predictionPoints, type Choice, type Confidence, type Outcome } from '../lib/scoring';
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
  revealed: Record<string, boolean>; claimedTiers: number[]; frame: FrameKey | null; customTitle: string | null;
  freezes: number; readNotifs: string[]; storySeen: string | null;
};

export type Celebration = { id: number; xp: number; label: string; emoji: GlyphName; levelUp?: number; confetti?: boolean };

const KEY = 'stockleague-demo-v3';
const daysAgo = (n: number) => todayKey(new Date(Date.now() - n * 86400000));
const initial: State = {
  onboarded: false, profileDone: false, tutorialDone: false,
  pseudo: 'Alex', photo: null, theme: 'light', notifications: true,
  cash: MY_START.cash, holdings: MY_START.holdings, transactions: MY_TRANSACTIONS, picks: MY_PICKS, feed: FEED,
  // Progression de départ : 80 % du niveau 3, série de 5 jours (la visite d'aujourd'hui la prolonge).
  xp: 540, visitStreak: 5, lastVisit: yesterdayKey(), visitDays: [5, 4, 3, 2, 1].map(daysAgo),
  reactions: { f4: 'fire' }, missions: {}, chests: {}, flash: { [yesterdayKey()]: 'up' },
  revealed: {}, claimedTiers: [0], frame: null, customTitle: null, freezes: 1, readNotifs: [], storySeen: null,
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
  pick: (eventId: string, ticker: string, choice: Choice, confidence: Confidence, silent?: boolean) => void;
  grant: (xp: number, label: string, emoji: GlyphName, confetti?: boolean) => void;
  react: (feedId: string, r: Reaction) => void;
  flashPick: (choice: 'up' | 'down') => void;
  openChest: () => number;
  reveal: (eventId: string) => { outcome: Outcome; points: number };
  claimTier: (i: number) => void;
  taunt: (playerId: string, message: string) => void;
  reset: () => void;
};
const Ctx = createContext<Store | null>(null);

const qtyFr = (q: number) => q.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    let s = initial;
    try { s = revive(localStorage.getItem(KEY)); } catch { /* démo neuve */ }
    applyReveals(s.revealed);
    return s;
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
    const res = nextVisitStreak(state.lastVisit, state.visitStreak);
    if (!res.isNewDay) return;
    const day = todayKey();
    // Gel de série : un seul jour manqué est pardonné si le joueur en a un en réserve.
    const dayBefore = todayKey(new Date(Date.now() - 2 * 86400000));
    const frozen = res.streak === 1 && state.lastVisit === dayBefore && state.freezes > 0;
    const streak = frozen ? state.visitStreak + 1 : res.streak;
    const extra = { visitStreak: streak, lastVisit: day, visitDays: [...state.visitDays.filter((d) => d !== day), day].slice(-30), ...(frozen ? { freezes: state.freezes - 1 } : {}) };
    const t = setTimeout(() => reward(XP.dailyVisit, frozen ? `Gel utilisé : série de ${streak} jours sauvée` : `Série de ${streak} jour${streak > 1 ? 's' : ''}`, frozen ? 'snowflake' : 'fire', extra), 900);
    return () => clearTimeout(t);
  }, [state.onboarded, state.profileDone, state.tutorialDone, state.lastVisit, state.visitStreak, state.visitDays, state.freezes, reward]);

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

  const pick = useCallback<Store['pick']>((eventId, ticker, choice, confidence, silent) => {
    const s = ref.current;
    const at = new Date();
    const isNew = !s.picks[eventId];
    const base: Partial<State> = {
      picks: { ...s.picks, [eventId]: { choice, confidence, at } },
      feed: [{ id: `p-${eventId}`, at, actor: ME, kind: 'predict', ticker, text: `as pronostiqué que ${TICKER_MAP[ticker].name} ${choice === 'beat' ? 'battrait' : 'manquerait'} les attentes` }, ...s.feed.filter((f) => f.id !== `p-${eventId}`)],
    };
    if (!isNew) { dispatch({ type: 'patch', patch: base }); haptic('tap'); return; }
    const mission = completeMission('pred', s);
    if (silent) { ref.current = { ...s, ...base, ...(mission ?? {}) } as State; dispatch({ type: 'patch', patch: { ...base, ...(mission ?? {}) } }); return; }
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

  /** Révèle un résultat publié : le pronostic est résolu et les points tombent. */
  const reveal = useCallback<Store['reveal']>((eventId) => {
    const s = ref.current;
    const revealed = { ...s.revealed, [eventId]: true };
    applyReveals(revealed);
    const e = EARNINGS.find((x) => x.id === eventId)!;
    const pick = s.picks[eventId];
    const outcome = pick ? outcomeOf(pick.choice, e.estimate, LIVE_RESULTS[eventId]) : 'void';
    const points = pick ? predictionPoints(outcome, pick.confidence) : 0;
    const feed: FeedItem = { id: `r-${eventId}`, at: new Date(), kind: 'result', ticker: e.ticker, emoji: 'bullseye', text: `${e.ticker === 'DIS' ? 'Disney' : e.ticker} a battu les attentes (1,12 $ contre ${e.estimate.toFixed(2).replace('.', ',')} $) : 3 joueurs sur 6 avaient vu juste` };
    dispatch({ type: 'patch', patch: { revealed, feed: [feed, ...s.feed] } });
    haptic(outcome === 'correct' ? 'success' : 'error');
    return { outcome, points };
  }, []);

  /** Récupère la récompense d'un palier du passe de saison. */
  const claimTier = useCallback((i: number) => {
    const s = ref.current;
    if (s.claimedTiers.includes(i)) return;
    const r = PASS[i];
    const claimedTiers = [...s.claimedTiers, i];
    if (r.kind === 'xp') return reward(r.amount, `Palier ${i + 1} : bonus d’XP`, 'path', { claimedTiers }, true);
    const patch: Partial<State> = { claimedTiers };
    if (r.kind === 'freeze') patch.freezes = s.freezes + 1;
    if (r.kind === 'frame') patch.frame = r.frame;
    if (r.kind === 'title') patch.customTitle = r.title;
    reward(5, r.kind === 'freeze' ? 'Gel de série obtenu' : r.kind === 'frame' ? 'Nouveau cadre équipé' : `Titre « ${r.title} » débloqué`, r.kind === 'freeze' ? 'snowflake' : r.kind === 'frame' ? 'frame' : 'id-card', patch, true);
  }, [reward]);

  const taunt = useCallback((playerId: string, message: string) => {
    const s = ref.current;
    const at = new Date();
    dispatch({ type: 'patch', patch: { feed: [{ id: `c${at.getTime()}`, at, actor: ME, kind: 'title', emoji: 'megaphone', text: `as chambré ${PLAYER_MAP[playerId]?.pseudo ?? playerId} : « ${message} »` }, ...s.feed] } });
    haptic('success');
  }, []);

  const reset = useCallback(() => { applyReveals({}); dispatch({ type: 'reset' }); }, []);
  const grant = useCallback<Store['grant']>((xp, label, emoji, confetti) => reward(xp, label, emoji, {}, confetti), [reward]);
  const dismissCelebration = useCallback((id: number) => setCelebrations((c) => c.filter((x) => x.id !== id)), [setCelebrations]);

  const value = useMemo(
    () => ({ ...state, celebrations, dismissCelebration, patch, trade, pick, react, flashPick, openChest, reveal, claimTier, taunt, reset, grant }),
    [state, celebrations, dismissCelebration, patch, trade, pick, react, flashPick, openChest, reveal, claimTier, taunt, reset, grant],
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
