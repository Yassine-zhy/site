/**
 * Ligue de démonstration. Les dates sont calculées par rapport à aujourd'hui,
 * pour que la démo ait toujours l'air « en direct ».
 */
import type { EmojiName } from './emoji-list';
import type { AvatarSeed } from './avatar-list';
import { TICKER_MAP } from './tickers';
import { addBusinessDays, lockTime, type Timing } from '../lib/market-time';
import type { Choice, Confidence } from '../lib/scoring';
import type { Holding } from '../lib/trading';

export const ME = 'alex';
const DAY = 86400000;
const now = new Date();
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY);

// --------------------------------------------------------------------------- joueurs
export type Player = { id: string; pseudo: string; avatar: AvatarSeed; tint: string };
export const PLAYERS: Player[] = [
  { id: 'alex', pseudo: 'Alex', avatar: 'alex', tint: '#DCE7F7' },
  { id: 'yanis', pseudo: 'Yanis', avatar: 'yanis', tint: '#FBE7C6' },
  { id: 'lea', pseudo: 'Léa', avatar: 'lea', tint: '#E4DDF6' },
  { id: 'mehdi', pseudo: 'Mehdi', avatar: 'mehdi', tint: '#D7EFE4' },
  { id: 'camille', pseudo: 'Camille', avatar: 'camille', tint: '#F7DCDC' },
  { id: 'ines', pseudo: 'Inès', avatar: 'ines', tint: '#E1ECEF' },
];
export const PLAYER_MAP = Object.fromEntries(PLAYERS.map((p) => [p.id, p])) as Record<string, Player>;

// --------------------------------------------------------------------------- titres et badges
export type TitleKey = 'buffett' | 'oracle' | 'diamond' | 'kamikaze' | 'lanterne';
export const TITLES: Record<TitleKey, { label: string; emoji: EmojiName; rule: string }> = {
  buffett: { label: 'Le Warren Buffett de la bande', emoji: 'top-hat', rule: '1er au classement général' },
  oracle: { label: "L'Oracle", emoji: 'crystal-ball', rule: 'Meilleur taux de pronostics justes' },
  diamond: { label: 'Diamond hands', emoji: 'gem-stone', rule: 'Le moins de ventes de la saison' },
  kamikaze: { label: 'Le kamikaze', emoji: 'rocket', rule: 'Plus grosse position sur une seule action' },
  lanterne: { label: 'La lanterne rouge', emoji: 'red-paper-lantern', rule: 'Dernier au classement général' },
};

export type BadgeKey = 'first-order' | 'five-right' | 'streak-3' | 'podium' | 'leader' | 'plus-10' | 'diversified' | 'sure-3' | 'early' | 'champion';
export const BADGES: Record<BadgeKey, { label: string; emoji: EmojiName; rule: string; goal?: number }> = {
  'first-order': { label: 'Premier ordre', emoji: 'handshake', rule: 'Passer ton premier ordre' },
  diversified: { label: 'Bien diversifié', emoji: 'shopping-bags', rule: 'Détenir 5 actions différentes', goal: 5 },
  'streak-3': { label: 'En feu', emoji: 'fire', rule: '3 pronostics justes d’affilée', goal: 3 },
  podium: { label: 'Sur le podium', emoji: '3rd-place-medal', rule: 'Finir une journée dans le top 3' },
  early: { label: 'Lève-tôt', emoji: 'telescope', rule: 'Pronostiquer 7 jours avant une publication' },
  'five-right': { label: 'Œil de lynx', emoji: 'bullseye', rule: '5 pronostics justes', goal: 5 },
  'sure-3': { label: 'Sûr de toi', emoji: 'sparkles', rule: '3 « sûr de moi » réussis', goal: 3 },
  'plus-10': { label: 'Double chiffre', emoji: 'chart-increasing', rule: '+10 % sur la saison', goal: 10 },
  leader: { label: 'Leader d’un jour', emoji: 'crown', rule: 'Être 1er au général à la clôture' },
  champion: { label: 'Champion', emoji: 'trophy', rule: 'Gagner une saison' },
};

// --------------------------------------------------------------------------- ligues
export type LeagueSummary = {
  id: string; name: string; season: number; status: 'draft' | 'active' | 'finished';
  start: Date; end: Date; players: number; maxPlayers: number; myRank?: number; startingCash: number; fee: number;
  inviteCode: string; isAdmin: boolean; winner?: string;
};
export const LEAGUES: LeagueSummary[] = [
  { id: 'loups-s2', name: 'Ligue des Loups', season: 2, status: 'active', start: daysFromNow(-37), end: daysFromNow(23), players: 6, maxPlayers: 8, myRank: 3, startingCash: 10000, fee: 0, inviteCode: 'K7WQ3M', isAdmin: false },
  { id: 'promo-l3', name: 'Promo Finance L3', season: 1, status: 'draft', start: daysFromNow(9), end: daysFromNow(70), players: 4, maxPlayers: 12, startingCash: 10000, fee: 1, inviteCode: 'P4XN8R', isAdmin: true },
  { id: 'loups-s1', name: 'Ligue des Loups', season: 1, status: 'finished', start: daysFromNow(-130), end: daysFromNow(-40), players: 5, maxPlayers: 8, myRank: 2, startingCash: 10000, fee: 0, inviteCode: 'H2JD9C', isAdmin: false, winner: 'lea' },
];
export const ACTIVE_LEAGUE = LEAGUES[0];
export const DRAFT_MEMBERS = ['alex', 'hugo', 'sarah', 'camille'] as const;

// --------------------------------------------------------------------------- portefeuilles
export const STARTING_CASH = 10000;
export const MY_START: { cash: number; holdings: Holding[] } = {
  cash: 1664.1,
  holdings: [
    { ticker: 'NVDA', quantity: 12, avgCost: 142.1 },
    { ticker: 'AAPL', quantity: 8, avgCost: 221.3 },
    { ticker: 'COST', quantity: 2, avgCost: 905 },
    { ticker: 'NKE', quantity: 25, avgCost: 74.6 },
    { ticker: 'LLY', quantity: 1.5, avgCost: 790.2 },
  ],
};

export type Transaction = { id: string; side: 'buy' | 'sell'; ticker: string; quantity: number; price: number; fee: number; at: Date };
export const MY_TRANSACTIONS: Transaction[] = [
  { id: 't5', side: 'buy', ticker: 'LLY', quantity: 1.5, price: 790.2, fee: 0, at: daysFromNow(-4) },
  { id: 't4', side: 'sell', ticker: 'TSLA', quantity: 3, price: 431.6, fee: 0, at: daysFromNow(-11) },
  { id: 't3', side: 'buy', ticker: 'NKE', quantity: 25, price: 74.6, fee: 0, at: daysFromNow(-19) },
  { id: 't2', side: 'buy', ticker: 'TSLA', quantity: 3, price: 389.2, fee: 0, at: daysFromNow(-28) },
  { id: 't1', side: 'buy', ticker: 'COST', quantity: 2, price: 905, fee: 0, at: daysFromNow(-36) },
  { id: 't0', side: 'buy', ticker: 'NVDA', quantity: 12, price: 142.1, fee: 0, at: daysFromNow(-37) },
  { id: 't-1', side: 'buy', ticker: 'AAPL', quantity: 8, price: 221.3, fee: 0, at: daysFromNow(-37) },
];

/** Résumé de saison des autres joueurs (le mien est calculé en direct). */
export type Rival = {
  returnPct: number; predPoints: number; rankYesterday: number; sells: number; correct: number; total: number;
  streak: number; titles: TitleKey[]; badges: BadgeKey[]; topHoldings: { ticker: string; weight: number }[]; bestTrade: string;
};
export const RIVALS: Record<string, Rival> = {
  yanis: { returnPct: 9.4, predPoints: 40, rankYesterday: 2, sells: 4, correct: 5, total: 8, streak: 1, titles: ['buffett'], badges: ['first-order', 'podium', 'leader', 'diversified', 'five-right'], topHoldings: [{ ticker: 'MSFT', weight: 28 }, { ticker: 'AVGO', weight: 24 }, { ticker: 'JPM', weight: 18 }], bestTrade: 'AVGO +21,4 %' },
  lea: { returnPct: 4.1, predPoints: 80, rankYesterday: 1, sells: 2, correct: 7, total: 8, streak: 5, titles: ['oracle'], badges: ['first-order', 'podium', 'leader', 'streak-3', 'five-right', 'sure-3', 'early', 'champion'], topHoldings: [{ ticker: 'V', weight: 31 }, { ticker: 'KO', weight: 22 }, { ticker: 'WMT', weight: 20 }], bestTrade: 'WMT +8,2 %' },
  mehdi: { returnPct: 11.8, predPoints: -10, rankYesterday: 6, sells: 9, correct: 3, total: 8, streak: 0, titles: ['kamikaze'], badges: ['first-order', 'plus-10'], topHoldings: [{ ticker: 'TSLA', weight: 78 }, { ticker: 'AMD', weight: 15 }], bestTrade: 'AMD +34,9 %' },
  camille: { returnPct: 3.2, predPoints: 40, rankYesterday: 5, sells: 0, correct: 4, total: 7, streak: 2, titles: ['diamond'], badges: ['first-order', 'early'], topHoldings: [{ ticker: 'BRK.B', weight: 35 }, { ticker: 'PG', weight: 25 }, { ticker: 'JNJ', weight: 20 }], bestTrade: 'JNJ +6,1 %' },
  ines: { returnPct: -4.7, predPoints: 30, rankYesterday: 4, sells: 6, correct: 4, total: 8, streak: 0, titles: ['lanterne'], badges: ['first-order'], topHoldings: [{ ticker: 'NFLX', weight: 30 }, { ticker: 'LULU', weight: 26 }, { ticker: 'TGT', weight: 21 }], bestTrade: 'NFLX +3,4 %' },
};
export const MY_RANK_YESTERDAY = 3;
export const MY_SELLS = 1;

// --------------------------------------------------------------------------- résultats trimestriels
export type EarningsEvent = {
  id: string; ticker: string; date: string; timing: Timing; quarter: string; estimate: number; actual: number | null; lockAt: Date;
  /** Pronostics des autres joueurs (visibles seulement après verrouillage). */
  picks: Record<string, Choice>;
};
const ev = (id: string, ticker: string, bdays: number, timing: Timing, quarter: string, actual: number | null, picks: Record<string, Choice>, estimate = TICKER_MAP[ticker].eps): EarningsEvent => {
  const date = addBusinessDays(now, bdays);
  return { id, ticker, date, timing, quarter, estimate, actual, lockAt: lockTime(date, timing), picks };
};

export const EARNINGS: EarningsEvent[] = [
  // Résolus
  ev('e-ko', 'KO', -18, 'bmo', 'T3 2026', 0.82, { yanis: 'beat', lea: 'beat', mehdi: 'miss', camille: 'beat', ines: 'miss' }),
  ev('e-jpm', 'JPM', -15, 'bmo', 'T3 2026', 5.07, { yanis: 'beat', lea: 'beat', mehdi: 'beat', camille: 'beat', ines: 'beat' }),
  ev('e-nflx', 'NFLX', -11, 'amc', 'T3 2026', 7.12, { yanis: 'miss', lea: 'beat', mehdi: 'beat', camille: 'miss', ines: 'beat' }),
  ev('e-tsla', 'TSLA', -9, 'amc', 'T3 2026', 0.47, { yanis: 'miss', lea: 'miss', mehdi: 'beat', camille: 'beat', ines: 'beat' }),
  ev('e-meta', 'META', -7, 'amc', 'T3 2026', 7.25, { yanis: 'beat', lea: 'beat', mehdi: 'beat', camille: 'miss', ines: 'miss' }),
  ev('e-nke', 'NKE', -4, 'amc', 'T1 2027', 0.34, { yanis: 'miss', lea: 'beat', mehdi: 'beat', camille: 'beat', ines: 'miss' }),
  // Verrouillé, résultat attendu
  ev('e-dis', 'DIS', 0, 'bmo', 'T4 2026', null, { yanis: 'beat', lea: 'beat', mehdi: 'miss', camille: 'beat', ines: 'miss' }),
  // À venir
  ev('e-hd', 'HD', 1, 'bmo', 'T3 2026', null, {}),
  ev('e-nvda', 'NVDA', 2, 'amc', 'T3 2027', null, {}),
  ev('e-wmt', 'WMT', 3, 'bmo', 'T3 2027', null, {}),
  ev('e-tgt', 'TGT', 3, 'bmo', 'T3 2026', null, {}),
  ev('e-lulu', 'LULU', 7, 'amc', 'T3 2026', null, {}),
  ev('e-crm', 'CRM', 8, 'amc', 'T3 2027', null, {}),
  ev('e-cost', 'COST', 9, 'amc', 'T1 2027', null, {}),
  ev('e-adbe', 'ADBE', 10, 'amc', 'T4 2026', null, {}),
];
// Le verrouillage de Disney est passé (démo : on le force dans le passé quelle que soit l'heure).
EARNINGS.find((e) => e.id === 'e-dis')!.lockAt = new Date(now.getTime() - 3 * 3600000);

export type MyPick = { choice: Choice; confidence: Confidence; at: Date };
export const MY_PICKS: Record<string, MyPick> = {
  'e-ko': { choice: 'beat', confidence: 'normal', at: daysFromNow(-27) },
  'e-jpm': { choice: 'miss', confidence: 'normal', at: daysFromNow(-22) },
  'e-nflx': { choice: 'beat', confidence: 'normal', at: daysFromNow(-16) },
  'e-tsla': { choice: 'miss', confidence: 'normal', at: daysFromNow(-13) },
  'e-meta': { choice: 'beat', confidence: 'normal', at: daysFromNow(-10) },
  'e-nke': { choice: 'beat', confidence: 'sure', at: daysFromNow(-6) },
  'e-dis': { choice: 'beat', confidence: 'normal', at: daysFromNow(-1) },
  'e-hd': { choice: 'beat', confidence: 'normal', at: daysFromNow(-1) },
};

// --------------------------------------------------------------------------- fil d'activité
export type FeedItem = { id: string; at: Date; actor?: string; kind: 'buy' | 'sell' | 'predict' | 'result' | 'title' | 'badge' | 'rank'; text: string; ticker?: string; emoji?: EmojiName };
const h = (n: number) => new Date(now.getTime() - n * 3600000);
export const FEED: FeedItem[] = [
  { id: 'f1', at: h(1.2), actor: 'mehdi', kind: 'buy', ticker: 'TSLA', text: 'a acheté 4 actions Tesla' },
  { id: 'f2', at: h(2.6), actor: 'lea', kind: 'predict', ticker: 'NVDA', text: 'a pronostiqué que Nvidia battrait les attentes' },
  { id: 'f3', at: h(3), kind: 'result', ticker: 'DIS', text: 'Pronostics verrouillés pour Disney : 4 joueurs sur 6 voient un BPA au-dessus des attentes', emoji: 'locked' },
  { id: 'f4', at: h(7), actor: 'yanis', kind: 'rank', text: 'prend la tête du classement général', emoji: 'top-hat' },
  { id: 'f5', at: h(7.1), actor: 'ines', kind: 'title', text: 'hérite du titre « La lanterne rouge »', emoji: 'red-paper-lantern' },
  { id: 'f6', at: h(21), actor: 'camille', kind: 'badge', text: 'a débloqué le badge « Lève-tôt »', emoji: 'telescope' },
  { id: 'f7', at: h(26), actor: 'yanis', kind: 'sell', ticker: 'AVGO', text: 'a vendu 3 actions Broadcom (+21,4 %)' },
  { id: 'f8', at: h(80), kind: 'result', ticker: 'NKE', text: 'Nike a battu les attentes (0,34 $ contre 0,27 $) : 4 joueurs sur 6 avaient vu juste', emoji: 'bullseye' },
  { id: 'f9', at: h(96), actor: 'alex', kind: 'buy', ticker: 'LLY', text: 'as acheté 1,5 action Eli Lilly' },
  { id: 'f10', at: h(150), kind: 'result', ticker: 'META', text: 'Meta a battu les attentes (7,25 $ contre 6,84 $) : 4 joueurs sur 6 avaient vu juste', emoji: 'chart-increasing' },
];

// --------------------------------------------------------------------------- saison 1 terminée (récap)
export const RECAP_S1 = {
  podium: [
    { id: 'lea', points: 186, returnPct: 8.9, title: 'oracle' as TitleKey },
    { id: 'alex', points: 151, returnPct: 10.1, title: 'diamond' as TitleKey },
    { id: 'yanis', points: 122, returnPct: 7.2, title: 'buffett' as TitleKey },
  ],
  others: [
    { id: 'mehdi', points: 64, returnPct: 12.4, title: 'kamikaze' as TitleKey },
    { id: 'ines', points: 18, returnPct: -1.8, title: 'lanterne' as TitleKey },
  ],
  bestTrade: { player: 'mehdi', ticker: 'AMD', gainPct: 41.2, text: 'Acheté à 148,20 $, revendu à 209,30 $' },
  bestCall: { player: 'lea', ticker: 'NVDA', text: '« Sûr de moi » sur Nvidia : BPA 1,05 $ contre 0,94 $ attendu', points: 20 },
};

// --------------------------------------------------------------------------- historique simulé
/** Marche aléatoire déterministe qui finit exactement sur `end`. */
export function simulatedSeries(seed: string, points: number, start: number, end: number, vol = 0.012): number[] {
  let s = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) - 0.5;
  const raw = [start];
  for (let i = 1; i < points; i++) raw.push(raw[i - 1] * (1 + rnd() * vol * 2));
  const drift = (end - raw[points - 1]) / (points - 1);
  return raw.map((v, i) => Math.round((v + drift * i) * 100) / 100);
}
