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

export function Glyph({ name, size = 24, className, label, color, weight = 'duotone' }: { name: GlyphName; size?: number; className?: string; label?: string; color?: string; weight?: 'duotone' | 'fill' | 'bold' | 'regular' }) {
  const [I, c] = GLYPH[name];
  return <I size={size} weight={weight} color={color ?? c} className={className ? `shrink-0 ${className}` : 'shrink-0'} aria-label={label} aria-hidden={label ? undefined : true} />;
}

const TIERS = {
  gold: ['#FFE08A', '#F2B705', '#B07F00'], silver: ['#F1F4F8', '#B7C2D0', '#7D8899'], bronze: ['#F2C29B', '#C98A5A', '#8A5530'],
  ink: ['#2B3647', '#1A2230', '#0E141D'], locked: ['#3A4252', '#2A303C', '#1C212A'],
} as const;
export type Tier = keyof typeof TIERS;

/** Médaillon hexagonal (titres, badges) : métal + pictogramme, angles nets. */
export function Medallion({ name, tier = 'ink', size = 48, className }: { name: GlyphName; tier?: Tier; size?: number; className?: string }) {
  const [I, c] = GLYPH[name];
  const [hi, mid, lo] = TIERS[tier];
  const metal = tier === 'gold' || tier === 'silver' || tier === 'bronze';
  return (
    <span className={`relative grid shrink-0 place-items-center ${className ?? ''}`} style={{ width: size, height: size * 1.1, clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)', background: `linear-gradient(160deg, ${hi} 0%, ${mid} 48%, ${lo} 100%)` }}>
      <span className="absolute inset-[2px] grid place-items-center" style={{ clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)', background: metal ? `linear-gradient(160deg, ${mid}, ${lo})` : `linear-gradient(160deg, ${mid}, ${lo})` }}>
        <I size={size * 0.5} weight="fill" color={metal ? '#0B0F16' : tier === 'locked' ? '#5A6475' : c === 'currentColor' ? '#E9EEF5' : c} />
      </span>
    </span>
  );
}
