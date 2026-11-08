import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { levelOf } from '../lib/xp';
import { useStore, type Celebration } from '../state/store';
import { Button, Glyph } from './ui';

const COLORS = ['#5B2EFF', '#FF3D8B', '#FFC531', '#12C9A0', '#2E8BFF', '#FF8A1F'];

/** Explosion de confettis (physique fluide, coupée si « réduire les animations »). */
export function Confetti() {
  useEffect(() => {
    const opts = { colors: COLORS, disableForReducedMotion: true, scalar: 1.1, ticks: 220 };
    confetti({ ...opts, particleCount: 90, spread: 75, startVelocity: 48, origin: { y: 0.62 } });
    const t = setTimeout(() => {
      confetti({ ...opts, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.75 } });
      confetti({ ...opts, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.75 } });
    }, 180);
    return () => clearTimeout(t);
  }, []);
  return null;
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
  return (
    <>
      {current?.confetti ? <Confetti key={current.id} /> : null}
      <AnimatePresence>
        {current ? (current.levelUp ? <LevelUp key={current.id} c={current} xp={xp} onClose={() => dismissCelebration(current.id)} /> : <XpToast key={current.id} c={current} />) : null}
      </AnimatePresence>
    </>
  );
}

function XpToast({ c }: { c: Celebration }) {
  return (
    <motion.div
      className="fixed inset-x-0 top-3 z-[75] flex justify-center px-4" role="status"
      initial={{ y: -90, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -90, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
    >
      <div className="hero flex items-center gap-3 rounded-[18px] py-2 pr-2 pl-2.5 shadow-[0_10px_30px_-10px_rgb(91_46_255/0.7)]">
        <Glyph name={c.emoji} size={36} />
        <span className="text-[14px] font-bold">{c.label}</span>
        <motion.span initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 14, delay: 0.12 }} className="display rounded-[10px] bg-gold px-2 py-1.5 text-lg text-gold-ink nums shadow-[0_3px_0_#e09e00]">+{c.xp} XP</motion.span>
      </div>
    </motion.div>
  );
}

function LevelUp({ c, xp, onClose }: { c: Celebration; xp: number; onClose: () => void }) {
  const l = levelOf(xp);
  return (
    <motion.div className="fixed inset-0 z-[72] grid place-items-center bg-[#140b3a]/70 px-6" role="dialog" aria-modal="true" aria-label="Nouveau niveau" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="hero w-full max-w-sm rounded-[28px] p-6 text-center" initial={{ scale: 0.6, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}>
        <motion.div initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.15 }}>
          <Glyph name="glowing-star" size={120} className="mx-auto drop-shadow-[0_12px_20px_rgb(0_0_0/0.25)]" />
        </motion.div>
        <p className="mt-2 text-sm font-bold text-gold">Niveau {c.levelUp} atteint</p>
        <p className="display mt-1 text-[46px]">{l.title}</p>
        <p className="mt-2 text-sm opacity-85">Encore {l.toNext} XP pour le niveau suivant. Les missions du jour sont le chemin le plus court.</p>
        <Button variant="gold" className="mt-6 w-full" onClick={onClose}>Continuer</Button>
      </motion.div>
    </motion.div>
  );
}
