import { Check, X } from '@phosphor-icons/react';
import { useRef, useState, type PointerEvent } from 'react';
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
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [leaving, setLeaving] = useState<null | 'beat' | 'miss'>(null);
  const start = useRef({ x: 0, y: 0, t: 0 });
  const startedAt = useRef(Date.now());
  const [done, setDone] = useState<{ n: number; s: number } | null>(null);
  const e = queue[i];

  const decide = (choice: 'beat' | 'miss') => {
    if (!e || leaving) return;
    setLeaving(choice);
    haptic('tap');
    setTimeout(() => {
      pick(e.id, e.ticker, choice, sure ? 'sure' : 'normal', true);
      setLeaving(null); setDrag({ x: 0, y: 0, active: false }); setSure(false);
      if (i + 1 >= queue.length) {
        setDone({ n: queue.length, s: Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)) });
        grant(30 * queue.length, `${queue.length} pronostics d’un coup`, 'swipe', true);
      }
      else setI(i + 1);
    }, 220);
  };
  const down = (ev: PointerEvent) => { (ev.currentTarget as Element).setPointerCapture(ev.pointerId); start.current = { x: ev.clientX, y: ev.clientY, t: Date.now() }; setDrag({ x: 0, y: 0, active: true }); };
  const move = (ev: PointerEvent) => { if (drag.active) setDrag({ x: ev.clientX - start.current.x, y: ev.clientY - start.current.y, active: true }); };
  const up = () => { if (drag.x > 90) decide('beat'); else if (drag.x < -90) decide('miss'); else setDrag({ x: 0, y: 0, active: false }); };

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
  const x = leaving === 'beat' ? 500 : leaving === 'miss' ? -500 : drag.x;
  const lean = Math.max(-1, Math.min(1, x / 120));

  return (
    <div className="flex min-h-dvh flex-col">
      <ScreenHeader title="Pronostics en rafale" right={<span className="mr-3 text-sm font-semibold text-muted nums">{i + 1}/{queue.length}</span>} />
      <div className="mx-4 mt-3 flex gap-1" aria-hidden>{queue.map((_, k) => <span key={k} className={cx('h-1 flex-1', k < i ? 'bg-gold' : k === i ? 'bg-ink' : 'bg-line-2')} />)}</div>

      <div className="relative mx-4 mt-5 flex-1">
        {queue[i + 1] ? <div className="absolute inset-x-3 top-3 bottom-0 border border-line bg-card-2" aria-hidden /> : null}
        <div
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="absolute inset-0 touch-none border border-line bg-card select-none"
          style={{ transform: `translateX(${x}px) rotate(${lean * 8}deg)`, transition: drag.active && !leaving ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.2,1)' }}
        >
          <div className="absolute inset-x-0 top-0 h-1" style={{ background: lean > 0.15 ? 'var(--gain)' : lean < -0.15 ? 'var(--loss)' : 'var(--gold)' }} />
          <span className="slant absolute top-6 right-4 bg-gain px-3 py-1 transition-opacity" style={{ opacity: Math.max(0, lean) }}><span className="unslant display block text-2xl text-white">BAT</span></span>
          <span className="slant absolute top-6 left-4 bg-loss px-3 py-1 transition-opacity" style={{ opacity: Math.max(0, -lean) }}><span className="unslant display block text-2xl text-white">MANQUE</span></span>

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
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-5 pb-[max(env(safe-area-inset-bottom),18px)]">
        <button onClick={() => decide('miss')} className="press flex h-16 items-center justify-center gap-2 bg-loss text-lg font-bold text-white dark:text-[#1f0705]" aria-label="Manque les attentes"><X size={24} weight="bold" /> Manque</button>
        <button onClick={() => { setSure(!sure); haptic('tap'); }} aria-pressed={sure} className={cx('press flex h-16 w-20 flex-col items-center justify-center border text-[11px] font-bold', sure ? 'border-gold bg-gold text-gold-ink' : 'border-line-2 text-ink-2')}>
          <Glyph name="flexed-biceps" size={22} color={sure ? '#0a0d12' : undefined} /> Sûr de moi
        </button>
        <button onClick={() => decide('beat')} className="press flex h-16 items-center justify-center gap-2 bg-gain text-lg font-bold text-white dark:text-[#03140b]" aria-label="Bat les attentes"><Check size={24} weight="bold" /> Bat</button>
      </div>
      <p className="pb-4 text-center text-[11px] text-muted">Glisse la carte, ou touche un bouton. « Sûr de moi » : +20 si juste, -10 si faux.</p>
    </div>
  );
}
