import { X } from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, CompanyLogo, Glyph, LogoMark, Medallion } from '../components/ui';
import { ME } from '../data/demo';
import { formatPoints } from '../lib/format';
import { myPredictionStats, standings } from '../state/derived';
import { useNav } from '../state/nav';
import { useName, useStore } from '../state/store';
import { todayKey } from '../lib/xp';

const DURATION = 4500;

/** « Ta semaine » : récap en story plein écran (comme les stories des réseaux sociaux). */
export function StoryScreen() {
  const s = useStore();
  const { pop } = useNav();
  const name = useName();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const rows = standings(s.cash, s.holdings, s.picks);
  const me = rows.find((r) => r.id === ME)!;
  const pred = myPredictionStats(s.picks);

  const slides: ReactNode[] = [
    <Slide key="a" kicker="Ta semaine" title={`${name(ME)}, voici ta semaine.`}>
      <Avatar id={ME} size={160} className="mx-auto" />
      <p className="mt-6 text-center text-lg text-[#c3cbd6]">7 jours, 1 ligue, 6 joueurs. Accroche-toi.</p>
    </Slide>,
    <Slide key="b" kicker="Classement" title="Tu grimpes.">
      <p className="display text-center text-[150px] leading-none text-gold">{me.rank}<sup className="text-5xl">e</sup></p>
      <p className="mt-2 text-center text-lg">contre {me.rankYesterday + 1}e lundi dernier</p>
      <p className="mt-6 text-center text-[#8590a2]">{formatPoints(me.total)} au total, dont {formatPoints(me.portfolioPts)} grâce au portefeuille.</p>
    </Slide>,
    <Slide key="c" kicker="Ton meilleur coup" title="Nvidia, la pépite.">
      <CompanyLogo ticker="NVDA" size={120} className="mx-auto" />
      <p className="display mt-6 text-center text-[96px] leading-none text-[#2fd27f]">+32 %</p>
      <p className="mt-3 text-center text-[#c3cbd6]">Acheté à 142,10 $, il vaut 187,62 $ aujourd’hui.</p>
    </Slide>,
    <Slide key="d" kicker="Pronostics" title="L’œil du lynx.">
      <p className="display text-center text-[120px] leading-none">{pred.correct}/{pred.decided}</p>
      <p className="mt-3 text-center text-lg">pronostics justes, série de {pred.streak} en cours</p>
      <div className="mt-6 flex justify-center"><Glyph name="fire" size={64} /></div>
    </Slide>,
    <Slide key="e" kicker="La semaine prochaine" title="Vise « L’Oracle ».">
      <div className="flex justify-center"><Medallion name="crystal-ball" tier="gold" size={120} /></div>
      <p className="mt-6 text-center text-lg text-[#c3cbd6]">2 pronostics justes de plus et le titre de Léa est à toi. 7 publications t’attendent.</p>
    </Slide>,
  ];

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => (i < slides.length - 1 ? setI(i + 1) : (s.patch({ storySeen: todayKey() }), pop())), DURATION);
    return () => clearTimeout(id);
  }, [i, paused, slides.length, pop, s]);
  useEffect(() => { s.patch({ storySeen: todayKey() }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex flex-col hero" onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}>
      <div className="flex gap-1 px-3 pt-3" aria-hidden>
        {slides.map((_, k) => (
          <span key={k} className="h-[3px] flex-1 overflow-hidden bg-white/20">
            <span className="block h-full bg-white" style={{ width: k < i ? '100%' : k > i ? '0%' : undefined, animation: k === i ? `story-bar ${DURATION}ms linear forwards` : undefined, animationPlayState: paused ? 'paused' : 'running' }} />
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="flex items-center gap-2"><LogoMark size={22} /><span className="display text-lg">StockLeague</span></span>
        <button onClick={pop} aria-label="Fermer" className="grid size-10 place-items-center"><X size={24} weight="bold" /></button>
      </div>
      <div className="relative flex-1">
        {slides[i]}
        <button className="absolute inset-y-0 left-0 w-1/3" aria-label="Précédent" onClick={() => setI(Math.max(0, i - 1))} />
        <button className="absolute inset-y-0 right-0 w-2/3" aria-label="Suivant" onClick={() => (i < slides.length - 1 ? setI(i + 1) : pop())} />
      </div>
    </div>
  );
}

function Slide({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="anim-fade flex h-full flex-col justify-center px-6 pb-16">
      <p className="text-center text-sm font-semibold text-gold">{kicker}</p>
      <p className="display mt-2 mb-8 text-center text-[44px] leading-[0.9]">{title}</p>
      {children}
    </div>
  );
}
