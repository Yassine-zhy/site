/**
 * Règles d'achat / vente (miroir de la future fonction Postgres atomique).
 * Ordres au marché, actions fractionnées à 2 décimales, pas de découvert ni de levier.
 */
export type Holding = { ticker: string; quantity: number; avgCost: number };
export type Portfolio = { cash: number; holdings: Holding[] };
export type Order = { side: 'buy' | 'sell'; ticker: string; quantity: number; price: number; fee: number };
export type TradeResult = { ok: true; portfolio: Portfolio; total: number } | { ok: false; error: string };

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
export const roundQty = (q: number) => Math.floor(q * 100 + 1e-9) / 100;

export function orderTotal(o: Pick<Order, 'quantity' | 'price'>): number {
  return round(o.quantity * o.price, 2);
}

export function executeOrder(p: Portfolio, o: Order): TradeResult {
  const quantity = round(o.quantity, 2);
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Indique une quantité supérieure à 0.' };
  if (Math.abs(quantity - o.quantity) > 1e-9) return { ok: false, error: 'Deux décimales maximum pour la quantité.' };
  if (!(o.price > 0)) return { ok: false, error: 'Cours indisponible pour le moment. Réessaie dans un instant.' };

  const gross = orderTotal({ quantity, price: o.price });
  const existing = p.holdings.find((h) => h.ticker === o.ticker);

  if (o.side === 'buy') {
    const cost = round(gross + o.fee, 2);
    if (cost > p.cash + 1e-9) return { ok: false, error: `Cash insuffisant : il te manque ${(cost - p.cash).toFixed(2).replace('.', ',')} $.` };
    const q = round((existing?.quantity ?? 0) + quantity, 2);
    const avg = round(((existing?.quantity ?? 0) * (existing?.avgCost ?? 0) + gross) / q, 4);
    const holdings = existing
      ? p.holdings.map((h) => (h.ticker === o.ticker ? { ...h, quantity: q, avgCost: avg } : h))
      : [...p.holdings, { ticker: o.ticker, quantity: q, avgCost: avg }];
    return { ok: true, total: cost, portfolio: { cash: round(p.cash - cost, 2), holdings } };
  }

  if (!existing || existing.quantity + 1e-9 < quantity) {
    return { ok: false, error: `Tu ne peux pas vendre plus que ce que tu possèdes (${(existing?.quantity ?? 0).toString().replace('.', ',')}).` };
  }
  const proceeds = round(gross - o.fee, 2);
  if (proceeds < 0) return { ok: false, error: 'Les frais dépassent le montant de la vente.' };
  const left = round(existing.quantity - quantity, 2);
  const holdings = left === 0 ? p.holdings.filter((h) => h.ticker !== o.ticker) : p.holdings.map((h) => (h.ticker === o.ticker ? { ...h, quantity: left } : h));
  return { ok: true, total: proceeds, portfolio: { cash: round(p.cash + proceeds, 2), holdings } };
}

/** Valeur totale du portefeuille au cours actuel. */
export function portfolioValue(p: Portfolio, priceOf: (t: string) => number): number {
  return round(p.cash + p.holdings.reduce((s, h) => s + h.quantity * priceOf(h.ticker), 0), 2);
}
