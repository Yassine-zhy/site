/** Icônes Fluent Emoji Flat embarquées (vrais objets : trophée, boule de cristal, diamant…). */
export const EMOJI = [
  'top-hat', 'crystal-ball', 'gem-stone', 'rocket', 'red-paper-lantern', 'trophy', 'crown',
  '1st-place-medal', '2nd-place-medal', '3rd-place-medal', 'sports-medal', 'fire', 'bullseye',
  'handshake', 'money-bag', 'chart-increasing', 'chart-decreasing', 'party-popper', 'locked',
  'bell', 'sun', 'crescent-moon', 'sparkles', 'eyes', 'hourglass-not-done', 'spiral-calendar',
  'chequered-flag', 'seedling', 'brain', 'snail', 'scroll', 'envelope-with-arrow', 'stopwatch',
  'shopping-bags', 'receipt', 'thinking-face', 'flexed-biceps', 'ticket', 'telescope', 'bank',
  'face-with-tears-of-joy', 'clapping-hands', 'face-screaming-in-fear', 'crossed-swords', 'high-voltage',
  'glowing-star', 'check-mark-button', 'camera', 'waving-hand', 'light-bulb', 'wrapped-gift', 'star-struck',
  'mobile-phone', 'books', 'red-heart', 'hundred-points', 'rocket',
] as const;
export type EmojiName = (typeof EMOJI)[number];
