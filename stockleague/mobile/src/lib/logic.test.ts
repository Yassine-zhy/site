import { describe, expect, it } from 'vitest';
import { addBusinessDays, isMarketOpen, lockTime, nyDateTime } from './market-time';
import { outcomeOf, portfolioPoints, predictionPoints, streakBonuses } from './scoring';
import { executeOrder } from './trading';

const base = { cash: 1000, holdings: [{ ticker: 'NKE', quantity: 10, avgCost: 70 }] };

describe('achat / vente', () => {
  it('achète en fractionné et recalcule le prix moyen', () => {
    const r = executeOrder(base, { side: 'buy', ticker: 'NKE', quantity: 2.5, price: 60, fee: 1 });
    expect(r.ok && r.portfolio.cash).toBe(849);
    expect(r.ok && r.portfolio.holdings[0]).toEqual({ ticker: 'NKE', quantity: 12.5, avgCost: 68 });
  });
  it('refuse un achat sans cash suffisant', () => {
    const r = executeOrder(base, { side: 'buy', ticker: 'AAPL', quantity: 5, price: 238, fee: 0 });
    expect(r.ok).toBe(false);
  });
  it('refuse plus de 2 décimales et les quantités nulles', () => {
    expect(executeOrder(base, { side: 'buy', ticker: 'F', quantity: 1.234, price: 12, fee: 0 }).ok).toBe(false);
    expect(executeOrder(base, { side: 'buy', ticker: 'F', quantity: 0, price: 12, fee: 0 }).ok).toBe(false);
  });
  it('vend et supprime la ligne vidée', () => {
    const r = executeOrder(base, { side: 'sell', ticker: 'NKE', quantity: 10, price: 72, fee: 0 });
    expect(r.ok && r.portfolio).toEqual({ cash: 1720, holdings: [] });
  });
  it('interdit la vente à découvert', () => {
    expect(executeOrder(base, { side: 'sell', ticker: 'NKE', quantity: 10.01, price: 72, fee: 0 }).ok).toBe(false);
    expect(executeOrder(base, { side: 'sell', ticker: 'AAPL', quantity: 1, price: 238, fee: 0 }).ok).toBe(false);
  });
});

describe('points', () => {
  it('applique le barème', () => {
    expect(predictionPoints('correct', 'normal')).toBe(10);
    expect(predictionPoints('correct', 'sure')).toBe(20);
    expect(predictionPoints('wrong', 'sure')).toBe(-10);
    expect(predictionPoints('wrong', 'normal')).toBe(0);
    expect(predictionPoints('void', 'sure')).toBe(0);
  });
  it('résout les prédictions, égalité = annulée', () => {
    expect(outcomeOf('beat', 1.5, 1.6)).toBe('correct');
    expect(outcomeOf('beat', 1.5, 1.4)).toBe('wrong');
    expect(outcomeOf('miss', 1.5, 1.5)).toBe('void');
    expect(outcomeOf('miss', 1.5, null)).toBe('pending');
  });
  it('calcule les séries', () => {
    expect(streakBonuses(['correct', 'correct', 'correct', 'correct', 'correct']).bonuses).toEqual([0, 0, 0, 5, 5]);
    expect(streakBonuses(['correct', 'correct', 'void', 'correct', 'correct']).bonuses).toEqual([0, 0, 0, 0, 5]);
    expect(streakBonuses(['correct', 'correct', 'correct', 'wrong', 'correct']).current).toBe(1);
  });
  it('points de portefeuille', () => {
    expect(portfolioPoints(7.3)).toBe(73);
    expect(portfolioPoints(-4.66)).toBe(-47);
  });
});

describe('heures de marché et verrouillage', () => {
  it('9 h 30 à New York en hiver = 14 h 30 UTC, en été = 13 h 30 UTC', () => {
    expect(nyDateTime('2026-11-10', 9, 30).toISOString()).toBe('2026-11-10T14:30:00.000Z');
    expect(nyDateTime('2026-07-10', 9, 30).toISOString()).toBe('2026-07-10T13:30:00.000Z');
  });
  it('verrouille avant ouverture à 9 h 30 et après clôture à 16 h', () => {
    expect(lockTime('2026-11-10', 'bmo').toISOString()).toBe('2026-11-10T14:30:00.000Z');
    expect(lockTime('2026-11-10', 'amc').toISOString()).toBe('2026-11-10T21:00:00.000Z');
    expect(lockTime('2026-11-10', 'unknown').toISOString()).toBe('2026-11-10T14:30:00.000Z');
  });
  it('sait si le marché est ouvert', () => {
    expect(isMarketOpen(new Date('2026-11-10T15:00:00Z'))).toBe(true);
    expect(isMarketOpen(new Date('2026-11-10T21:30:00Z'))).toBe(false);
    expect(isMarketOpen(new Date('2026-11-08T15:00:00Z'))).toBe(false); // dimanche
  });
  it('saute les week-ends', () => {
    expect(addBusinessDays(new Date('2026-11-06T12:00:00Z'), 1)).toBe('2026-11-09');
  });
});

import { levelOf, nextVisitStreak, xpForLevel } from './xp';
describe('progression', () => {
  it('calcule les niveaux', () => {
    expect(xpForLevel(2)).toBe(100);
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(540)).toMatchObject({ level: 3, toNext: 60 });
  });
  it('fait vivre la série de jours', () => {
    expect(nextVisitStreak('2026-11-07', 5, '2026-11-08', '2026-11-07')).toEqual({ streak: 6, isNewDay: true });
    expect(nextVisitStreak('2026-11-08', 6, '2026-11-08', '2026-11-07')).toEqual({ streak: 6, isNewDay: false });
    expect(nextVisitStreak('2026-11-01', 6, '2026-11-08', '2026-11-07')).toEqual({ streak: 1, isNewDay: true });
  });
});
