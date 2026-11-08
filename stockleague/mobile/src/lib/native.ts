/** Pont vers l'appli Android (couleur de la barre d'état). Sans effet dans un navigateur. */
declare global {
  interface Window { StockLeagueApp?: { setBars: (color: string, darkIcons: boolean) => void } }
}

export function setSystemBars(color: string, darkIcons: boolean) {
  try { window.StockLeagueApp?.setBars(color, darkIcons); } catch { /* navigateur classique */ }
}

export const BAR_COLORS = {
  light: { bg: '#f4f2fb', board: '#5b2eff' },
  dark: { bg: '#0f0b1e', board: '#5b2eff' },
} as const;
