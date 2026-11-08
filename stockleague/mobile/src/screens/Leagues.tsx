import { CaretRight, Key, Plus } from '@phosphor-icons/react';
import { Avatar, Button, Glyph, ScreenHeader, Tag } from '../components/ui';
import { LEAGUES, PLAYER_MAP, type LeagueSummary } from '../data/demo';
import { formatDate, formatUSD } from '../lib/format';
import { useNav } from '../state/nav';

const STATUS = {
  active: { label: 'En cours', tone: 'gold' as const },
  draft: { label: 'Pas commencée', tone: 'neutral' as const },
  finished: { label: 'Terminée', tone: 'board' as const },
};

export function LeaguesScreen() {
  const { push, reset } = useNav();
  const open = (l: LeagueSummary) => (l.status === 'active' ? reset('ligue') : l.status === 'draft' ? push({ name: 'settings' }) : push({ name: 'recap' }));
  return (
    <div className="pb-10">
      <ScreenHeader title="Mes ligues" />
      <div className="space-y-3 px-4 pt-4">
        {LEAGUES.map((l) => (
          <button key={l.id} onClick={() => open(l)} className="press block w-full overflow-hidden rounded-[20px] bg-card shadow-card text-left">
            <div className="flex items-start gap-3 p-4">
              <Glyph name={l.status === 'finished' ? 'chequered-flag' : l.status === 'draft' ? 'spiral-calendar' : 'trophy'} size={40} />
              <div className="min-w-0 flex-1">
                <p className="display truncate text-[26px]">{l.name}</p>
                <p className="text-xs text-muted">Saison {l.season}, {formatDate(l.start)} au {formatDate(l.end)}</p>
              </div>
              <Tag tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Tag>
            </div>
            <div className="flex items-center gap-4 border-t border-line bg-card-2 px-4 py-2.5 text-xs">
              <span><b className="nums">{l.players}</b>/{l.maxPlayers} joueurs</span>
              <span>Capital <b className="nums">{formatUSD(l.startingCash)}</b></span>
              {l.status === 'finished' && l.winner ? (
                <span className="ml-auto flex items-center gap-1.5"><Avatar id={l.winner} size={18} /> {PLAYER_MAP[l.winner].pseudo} gagne</span>
              ) : l.myRank ? <span className="ml-auto font-bold">Tu es {l.myRank}<sup>e</sup></span> : <span className="ml-auto font-bold">{l.isAdmin ? 'Tu es admin' : ''}</span>}
              <CaretRight size={14} className="text-muted" />
            </div>
          </button>
        ))}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button onClick={() => push({ name: 'create' })}><Plus size={18} weight="bold" /> Créer</Button>
          <Button variant="secondary" onClick={() => push({ name: 'join' })}><Key size={18} weight="bold" /> Rejoindre</Button>
        </div>
      </div>
    </div>
  );
}
