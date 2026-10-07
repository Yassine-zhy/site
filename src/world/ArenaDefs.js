// Arènes des boss du monde : sol dallé aplani, enceinte, portail d'entrée tourné vers le chemin
// d'arrivée, et un thème propre à chaque seigneur (matières, flammes, décor, bannières).
//   r : rayon du sol de combat · floor : hauteur du sol · gate : angle du portail (atan2(dz, dx))
export const ARENAS = [
  {
    id: 'roi', boss: 'roi', x: -30, z: -478, r: 21, floor: 104, gate: 2.25,
    name: 'Le Trône du Silence', epithet: 'Seigneur déchu du Pic du Silence',
    theme: { stone: '#3d3648', stone2: '#2a2433', trim: '#8a7aa8', flame: '#b56bff', glow: '#c06bff', banner: '#3a1460', sigil: 'crown', props: 'royal' },
  },
  {
    id: 'colosse', boss: 'colosse', x: 1322, z: 40, r: 30, floor: 16, gate: Math.PI,
    name: 'Le Cirque d’Ambre', epithet: 'Gardien déchu des sables',
    theme: { stone: '#c99a5b', stone2: '#a8743e', trim: '#e9c27a', flame: '#ffa040', glow: '#ffb050', banner: '#7a2f0c', sigil: 'sun', props: 'amber' },
  },
  {
    id: 'reine', boss: 'reine', x: 72, z: -1274, r: 18, floor: 140, gate: 1.0,
    name: 'Le Palais de Givre', epithet: 'Souveraine des Cimes gelées',
    theme: { stone: '#c9dbe8', stone2: '#9fb6c8', trim: '#eaf6ff', flame: '#8fe8ff', glow: '#9fe0ff', banner: '#1d4f7a', sigil: 'flake', props: 'ice' },
  },
  {
    id: 'gardien', boss: 'gardien', x: 290, z: 1287, r: 19, floor: 96, gate: -1.31,
    name: 'Le Sanctuaire Sylvestre', epithet: 'Esprit ancien de la Canopée',
    theme: { stone: '#6f7f62', stone2: '#55644c', trim: '#a8c48a', flame: '#9dff7a', glow: '#7dff8a', banner: '#1f5a2a', sigil: 'leaf', props: 'grove' },
  },
  {
    id: 'fossoyeur', boss: 'fossoyeur', x: -1324, z: 337, r: 27, floor: 20, gate: -0.2,
    name: 'La Nécropole', epithet: 'Celui qui creuse pour les vivants',
    theme: { stone: '#77727e', stone2: '#5a5562', trim: '#b9b2c4', flame: '#7dffcf', glow: '#a98cff', banner: '#2c2140', sigil: 'skull', props: 'grave' },
  },
];

export const ARENA_OF = Object.fromEntries(ARENAS.map((a) => [a.boss, a]));

export function arenaAt(x, z, margin = 0) {
  for (const a of ARENAS) if (Math.hypot(x - a.x, z - a.z) < a.r + margin) return a;
  return null;
}
