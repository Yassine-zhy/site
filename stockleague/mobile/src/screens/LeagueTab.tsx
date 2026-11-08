import { CaretDown, GearSix, Info } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { TickerTape } from '../components/ticker-tape';
import { Avatar, Emoji, RankMove, Segmented, Tag, Trend, cx } from '../components/ui';
import { ACTIVE_LEAGUE, ME, PLAYER_MAP, TITLES, type TitleKey } from '../data/demo';
import { formatDate, formatPoints } from '../lib/format';
import { daysLeft, standings, type Standing } from '../state/derived';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

type Board = 'general' | 'portfolio' | 'pred';

export function LeagueTab() {
  const { cash, holdings, picks } = useStore();
  const { push } = useNav();
  const [board, setBoard] = useState<Board>('general');
  const all = useMemo(() => standings(cash, holdings, picks), [cash, holdings, picks]);

  const sorted = useMemo(() => {
    const key = board === 'general' ? 'total' : board === 'portfolio' ? 'portfolioPts' : 'predPts';
    return [...all].sort((a, b) => b[key] - a[key]).map((s, i) => ({ ...s, boardRank: i + 1, score: s[key] }));
  }, [all, board]);

  const me = sorted.find((s) => s.id === ME)!;
  const above = sorted[me.boardRank - 2];

  return (
    <div className="pb-28">
      {/* ------------------------------------------------ tableau de marque */}
      <section className="bg-board pt-[max(env(safe-area-inset-top),12px)] text-board-ink">
        <div className="flex items-start justify-between px-4 pt-2">
          <button onClick={() => push({ name: 'leagues' })} className="press -ml-1 rounded-btn px-1 py-1 text-left" aria-label="Changer de ligue">
            <span className="flex items-center gap-1.5">
              <span className="display text-[34px]">{ACTIVE_LEAGUE.name}</span>
              <CaretDown size={20} weight="bold" className="mt-1 opacity-70" />
            </span>
            <span className="text-[13px] opacity-70">Saison {ACTIVE_LEAGUE.season}, {ACTIVE_LEAGUE.players} joueurs, fin le {formatDate(ACTIVE_LEAGUE.end)}</span>
          </button>
          <div className="flex items-center gap-1">
            <span className="display rounded-[6px] bg-gold px-2 py-1.5 text-xl text-gold-ink nums" aria-label={`${daysLeft()} jours restants`}>J-{daysLeft()}</span>
            <button onClick={() => push({ name: 'settings' })} className="press grid size-11 place-items-center rounded-btn" aria-label="Réglages de la ligue">
              <GearSix size={24} />
            </button>
          </div>
        </div>
        <Podium rows={sorted.slice(0, 3)} />
        <TickerTape />
      </section>

      <div className="px-4">
        <Segmented
          className="mt-4"
          value={board}
          onChange={setBoard}
          options={[{ value: 'general', label: 'Général' }, { value: 'portfolio', label: 'Portefeuille' }, { value: 'pred', label: 'Pronostics' }]}
        />

        {/* ------------------------------------------------ ma position */}
        <div className="mt-3 flex items-center gap-3 rounded-tile border border-line bg-card px-4 py-3">
          <span className="display w-9 text-[34px] nums">{me.boardRank}<sup className="text-sm">e</sup></span>
          <p className="flex-1 text-[13px] leading-snug text-ink-2">
            {above
              ? <>Il te manque <b className="text-ink nums">{above.score - me.score + 1} pts</b> pour doubler {PLAYER_MAP[above.id].pseudo}.</>
              : <>Tu mènes ce classement. Garde le cap jusqu’au {formatDate(ACTIVE_LEAGUE.end)}.</>}
          </p>
          <Emoji name={me.boardRank === 1 ? 'crown' : 'flexed-biceps'} size={30} />
        </div>

        {/* ------------------------------------------------ classement */}
        <ol className="mt-3 overflow-hidden rounded-tile border border-line bg-card">
          {sorted.map((s) => (
            <li key={s.id}>
              <button onClick={() => (s.id === ME ? push({ name: 'badges' }) : push({ name: 'player', id: s.id }))} className={cx('press flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left last:border-b-0', s.id === ME && 'bg-gold/[0.08]')}>
                <span className="display w-6 text-center text-[26px] nums">{s.boardRank}</span>
                <RankMove delta={board === 'general' ? s.rankYesterday - s.rank : 0} />
                <Avatar id={s.id} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    {PLAYER_MAP[s.id].pseudo}
                    {s.id === ME ? <Tag tone="board">toi</Tag> : null}
                  </span>
                  <SubLine s={s} board={board} />
                </span>
                <span className="text-right">
                  <span className="display block text-[22px] nums">{formatPoints(s.score)}</span>
                  {board === 'pred'
                    ? <span className="text-xs font-semibold text-muted nums">{s.correct}/{s.decided} justes</span>
                    : <Trend value={s.returnPct} className="text-xs" />}
                </span>
              </button>
            </li>
          ))}
        </ol>

        {/* ------------------------------------------------ titres du jour */}
        <div className="mb-2 mt-7 flex items-end justify-between px-1">
          <h2 className="display text-[26px]">Titres du jour</h2>
          <span className="text-xs text-muted">Mis à jour à la clôture</span>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {(Object.keys(TITLES) as TitleKey[]).map((k) => {
            const holder = all.find((s) => s.titles.includes(k));
            return (
              <div key={k} className="w-[156px] shrink-0 snap-start rounded-tile border border-line bg-card p-3">
                <Emoji name={TITLES[k].emoji} size={40} />
                <p className="mt-2 text-[14px] font-bold leading-tight">{TITLES[k].label}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{TITLES[k].rule}</p>
                {holder ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2">
                    <Avatar id={holder.id} size={24} />
                    <span className="text-xs font-semibold">{PLAYER_MAP[holder.id].pseudo}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <button onClick={() => push({ name: 'rules' })} className="press mt-6 flex w-full items-center gap-3 rounded-tile border border-line bg-card px-4 py-3 text-left">
          <Info size={22} className="text-muted" />
          <span className="flex-1 text-sm font-semibold">Règles et barème des points</span>
          <span className="text-xs text-muted">+10, +20, série…</span>
        </button>
      </div>
    </div>
  );
}

function SubLine({ s, board }: { s: Standing; board: Board }) {
  if (board === 'pred') return <span className="block truncate text-xs text-muted">{Math.round(s.accuracy * 100)} % de réussite{s.streak >= 3 ? `, série de ${s.streak}` : ''}</span>;
  const t = s.titles[0];
  if (!t) return <span className="block truncate text-xs text-muted">{s.sells} vente{s.sells > 1 ? 's' : ''} cette saison</span>;
  return (
    <span className="flex items-center gap-1 truncate text-xs text-muted">
      <Emoji name={TITLES[t].emoji} size={14} />
      {TITLES[t].label}
    </span>
  );
}

/** Podium : 2e à gauche, 1er au centre, 3e à droite. */
function Podium({ rows }: { rows: (Standing & { boardRank: number; score: number })[] }) {
  const { push } = useNav();
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  const style = {
    1: { h: 92, ring: 'gold' as const, size: 72, medal: '1st-place-medal' as const, edge: 'var(--gold)' },
    2: { h: 66, ring: 'silver' as const, size: 58, medal: '2nd-place-medal' as const, edge: 'var(--silver)' },
    3: { h: 48, ring: 'bronze' as const, size: 58, medal: '3rd-place-medal' as const, edge: 'var(--bronze)' },
  };
  return (
    <div className="mt-5 grid grid-cols-3 items-end gap-2 px-4">
      {order.map((r) => {
        const st = style[r.boardRank as 1 | 2 | 3];
        return (
          <button key={r.id} onClick={() => r.id !== ME && push({ name: 'player', id: r.id })} className="flex flex-col items-center" aria-label={`${r.boardRank}e : ${PLAYER_MAP[r.id].pseudo}, ${formatPoints(r.score)}`}>
            <span className="relative">
              <Avatar id={r.id} size={st.size} ring={st.ring} />
              <Emoji name={st.medal} size={26} className="absolute -right-2.5 -bottom-2" />
            </span>
            <span className="mt-2.5 max-w-full truncate text-[14px] font-bold">{PLAYER_MAP[r.id].pseudo}</span>
            <span className="display text-[19px] nums opacity-90">{formatPoints(r.score)}</span>
            <span className="mt-1.5 grid w-full place-items-center rounded-t-[8px] bg-board-2" style={{ height: st.h, boxShadow: `inset 0 3px 0 ${st.edge}` }}>
              <span className="display text-[40px] opacity-40 nums">{r.boardRank}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
