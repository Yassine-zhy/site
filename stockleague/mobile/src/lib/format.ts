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

/** « à l'instant », « il y a 3 h », « hier », « il y a 4 j » */
export function formatRelative(date: Date, now = new Date()): string {
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hier' : `il y a ${d} j`;
}

/** Compte à rebours compact : « 2 j 4 h », « 3 h 12 min », « 8 min » */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0 min';
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), mm = min % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${String(mm).padStart(2, '0')}`;
  return `${mm} min`;
}

const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
/** « mardi 10 novembre » */
export const formatDayLong = (d: Date) => weekday.format(d);
const dayShort = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
export const formatDayShort = (d: Date) => dayShort.format(d);
