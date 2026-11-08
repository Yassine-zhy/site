import { LockSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { SheetFrame } from '../components/sheet';
import { Button, CompanyLogo, Glyph, cx } from '../components/ui';
import { EARNINGS } from '../data/demo';
import { TICKER_MAP } from '../data/tickers';
import { formatCountdown, formatDayLong, formatUSD } from '../lib/format';
import { SCORING, type Choice, type Confidence } from '../lib/scoring';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';
import { PicksSplit } from './PronosTab';

export function PredictSheet({ eventId }: { eventId: string }) {
  const e = EARNINGS.find((x) => x.id === eventId)!;
  const t = TICKER_MAP[e.ticker];
  const store = useStore();
  const { closeSheet } = useNav();
  const existing = store.picks[eventId];
  const [choice, setChoice] = useState<Choice | null>(existing?.choice ?? null);
  const [confidence, setConfidence] = useState<Confidence>(existing?.confidence ?? 'normal');
  const [saved, setSaved] = useState(false);
  const locked = e.lockAt.getTime() <= Date.now();
  const p = SCORING.prediction;

  if (saved) {
    return (
      <SheetFrame title="Pronostic enregistré">
        <div className="px-5 pt-4 text-center">
          <Glyph name="bullseye" size={72} className="anim-pop mx-auto" />
          <p className="display mt-4 text-[32px]">Pronostic enregistré</p>
          <p className="mt-2 text-[15px] text-ink-2">
            {t.name} {choice === 'beat' ? 'bat' : 'manque'} les attentes{confidence === 'sure' ? ', et tu es sûr de toi' : ''}. Modifiable jusqu’au verrouillage, dans {formatCountdown(e.lockAt.getTime() - Date.now())}.
          </p>
          <p className="mt-2 text-xs text-muted">Les pronostics des autres joueurs restent cachés jusque-là.</p>
          <Button className="mt-6 w-full" onClick={closeSheet}>Terminé</Button>
        </div>
      </SheetFrame>
    );
  }

  return (
    <SheetFrame title={`Pronostic ${t.name}`}>
      <div className="px-4 pt-2">
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={e.ticker} size={48} />
          <div>
            <p className="text-[17px] font-bold">{t.name} publie ses résultats {e.quarter}</p>
            <p className="text-xs text-muted first-letter:uppercase">
              {formatDayLong(new Date(`${e.date}T12:00:00Z`))}, {e.timing === 'amc' ? 'après la clôture' : 'avant l’ouverture'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[14px] hero p-4 text-white">
          <div>
            <p className="text-xs opacity-70">BPA attendu par les analystes</p>
            <p className="display mt-1 text-[40px] nums">{formatUSD(e.estimate)}</p>
          </div>
          <div className="text-right text-xs">
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-[14px] bg-white/10 px-2 py-1 font-bold"><LockSimple size={12} weight="bold" /> Verrouillé</span>
            ) : (
              <>
                <p className="opacity-70">Verrouillage dans</p>
                <p className="display mt-1 text-2xl text-gold nums">{formatCountdown(e.lockAt.getTime() - Date.now())}</p>
              </>
            )}
          </div>
        </div>

        {locked ? (
          <div className="mt-4">
            <p className="mb-2 text-sm font-bold">Les pronostics de la ligue</p>
            <PicksSplit e={e} mine={existing} />
            <Button variant="secondary" className="mt-5 w-full" onClick={closeSheet}>Fermer</Button>
          </div>
        ) : (
          <>
            <p className="mt-5 mb-2 text-sm font-bold">Le BPA publié va…</p>
            <div className="grid grid-cols-2 gap-2">
              {([['beat', 'Battre les attentes', 'chart-increasing', 'gain'], ['miss', 'Manquer les attentes', 'chart-decreasing', 'loss']] as const).map(([v, label, emoji, tone]) => (
                <button
                  key={v}
                  onClick={() => setChoice(v)}
                  aria-pressed={choice === v}
                  className={cx('press flex flex-col items-center gap-2 rounded-[14px] border-2 p-4', choice === v ? (tone === 'gain' ? 'border-gain bg-gain-soft' : 'border-loss bg-loss-soft') : 'border-line bg-card')}
                >
                  <Glyph name={emoji} size={44} />
                  <span className="text-center text-sm font-bold leading-tight">{label}</span>
                </button>
              ))}
            </div>

            <p className="mt-5 mb-2 text-sm font-bold">Ton niveau de confiance</p>
            <div className="grid grid-cols-2 gap-2">
              {([['normal', 'Normal', 'thinking-face', `+${p.correct} si juste, ${p.wrong} si faux`], ['sure', 'Sûr de moi', 'flexed-biceps', `+${p.sureCorrect} si juste, ${p.sureWrong} si faux`]] as const).map(([v, label, emoji, rule]) => (
                <button key={v} onClick={() => setConfidence(v)} aria-pressed={confidence === v} className={cx('press flex items-center gap-2 rounded-[14px] border-2 p-3 text-left', confidence === v ? 'border-ink bg-card-2' : 'border-line bg-card')}>
                  <Glyph name={emoji} size={28} />
                  <span>
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="block text-[11px] text-muted">{rule}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted">Égalité exacte avec l’estimation : pronostic annulé, 0 point.</p>
            <Button className="mt-4 w-full" disabled={!choice} onClick={() => { store.pick(e.id, e.ticker, choice!, confidence); setSaved(true); }}>
              {existing ? 'Modifier mon pronostic' : 'Valider mon pronostic'}
            </Button>
          </>
        )}
      </div>
    </SheetFrame>
  );
}
