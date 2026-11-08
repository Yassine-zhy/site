import { useEffect, useMemo } from 'react';
import { levelOf } from '../lib/xp';
import { useStore, type Celebration } from '../state/store';
import { Button, Glyph } from './ui';

const COLORS = ['#F2B705', '#1D4E89', '#0B7A50', '#C0352B', '#7A3E9D', '#4AA3DF'];

/** Pluie de confettis (CSS seulement, 48 morceaux, se coupe si « réduire les animations »). */
export function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 48 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.25, dur: 1.1 + Math.random() * 0.9,
    rot: Math.random() * 720 - 360, drift: Math.random() * 120 - 60, color: COLORS[i % COLORS.length], w: 6 + Math.random() * 6,
  })), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden motion-reduce:hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti absolute top-[-16px] block"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.45, background: p.color, borderRadius: 1.5, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--rot' as string]: `${p.rot}deg`, ['--drift' as string]: `${p.drift}px` }}
        />
      ))}
    </div>
  );
}

/** File des récompenses : bandeau « +30 XP », confettis, et écran de passage de niveau. */
export function Celebrations() {
  const { celebrations, dismissCelebration, xp } = useStore();
  const current = celebrations[0];
  useEffect(() => {
    if (!current || current.levelUp) return;
    const t = setTimeout(() => dismissCelebration(current.id), 2200);
    return () => clearTimeout(t);
  }, [current, dismissCelebration]);
  if (!current) return null;
  return (
    <>
      {current.confetti ? <Confetti key={current.id} /> : null}
      {current.levelUp ? <LevelUp c={current} xp={xp} onClose={() => dismissCelebration(current.id)} /> : <XpToast key={current.id} c={current} />}
    </>
  );
}

function XpToast({ c }: { c: Celebration }) {
  return (
    <div className="anim-toast fixed inset-x-0 top-3 z-[75] flex justify-center px-4" role="status">
      <div className="flex items-center gap-3 rounded-[2px] bg-board py-2.5 pr-4 pl-3 text-board-ink shadow-card">
        <Glyph name={c.emoji} size={30} />
        <span className="text-sm font-semibold">{c.label}</span>
        <span className="display rounded-[2px] bg-gold px-1.5 py-1 text-lg text-gold-ink nums">+{c.xp} XP</span>
      </div>
    </div>
  );
}

function LevelUp({ c, xp, onClose }: { c: Celebration; xp: number; onClose: () => void }) {
  const l = levelOf(xp);
  return (
    <div className="anim-fade fixed inset-0 z-[72] grid place-items-center bg-[#050b14]/70 px-6" role="dialog" aria-modal="true" aria-label="Nouveau niveau">
      <div className="anim-pop w-full max-w-sm rounded-[2px] bg-board p-6 text-center text-board-ink">
        <Glyph name="glowing-star" size={84} className="mx-auto" />
        <p className="mt-3 text-sm font-semibold text-gold">Niveau {c.levelUp} atteint</p>
        <p className="display mt-1 text-[44px]">{l.title}</p>
        <p className="mt-2 text-sm opacity-75">Encore {l.toNext} XP pour le niveau suivant. Les missions du jour sont le chemin le plus court.</p>
        <Button variant="gold" className="mt-6 w-full" onClick={onClose}>Continuer</Button>
      </div>
    </div>
  );
}
