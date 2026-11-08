import { useState } from 'react';
import { SheetFrame } from '../components/sheet';
import { Avatar, Button, Glyph, cx } from '../components/ui';
import { TAUNTS } from '../data/demo';
import { useNav } from '../state/nav';
import { useName, useStore } from '../state/store';

/** Chambrer un ami : message prédéfini, visible dans le fil de la ligue. */
export function TauntSheet({ playerId }: { playerId: string }) {
  const { taunt } = useStore();
  const { closeSheet } = useNav();
  const name = useName();
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  return (
    <SheetFrame title={`Chambrer ${name(playerId)}`}>
      <div className="px-5 pt-2">
        <div className="flex items-center gap-3">
          <Avatar id={playerId} size={48} />
          <p className="display text-[30px]">{sent ? 'Message envoyé' : `Chambrer ${name(playerId)}`}</p>
        </div>
        {sent ? (
          <>
            <p className="mt-4 text-[15px] text-ink-2">{name(playerId)} le verra dans sa prochaine notification. À toi de tenir ta promesse.</p>
            <Button className="mt-6 w-full" onClick={closeSheet}>Fermer</Button>
          </>
        ) : (
          <>
            <ul className="mt-4 space-y-2">
              {TAUNTS.map((t) => (
                <li key={t}>
                  <button onClick={() => setMsg(t)} aria-pressed={msg === t} className={cx('press flex w-full items-center gap-3 border p-3.5 text-left text-[15px]', msg === t ? 'border-gold bg-gold/10' : 'border-line')}>
                    <Glyph name="megaphone" size={22} /> {t}
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="gold" className="mt-4 w-full" disabled={!msg} onClick={() => { taunt(playerId, msg!); setSent(true); }}>Envoyer</Button>
          </>
        )}
      </div>
    </SheetFrame>
  );
}
