import { ChartLineUp, Crosshair, House, Trophy, UserCircle, type Icon } from '@phosphor-icons/react';
import { EARNINGS } from '../data/demo';
import { useStore } from '../state/store';
import { useNav, type Tab } from '../state/nav';
import { cx } from './ui';

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
  // Pastille : pronostics encore à faire (effet Zeigarnik : une tâche ouverte attire l'œil).
  const todo = EARNINGS.filter((e) => e.lockAt.getTime() > Date.now() && !picks[e.id]).length;
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ id, label, icon: I }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button onClick={() => setTab(id)} aria-current={active ? 'page' : undefined} className={cx('relative flex w-full flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-semibold', active ? 'text-ink' : 'text-muted')}>
                {active ? <span className="absolute top-0 h-[3px] w-8 rounded-b-sm bg-gold" aria-hidden /> : null}
                <span className="relative">
                  <I size={25} weight={active ? 'fill' : 'regular'} aria-hidden />
                  {id === 'pronos' && todo ? <span className="absolute -top-1 -right-2.5 grid h-4 min-w-4 place-items-center rounded-[5px] bg-loss px-1 text-[10px] font-bold text-white nums" aria-label={`${todo} à faire`}>{todo}</span> : null}
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
