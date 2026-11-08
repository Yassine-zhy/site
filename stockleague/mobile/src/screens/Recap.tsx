import { ArrowsClockwise, ShareNetwork } from '@phosphor-icons/react';
import { Avatar, Button, CompanyLogo, Glyph, ScreenHeader, Trend } from '../components/ui';
import { LogoMark } from '../components/ui';
import { LEAGUES, RECAP_S1, TITLES } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatDate, formatPoints } from '../lib/format';
import { useNav } from '../state/nav';
import { useName } from '../state/store';

/** Carte récap de fin de saison (même rendu que l'image partageable). Carré ou format LinkedIn. */
export function RecapCard({ wide }: { wide?: boolean }) {
  const name = useName();
  const l = LEAGUES[2];
  const [first, second, third] = RECAP_S1.podium;
  const bt = RECAP_S1.bestTrade, bc = RECAP_S1.bestCall;
  const header = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><LogoMark size={22} /><span className="display text-lg">StockLeague</span></div>
        {!wide ? <span className="text-[10px] opacity-60 nums">{formatDate(l.start)} au {formatDate(l.end)}</span> : null}
      </div>
      <p className="display mt-2 text-[26px] leading-none">{l.name}, saison {l.season}</p>
    </>
  );
  const podium = (
    <div className="mt-3 grid grid-cols-3 items-end gap-2">
      {[second, first, third].map((p, i) => {
        const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
        return (
          <div key={p.id} className="flex flex-col items-center">
            <Avatar id={p.id} size={rank === 1 ? 54 : 44} ring={rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'} />
            <span className="mt-1.5 text-[12px] font-bold">{name(p.id)}</span>
            <span className="display text-[14px] nums opacity-80">{formatPoints(p.points)}</span>
            <span className="mt-1 grid w-full place-items-center rounded-t-[2px] bg-board-2" style={{ height: rank === 1 ? 44 : rank === 2 ? 30 : 20 }}>
              <span className="display text-xl opacity-40">{rank}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
  const highlights = (
    <div className={wide ? 'grid content-center gap-2 text-[11px]' : 'mt-3 grid grid-cols-2 gap-2 text-[11px]'}>
      <div className="rounded-[2px] bg-board-2 p-2">
        <p className="opacity-60">Meilleur coup</p>
        <div className="mt-1 flex items-center gap-1.5"><CompanyLogo ticker={bt.ticker} size={20} /><b>{name(bt.player)}, {TICKER_MAP[bt.ticker].name}</b></div>
        <p className="mt-0.5 font-bold text-[#4ade9b] nums">+{bt.gainPct.toLocaleString('fr-FR')} %</p>
      </div>
      <div className="rounded-[2px] bg-board-2 p-2">
        <p className="opacity-60">Meilleur pronostic</p>
        <div className="mt-1 flex items-center gap-1.5"><CompanyLogo ticker={bc.ticker} size={20} /><b>{name(bc.player)}, {TICKER_MAP[bc.ticker].name}</b></div>
        <p className="mt-0.5 font-bold text-gold">« Sûr de moi », +{bc.points} pts</p>
      </div>
    </div>
  );
  if (wide) {
    return (
      <div className="grid aspect-[1.91/1] w-full grid-cols-[1.25fr_1fr] gap-3 overflow-hidden rounded-[2px] bg-board p-3 text-board-ink">
        <div>{header}{podium}</div>
        {highlights}
      </div>
    );
  }
  return <div className="aspect-square w-full overflow-hidden rounded-[2px] bg-board p-4 text-board-ink">{header}{podium}{highlights}</div>;
}

export function RecapScreen() {
  const name = useName();
  const { openSheet } = useNav();
  const all = [...RECAP_S1.podium, ...RECAP_S1.others];
  return (
    <div className="pb-10">
      <ScreenHeader title="Fin de saison" />
      <div className="px-4 pt-4">
        <div className="flex items-center gap-3">
          <Glyph name="trophy" size={52} />
          <div>
            <p className="display text-[32px]">{name(RECAP_S1.podium[0].id)} remporte la saison</p>
            <p className="text-sm text-muted">Positions gelées au cours de clôture du dernier jour.</p>
          </div>
        </div>
        <div className="mt-4"><RecapCard /></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="gold" onClick={() => openSheet({ name: 'share' })}><ShareNetwork size={18} weight="bold" /> Partager</Button>
          <Button variant="secondary"><ArrowsClockwise size={18} weight="bold" /> Rejouer</Button>
        </div>

        <h2 className="display mt-7 mb-2 px-1 text-[26px]">Classement final</h2>
        <ol className="-mx-4 border-y border-line bg-card">
          {all.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0">
              <span className="display w-6 text-center text-[24px] nums">{i + 1}</span>
              <Avatar id={p.id} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{name(p.id)}</span>
                <span className="flex items-center gap-1 text-xs text-muted"><Glyph name={TITLES[p.title].emoji} size={14} />{TITLES[p.title].label}</span>
              </span>
              <span className="text-right">
                <span className="display block text-xl nums">{formatPoints(p.points)}</span>
                <Trend value={p.returnPct} className="text-xs" />
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
