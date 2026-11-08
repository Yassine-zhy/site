import { CaretDown, GearSix, Info } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { TickerTape } from '../components/ticker-tape';
import { Avatar, Glyph, Medallion, RankMove, Segmented, Tag, Trend, cx } from '../components/ui';
import { ACTIVE_LEAGUE, ME, TITLES, type TitleKey } from '../data/demo';
import { formatDate, formatPoints } from '../lib/format';
import { daysLeft, standings, type Standing } from '../state/derived';
import { useNav } from '../state/nav';
import { useName, useStore } from '../state/store';

type Board = 'general' | 'portfolio' | 'pred';

export function LeagueTab() {
  const { cash, holdings, picks } = useStore();
  const { push } = useNav();
  const name = useName();
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
          <button onClick={() => push({ name: 'leagues' })} className="press -ml-1 rounded-[2px] px-1 py-1 text-left" aria-label="Changer de ligue">
            <span className="flex items-center gap-1.5">
              <span className="display text-[34px]">{ACTIVE_LEAGUE.name}</span>
              <CaretDown size={20} weight="bold" className="mt-1 opacity-70" />
            </span>
            <span className="text-[13px] opacity-70">Saison {ACTIVE_LEAGUE.season}, {ACTIVE_LEAGUE.players} joueurs, fin le {formatDate(ACTIVE_LEAGUE.end)}</span>
          </button>
          <div className="flex items-center gap-1">
            <span className="slant bg-gold px-2.5 py-1" aria-label={`${daysLeft()} jours restants`}><span className="unslant display block text-[22px] text-gold-ink nums">J-{daysLeft()}</span></span>
            <button onClick={() => push({ name: 'settings' })} className="press grid size-11 place-items-center rounded-[2px]" aria-label="Réglages de la ligue">
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
        <div className="mt-3 flex items-center gap-3 rounded-[2px] border border-line bg-card px-4 py-3">
          <span className="display w-9 text-[34px] nums">{me.boardRank}<sup className="text-sm">e</sup></span>
          <p className="flex-1 text-[13px] leading-snug text-ink-2">
            {above
              ? <>Il te manque <b className="text-ink nums">{above.score - me.score + 1} pts</b> pour doubler {name(above.id)}.</>
              : <>Tu mènes ce classement. Garde le cap jusqu’au {formatDate(ACTIVE_LEAGUE.end)}.</>}
          </p>
          <Glyph name={me.boardRank === 1 ? 'crown' : 'flexed-biceps'} size={30} />
        </div>

        {/* ------------------------------------------------ classement */}
        <ol className="mt-3 -mx-4 border-y border-line bg-card">
          {sorted.map((s) => (
            <li key={s.id}>
              <button onClick={() => (s.id === ME ? push({ name: 'badges' }) : push({ name: 'player', id: s.id }))} className={cx('press flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left last:border-b-0', s.id === ME && 'bg-gold/[0.08]')}>
                <span className="display w-6 text-center text-[26px] nums">{s.boardRank}</span>
                <RankMove delta={board === 'general' ? s.rankYesterday - s.rank : 0} />
                <Avatar id={s.id} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-bold">
                    {name(s.id)}
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
              <div key={k} className="w-[156px] shrink-0 snap-start border-t-2 border-gold bg-card p-3">
                <Medallion name={TITLES[k].emoji} tier={k === 'lanterne' ? 'ink' : 'gold'} size={40} />
                <p className="mt-2 text-[14px] font-bold leading-tight">{TITLES[k].label}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted">{TITLES[k].rule}</p>
                {holder ? (
                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2">
                    <Avatar id={holder.id} size={24} />
                    <span className="text-xs font-semibold">{name(holder.id)}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <button onClick={() => push({ name: 'activity' })} className="press mt-6 flex w-full items-center gap-3 rounded-[2px] border border-line bg-card px-4 py-3 text-left">
          <Glyph name="bell" size={24} />
          <span className="flex-1 text-sm font-semibold">Activité de la ligue</span>
          <span className="text-xs text-muted">achats, pronostics, réactions</span>
        </button>
        <button onClick={() => push({ name: 'rules' })} className="press mt-2 flex w-full items-center gap-3 rounded-[2px] border border-line bg-card px-4 py-3 text-left">
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
      <Glyph name={TITLES[t].emoji} size={14} />
      {TITLES[t].label}
    </span>
  );
}

/** Podium : cartes de joueurs avec photo, 2e à gauche, 1er au centre (plus grand), 3e à droite. */
function Podium({ rows }: { rows: (Standing & { boardRank: number; score: number })[] }) {
  const { push } = useNav();
  const name = useName();
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  const tier = { 1: 'var(--gold)', 2: 'var(--silver)', 3: 'var(--bronze)' } as const;
  return (
    <div className="mt-5 grid grid-cols-[1fr_1.18fr_1fr] items-end gap-2 px-4 pb-4">
      {order.map((r) => {
        const first = r.boardRank === 1;
        const color = tier[r.boardRank as 1 | 2 | 3];
        return (
          <button key={r.id} onClick={() => r.id !== ME && push({ name: 'player', id: r.id })} className="press relative block text-left" aria-label={`${r.boardRank}e : ${name(r.id)}, ${formatPoints(r.score)}`}>
            <span className="relative block overflow-hidden rounded-[2px] bg-board-2" style={{ aspectRatio: first ? '3 / 4.1' : '3 / 3.7', boxShadow: `inset 0 0 0 1px ${color}` }}>
              <Avatar id={r.id} size={400} className="!h-full !w-full" />
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
              <span className="display absolute top-1.5 left-2 text-[34px] leading-none text-white drop-shadow" style={{ color }}>{r.boardRank}</span>
              <span className="absolute inset-x-2 bottom-2">
                <span className="block truncate text-[15px] font-bold text-white">{name(r.id)}</span>
                <span className="display block text-[22px] text-white nums">{formatPoints(r.score)}</span>
              </span>
            </span>
            <span className="block h-[3px]" style={{ background: color }} />
          </button>
        );
      })}
    </div>
  );
}
