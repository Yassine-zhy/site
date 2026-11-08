import { useEffect } from 'react';
import { Avatar, CompanyLogo, Glyph, ScreenHeader, cx } from '../components/ui';
import { useNav, type Route } from '../state/nav';
import { useStore } from '../state/store';
import { useNotifications } from '../state/notifications';

/** Centre de notifications : ce qui s'est passé pendant ton absence. */
export function InboxScreen() {
  const { readNotifs, patch } = useStore();
  const { push } = useNav();
  const items = useNotifications();
  useEffect(() => {
    const t = setTimeout(() => patch({ readNotifs: [...new Set([...readNotifs, ...items.map((n) => n.id)])] }), 1200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pb-10">
      <ScreenHeader title="Notifications" />
      <ul>
        {items.map((n) => {
          const unread = !readNotifs.includes(n.id);
          return (
            <li key={n.id}>
              <button onClick={() => n.go && push(n.go as Route)} className={cx('press flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left', unread && 'bg-gold/[0.06]')}>
                {n.player ? <Avatar id={n.player} size={42} /> : n.ticker ? <CompanyLogo ticker={n.ticker} size={42} /> : <Glyph name={n.icon} size={34} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-snug"><b>{n.title}</b> {n.text}</span>
                  <span className="mt-0.5 block text-xs text-muted">{n.when}</span>
                </span>
                {unread ? <span className="mt-1.5 size-2 shrink-0 bg-gold" aria-label="Non lue" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
