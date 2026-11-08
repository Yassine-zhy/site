import { Avatar, Button, CompanyLogo, Glyph, Medallion, ScreenHeader, Trend } from '../components/ui';
import { BADGES, PLAYER_MAP, RIVALS, TITLES } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatPoints } from '../lib/format';
import { standings } from '../state/derived';
import { useNav } from '../state/nav';
import { Megaphone } from '@phosphor-icons/react';
import { useStore } from '../state/store';

export function PlayerScreen({ id }: { id: string }) {
  const { cash, holdings, picks } = useStore();
  const p = PLAYER_MAP[id];
  const r = RIVALS[id];
  const s = standings(cash, holdings, picks).find((x) => x.id === id)!;
  const { openSheet } = useNav();

  return (
    <div className="pb-10">
      <ScreenHeader title={p.pseudo} />
      <section className="mx-4 mt-4 overflow-hidden rounded-[2px] bg-board p-4 text-board-ink">
        <div className="flex items-center gap-4">
          <Avatar id={id} size={72} ring={s.rank === 1 ? 'gold' : undefined} />
          <div>
            <p className="display text-[36px]">{p.pseudo}</p>
            <p className="text-[13px] opacity-75">{s.rank}<sup>e</sup> au classement général</p>
          </div>
          <span className="display ml-auto text-[30px] whitespace-nowrap nums">{formatPoints(s.total)}</span>
        </div>
        {r.titles.map((t) => (
          <div key={t} className="mt-4 flex items-center gap-3 rounded-[2px] bg-board-2 p-3">
            <Medallion name={TITLES[t].emoji} tier="gold" size={36} />
            <div>
              <p className="text-sm font-bold">{TITLES[t].label}</p>
              <p className="text-[11px] opacity-70">{TITLES[t].rule}</p>
            </div>
          </div>
        ))}
      </section>

      <Button variant="gold" className="mx-4 mt-3 w-[calc(100%-2rem)]" onClick={() => openSheet({ name: 'taunt', playerId: id })}><Megaphone size={20} weight="fill" /> Chambrer {p.pseudo}</Button>

      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <Stat label="Points portefeuille" value={formatPoints(s.portfolioPts)} />
        <Stat label="Points pronostics" value={formatPoints(s.predPts)} />
        <div className="rounded-[2px] border border-line bg-card p-3"><p className="text-[11px] font-semibold text-muted">Rendement saison</p><Trend value={r.returnPct} className="mt-1 text-[17px]" /></div>
        <Stat label="Pronostics justes" value={`${r.correct}/${r.total} (${Math.round((r.correct / r.total) * 100)} %)`} />
      </div>

      <h2 className="display mx-5 mt-7 mb-2 text-[26px]">Plus grosses positions</h2>
      <ul className="mx-4 space-y-2">
        {r.topHoldings.map((h) => (
          <li key={h.ticker} className="flex items-center gap-3 rounded-[2px] border border-line bg-card p-3">
            <CompanyLogo ticker={h.ticker} size={38} />
            <div className="flex-1">
              <p className="text-sm font-bold">{TICKER_MAP[h.ticker].name}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-[2px] bg-card-2"><div className="h-full bg-board dark:bg-ink-2" style={{ width: `${h.weight}%` }} /></div>
            </div>
            <span className="w-12 text-right text-sm font-bold nums">{h.weight} %</span>
          </li>
        ))}
      </ul>
      <div className="mx-4 mt-2 flex items-center gap-3 rounded-[2px] border border-line bg-card p-3">
        <Glyph name="money-bag" size={30} />
        <p className="text-sm"><span className="text-muted">Meilleur coup :</span> <b>{r.bestTrade}</b></p>
      </div>

      <h2 className="display mx-5 mt-7 mb-2 text-[26px]">Badges</h2>
      <div className="mx-4 grid grid-cols-4 gap-2">
        {r.badges.map((b) => (
          <div key={b} className="flex flex-col items-center gap-1.5 rounded-[2px] border border-line bg-card px-1 py-3">
            <Medallion name={BADGES[b].emoji} tier="gold" size={34} />
            <span className="text-center text-[10.5px] font-semibold leading-tight">{BADGES[b].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] border border-line bg-card p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-1 text-[17px] font-bold nums">{value}</p>
    </div>
  );
}
