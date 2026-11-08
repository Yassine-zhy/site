/** Calculs dérivés partagés par les écrans : classement, rendement, points. */
import { ACTIVE_LEAGUE, EARNINGS, LIVE_RESULTS, ME, MY_RANK_YESTERDAY, MY_SELLS, PLAYERS, RIVALS, STARTING_CASH, TITLES, type TitleKey } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { outcomeOf, portfolioPoints, predictionPoints, streakBonuses, type Outcome } from '../lib/scoring';
import { portfolioValue, type Holding } from '../lib/trading';
import type { MyPick } from '../data/demo';

export const priceOf = (t: string) => TICKER_MAP[t]?.price ?? 0;

export type Standing = {
  id: string; rank: number; rankYesterday: number; total: number; portfolioPts: number; predPts: number;
  returnPct: number; accuracy: number; correct: number; decided: number; streak: number; titles: TitleKey[]; sells: number;
};

export function myPredictionStats(picks: Record<string, MyPick>) {
  const resolved = EARNINGS.filter((e) => e.actual !== null && picks[e.id]).sort((a, b) => a.date.localeCompare(b.date));
  const outcomes: Outcome[] = resolved.map((e) => outcomeOf(picks[e.id].choice, e.estimate, e.actual));
  const { bonuses, current } = streakBonuses(outcomes);
  const points = outcomes.reduce((s, o, i) => s + predictionPoints(o, picks[resolved[i].id].confidence) + bonuses[i], 0);
  const correct = outcomes.filter((o) => o === 'correct').length;
  const decided = outcomes.filter((o) => o === 'correct' || o === 'wrong').length;
  return { points, correct, decided, streak: current, sureCorrect: resolved.filter((e, i) => outcomes[i] === 'correct' && picks[e.id].confidence === 'sure').length };
}

export function myPortfolio(cash: number, holdings: Holding[]) {
  const value = portfolioValue({ cash, holdings }, priceOf);
  const returnPct = ((value - STARTING_CASH) / STARTING_CASH) * 100;
  const dayChange = holdings.reduce((s, h) => {
    const t = TICKER_MAP[h.ticker];
    return s + h.quantity * (t.price - t.price / (1 + t.changePct / 100));
  }, 0);
  return { value, returnPct, dayChange, dayChangePct: (dayChange / (value - dayChange)) * 100, invested: value - cash };
}

export function standings(cash: number, holdings: Holding[], picks: Record<string, MyPick>): Standing[] {
  const me = myPortfolio(cash, holdings);
  const mp = myPredictionStats(picks);
  const rows = PLAYERS.map((p) => {
    if (p.id === ME) {
      const portfolioPts = portfolioPoints(me.returnPct);
      return { id: ME, rankYesterday: MY_RANK_YESTERDAY, portfolioPts, predPts: mp.points, total: portfolioPts + mp.points, returnPct: me.returnPct, accuracy: mp.decided ? mp.correct / mp.decided : 0, correct: mp.correct, decided: mp.decided, streak: mp.streak, titles: [] as TitleKey[], sells: MY_SELLS };
    }
    const r = RIVALS[p.id];
    const portfolioPts = portfolioPoints(r.returnPct);
    const predPts = r.predPoints + liveBonus(p.id);
    return { id: p.id, rankYesterday: r.rankYesterday, portfolioPts, predPts, total: portfolioPts + predPts, returnPct: r.returnPct, accuracy: r.correct / r.total, correct: r.correct, decided: r.total, streak: r.streak, titles: r.titles, sells: r.sells };
  });
  return rows.sort((a, b) => b.total - a.total).map((r, i) => ({ ...r, rank: i + 1 }));
}

export const titleOf = (k: TitleKey) => TITLES[k];
export const daysLeft = () => Math.max(0, Math.ceil((ACTIVE_LEAGUE.end.getTime() - Date.now()) / 86400000));

/** Points gagnés par un ami sur les résultats révélés en direct (barème normal : +10 si juste). */
export function liveBonus(id: string): number {
  return Object.keys(LIVE_RESULTS).reduce((sum, eid) => {
    const e = EARNINGS.find((x) => x.id === eid);
    if (!e || e.actual === null || !e.picks[id]) return sum;
    return sum + (outcomeOf(e.picks[id], e.estimate, e.actual) === 'correct' ? 10 : 0);
  }, 0);
}
