/** Pont vers l'appli Android (couleur de la barre d'état). Sans effet dans un navigateur. */
declare global {
  interface Window { StockLeagueApp?: { setBars: (color: string, darkIcons: boolean) => void } }
}

export function setSystemBars(color: string, darkIcons: boolean) {
  try { window.StockLeagueApp?.setBars(color, darkIcons); } catch { /* navigateur classique */ }
}

export const BAR_COLORS = {
  light: { bg: '#eef1f5', board: '#0b1a30' },
  dark: { bg: '#08121f', board: '#13233b' },
} as const;
