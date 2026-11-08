import { Check, X } from '@phosphor-icons/react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { Button, CompanyLogo, Glyph, ScreenHeader, cx } from '../components/ui';
import { crowdBeat, EARNINGS } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatCountdown, formatDayLong, formatUSD } from '../lib/format';
import { haptic } from '../lib/haptics';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

/** Pronostics en rafale : glisse à droite « bat », à gauche « manque ». */
export function SwipeScreen() {
  const { picks, pick, grant } = useStore();
  const { pop } = useNav();
  const [queue] = useState(() => EARNINGS.filter((e) => e.lockAt.getTime() > Date.now() && !picks[e.id]).sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime()));
  const [i, setI] = useState(0);
  const [sure, setSure] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const beatOpacity = useTransform(x, [20, 110], [0, 1]);
  const missOpacity = useTransform(x, [-110, -20], [1, 0]);
  const busy = useRef(false);
  const startedAt = useRef(Date.now());
  const [done, setDone] = useState<{ n: number; s: number } | null>(null);
  const e = queue[i];

  const decide = async (choice: 'beat' | 'miss') => {
    if (!e || busy.current) return;
    busy.current = true;
    haptic('tap');
    await animate(x, choice === 'beat' ? 520 : -520, { type: 'spring', stiffness: 260, damping: 30, velocity: x.getVelocity() });
    pick(e.id, e.ticker, choice, sure ? 'sure' : 'normal', true);
    setSure(false);
    if (i + 1 >= queue.length) {
      setDone({ n: queue.length, s: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)) });
      grant(30 * queue.length, `${queue.length} pronostics d’un coup`, 'swipe', true);
    } else setI(i + 1);
    x.jump(0);
    busy.current = false;
  };

  if (!queue.length || done) {
    return (
      <div className="flex min-h-dvh flex-col">
        <ScreenHeader title="Pronostics en rafale" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Glyph name="check-mark-button" size={72} className="anim-pop" />
          <p className="display mt-4 text-[40px]">{done ? `${done.n} pronostics en ${done.s} s` : 'Tout est pronostiqué'}</p>
          <p className="mt-2 text-[15px] text-ink-2">Les autres joueurs ne verront tes choix qu’au verrouillage. Les points tombent à la publication.</p>
          <Button className="mt-8 w-full" onClick={pop}>Terminé</Button>
        </div>
      </div>
    );
  }

  const t = TICKER_MAP[e.ticker];
  const crowd = crowdBeat(e.id);

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader title="Pronostics en rafale" right={<span className="mr-3 text-sm font-semibold text-muted nums">{i + 1}/{queue.length}</span>} />
      <div className="mx-4 mt-3 flex gap-1" aria-hidden>{queue.map((_, k) => <span key={k} className={cx('h-1 flex-1', k < i ? 'bg-gold' : k === i ? 'bg-ink' : 'bg-line-2')} />)}</div>

      <div className="relative mx-4 mt-5 flex-1">
        {queue[i + 1] ? <div className="absolute inset-x-4 top-4 -bottom-2 rounded-[26px] bg-card/70 shadow-card" aria-hidden /> : null}
        <motion.div
          key={e.id}
          drag="x" dragSnapToOrigin={false} dragElastic={0.9} dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100 || info.velocity.x > 650) decide('beat');
            else if (info.offset.x < -100 || info.velocity.x < -650) decide('miss');
            else animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
          }}
          initial={{ scale: 0.94, y: 14, opacity: 0.6 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          style={{ x, rotate }}
          className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[26px] bg-card shadow-[0_20px_40px_-20px_rgb(76_45_180/0.55)] select-none active:cursor-grabbing"
        >
          <div className="hero h-2" />
          <motion.span className="absolute top-7 right-5 rotate-12 rounded-[10px] border-[3px] border-gain px-3 py-1" style={{ opacity: beatOpacity }}><span className="display block text-3xl text-gain">BAT</span></motion.span>
          <motion.span className="absolute top-7 left-5 -rotate-12 rounded-[10px] border-[3px] border-loss px-3 py-1" style={{ opacity: missOpacity }}><span className="display block text-3xl text-loss">MANQUE</span></motion.span>
          <div className="flex h-full flex-col items-center px-6 pt-14 pb-6 text-center">
            <CompanyLogo ticker={e.ticker} size={96} />
            <p className="display mt-5 text-[40px]">{t.name}</p>
            <p className="text-sm text-muted first-letter:uppercase">{formatDayLong(new Date(`${e.date}T12:00:00Z`))}, {e.timing === 'amc' ? 'après la clôture' : 'avant l’ouverture'}</p>
            <div className="mt-6 w-full border-y border-line py-4">
              <p className="text-xs text-muted">BPA attendu par les analystes</p>
              <p className="display mt-1 text-[56px] nums">{formatUSD(e.estimate)}</p>
            </div>
            <div className="mt-5 w-full text-left">
              <div className="flex justify-between text-xs font-semibold"><span className="text-gain">{crowd} % bat</span><span className="text-muted">tous les joueurs StockLeague</span><span className="text-loss">{100 - crowd} % manque</span></div>
              <div className="mt-1.5 flex h-1.5"><span className="bg-gain" style={{ width: `${crowd}%` }} /><span className="flex-1 bg-loss" /></div>
            </div>
            <p className="mt-auto flex items-center gap-1.5 text-xs text-muted nums"><Glyph name="stopwatch" size={14} color="currentColor" /> Verrouillage dans {formatCountdown(e.lockAt.getTime() - Date.now())}</p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-5 pb-[max(env(safe-area-inset-bottom),18px)]">
        <button onClick={() => decide('miss')} style={{ ['--lip' as string]: '#c01d37' }} className="btn-3d flex h-16 items-center justify-center gap-2 rounded-[18px] bg-loss text-lg font-extrabold text-white" aria-label="Manque les attentes"><X size={24} weight="bold" /> Manque</button>
        <button onClick={() => { setSure(!sure); haptic('tap'); }} aria-pressed={sure} style={{ ['--lip' as string]: sure ? '#e09e00' : 'var(--line-2)' }} className={cx('btn-3d flex h-16 w-20 flex-col items-center justify-center rounded-[18px] text-[11px] font-extrabold', sure ? 'bg-gold text-gold-ink' : 'border-2 border-line bg-card text-ink-2')}>
          <Glyph name="flexed-biceps" size={24} /> Sûr de moi
        </button>
        <button onClick={() => decide('beat')} style={{ ['--lip' as string]: '#0a8048' }} className="btn-3d flex h-16 items-center justify-center gap-2 rounded-[18px] bg-gain text-lg font-extrabold text-white" aria-label="Bat les attentes"><Check size={24} weight="bold" /> Bat</button>
      </div>
      <p className="pb-4 text-center text-[11px] text-muted">Glisse la carte, ou touche un bouton. « Sûr de moi » : +20 si juste, -10 si faux.</p>
    </div>
  );
}
