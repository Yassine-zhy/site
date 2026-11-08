import type { GlyphName } from '../data/glyphs';
import { EARNINGS } from '../data/demo';
import { formatCountdown } from '../lib/format';
import type { Route } from './nav';
import { useStore } from './store';

export type Notif = { id: string; title: string; text: string; when: string; icon: GlyphName; player?: string; ticker?: string; go?: Route };

/** Notifications de la démo (dans la vraie appli : notifications push). */
export function useNotifications(): Notif[] {
  const { revealed, picks } = useStore();
  const next = EARNINGS.filter((e) => e.lockAt.getTime() > Date.now() && !picks[e.id]).sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime())[0];
  const list: Notif[] = [];
  if (!revealed['e-dis']) list.push({ id: 'n-dis', title: 'Disney a publié.', text: 'Ton pronostic est prêt à être révélé.', when: 'il y a 12 min', icon: 'bell', ticker: 'DIS', go: { name: 'reveal', eventId: 'e-dis' } });
  if (next) list.push({ id: `n-lock-${next.id}`, title: 'Dernière ligne droite.', text: `Le pronostic ${next.ticker} se verrouille dans ${formatCountdown(next.lockAt.getTime() - Date.now())}.`, when: 'il y a 40 min', icon: 'stopwatch', ticker: next.ticker, go: { name: 'swipe' } });
  list.push(
    { id: 'n-lea', title: 'Léa t’a chambré :', text: '« Profite de ta place, elle ne va pas durer. »', when: 'il y a 2 h', icon: 'megaphone', player: 'lea', go: { name: 'player', id: 'lea' } },
    { id: 'n-yanis', title: 'Yanis prend la tête', text: 'du classement général. Il a 17 pts d’avance sur toi.', when: 'il y a 7 h', icon: 'crown', player: 'yanis', go: { name: 'player', id: 'yanis' } },
    { id: 'n-pass', title: 'Passe de saison :', text: 'une récompense t’attend.', when: 'hier', icon: 'path', go: { name: 'pass' } },
    { id: 'n-story', title: 'Ta semaine est prête.', text: 'Rang, meilleur coup, pronostics : regarde ton récap.', when: 'hier', icon: 'cards', go: { name: 'story' } },
  );
  return list;
}
