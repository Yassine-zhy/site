/** Retour haptique léger (vibration) : confirme une action sans regarder l'écran. */
const PATTERNS = { tap: 8, success: [12, 40, 18], error: [30, 50, 30] } as const;
export function haptic(kind: keyof typeof PATTERNS) {
  try { navigator.vibrate?.(PATTERNS[kind] as number | number[]); } catch { /* non pris en charge */ }
}
