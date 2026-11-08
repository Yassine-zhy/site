import { Avatar, CompanyLogo, Glyph, ScreenHeader, cx } from '../components/ui';
import { ME, REACTION_COUNTS, type FeedItem } from '../data/demo';
import type { GlyphName } from '../data/glyphs';
import { formatRelative } from '../lib/format';
import { useNav } from '../state/nav';
import { useName, useStore, type Reaction } from '../state/store';

const REACTIONS: { key: Reaction; emoji: GlyphName; label: string }[] = [
  { key: 'fire', emoji: 'fire', label: 'En feu' },
  { key: 'clap', emoji: 'clapping-hands', label: 'Bravo' },
  { key: 'laugh', emoji: 'face-with-tears-of-joy', label: 'Mort de rire' },
  { key: 'shock', emoji: 'face-screaming-in-fear', label: 'Aïe' },
];

const groupOf = (d: Date) => {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  return days <= 0 ? 'Aujourd’hui' : days === 1 ? 'Hier' : 'Plus tôt cette semaine';
};

export function ActivityScreen() {
  const { feed } = useStore();
  const groups = new Map<string, FeedItem[]>();
  [...feed].sort((a, b) => b.at.getTime() - a.at.getTime()).forEach((f) => groups.set(groupOf(f.at), [...(groups.get(groupOf(f.at)) ?? []), f]));
  return (
    <div className="pb-10">
      <ScreenHeader title="Activité de la ligue" />
      <p className="px-5 pt-4 text-[13px] text-muted">Réagis aux coups de tes amis : ils le voient.</p>
      <div className="px-4">
        {[...groups.entries()].map(([label, items]) => (
          <section key={label} className="mt-5">
            <h2 className="mb-2 px-1 text-[13px] font-bold text-ink-2">{label}</h2>
            <ul className="overflow-hidden rounded-[20px] bg-card shadow-card">{items.map((f) => <FeedRow key={f.id} f={f} />)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function FeedRow({ f }: { f: FeedItem }) {
  const { push } = useNav();
  const { reactions, react } = useStore();
  const name = useName();
  const mine = reactions[f.id];
  const open = () => (f.ticker ? push({ name: 'stock', ticker: f.ticker }) : f.actor && f.actor !== ME ? push({ name: 'player', id: f.actor }) : undefined);
  const counts = REACTION_COUNTS[f.id] ?? {};
  const canReact = f.actor !== ME;

  return (
    <li className="border-b border-line last:border-b-0">
      <button onClick={open} className="press flex w-full items-start gap-3 px-3 pt-3 pb-2 text-left">
        <span className="relative mt-0.5">
          {f.actor ? <Avatar id={f.actor} size={40} /> : f.ticker ? <CompanyLogo ticker={f.ticker} size={40} /> : <Glyph name="bell" size={40} />}
          {f.actor && f.ticker ? <CompanyLogo ticker={f.ticker} size={20} className="absolute -right-1.5 -bottom-1.5 shadow-card" /> : null}
          {(!f.ticker || !f.actor) && f.emoji ? <Glyph name={f.emoji} size={20} className="absolute -right-1.5 -bottom-1.5" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-snug">
            {f.actor ? <b>{f.actor === ME ? 'Tu' : name(f.actor)} </b> : null}
            {f.text}
          </span>
          <span className="mt-0.5 block text-xs text-muted">{formatRelative(f.at)}</span>
        </span>
      </button>
      {canReact ? (
        <div className="flex gap-1.5 px-3 pb-2.5 pl-[64px]">
          {REACTIONS.map((r) => {
            const n = (counts[r.key] ?? 0) + (mine === r.key ? 1 : 0);
            const active = mine === r.key;
            if (!n && !active && mine) return null;
            return (
              <button
                key={r.key}
                onClick={() => react(f.id, r.key)}
                aria-pressed={active}
                aria-label={`${r.label}${n ? ` (${n})` : ''}`}
                className={cx('press flex h-7 items-center gap-1 rounded-[14px] border px-1.5 text-xs font-bold nums', active ? 'border-gold bg-gold/15' : 'border-line bg-card-2', !n && 'opacity-70')}
              >
                <Glyph name={r.emoji} size={15} className={active ? 'anim-pop' : ''} />
                {n ? n : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}
