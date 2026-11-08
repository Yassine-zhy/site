import { ChartLineUp, Crosshair, House, Trophy, UserCircle, type Icon } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { EARNINGS } from '../data/demo';
import { haptic } from '../lib/haptics';
import { useNav, type Tab } from '../state/nav';
import { useStore } from '../state/store';
import { cx } from './ui';

/** Chaque rubrique a sa couleur (repère visuel immédiat). */
export const TAB_COLORS: Record<Tab, string> = { accueil: 'var(--orange)', ligue: 'var(--violet)', portefeuille: 'var(--blue)', pronos: 'var(--pink)', profil: 'var(--mint)' };
const TABS: { id: Tab; label: string; icon: Icon }[] = [
  { id: 'accueil', label: 'Accueil', icon: House },
  { id: 'ligue', label: 'Ligue', icon: Trophy },
  { id: 'portefeuille', label: 'Portefeuille', icon: ChartLineUp },
  { id: 'pronos', label: 'Pronostics', icon: Crosshair },
  { id: 'profil', label: 'Profil', icon: UserCircle },
];

export function TabBar() {
  const { tab, setTab } = useNav();
  const { picks } = useStore();
  // Pastille : pronostics encore à faire (une tâche ouverte attire l'œil).
  const todo = EARNINGS.filter((e) => e.lockAt.getTime() > Date.now() && !picks[e.id]).length;
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--line),0_-8px_24px_-16px_rgb(76_45_180/0.35)]">
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
        {TABS.map(({ id, label, icon: I }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button onClick={() => { if (!active) { haptic('tap'); setTab(id); } }} aria-current={active ? 'page' : undefined} className={cx('relative flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-bold', active ? 'text-ink' : 'text-muted')}>
                <span className="relative grid h-9 w-14 place-items-center">
                  {active ? <motion.span layoutId="tab-blob" className="absolute inset-0 rounded-[12px]" style={{ background: TAB_COLORS[id], opacity: 0.16 }} transition={{ type: 'spring', stiffness: 500, damping: 36 }} /> : null}
                  <motion.span animate={active ? { scale: [1, 1.22, 1], y: [0, -3, 0] } : { scale: 1, y: 0 }} transition={{ duration: 0.38 }} className="relative">
                    <I size={25} weight={active ? 'fill' : 'bold'} color={active ? TAB_COLORS[id] : undefined} aria-hidden />
                  </motion.span>
                  {id === 'pronos' && todo ? <span className="absolute -top-0.5 right-1 grid h-[18px] min-w-[18px] place-items-center rounded-[6px] bg-loss px-1 text-[10px] font-extrabold text-white nums shadow-[0_2px_0_#c01d37]" aria-label={`${todo} à faire`}>{todo}</span> : null}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
