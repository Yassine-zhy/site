import { Copy, LinkSimple, ShareNetwork, UserMinus } from '@phosphor-icons/react';
import { useState } from 'react';
import { Avatar, Button, CompanyLogo, Emoji, ScreenHeader, Tag, cx } from '../components/ui';
import { DRAFT_MEMBERS, LEAGUES, PLAYER_MAP } from '../data/demo';
import { TICKERS } from '../data/tickers';
import { formatCountdown, formatDate, formatUSD } from '../lib/format';

const NAMES: Record<string, string> = { hugo: 'Hugo', sarah: 'Sarah' };

/** Carte d'invitation : code court + lien, à partager. */
export function InviteCard({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const link = `stockleague.app/rejoindre/${code}`;
  const copy = () => { navigator.clipboard?.writeText(`https://${link}`).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  return (
    <div className={cx('rounded-tile bg-board p-4 text-board-ink', className)}>
      <p className="text-xs opacity-70">Code d’invitation</p>
      <p className="display mt-1 text-[48px] tracking-[0.12em] text-gold">{code}</p>
      <p className="mt-1 flex items-center gap-1.5 truncate text-xs opacity-70"><LinkSimple size={14} /> {link}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={copy} className="press flex h-11 items-center justify-center gap-2 rounded-btn bg-white/10 text-sm font-bold"><Copy size={18} /> {copied ? 'Lien copié' : 'Copier le lien'}</button>
        <button onClick={() => navigator.share?.({ title: 'Rejoins ma ligue StockLeague', text: `Code : ${code}`, url: `https://${link}` }).catch(() => {})} className="press flex h-11 items-center justify-center gap-2 rounded-btn bg-gold text-sm font-bold text-gold-ink"><ShareNetwork size={18} /> Partager</button>
      </div>
    </div>
  );
}

export function LeagueSettingsScreen() {
  const l = LEAGUES[1];
  const [members, setMembers] = useState<string[]>([...DRAFT_MEMBERS]);
  const watch = TICKERS.slice(0, 12);

  return (
    <div className="pb-10">
      <ScreenHeader title={l.name} right={<Tag className="mr-2">Admin</Tag>} />
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3 rounded-tile border border-line bg-card p-4">
          <Emoji name="hourglass-not-done" size={40} />
          <div>
            <p className="font-bold">La saison commence dans {formatCountdown(l.start.getTime() - Date.now())}</p>
            <p className="text-xs text-muted">Du {formatDate(l.start)} au {formatDate(l.end)}. Les ordres s’ouvriront au coup d’envoi.</p>
          </div>
        </div>

        <InviteCard code={l.inviteCode} className="mt-3" />

        <h2 className="display mt-7 mb-2 px-1 text-[26px]">Joueurs <span className="text-muted nums">{members.length}/{l.maxPlayers}</span></h2>
        <ul className="overflow-hidden rounded-tile border border-line bg-card">
          {members.map((m) => (
            <li key={m} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
              <Avatar id={m} size={38} />
              <span className="flex-1 font-semibold">{PLAYER_MAP[m]?.pseudo ?? NAMES[m]}{m === 'alex' ? ' (toi)' : ''}</span>
              {m === 'alex' ? <Tag tone="board">Admin</Tag> : (
                <button onClick={() => setMembers(members.filter((x) => x !== m))} className="press grid size-9 place-items-center rounded-[9px] text-loss" aria-label={`Retirer ${NAMES[m] ?? m}`}><UserMinus size={20} /></button>
              )}
            </li>
          ))}
        </ul>

        <h2 className="display mt-7 mb-2 px-1 text-[26px]">Réglages</h2>
        <dl className="overflow-hidden rounded-tile border border-line bg-card text-sm">
          {[['Capital de départ', formatUSD(l.startingCash)], ['Frais par ordre', formatUSD(l.fee)], ['Marchés', 'États-Unis'], ['Joueurs maximum', String(l.maxPlayers)]].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line px-4 py-3 last:border-b-0"><dt className="text-muted">{k}</dt><dd className="font-bold nums">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-1.5 px-1 text-xs text-muted">Modifiables jusqu’au début de la saison.</p>

        <div className="mb-2 mt-7 flex items-end justify-between px-1">
          <h2 className="display text-[26px]">Entreprises suivies</h2>
          <span className="text-xs text-muted">50 pour les pronostics</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {watch.map((t) => <CompanyLogo key={t.ticker} ticker={t.ticker} size={48} className="w-full! h-auto! aspect-square" />)}
        </div>
        <Button variant="secondary" className="mt-3 w-full">Modifier la liste</Button>

        <Button variant="secondary" className="mt-8 w-full text-loss!">Clôturer la saison maintenant</Button>
      </div>
    </div>
  );
}
