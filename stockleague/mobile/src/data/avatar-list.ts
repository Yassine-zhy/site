/**
 * Portraits des joueurs de la démo (photos Unsplash, licence Unsplash : usage libre).
 * Dans la vraie appli, chaque joueur importe sa propre photo.
 */
export const PORTRAITS = {
  alex: '1507003211169-0a1dd7228f2d',
  yanis: '1500648767791-00dcc994a43e',
  lea: '1494790108377-be9c29b29330',
  mehdi: '1506794778202-cad84cf45f1d',
  camille: '1438761681033-6461ffad8d80',
  ines: '1544005313-94ddf0286df2',
  hugo: '1539571696357-5a69c17a67c6',
  sarah: '1534528741775-53994a69daeb',
} as const;
export type AvatarSeed = keyof typeof PORTRAITS;
