/**
 * Heures de la bourse de New York (NYSE / Nasdaq), indépendantes du fuseau du téléphone.
 * Ouverture 9 h 30, clôture 16 h, heure de New York, du lundi au vendredi.
 */
const NY = 'America/New_York';

/** Décalage (en minutes) de New York par rapport à UTC à un instant donné (-300 l'hiver, -240 l'été). */
export function nyOffsetMinutes(at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: NY, timeZoneName: 'shortOffset' })
    .formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const m = part.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!m) return -300;
  const h = Number(m[1]);
  return h * 60 + Math.sign(h) * Number(m[2] ?? 0);
}

/** Date "YYYY-MM-DD" + heure de New York → instant exact (gère le changement d'heure). */
export function nyDateTime(ymd: string, hour: number, minute = 0): Date {
  const [y, mo, d] = ymd.split('-').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, hour, minute));
  const offset = nyOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000);
}

/** Composantes de l'instant à New York. */
export function nyParts(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: NY, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { ymd: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday as string, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function isMarketOpen(at = new Date()): boolean {
  const { weekday, minutes } = nyParts(at);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export type Timing = 'bmo' | 'amc' | 'unknown';

/**
 * Heure de verrouillage d'un pronostic :
 *  avant ouverture (bmo) ou inconnu → 9 h 30 le jour de publication ;
 *  après clôture (amc) → 16 h.
 */
export function lockTime(reportYmd: string, timing: Timing): Date {
  return timing === 'amc' ? nyDateTime(reportYmd, 16, 0) : nyDateTime(reportYmd, 9, 30);
}

/** Ajoute n jours ouvrés (lundi-vendredi) à une date, renvoie "YYYY-MM-DD". */
export function addBusinessDays(from: Date, n: number): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const step = n >= 0 ? 1 : -1;
  let left = Math.abs(n);
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + step);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d.toISOString().slice(0, 10);
}
