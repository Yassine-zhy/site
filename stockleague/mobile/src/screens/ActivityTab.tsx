import { Avatar, CompanyLogo, Emoji } from '../components/ui';
import { ME, PLAYER_MAP, type FeedItem } from '../data/demo';
import { formatRelative } from '../lib/format';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

const groupOf = (d: Date) => {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  return days <= 0 ? 'Aujourd’hui' : days === 1 ? 'Hier' : 'Plus tôt cette semaine';
};

export function ActivityTab() {
  const { feed } = useStore();
  const groups = new Map<string, FeedItem[]>();
  [...feed].sort((a, b) => b.at.getTime() - a.at.getTime()).forEach((f) => groups.set(groupOf(f.at), [...(groups.get(groupOf(f.at)) ?? []), f]));

  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28">
      <h1 className="display pt-2 text-[40px]">Activité</h1>
      <p className="mt-1 text-[13px] text-muted">Tout ce qui se passe dans la Ligue des Loups.</p>
      {[...groups.entries()].map(([label, items]) => (
        <section key={label} className="mt-6">
          <h2 className="mb-2 px-1 text-[13px] font-bold text-ink-2">{label}</h2>
          <ul className="overflow-hidden rounded-tile border border-line bg-card">
            {items.map((f) => <FeedRow key={f.id} f={f} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedRow({ f }: { f: FeedItem }) {
  const { push } = useNav();
  const actor = f.actor ? PLAYER_MAP[f.actor] : null;
  const open = () => (f.ticker ? push({ name: 'stock', ticker: f.ticker }) : f.actor && f.actor !== ME ? push({ name: 'player', id: f.actor }) : undefined);
  return (
    <li>
      <button onClick={open} className="press flex w-full items-start gap-3 border-b border-line px-3 py-3 text-left last:border-b-0">
        <span className="relative mt-0.5">
          {actor ? <Avatar id={actor.id} size={40} /> : f.ticker ? <CompanyLogo ticker={f.ticker} size={40} /> : <Emoji name="bell" size={40} />}
          {actor && f.ticker ? <CompanyLogo ticker={f.ticker} size={20} className="absolute -right-1.5 -bottom-1.5 shadow-card" /> : null}
          {actor && !f.ticker && f.emoji ? <Emoji name={f.emoji} size={20} className="absolute -right-1.5 -bottom-1.5" /> : null}
          {!actor && f.emoji ? <Emoji name={f.emoji} size={20} className="absolute -right-1.5 -bottom-1.5" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-snug">
            {actor ? <b>{actor.id === ME ? 'Tu' : actor.pseudo} </b> : null}
            {f.text}
          </span>
          <span className="mt-0.5 block text-xs text-muted">{formatRelative(f.at)}</span>
        </span>
      </button>
    </li>
  );
}
