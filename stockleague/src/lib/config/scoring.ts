/**
 * Barème de points. Toutes les valeurs du jeu sont ici : modifier ce fichier
 * suffit pour équilibrer les règles (les tests unitaires s'appuient dessus).
 */
export const SCORING = {
  prediction: {
    /** Bonne prédiction en confiance « normale ». */
    correct: 10,
    /** Mauvaise prédiction en confiance « normale ». */
    wrong: 0,
    /** Bonne prédiction en « sûr de moi ». */
    sureCorrect: 20,
    /** Mauvaise prédiction en « sûr de moi ». */
    sureWrong: -10,
    /** Égalité exacte BPA réel = estimation : prédiction annulée. */
    void: 0,
  },
  streak: {
    /** Nombre de bonnes prédictions d'affilée pour lancer la série. */
    threshold: 3,
    /** Bonus pour chaque bonne prédiction au-delà du seuil (4e, 5e…). */
    bonusPerCorrect: 5,
  },
  portfolio: {
    /** Points = rendement cumulé de la saison en % × ce multiplicateur (arrondi). */
    pointsPerPercent: 10,
  },
} as const;
