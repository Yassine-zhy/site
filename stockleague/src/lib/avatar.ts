/** Avatar par défaut : initiales du pseudo sur une couleur stable (même pseudo = même couleur). */
export function initialsOf(pseudo: string): string {
  const words = pseudo.trim().split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toLocaleUpperCase("fr-FR");
}

/** Palette sobre, lisible en clair comme en sombre (texte blanc, contraste ≥ 4,5:1). */
export const AVATAR_COLORS = ["#1D4E89", "#7A3E9D", "#0F6E5C", "#9C4221", "#2F5D50", "#8A2846", "#4A4E8C", "#5B5F1E"] as const;

export function avatarColorOf(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
