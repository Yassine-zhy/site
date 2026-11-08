import { ChartLineUp, Crosshair, Pulse, Trophy, UserCircle, type Icon } from '@phosphor-icons/react';
import { useNav, type Tab } from '../state/nav';
import { cx } from './ui';

const TABS: { id: Tab; label: string; icon: Icon }[] = [
  { id: 'ligue', label: 'Ligue', icon: Trophy },
  { id: 'portefeuille', label: 'Portefeuille', icon: ChartLineUp },
  { id: 'pronos', label: 'Pronostics', icon: Crosshair },
  { id: 'activite', label: 'Activité', icon: Pulse },
  { id: 'profil', label: 'Profil', icon: UserCircle },
];

export function TabBar() {
  const { tab, setTab } = useNav();
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ id, label, icon: I }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button onClick={() => setTab(id)} aria-current={active ? 'page' : undefined} className={cx('relative flex w-full flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-semibold', active ? 'text-ink' : 'text-muted')}>
                {active ? <span className="absolute top-0 h-[3px] w-8 rounded-b-sm bg-gold" aria-hidden /> : null}
                <I size={25} weight={active ? 'fill' : 'regular'} aria-hidden />
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
