/** Barème (identique à stockleague/src/lib/config/scoring.ts). */
export const SCORING = {
  prediction: { correct: 10, wrong: 0, sureCorrect: 20, sureWrong: -10, void: 0 },
  streak: { threshold: 3, bonusPerCorrect: 5 },
  portfolio: { pointsPerPercent: 10 },
} as const;

export type Choice = 'beat' | 'miss';
export type Confidence = 'normal' | 'sure';
export type Outcome = 'pending' | 'correct' | 'wrong' | 'void';

/** BPA réel vs estimation : égalité exacte = prédiction annulée. */
export function outcomeOf(choice: Choice, estimate: number, actual: number | null): Outcome {
  if (actual === null) return 'pending';
  if (actual === estimate) return 'void';
  const beat = actual > estimate;
  return (choice === 'beat') === beat ? 'correct' : 'wrong';
}

export function predictionPoints(outcome: Outcome, confidence: Confidence): number {
  const s = SCORING.prediction;
  if (outcome === 'correct') return confidence === 'sure' ? s.sureCorrect : s.correct;
  if (outcome === 'wrong') return confidence === 'sure' ? s.sureWrong : s.wrong;
  return 0;
}

/**
 * Bonus de série, dans l'ordre chronologique : une prédiction annulée ne casse pas la série,
 * une erreur la remet à zéro ; +5 pour chaque bonne prédiction au-delà de la 3e d'affilée.
 */
export function streakBonuses(outcomes: Outcome[]): { bonuses: number[]; current: number } {
  let run = 0;
  const bonuses = outcomes.map((o) => {
    if (o === 'correct') {
      run++;
      return run > SCORING.streak.threshold ? SCORING.streak.bonusPerCorrect : 0;
    }
    if (o === 'wrong') run = 0;
    return 0;
  });
  return { bonuses, current: run };
}

/** Points de portefeuille : rendement cumulé en % × 10, arrondi. */
export const portfolioPoints = (returnPct: number) => Math.round(returnPct * SCORING.portfolio.pointsPerPercent);
