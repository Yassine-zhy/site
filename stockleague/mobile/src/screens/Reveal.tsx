import { useEffect, useMemo, useState } from 'react';
import { Confetti } from '../components/celebrate';
import { Avatar, Button, CompanyLogo, Glyph, Tag, cx } from '../components/ui';
import { DUEL, EARNINGS, LIVE_RESULTS, ME, PLAYERS } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatPoints, formatUSD } from '../lib/format';
import { haptic } from '../lib/haptics';
import { useCountUp } from '../lib/use-count-up';
import { standings } from '../state/derived';
import { useNav } from '../state/nav';
import { useName, useStore } from '../state/store';

type Phase = 'intro' | 'countdown' | 'result' | 'impact';

/** Soirée résultats : le chiffre tombe en direct, avec compte à rebours et verdict. */
export function RevealScreen({ eventId }: { eventId: string }) {
  const s = useStore();
  const { pop, reset } = useNav();
  const name = useName();
  const e = EARNINGS.find((x) => x.id === eventId)!;
  const t = TICKER_MAP[e.ticker];
  const actual = LIVE_RESULTS[eventId];
  const pick = s.picks[eventId];
  const [phase, setPhase] = useState<Phase>(s.revealed[eventId] ? 'result' : 'intro');
  const [count, setCount] = useState(3);
  const [res, setRes] = useState<{ outcome: string; points: number } | null>(null);
  const before = useMemo(() => standings(s.cash, s.holdings, s.picks), []); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useCountUp(phase === 'intro' || phase === 'countdown' ? e.estimate : actual, 1400);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) { setRes(s.reveal(eventId)); setPhase('result'); return; }
    haptic('tap');
    const id = setTimeout(() => setCount(count - 1), 750);
    return () => clearTimeout(id);
  }, [phase, count, eventId, s]);

  const after = standings(s.cash, s.holdings, s.picks);
  const meBefore = before.find((r) => r.id === ME)!, meAfter = after.find((r) => r.id === ME)!;
  const passed = before.filter((r) => r.rank < meBefore.rank && (after.find((a) => a.id === r.id)!.rank > meAfter.rank)).map((r) => r.id);
  const beat = actual > e.estimate;
  const all: Record<string, string> = { ...e.picks, ...(pick ? { [ME]: pick.choice } : {}) };
  const right = PLAYERS.filter((p) => all[p.id] === (beat ? 'beat' : 'miss'));
  const correct = res ? res.outcome === 'correct' : pick?.choice === (beat ? 'beat' : 'miss');
  const duelMine = DUEL.mine + (correct ? 10 : 0);

  return (
    <div className="flex min-h-dvh flex-col bg-[linear-gradient(165deg,#3b14b8_0%,#1c0b5c_55%,#12083d_100%)] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-[max(env(safe-area-inset-bottom),20px)] text-[#f3f5f8]">
      {phase === 'result' && correct ? <Confetti /> : null}
      <div className="flex items-center gap-3">
        <CompanyLogo ticker={e.ticker} size={44} />
        <div>
          <p className="text-xs font-semibold text-gold">Soirée résultats</p>
          <p className="text-[17px] font-bold">{t.name}, {e.quarter}</p>
        </div>
      </div>

      <div className="mt-8 border-y border-white/10 py-6 text-center">
        <p className="text-sm text-[#8590a2]">{phase === 'intro' || phase === 'countdown' ? 'BPA attendu par les analystes' : 'BPA publié'}</p>
        {phase === 'countdown' ? (
          <p key={count} className="display anim-pop mt-2 text-[120px] leading-none text-gold">{count || ''}</p>
        ) : (
          <p className={cx('display mt-2 text-[96px] leading-none nums', phase !== 'intro' && (beat ? 'text-[#2fd27f]' : 'text-[#ff5a4e]'))}>{formatUSD(shown)}</p>
        )}
        {phase !== 'intro' && phase !== 'countdown' ? (
          <div className="anim-pop mt-4 flex items-center justify-center gap-2">
            <Tag tone={beat ? 'gain' : 'loss'}>{beat ? 'Attentes battues' : 'Attentes manquées'}</Tag>
            <span className="text-sm text-[#8590a2] nums">contre {formatUSD(e.estimate)} attendu</span>
          </div>
        ) : null}
      </div>

      {phase === 'intro' ? (
        <div className="mt-6 flex-1">
          <p className="text-[15px] text-[#c3cbd6]">Ton pronostic : <b className="text-white">{pick ? (pick.choice === 'beat' ? 'bat les attentes' : 'manque les attentes') : 'aucun'}</b>{pick?.confidence === 'sure' ? ', sûr de toi' : ''}.</p>
          <p className="mt-2 text-sm text-[#8590a2]">Le chiffre vient de tomber. Prêt ?</p>
        </div>
      ) : null}

      {phase === 'result' ? (
        <div className="anim-fade mt-6 flex-1">
          <div className="flex items-center gap-3 rounded-[18px] bg-white/10 p-4">
            <Glyph name={correct ? 'bullseye' : 'snail'} size={36} />
            <div className="flex-1">
              <p className="font-bold">{correct ? 'Bien vu !' : 'Raté cette fois.'}</p>
              <p className="text-xs text-[#8590a2]">{correct ? 'Ton pronostic était juste.' : 'La série repart de zéro.'}</p>
            </div>
            <span className={cx('display text-[40px] nums', correct ? 'text-[#2fd27f]' : 'text-[#8590a2]')}>{formatPoints(res?.points ?? (correct ? 10 : 0))}</span>
          </div>
          <p className="mt-5 text-sm font-bold">Ils avaient vu juste ({right.length}/{PLAYERS.length})</p>
          <div className="mt-2 flex gap-2">{right.map((p) => <span key={p.id} className="flex flex-col items-center gap-1"><Avatar id={p.id} size={46} /><span className="text-[11px]">{name(p.id)}</span></span>)}</div>
        </div>
      ) : null}

      {phase === 'impact' ? (
        <div className="anim-fade mt-6 flex-1">
          <p className="text-sm text-[#8590a2]">Classement général</p>
          <p className="display mt-1 text-[64px] leading-none">{meAfter.rank}<sup className="text-2xl">e</sup> <span className="text-[28px] text-[#8590a2]">(avant : {meBefore.rank}e)</span></p>
          {passed.length ? (
            <div className="anim-pop mt-4 flex items-center gap-3 bg-gold p-3 text-[#0a0d12]">
              <Avatar id={passed[0]} size={44} />
              <p className="flex-1 font-bold">Tu passes devant {name(passed[0])} !</p>
              <Glyph name="rocket" size={36} />
            </div>
          ) : null}
          <div className="mt-4 rounded-[18px] bg-white/10 p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><Glyph name="crossed-swords" size={20} /> Duel de la semaine</p>
            <p className="display mt-1 text-[34px] nums">{duelMine} – {DUEL.theirs}</p>
            <p className="text-xs text-[#8590a2]">{duelMine > DUEL.theirs ? `Tu mènes contre ${name(DUEL.opponent)}. Tiens jusqu’à vendredi.` : `Encore ${DUEL.theirs - duelMine + 1} pts pour passer devant ${name(DUEL.opponent)}.`}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-2">
        {phase === 'intro' ? <Button variant="gold" onClick={() => setPhase('countdown')}>Révéler le résultat</Button> : null}
        {phase === 'result' ? <Button variant="gold" onClick={() => setPhase('impact')}>Voir l’impact sur le classement</Button> : null}
        {phase === 'impact' ? <Button variant="gold" onClick={() => reset('ligue')}>Voir le classement</Button> : null}
        {phase !== 'countdown' ? <button onClick={pop} className="h-12 text-sm font-semibold text-[#8590a2]">Fermer</button> : null}
      </div>
    </div>
  );
}
