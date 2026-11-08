import { useState } from 'react';
import { Button, Glyph, cx } from '../components/ui';
import type { GlyphName } from '../data/glyphs';
import { useStore } from '../state/store';

const STEPS: { emoji: GlyphName; title: string; text: string }[] = [
  { emoji: 'trophy', title: 'Une ligue, une saison', text: 'Tu affrontes tes amis jusqu’au dernier jour. Ton score = points de portefeuille + points de pronostics.' },
  { emoji: 'money-bag', title: 'Investis tes 10 000 $', text: 'Achète de vraies actions au cours du marché. Chaque soir, +1 % de rendement = +10 points.' },
  { emoji: 'crystal-ball', title: 'Pronostique les résultats', text: 'Avant chaque publication, Apple ou Nike va-t-elle battre ou manquer les attentes ? +10 si juste, +20 si tu étais « sûr de toi ».' },
  { emoji: 'fire', title: 'Reviens chaque jour', text: 'Missions du jour, défi éclair, coffre, duel de la semaine : de quoi grimper vite au classement.' },
];

/** Prise en main en 4 cartes au premier lancement. */
export function Tutorial() {
  const { patch } = useStore();
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <div className="anim-fade fixed inset-0 z-[65] flex items-end bg-[#050b14]/70" role="dialog" aria-modal="true" aria-label="Comment ça marche">
      <div className="anim-sheet w-full rounded-t-[2px] bg-card px-5 pt-6 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div key={i} className="anim-fade text-center">
          <Glyph name={s.emoji} size={80} className="anim-pop mx-auto" />
          <p className="display mt-4 text-[34px]">{s.title}</p>
          <p className="mx-auto mt-2 max-w-[34ch] text-[15px] leading-relaxed text-ink-2">{s.text}</p>
        </div>
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden>
          {STEPS.map((_, k) => <span key={k} className={cx('h-1.5 rounded-[14px] transition-all', k === i ? 'w-6 bg-ink' : 'w-1.5 bg-line-2')} />)}
        </div>
        <div className="mt-6 grid grid-cols-[auto_1fr] gap-2">
          <Button variant="ghost" className="text-muted" onClick={() => patch({ tutorialDone: true })}>Passer</Button>
          <Button onClick={() => (last ? patch({ tutorialDone: true }) : setI(i + 1))}>{last ? 'Je commence' : 'Suivant'}</Button>
        </div>
      </div>
    </div>
  );
}
