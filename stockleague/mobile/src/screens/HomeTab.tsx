import { CaretRight, Lightning } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Sparkline } from '../components/charts';
import { Avatar, Bar, CompanyLogo, Glyph, Trend, cx } from '../components/ui';
import { ACTIVE_LEAGUE, DUEL, EARNINGS, ME, STARTING_CASH, simulatedSeries } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatCountdown, formatUSD } from '../lib/format';
import { useCountUp } from '../lib/use-count-up';
import { levelOf, todayKey, XP, yesterdayKey } from '../lib/xp';
import { myPortfolio, standings } from '../state/derived';
import { useNav } from '../state/nav';
import { useName, useStore, type Mission } from '../state/store';
import { FeedRow } from './Activity';

const greeting = () => { const h = new Date().getHours(); return h < 6 ? 'Bonne nuit' : h < 18 ? 'Salut' : 'Bonsoir'; };

/** Accueil : ce qu'il y a à faire aujourd'hui, en un coup d'œil. */
export function HomeTab() {
  const s = useStore();
  const { push, setTab, openSheet } = useNav();
  const name = useName();
  const lvl = levelOf(s.xp);
  const now = Date.now();
  const rows = useMemo(() => standings(s.cash, s.holdings, s.picks), [s.cash, s.holdings, s.picks]);
  const me = rows.find((r) => r.id === ME)!;
  const above = rows[me.rank - 2];
  const p = myPortfolio(s.cash, s.holdings);
  const value = useCountUp(p.value);

  const nextOpen = EARNINGS.filter((e) => e.lockAt.getTime() > now).sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime());
  const todo = nextOpen.filter((e) => !s.picks[e.id]);
  const urgent = todo[0];

  const day = todayKey();
  const done = s.missions[day] ?? {};
  const missions: { id: Mission; label: string; xp: number; emoji: Parameters<typeof Glyph>[0]['name']; go: () => void }[] = [
    { id: 'pred', label: 'Fais un pronostic', xp: XP.prediction, emoji: 'crystal-ball', go: () => (urgent ? openSheet({ name: 'predict', eventId: urgent.id }) : setTab('pronos')) },
    { id: 'order', label: 'Passe un ordre', xp: XP.order, emoji: 'shopping-bags', go: () => push({ name: 'market' }) },
    { id: 'react', label: 'Réagis à l’activité d’un ami', xp: XP.reaction, emoji: 'clapping-hands', go: () => push({ name: 'activity' }) },
  ];
  const doneCount = missions.filter((m) => done[m.id]).length;
  const chest = s.chests[day];

  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),14px)] pb-28">
      {/* ------------------------------------------------ en-tête : niveau et série */}
      <header className="flex items-center gap-3 pt-2">
        <button onClick={() => setTab('profil')} aria-label="Mon profil">
          <Avatar id={ME} size={52} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="display truncate text-[32px]">{greeting()} {name(ME)}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="font-semibold text-ink">Niv. {lvl.level}</span>
            <Bar value={lvl.progress} className="flex-1" />
            <span className="nums">{lvl.toNext} XP</span>
          </div>
        </div>
        <button onClick={() => setTab('profil')} className="press flex flex-col items-center rounded-[2px] border border-line bg-card px-2.5 py-1.5" aria-label={`Série de ${s.visitStreak} jours`}>
          <Glyph name="fire" size={26} className="anim-flame" />
          <span className="display text-lg leading-none nums">{s.visitStreak}</span>
        </button>
      </header>

      {/* ------------------------------------------------ à faire maintenant */}
      {urgent ? (
        <button onClick={() => openSheet({ name: 'predict', eventId: urgent.id })} className="press mt-4 block w-full overflow-hidden rounded-[2px] bg-board text-left text-board-ink">
          <div className="flex items-center gap-3 p-4">
            <CompanyLogo ticker={urgent.ticker} size={52} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gold">À faire maintenant</p>
              <p className="mt-0.5 text-[17px] font-bold leading-tight">{TICKER_MAP[urgent.ticker].name} va-t-il battre les attentes ?</p>
              <p className="mt-1 text-xs opacity-75 nums">Verrouillage dans <b className="text-board-ink">{formatCountdown(urgent.lockAt.getTime() - now)}</b></p>
            </div>
            <CaretRight size={20} weight="bold" className="opacity-70" />
          </div>
          {todo.length > 1 ? <p className="border-t border-white/10 bg-board-2 px-4 py-2 text-xs">+ {todo.length - 1} autre{todo.length > 2 ? 's' : ''} pronostic{todo.length > 2 ? 's' : ''} à faire cette semaine</p> : null}
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-[2px] border border-line bg-card p-4">
          <Glyph name="check-mark-button" size={36} />
          <p className="text-sm"><b>Tout est à jour.</b> Tes pronostics de la semaine sont faits.</p>
        </div>
      )}

      {/* ------------------------------------------------ missions du jour */}
      <section className="mt-3 rounded-[2px] border border-line bg-card">
        <div className="flex items-center justify-between px-4 pt-3.5">
          <h2 className="display text-[24px]">Missions du jour</h2>
          <span className="text-xs font-bold text-muted nums">{doneCount}/3</span>
        </div>
        <ul className="mt-1">
          {missions.map((m) => (
            <li key={m.id}>
              <button disabled={done[m.id]} onClick={m.go} className="press flex w-full items-center gap-3 px-4 py-2.5 text-left disabled:active:scale-100">
                <span className={cx('grid size-10 place-items-center rounded-[2px] border', done[m.id] ? 'border-gain bg-gain-soft' : 'border-line bg-card-2')}>
                  {done[m.id] ? <Glyph name="check-mark-button" size={22} /> : <Glyph name={m.emoji} size={22} />}
                </span>
                <span className={cx('flex-1 text-sm font-semibold', done[m.id] && 'text-muted line-through')}>{m.label}</span>
                <span className={cx('rounded-[2px] px-1.5 py-0.5 text-xs font-bold nums', done[m.id] ? 'text-muted' : 'bg-gold/20 text-ink')}>+{m.xp} XP</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-[2px] bg-card-2"><div className="h-full rounded-[2px] bg-gold transition-[width] duration-500" style={{ width: `${(doneCount / 3) * 100}%` }} /></div>
            <p className="mt-1 text-[11px] text-muted">{chest ? `Coffre ouvert : +${chest} XP. Nouvelles missions demain.` : doneCount === 3 ? 'Le coffre du jour est prêt.' : 'Termine les 3 missions pour ouvrir le coffre du jour.'}</p>
          </div>
          <button onClick={() => doneCount === 3 && !chest && s.openChest()} disabled={doneCount < 3 || !!chest} aria-label="Ouvrir le coffre du jour" className={cx('press grid size-12 place-items-center rounded-[2px] border', doneCount === 3 && !chest ? 'border-gold bg-gold/15' : 'border-line bg-card-2', doneCount < 3 && 'opacity-60')}>
            <Glyph name="wrapped-gift" size={30} className={doneCount === 3 && !chest ? 'anim-shake' : chest ? 'grayscale' : ''} />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ défi éclair */}
      <FlashChallenge />

      {/* ------------------------------------------------ duel de la semaine */}
      <button onClick={() => setTab('ligue')} className="press mt-3 block w-full rounded-[2px] border border-line bg-card p-4 text-left">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><Glyph name="crossed-swords" size={24} /><span className="display text-[24px]">Duel de la semaine</span></span>
          <span className="text-xs text-muted">fin vendredi</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Avatar id={ME} size={44} />
          <div className="flex-1">
            <div className="flex justify-between text-sm font-bold nums"><span>{DUEL.mine} pts</span><span>{DUEL.theirs} pts</span></div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-[2px]">
              <span className="bg-gold" style={{ width: `${(DUEL.mine / (DUEL.mine + DUEL.theirs)) * 100}%` }} />
              <span className="flex-1 bg-board dark:bg-line-2" />
            </div>
          </div>
          <Avatar id={DUEL.opponent} size={44} />
        </div>
        <p className="mt-2.5 text-xs text-ink-2">Il te manque <b className="text-ink nums">{DUEL.theirs - DUEL.mine + 1} pts</b> pour passer devant {name(DUEL.opponent)}. Un pronostic juste en « sûr de moi » suffit.</p>
      </button>

      {/* ------------------------------------------------ classement et portefeuille */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button onClick={() => setTab('ligue')} className="press rounded-[2px] border border-line bg-card p-3 text-left">
          <p className="text-[11px] font-semibold text-muted">{ACTIVE_LEAGUE.name}</p>
          <p className="display mt-1 text-[40px] leading-none nums">{me.rank}<sup className="text-base">e</sup></p>
          <p className="mt-1 text-[11px] text-ink-2">{above ? <>à <b className="nums">{above.total - me.total + 1} pts</b> de {name(above.id)}</> : 'en tête'}</p>
        </button>
        <button onClick={() => setTab('portefeuille')} className="press rounded-[2px] border border-line bg-card p-3 text-left">
          <p className="text-[11px] font-semibold text-muted">Portefeuille</p>
          <p className="mt-1 truncate text-[19px] font-bold nums">{formatUSD(value)}</p>
          <div className="mt-1 flex items-end justify-between">
            <Trend value={p.returnPct} className="text-xs" />
            <Sparkline values={simulatedSeries('alex-portfolio', 38, STARTING_CASH, p.value, 0.009).slice(-14)} width={52} height={22} />
          </div>
        </button>
      </div>

      {/* ------------------------------------------------ activité */}
      <div className="mb-2 mt-7 flex items-end justify-between px-1">
        <h2 className="display text-[26px]">Dans la ligue</h2>
        <button onClick={() => push({ name: 'activity' })} className="text-sm font-semibold underline underline-offset-4">Tout voir</button>
      </div>
      <ul className="-mx-4 border-y border-line bg-card">
        {[...s.feed].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 3).map((f) => <FeedRow key={f.id} f={f} />)}
      </ul>
    </div>
  );
}

/** Défi éclair : une question par jour, réponse en un geste, résultat le lendemain (XP seulement). */
function FlashChallenge() {
  const { flash, flashPick } = useStore();
  const today = flash[todayKey()];
  const yesterday = flash[yesterdayKey()];
  const [justPicked, setJustPicked] = useState(false);
  return (
    <section className="mt-3 rounded-[2px] border border-line bg-card p-4">
      <div className="flex items-center gap-2">
        <Glyph name="high-voltage" size={24} />
        <h2 className="display text-[24px]">Défi éclair</h2>
        <span className="ml-auto rounded-[2px] bg-gold/20 px-1.5 py-0.5 text-xs font-bold">+{XP.flash} XP</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold">Le S&amp;P 500 finira-t-il la journée en hausse ?</p>
      {today ? (
        <p className={cx('mt-3 flex items-center gap-2 rounded-[2px] bg-card-2 p-3 text-sm', justPicked && 'anim-pop')}>
          <Lightning size={18} weight="fill" className="text-gold" />
          Tu as répondu <b>{today === 'up' ? 'hausse' : 'baisse'}</b>. Résultat demain matin.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { flashPick('up'); setJustPicked(true); }} className="press flex h-12 items-center justify-center gap-2 rounded-[2px] border-2 border-gain/40 bg-gain-soft font-bold text-gain"><Glyph name="chart-increasing" size={22} /> Hausse</button>
          <button onClick={() => { flashPick('down'); setJustPicked(true); }} className="press flex h-12 items-center justify-center gap-2 rounded-[2px] border-2 border-loss/40 bg-loss-soft font-bold text-loss"><Glyph name="chart-decreasing" size={22} /> Baisse</button>
        </div>
      )}
      {yesterday ? <p className="mt-2.5 text-xs text-muted">Hier : tu avais dit {yesterday === 'up' ? 'hausse' : 'baisse'}, le S&amp;P 500 a fini à +0,62 %. {yesterday === 'up' ? `Bien vu, +${XP.flash} XP.` : 'Raté cette fois.'}</p> : null}
    </section>
  );
}
