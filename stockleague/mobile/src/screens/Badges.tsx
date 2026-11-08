import { Medallion, ScreenHeader, cx } from '../components/ui';
import { BADGES } from '../data/demo';
import { badgeStates } from '../state/badges';
import { useStore } from '../state/store';

export function BadgesScreen() {
  const states = badgeStates(useStore());
  return (
    <div className="pb-10">
      <ScreenHeader title="Mes badges" />
      <p className="px-5 pt-4 text-sm text-muted">{states.filter((b) => b.unlocked).length} débloqués sur {states.length} dans la Ligue des Loups.</p>
      <div className="grid grid-cols-2 gap-2 px-4 pt-3">
        {states.map((b) => {
          const def = BADGES[b.key];
          const pct = b.goal ? Math.min(100, ((b.progress ?? 0) / b.goal) * 100) : 0;
          return (
            <div key={b.key} className={cx('rounded-[14px] border bg-card p-4', b.unlocked ? 'border-line' : 'border-dashed border-line-2')}>
              <Medallion name={def.emoji} tier={b.unlocked ? 'gold' : 'locked'} size={46} />
              <p className="mt-2 font-bold">{def.label}</p>
              <p className="text-xs text-muted">{def.rule}</p>
              {b.unlocked ? (
                <p className="mt-2 text-xs font-bold text-gain">Débloqué</p>
              ) : b.goal ? (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-[14px] bg-card-2"><div className="h-full bg-gold" style={{ width: `${pct}%` }} /></div>
                  <p className="mt-1 text-[11px] text-muted nums">{(b.progress ?? 0).toLocaleString('fr-FR')} / {b.goal}</p>
                </div>
              ) : <p className="mt-2 text-xs text-muted">À débloquer</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
