import { CaretRight, LockSimple } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Avatar, CompanyLogo, Glyph, EmptyState, Segmented, Tag, cx } from '../components/ui';
import { EARNINGS, LIVE_RESULTS, ME, PLAYERS, type EarningsEvent, type MyPick } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatCountdown, formatDayLong, formatPoints, formatUSD } from '../lib/format';
import { outcomeOf, predictionPoints, SCORING } from '../lib/scoring';
import { myPredictionStats } from '../state/derived';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

type View = 'open' | 'locked' | 'done';
const eps = (n: number) => formatUSD(n);

export function PronosTab() {
  const { picks, revealed } = useStore();
  const { openSheet, push } = useNav();
  const [view, setView] = useState<View>('open');
  const now = Date.now();
  const stats = myPredictionStats(picks);

  const groups = useMemo(() => ({
    open: EARNINGS.filter((e) => e.lockAt.getTime() > now).sort((a, b) => a.lockAt.getTime() - b.lockAt.getTime()),
    locked: EARNINGS.filter((e) => e.lockAt.getTime() <= now && e.actual === null),
    done: EARNINGS.filter((e) => e.actual !== null).sort((a, b) => b.date.localeCompare(a.date)),
  }), [now, revealed]); // eslint-disable-line react-hooks/exhaustive-deps
  const toPick = groups.open.filter((e) => !picks[e.id]).length;
  const nextBonus = SCORING.streak.threshold + 1 - stats.streak;

  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28">
      <h1 className="display pt-2 text-[40px]">Pronostics</h1>
      <p className="mt-1 text-[13px] text-muted">Le bénéfice publié battra-t-il ou manquera-t-il l’estimation des analystes ?</p>
      <button onClick={() => openSheet({ name: 'glossary' })} className="press mt-2 inline-flex items-center gap-1.5 rounded-[18px] bg-card shadow-card px-2.5 py-1.5 text-xs font-semibold"><Glyph name="light-bulb" size={16} /> C’est quoi le BPA ?</button>

      {/* ------------------------------------------------ série et stats */}
      <div className="grad-pink mt-4 overflow-hidden rounded-[22px] text-white shadow-[0_14px_30px_-14px_rgb(255_61_139/0.8)]">
        <div className="flex items-center gap-3 border-b border-white/20 p-4">
          <Glyph name="fire" size={52} className="anim-flame" />
          <div className="flex-1">
            <p className="font-bold">Série de {stats.streak} pronostic{stats.streak > 1 ? 's' : ''} juste{stats.streak > 1 ? 's' : ''}</p>
            <p className="text-xs opacity-85">
              {nextBonus > 0 ? `Encore ${nextBonus} pour déclencher le bonus de +${SCORING.streak.bonusPerCorrect} pts.` : `Bonus de +${SCORING.streak.bonusPerCorrect} pts à chaque nouveau pronostic juste.`}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-white/20 text-center">
          <div className="p-3"><dt className="text-[11px] font-semibold opacity-80">Points</dt><dd className="display mt-1 text-2xl nums">{formatPoints(stats.points)}</dd></div>
          <div className="p-3"><dt className="text-[11px] font-semibold opacity-80">Réussite</dt><dd className="display mt-1 text-2xl nums">{stats.decided ? Math.round((stats.correct / stats.decided) * 100) : 0} %</dd></div>
          <div className="p-3"><dt className="text-[11px] font-semibold opacity-80">Justes</dt><dd className="display mt-1 text-2xl nums">{stats.correct}/{stats.decided}</dd></div>
        </dl>
      </div>

      {toPick > 0 ? (
        <button onClick={() => push({ name: 'swipe' })} className="press mt-3 flex w-full items-center gap-3 bg-gold p-3.5 text-left text-gold-ink">
          <Glyph name="swipe" size={34} />
          <span className="flex-1"><span className="block font-bold">Mode rafale</span><span className="block text-xs">{toPick} pronostics à faire : glisse, c’est fait.</span></span>
          <CaretRight size={18} weight="bold" />
        </button>
      ) : null}

      <Segmented
        className="mt-4"
        value={view}
        onChange={setView}
        options={[
          { value: 'open', label: `À venir${toPick ? ` (${toPick})` : ''}` },
          { value: 'locked', label: 'En attente' },
          { value: 'done', label: 'Résultats' },
        ]}
      />

      <div className="mt-3">
        {view === 'open' ? <OpenList events={groups.open} picks={picks} /> : null}
        {view === 'locked' ? (groups.locked.length ? groups.locked.map((e) => <LockedCard key={e.id} e={e} pick={picks[e.id]} />) : <EmptyState emoji="hourglass-not-done" title="Rien en attente">Les pronostics verrouillés apparaissent ici jusqu’à la publication du résultat.</EmptyState>) : null}
        {view === 'done' ? <div className="space-y-2">{groups.done.map((e) => <ResultCard key={e.id} e={e} pick={picks[e.id]} />)}</div> : null}
      </div>
    </div>
  );
}

function TimingLabel({ e }: { e: EarningsEvent }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <Glyph name={e.timing === 'amc' ? 'crescent-moon' : 'sun'} size={14} />
      {e.timing === 'amc' ? 'Après la clôture' : 'Avant l’ouverture'}
    </span>
  );
}

function OpenList({ events, picks }: { events: EarningsEvent[]; picks: Record<string, MyPick> }) {
  const { openSheet } = useNav();
  const byDay = new Map<string, EarningsEvent[]>();
  events.forEach((e) => byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]));
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-2 px-1 text-[13px] font-bold text-ink-2 first-letter:uppercase">
            {day === tomorrow ? 'Demain, ' : ''}{formatDayLong(new Date(`${day}T12:00:00Z`))}
          </h3>
          <div className="space-y-2">
            {list.map((e) => {
              const t = TICKER_MAP[e.ticker];
              const pick = picks[e.id];
              const left = e.lockAt.getTime() - Date.now();
              return (
                <button key={e.id} onClick={() => openSheet({ name: 'predict', eventId: e.id })} className="press flex w-full items-center gap-3 rounded-[18px] bg-card shadow-card p-3 text-left">
                  <CompanyLogo ticker={e.ticker} size={46} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate font-bold">{t.name}</span>
                      <span className="text-[11px] font-semibold text-muted">{e.quarter}</span>
                    </span>
                    <TimingLabel e={e} />
                    <span className="mt-1 block text-xs nums">BPA attendu <b>{eps(e.estimate)}</b></span>
                    <span className={cx('mt-0.5 flex items-center gap-1 text-xs nums', left < 86400000 ? 'font-semibold text-loss' : 'text-muted')}>
                      <Glyph name="stopwatch" size={13} color="currentColor" /> Verrouillage dans {formatCountdown(left)}
                    </span>
                  </span>
                  {pick ? (
                    <span className="flex flex-col items-end gap-1">
                      <Tag tone={pick.choice === 'beat' ? 'gain' : 'loss'}>{pick.choice === 'beat' ? '▲ Bat' : '▼ Manque'}</Tag>
                      {pick.confidence === 'sure' ? <Tag tone="gold">Sûr de moi</Tag> : null}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-[14px] hero px-2.5 py-2 text-xs font-bold text-white">
                      Pronostiquer <CaretRight size={12} weight="bold" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Pronostic verrouillé : les choix de tous deviennent visibles. */
export function PicksSplit({ e, mine }: { e: EarningsEvent; mine?: MyPick }) {
  const all: Record<string, string> = { ...e.picks, ...(mine ? { [ME]: mine.choice } : {}) };
  const beat = PLAYERS.filter((p) => all[p.id] === 'beat');
  const miss = PLAYERS.filter((p) => all[p.id] === 'miss');
  const total = beat.length + miss.length || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-[14px]" role="img" aria-label={`${beat.length} bat, ${miss.length} manque`}>
        <span className="bg-gain" style={{ width: `${(beat.length / total) * 100}%` }} />
        <span className="bg-loss" style={{ width: `${(miss.length / total) * 100}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
        {[{ list: beat, label: 'Bat', tone: 'text-gain' }, { list: miss, label: 'Manque', tone: 'text-loss' }].map((c) => (
          <div key={c.label}>
            <p className={cx('mb-1 font-bold', c.tone)}>{c.label} ({c.list.length})</p>
            <div className="flex -space-x-1.5">{c.list.map((p) => <Avatar key={p.id} id={p.id} size={26} className="border-2 border-card" />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LockedCard({ e, pick }: { e: EarningsEvent; pick?: MyPick }) {
  const t = TICKER_MAP[e.ticker];
  return (
    <div className="rounded-[18px] bg-card shadow-card p-3">
      <div className="flex items-center gap-3">
        <CompanyLogo ticker={e.ticker} size={46} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.name} <span className="text-[11px] font-semibold text-muted">{e.quarter}</span></p>
          <TimingLabel e={e} />
          <p className="text-xs nums">BPA attendu <b>{eps(e.estimate)}</b></p>
        </div>
        <Tag><LockSimple size={11} weight="bold" /> Verrouillé</Tag>
      </div>
      <div className="mt-3 border-t border-line pt-3"><PicksSplit e={e} mine={pick} /></div>
      <RevealButton id={e.id} />
    </div>
  );
}

function ResultCard({ e, pick }: { e: EarningsEvent; pick?: MyPick }) {
  const t = TICKER_MAP[e.ticker];
  const actual = e.actual!;
  const verdict = actual === e.estimate ? 'void' : actual > e.estimate ? 'beat' : 'miss';
  const outcome = pick ? outcomeOf(pick.choice, e.estimate, actual) : null;
  const pts = pick && outcome ? predictionPoints(outcome, pick.confidence) : 0;
  return (
    <div className="rounded-[18px] bg-card shadow-card p-3">
      <div className="flex items-center gap-3">
        <CompanyLogo ticker={e.ticker} size={42} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t.name} <span className="text-[11px] font-semibold text-muted">{e.quarter}</span></p>
          <p className="text-xs nums">
            <b>{eps(actual)}</b> <span className="text-muted">publié contre {eps(e.estimate)} attendu</span>
          </p>
        </div>
        <Tag tone={verdict === 'beat' ? 'gain' : verdict === 'miss' ? 'loss' : 'neutral'}>{verdict === 'beat' ? 'Battu' : verdict === 'miss' ? 'Manqué' : 'Égalité'}</Tag>
      </div>
      {pick ? (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-xs">
          <Glyph name={outcome === 'correct' ? 'bullseye' : outcome === 'void' ? 'thinking-face' : 'snail'} size={20} />
          <span className="flex-1 text-ink-2">
            Ton pronostic : <b className="text-ink">{pick.choice === 'beat' ? 'bat' : 'manque'}</b>{pick.confidence === 'sure' ? ', sûr de toi' : ''}
            {outcome === 'void' ? ' (annulé pour égalité)' : ''}
          </span>
          <span className={cx('display text-lg nums', pts > 0 ? 'text-gain' : pts < 0 ? 'text-loss' : 'text-muted')}>{formatPoints(pts)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Résultat publié et pas encore révélé : on invite le joueur à le découvrir. */
function RevealButton({ id }: { id: string }) {
  const { push } = useNav();
  if (!(id in LIVE_RESULTS)) return <p className="mt-3 text-[11px] text-muted">Résultat récupéré automatiquement après la publication, puis points attribués.</p>;
  return (
    <button onClick={() => push({ name: 'reveal', eventId: id })} className="press mt-3 flex h-12 w-full items-center justify-center gap-2 bg-gold font-bold text-gold-ink">
      <Glyph name="bell" size={20} color="#0a0d12" /> Résultat tombé : révéler
    </button>
  );
}
