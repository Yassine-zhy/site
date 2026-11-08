/** Graines des avatars illustrés (DiceBear Notionists, CC0). */
export const AVATAR_SEEDS = ['alex', 'yanis', 'lea', 'mehdi', 'camille', 'ines', 'hugo', 'sarah'] as const;
export type AvatarSeed = (typeof AVATAR_SEEDS)[number];
