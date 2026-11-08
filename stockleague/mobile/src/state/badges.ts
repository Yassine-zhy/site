import { BADGES, type BadgeKey } from '../data/demo';
import { myPredictionStats, myPortfolio, standings } from './derived';
import type { useStore } from './store';

type S = Pick<ReturnType<typeof useStore>, 'cash' | 'holdings' | 'picks' | 'transactions'>;

/** État de chaque badge pour le joueur (débloqué, ou progression). */
export function badgeStates(s: S): { key: BadgeKey; unlocked: boolean; progress?: number; goal?: number }[] {
  const pred = myPredictionStats(s.picks);
  const port = myPortfolio(s.cash, s.holdings);
  const rank = standings(s.cash, s.holdings, s.picks).find((r) => r.id === 'alex')!.rank;
  const v: Record<BadgeKey, { unlocked: boolean; progress?: number }> = {
    'first-order': { unlocked: s.transactions.length > 0 },
    diversified: { unlocked: s.holdings.length >= 5, progress: s.holdings.length },
    'streak-3': { unlocked: true, progress: 3 },
    podium: { unlocked: true }, // atteint au moins une fois cette saison
    early: { unlocked: true },
    'five-right': { unlocked: pred.correct >= 5, progress: pred.correct },
    'sure-3': { unlocked: pred.sureCorrect >= 3, progress: pred.sureCorrect },
    'plus-10': { unlocked: port.returnPct >= 10, progress: Math.max(0, Math.round(port.returnPct * 10) / 10) },
    leader: { unlocked: rank === 1 },
    champion: { unlocked: false },
  };
  return (Object.keys(BADGES) as BadgeKey[]).map((key) => ({ key, ...v[key], goal: BADGES[key].goal }));
}
