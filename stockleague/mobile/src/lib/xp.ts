/**
 * Progression personnelle (XP et niveaux), séparée des points de ligue :
 * elle récompense l'assiduité sans changer le classement.
 */
export const LEVELS = ['Stagiaire', 'Analyste junior', 'Analyste', 'Gérant', 'Gérant senior', 'Stratège', 'Légende de Wall Street'] as const;

/** XP cumulée nécessaire pour atteindre le niveau n (n ≥ 1) : 0, 100, 300, 600, 1000… */
export const xpForLevel = (n: number) => 50 * (n - 1) * n;

export function levelOf(xp: number) {
  let level = 1;
  while (level < LEVELS.length && xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level), next = level < LEVELS.length ? xpForLevel(level + 1) : base;
  return { level, title: LEVELS[level - 1], base, next, progress: next > base ? (xp - base) / (next - base) : 1, toNext: Math.max(0, next - xp) };
}

export const XP = { prediction: 30, order: 20, reaction: 10, flash: 15, dailyVisit: 10 } as const;

/** Clé du jour local "AAAA-MM-JJ". */
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const yesterdayKey = () => todayKey(new Date(Date.now() - 86400000));

/** Série de jours consécutifs : continue si la dernière visite date d'hier. */
export function nextVisitStreak(last: string | null, streak: number, today = todayKey(), yesterday = yesterdayKey()) {
  if (last === today) return { streak, isNewDay: false };
  return { streak: last === yesterday ? streak + 1 : 1, isNewDay: true };
}
