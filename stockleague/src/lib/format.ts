/**
 * Formats français : 1 234,56 $ · 7,30 % · 08/11/2026.
 * Les montants arrivent parfois en string (colonnes numeric de Postgres) :
 * toutes les fonctions acceptent number | string.
 */
type Num = number | string | null | undefined;

export const toNumber = (v: Num): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" });
const usdSigned = new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", signDisplay: "exceptZero",
});
const pctSigned = new Intl.NumberFormat("fr-FR", {
  style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero",
});
const qty = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const intSigned = new Intl.NumberFormat("fr-FR", { signDisplay: "exceptZero", maximumFractionDigits: 0 });

/** 1 234,56 $ */
export const formatUSD = (v: Num) => usd.format(toNumber(v));
/** +1 234,56 $ / -12,30 $ (signe explicite pour l'accessibilité) */
export const formatSignedUSD = (v: Num) => usdSigned.format(toNumber(v));
/** Reçoit un pourcentage (7.3 = 7,3 %) → +7,30 % */
export const formatSignedPercent = (pct: Num) => pctSigned.format(toNumber(pct) / 100);
/** 12,5 (2 décimales max, actions fractionnées) */
export const formatQuantity = (v: Num) => qty.format(toNumber(v));
/** +73 pts */
export const formatPoints = (v: Num) => `${intSigned.format(Math.round(toNumber(v)))} pts`;

/** Tendance d'une valeur, pour choisir couleur et icône. */
export const trendOf = (v: Num): "up" | "down" | "flat" => {
  const n = toNumber(v);
  return n > 0 ? "up" : n < 0 ? "down" : "flat";
};

const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

/**
 * jj/mm/aaaa. Une date Postgres "2026-11-08" est interprétée telle quelle (UTC),
 * pour éviter qu'un fuseau horaire la décale d'un jour.
 */
export const formatDate = (v: string | Date) => dateFr.format(typeof v === "string" ? new Date(v.length === 10 ? `${v}T00:00:00Z` : v) : v);

/** jj/mm/aaaa à hh:mm dans un fuseau donné (par défaut celui de l'utilisateur). */
export const formatDateTime = (v: string | Date, timeZone?: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone,
  }).format(typeof v === "string" ? new Date(v) : v).replace(" ", " à ");
