import { useRef, useState } from 'react';
import { Avatar, Button, Glyph, ScreenHeader } from '../components/ui';
import { DRAFT_MEMBERS, LEAGUES } from '../data/demo';
import { formatDate, formatUSD } from '../lib/format';
import { useNav } from '../state/nav';

const ALPHABET = /[^A-HJ-NP-Z2-9]/g;

export function JoinLeagueScreen() {
  const { push } = useNav();
  const [code, setCode] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const league = LEAGUES[1];
  const complete = code.length === 6;

  return (
    <div className="pb-10">
      <ScreenHeader title="Rejoindre une ligue" />
      <div className="px-4 pt-6">
        <p className="display text-[30px]">Entre le code à 6 caractères</p>
        <p className="mt-1 text-sm text-muted">Ton ami le trouve dans les réglages de sa ligue. Essaie {league.inviteCode}.</p>
        <button onClick={() => input.current?.focus()} className="mt-5 grid w-full grid-cols-6 gap-2" aria-label="Saisir le code">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className={`display grid h-16 place-items-center rounded-[2px] border-2 bg-card text-[32px] ${i === code.length ? 'border-ink' : 'border-line'}`}>{code[i] ?? ''}</span>
          ))}
        </button>
        <input ref={input} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(ALPHABET, '').slice(0, 6))} className="sr-only" autoCapitalize="characters" autoComplete="off" aria-label="Code d'invitation" />

        {complete ? (
          <div className="anim-fade mt-6 rounded-[2px] border border-line bg-card p-4">
            <div className="flex items-center gap-3">
              <Glyph name="spiral-calendar" size={40} />
              <div>
                <p className="display text-[26px]">{league.name}</p>
                <p className="text-xs text-muted">Début le {formatDate(league.start)}, capital {formatUSD(league.startingCash)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
              <div className="flex -space-x-2">{DRAFT_MEMBERS.map((m) => <Avatar key={m} id={m} size={28} className="border-2 border-card" />)}</div>
              <span className="text-xs text-muted">{league.players}/{league.maxPlayers} joueurs déjà inscrits</span>
            </div>
            <Button className="mt-4 w-full" onClick={() => push({ name: 'settings' })}>Rejoindre la ligue</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
