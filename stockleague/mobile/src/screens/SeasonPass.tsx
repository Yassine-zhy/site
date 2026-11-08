import { Check, LockSimple } from '@phosphor-icons/react';
import { Avatar, Button, Glyph, Medallion, ScreenHeader, cx } from '../components/ui';
import { FRAMES, ME, PASS, PASS_BASE_XP, PASS_TIER_XP, type PassReward } from '../data/demo';
import { useStore } from '../state/store';

export const passProgress = (xp: number) => {
  const seasonXp = Math.max(0, xp - PASS_BASE_XP);
  return { seasonXp, reached: Math.min(PASS.length, Math.floor(seasonXp / PASS_TIER_XP)), inTier: (seasonXp % PASS_TIER_XP) / PASS_TIER_XP };
};
export const rewardLabel = (r: PassReward) =>
  r.kind === 'frame' ? `Cadre photo « ${FRAMES[r.frame].label} »` : r.kind === 'freeze' ? 'Gel de série' : r.kind === 'title' ? `Titre « ${r.title} »` : `+${r.amount} XP`;

/** Passe de saison : 10 paliers à débloquer avec l'XP de la saison (récompenses cosmétiques). */
export function SeasonPassScreen() {
  const s = useStore();
  const { seasonXp, reached, inTier } = passProgress(s.xp);
  return (
    <div className="pb-10">
      <ScreenHeader title="Passe de saison" />
      <section className="bg-board px-4 py-5 text-board-ink">
        <p className="text-xs font-semibold text-gold">Saison 2, Ligue des Loups</p>
        <p className="display mt-1 text-[44px] leading-none">Palier {Math.min(reached + 1, PASS.length)}<span className="text-[24px] text-muted"> / {PASS.length}</span></p>
        <div className="mt-3 h-1.5 bg-white/10"><div className="h-full bg-gold" style={{ width: `${reached >= PASS.length ? 100 : inTier * 100}%` }} /></div>
        <p className="mt-2 text-xs opacity-75 nums">{seasonXp} XP gagnés cette saison. {reached < PASS.length ? `Encore ${PASS_TIER_XP - (seasonXp % PASS_TIER_XP)} XP pour le prochain palier.` : 'Passe terminé, bravo.'}</p>
      </section>
      <ol className="mt-2">
        {PASS.map((r, i) => {
          const unlocked = i < reached;
          const claimed = s.claimedTiers.includes(i);
          return (
            <li key={i} className={cx('flex items-center gap-4 border-b border-line px-4 py-4', !unlocked && 'opacity-55')}>
              <span className="display w-8 text-[28px] text-muted nums">{i + 1}</span>
              {r.kind === 'frame' ? (
                <span className="grid size-12 place-items-center" style={{ background: FRAMES[r.frame].css, padding: 3 }}><Avatar id={ME} size={42} /></span>
              ) : (
                <Medallion name={r.kind === 'freeze' ? 'snowflake' : r.kind === 'title' ? 'id-card' : 'path'} tier={unlocked ? 'gold' : 'locked'} size={44} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{rewardLabel(r)}</span>
                <span className="block text-xs text-muted">{r.kind === 'freeze' ? 'Protège ta série si tu rates un jour' : r.kind === 'frame' ? 'Visible par tes amis partout' : r.kind === 'title' ? 'Affiché sous ton nom' : 'Coup de pouce de progression'}</span>
              </span>
              {claimed ? <Check size={22} weight="bold" className="text-gain" aria-label="Récupéré" />
                : unlocked ? <Button variant="gold" className="h-10 px-3 text-sm" onClick={() => s.claimTier(i)}>Récupérer</Button>
                : <LockSimple size={20} className="text-muted" aria-label="Verrouillé" />}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 flex items-start gap-2 px-4 text-xs text-muted"><Glyph name="shield" size={16} /> Récompenses uniquement esthétiques ou de confort : elles ne donnent aucun point de classement.</p>
    </div>
  );
}
