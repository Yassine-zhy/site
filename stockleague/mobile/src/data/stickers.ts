/**
 * Illustrations 3D (Microsoft Fluent Emoji 3D, licence MIT) : trophée, flamme, fusée…
 * Utilisées comme « autocollants » de jeu (titres, badges, missions, célébrations),
 * jamais comme icônes de navigation (celles-ci restent vectorielles).
 */
export const STICKERS = {
  trophy: 'Trophy', fire: 'Fire', crystal: 'Crystal ball', rocket: 'Rocket', gem: 'Gem stone', gift: 'Wrapped gift',
  moneybag: 'Money bag', chartup: 'Chart increasing', chartdown: 'Chart decreasing', crown: 'Crown',
  medal1: '1st place medal', medal2: '2nd place medal', medal3: '3rd place medal', target: 'Bullseye', party: 'Party popper',
  bolt: 'High voltage', swords: 'Crossed swords', bell: 'Bell', star: 'Glowing star', snow: 'Snowflake', megaphone: 'Megaphone',
  tophat: 'Top hat', lantern: 'Red paper lantern', handshake: 'Handshake', clap: 'Clapping hands*', muscle: 'Flexed biceps*',
  check: 'Check mark button', hourglass: 'Hourglass not done', calendar: 'Spiral calendar', flag: 'Chequered flag', bulb: 'Light bulb',
  eyes: 'Eyes', seedling: 'Seedling', brain: 'Brain', joy: 'Face with tears of joy', scream: 'Face screaming in fear',
  thinking: 'Thinking face', bags: 'Shopping bags', telescope: 'Telescope', sparkles: 'Sparkles', coin: 'Coin', bank: 'Bank',
  ticket: 'Ticket', lock: 'Locked', sun: 'Sun', moon: 'Crescent moon', envelope: 'Envelope with arrow', stopwatch: 'Stopwatch',
  frame: 'Framed picture', phone: 'Mobile phone', hundred: 'Hundred points', cross: 'Cross mark', wave: 'Waving hand*',
  cardindex: 'Card index', ab: 'Bar chart', joystick: 'Joystick', camera: 'Camera', id: 'Identification card',
} as const;
export type StickerName = keyof typeof STICKERS;
