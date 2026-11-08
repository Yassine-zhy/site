/**
 * Pictogrammes : une seule famille vectorielle (Phosphor, licence MIT), en deux tons,
 * avec une couleur par sens. Pas d'émoji : rendu net, cohérent, adapté au thème.
 */
import {
  Anchor, Bank, Barbell, Bell, Books, Brain, CalendarDots, Camera, ChartLineDown, ChartLineUp, CheckCircle, Coins,
  Confetti, Crown, Diamond, DeviceMobile, EnvelopeSimple, Eye, Eyes, Fire, FlagCheckered, Gift, HandWaving,
  HandsClapping, Handshake, Heart, Hourglass, Lightbulb, Lightning, Lock, Medal, MinusCircle, Moon, Plant, Receipt,
  Rocket, Scroll, Seal, ShoppingBag, Smiley, SmileyNervous, SmileyWink, Sparkle, Star, Sun, Sword, Target,
  Binoculars, Ticket, Snowflake, Megaphone, Cards, FrameCorners, HandSwipeRight, Path, ChatCircleText, ShieldCheck, Palette, IdentificationBadge, Timer, Trophy, XCircle, type Icon,
} from '@phosphor-icons/react';
import type { GlyphName } from '../data/glyphs';
import type { StickerName } from '../data/stickers';

const GOLD = '#F2B705', SILVER = '#B7C2D0', BRONZE = '#C98A5A', RED = '#FF5A4E', ORANGE = '#FF8A3D', BLUE = '#5B9BFF',
  PURPLE = '#A78BFA', CYAN = '#4FD1E8', GREEN = 'var(--gain)', LOSS = 'var(--loss)', INK = 'currentColor';

export const GLYPH: Record<GlyphName, [Icon, string]> = {
  'top-hat': [Crown, GOLD], 'crystal-ball': [Eye, PURPLE], 'gem-stone': [Diamond, CYAN], rocket: [Rocket, ORANGE],
  'red-paper-lantern': [Anchor, RED], trophy: [Trophy, GOLD], crown: [Crown, GOLD],
  '1st-place-medal': [Medal, GOLD], '2nd-place-medal': [Medal, SILVER], '3rd-place-medal': [Medal, BRONZE], 'sports-medal': [Medal, GOLD],
  fire: [Fire, ORANGE], bullseye: [Target, RED], handshake: [Handshake, BLUE], 'money-bag': [Coins, GOLD],
  'chart-increasing': [ChartLineUp, GREEN], 'chart-decreasing': [ChartLineDown, LOSS], 'party-popper': [Confetti, GOLD],
  locked: [Lock, INK], bell: [Bell, GOLD], sun: [Sun, GOLD], 'crescent-moon': [Moon, BLUE], sparkles: [Sparkle, GOLD],
  eyes: [Eyes, INK], 'hourglass-not-done': [Hourglass, GOLD], 'spiral-calendar': [CalendarDots, BLUE],
  'chequered-flag': [FlagCheckered, INK], seedling: [Plant, GREEN], brain: [Brain, PURPLE], snail: [XCircle, LOSS],
  scroll: [Scroll, INK], 'envelope-with-arrow': [EnvelopeSimple, GOLD], stopwatch: [Timer, INK], 'shopping-bags': [ShoppingBag, BLUE],
  receipt: [Receipt, INK], 'thinking-face': [MinusCircle, INK], 'flexed-biceps': [Barbell, ORANGE], ticket: [Ticket, GOLD],
  telescope: [Binoculars, BLUE], bank: [Bank, INK], 'face-with-tears-of-joy': [SmileyWink, GOLD], 'clapping-hands': [HandsClapping, GOLD],
  'face-screaming-in-fear': [SmileyNervous, RED], 'crossed-swords': [Sword, RED], 'high-voltage': [Lightning, GOLD],
  'glowing-star': [Star, GOLD], 'check-mark-button': [CheckCircle, GREEN], camera: [Camera, INK], 'waving-hand': [HandWaving, GOLD],
  'light-bulb': [Lightbulb, GOLD], 'wrapped-gift': [Gift, GOLD], 'star-struck': [Smiley, GOLD], 'mobile-phone': [DeviceMobile, INK],
  books: [Books, INK], 'red-heart': [Heart, RED], 'hundred-points': [Seal, GOLD],
  snowflake: [Snowflake, CYAN], megaphone: [Megaphone, ORANGE], cards: [Cards, BLUE], frame: [FrameCorners, GOLD],
  swipe: [HandSwipeRight, GOLD], path: [Path, GOLD], chat: [ChatCircleText, BLUE], shield: [ShieldCheck, GREEN],
  palette: [Palette, PURPLE], 'id-card': [IdentificationBadge, GOLD],
};

/** Illustration 3D associée à chaque pictogramme (utilisée à partir de 22 px). */
const STICKER_OF: Partial<Record<GlyphName, StickerName>> = {
  'top-hat': 'tophat', 'crystal-ball': 'crystal', 'gem-stone': 'gem', rocket: 'rocket', 'red-paper-lantern': 'lantern', trophy: 'trophy',
  crown: 'crown', '1st-place-medal': 'medal1', '2nd-place-medal': 'medal2', '3rd-place-medal': 'medal3', 'sports-medal': 'medal1',
  fire: 'fire', bullseye: 'target', handshake: 'handshake', 'money-bag': 'moneybag', 'chart-increasing': 'chartup',
  'chart-decreasing': 'chartdown', 'party-popper': 'party', locked: 'lock', bell: 'bell', sun: 'sun', 'crescent-moon': 'moon',
  sparkles: 'sparkles', eyes: 'eyes', 'hourglass-not-done': 'hourglass', 'spiral-calendar': 'calendar', 'chequered-flag': 'flag',
  seedling: 'seedling', brain: 'brain', snail: 'cross', 'envelope-with-arrow': 'envelope', stopwatch: 'stopwatch',
  'shopping-bags': 'bags', receipt: 'cardindex', 'thinking-face': 'thinking', 'flexed-biceps': 'muscle', ticket: 'ticket',
  telescope: 'telescope', bank: 'bank', 'face-with-tears-of-joy': 'joy', 'clapping-hands': 'clap', 'face-screaming-in-fear': 'scream',
  'crossed-swords': 'swords', 'high-voltage': 'bolt', 'glowing-star': 'star', 'check-mark-button': 'check', camera: 'camera',
  'waving-hand': 'wave', 'light-bulb': 'bulb', 'wrapped-gift': 'gift', 'star-struck': 'star', 'mobile-phone': 'phone',
  'hundred-points': 'hundred', snowflake: 'snow', megaphone: 'megaphone', cards: 'ab', frame: 'frame', swipe: 'joystick',
  path: 'trophy', 'id-card': 'id', palette: 'sparkles', shield: 'check', chat: 'megaphone',
};
const base = (p: string) => `${import.meta.env.BASE_URL}${p}`;

/** Illustration 3D seule (autocollant). */
export function Sticker({ name, size = 48, className, gray }: { name: StickerName; size?: number; className?: string; gray?: boolean }) {
  return <img src={base(`3d/${name}.png`)} width={size} height={size} alt="" aria-hidden draggable={false} decoding="async" className={`shrink-0 select-none ${gray ? 'opacity-40 grayscale' : ''} ${className ?? ''}`} />;
}

/**
 * Pictogramme : illustration 3D à partir de 22 px (rendu « jeu »),
 * icône vectorielle Phosphor en dessous ou si `vector` est demandé.
 */
export function Glyph({ name, size = 24, className, label, color, weight = 'duotone', vector }: { name: GlyphName; size?: number; className?: string; label?: string; color?: string; weight?: 'duotone' | 'fill' | 'bold' | 'regular'; vector?: boolean }) {
  const sticker = STICKER_OF[name];
  if (sticker && size >= 22 && !vector && !color) {
    return <img src={base(`3d/${sticker}.png`)} width={size} height={size} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} decoding="async" className={`inline-block shrink-0 select-none ${className ?? ''}`} />;
  }
  const [I, c] = GLYPH[name];
  return <I size={size} weight={weight} color={color ?? c} className={className ? `shrink-0 ${className}` : 'shrink-0'} aria-label={label} aria-hidden={label ? undefined : true} />;
}

const TIERS = {
  gold: 'linear-gradient(145deg,#FFE27A,#FFB21E)', silver: 'linear-gradient(145deg,#EEF1F8,#C3CADB)', bronze: 'linear-gradient(145deg,#FFD2A8,#E58A4E)',
  ink: 'linear-gradient(145deg,#8B6CFF,#5B2EFF)', locked: 'linear-gradient(145deg,#ECEAF3,#DAD6E6)',
} as const;
export type Tier = keyof typeof TIERS;

/** Tuile de badge / titre : illustration 3D sur un fond coloré en relief. */
export function Medallion({ name, tier = 'ink', size = 48, className }: { name: GlyphName; tier?: Tier; size?: number; className?: string }) {
  const sticker = STICKER_OF[name] ?? 'star';
  return (
    <span className={`relative grid shrink-0 place-items-center ${className ?? ''}`} style={{ width: size * 1.15, height: size * 1.15, borderRadius: size * 0.34, background: TIERS[tier], boxShadow: tier === 'locked' ? 'inset 0 -3px 0 rgb(0 0 0 / 0.06)' : 'inset 0 -4px 0 rgb(0 0 0 / 0.14), 0 6px 14px -8px rgb(91 46 255 / 0.5)' }}>
      <Sticker name={sticker} size={size * 0.82} gray={tier === 'locked'} />
    </span>
  );
}
