/**
 * Identité de l'application, centralisée ici.
 * Pour renommer l'app, il suffit de changer APP_NAME (et la description si besoin).
 */
export const APP_NAME = "StockLeague";
export const APP_TAGLINE = "La bourse, version championnat entre amis.";
export const APP_DESCRIPTION =
  "Crée une ligue privée, investis un capital fictif sur de vraies actions et pronostique les résultats trimestriels. Une saison, un classement, un gagnant.";

/** Mention légale affichée dans toute l'app. */
export const DISCLAIMER =
  "Argent fictif — à but ludique et éducatif — ceci n'est pas un conseil en investissement.";

/** Délai indicatif des cours affichés (offre gratuite du fournisseur de données). */
export const QUOTE_DELAY_MINUTES = 15;

/** Valeurs par défaut à la création d'une ligue. */
export const LEAGUE_DEFAULTS = {
  startingCash: 10_000,
  fee: 0,
  maxPlayers: 10,
  markets: ["US"] as const,
  minSeasonDays: 7,
  maxSeasonDays: 92, // ~3 mois
} as const;
