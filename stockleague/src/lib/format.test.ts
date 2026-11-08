import { describe, expect, it } from "vitest";
import { formatDate, formatPoints, formatQuantity, formatSignedPercent, formatSignedUSD, formatUSD, toNumber, trendOf } from "./format";

// Intl utilise des espaces insécables fines (U+202F / U+00A0) : on les normalise pour comparer.
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("formats français", () => {
  it("formate les dollars", () => {
    expect(n(formatUSD(1234.56))).toBe("1 234,56 $");
    expect(n(formatUSD("10000"))).toBe("10 000,00 $");
  });
  it("affiche toujours le signe des gains et pertes", () => {
    expect(n(formatSignedUSD(1234.5))).toBe("+1 234,50 $");
    expect(n(formatSignedUSD(-12.3))).toBe("-12,30 $");
    expect(n(formatSignedUSD(0))).toBe("0,00 $");
  });
  it("formate les pourcentages", () => {
    expect(n(formatSignedPercent(7.3))).toBe("+7,30 %");
    expect(n(formatSignedPercent("-2.456"))).toBe("-2,46 %");
  });
  it("formate quantités et points", () => {
    expect(formatQuantity(12.5)).toBe("12,5");
    expect(formatPoints(73)).toBe("+73 pts");
    expect(formatPoints(-10)).toBe("-10 pts");
  });
  it("formate les dates sans décalage de fuseau", () => {
    expect(formatDate("2026-11-08")).toBe("08/11/2026");
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
  });
  it("normalise les valeurs numériques", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber("abc")).toBe(0);
    expect(trendOf("-0.01")).toBe("down");
    expect(trendOf(0)).toBe("flat");
  });
});
