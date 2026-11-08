import { BellRinging, BookOpen, Camera, CaretRight, ClockCounterClockwise, Moon, PencilSimple, SignOut, Trophy, type Icon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { PhotoPicker } from '../components/photo-picker';
import { Avatar, Button, Glyph, Medallion, Ring, Segmented, cx } from '../components/ui';
import { BADGES, FRAMES, LEAGUES, ME, PASS, type FrameKey } from '../data/demo';
import { passProgress } from './SeasonPass';
import { DISCLAIMER } from '../lib/constants';
import { formatDate } from '../lib/format';
import { levelOf, LEVELS, todayKey } from '../lib/xp';
import { badgeStates } from '../state/badges';
import { useNav } from '../state/nav';
import { useStore } from '../state/store';

export function ProfileTab() {
  const store = useStore();
  const { push } = useNav();
  const badges = badgeStates(store);
  const unlocked = badges.filter((b) => b.unlocked).length;
  const lvl = levelOf(store.xp);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.pseudo);
  const days = Array.from({ length: 14 }, (_, i) => todayKey(new Date(Date.now() - (13 - i) * 86400000)));

  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-28">
      <header className="flex items-center gap-4 pt-3">
        <PhotoPicker onDone={(photo) => store.patch({ photo })} className="press relative shrink-0">
          <Avatar id={ME} size={84} />
          <span className="absolute -right-1.5 -bottom-1.5 grid size-8 place-items-center rounded-[14px] border-[3px] border-bg bg-gold text-gold-ink" aria-label="Changer la photo"><Camera size={15} weight="bold" /></span>
        </PhotoPicker>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); if (name.trim().length >= 2) { store.patch({ pseudo: name.trim() }); setEditing(false); } }} className="flex gap-2">
              <input autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className="h-11 min-w-0 flex-1 rounded-[14px] border border-line-2 bg-card px-3 text-[17px] font-bold outline-none focus:border-ink" aria-label="Pseudo" />
              <Button type="submit" className="h-11 px-3 text-sm">OK</Button>
            </form>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-left">
              <span className="display truncate text-[36px]">{store.pseudo}</span>
              <PencilSimple size={18} className="text-muted" />
            </button>
          )}
          {store.customTitle ? <p className="text-[13px] font-semibold text-gold">{store.customTitle}</p> : <p className="text-[13px] text-muted">alex@exemple.com</p>}
          <p className="text-xs text-muted nums">Inscrit le {formatDate(new Date(Date.now() - 140 * 86400000))}</p>
        </div>
      </header>

      {/* ------------------------------------------------ niveau */}
      <section className="mt-5 rounded-[14px] hero p-4 text-white">
        <div className="flex items-center gap-4">
          <Ring value={lvl.progress} size={72} stroke={5}><span className="display text-[30px] nums">{lvl.level}</span></Ring>
          <div className="flex-1">
            <p className="text-xs opacity-70">Niveau {lvl.level}</p>
            <p className="display text-[28px]">{lvl.title}</p>
            <p className="text-xs opacity-75 nums">{store.xp} XP, encore <b className="text-gold">{lvl.toNext} XP</b>{lvl.level < LEVELS.length ? ` pour « ${LEVELS[lvl.level]} »` : ''}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold"><Glyph name="fire" size={18} /> Série de {store.visitStreak} jours</span>
            <span className="opacity-70">7 jours = badge « Assidu »</span>
          </div>
          <div className="mt-2 grid grid-cols-14 gap-1" style={{ gridTemplateColumns: 'repeat(14, 1fr)' }} aria-label="Jours de connexion des deux dernières semaines">
            {days.map((d) => {
              const on = store.visitDays.includes(d) || (d === todayKey() && store.lastVisit === d);
              return <span key={d} className={cx('aspect-square rounded-[14px]', on ? 'bg-gold' : 'bg-white/10', d === todayKey() && 'ring-2 ring-white/60')} />;
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ passe, cadres, gels */}
      <button onClick={() => push({ name: 'pass' })} className="press mt-3 flex w-full items-center gap-3 rounded-[18px] bg-card shadow-card p-4 text-left">
        <Glyph name="path" size={30} />
        <span className="flex-1">
          <span className="block font-bold">Passe de saison</span>
          <span className="block text-xs text-muted nums">Palier {Math.min(passProgress(store.xp).reached + 1, PASS.length)} sur {PASS.length}, {store.claimedTiers.length} récompense{store.claimedTiers.length > 1 ? 's' : ''} récupérée{store.claimedTiers.length > 1 ? 's' : ''}</span>
        </span>
        <span className="flex items-center gap-1 text-sm font-bold text-ink nums"><Glyph name="snowflake" size={20} /> {store.freezes}</span>
      </button>
      <div className="mt-3 rounded-[18px] bg-card shadow-card p-4">
        <p className="text-sm font-bold">Cadre de ta photo</p>
        <div className="mt-3 flex gap-3">
          <button onClick={() => store.patch({ frame: null })} aria-pressed={!store.frame} className={cx('grid size-14 place-items-center border text-[11px] font-semibold', !store.frame ? 'border-gold' : 'border-line')}>Aucun</button>
          {(Object.keys(FRAMES) as FrameKey[]).map((f) => {
            const owned = PASS.some((r, i) => r.kind === 'frame' && r.frame === f && store.claimedTiers.includes(i));
            return (
              <button key={f} disabled={!owned} onClick={() => store.patch({ frame: f })} aria-pressed={store.frame === f} aria-label={FRAMES[f].label} className={cx('relative size-14 p-[3px]', store.frame === f && 'outline-2 outline-offset-2 outline-gold', !owned && 'opacity-35')} style={{ background: FRAMES[f].css }}>
                <span className="block size-full bg-card" />
                {!owned ? <Glyph name="locked" size={16} className="absolute inset-0 m-auto" /> : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">Débloque les cadres dans le passe de saison.</p>
      </div>

      <dl className="mt-3 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[20px] bg-card shadow-card text-center">
        <div className="p-3"><dt className="text-[11px] font-semibold text-muted">Ligues</dt><dd className="display mt-1 text-[28px] nums">{LEAGUES.length}</dd></div>
        <div className="p-3"><dt className="text-[11px] font-semibold text-muted">Meilleur rang</dt><dd className="display mt-1 text-[28px] nums">2<sup className="text-sm">e</sup></dd></div>
        <div className="p-3"><dt className="text-[11px] font-semibold text-muted">Badges</dt><dd className="display mt-1 text-[28px] nums">{unlocked}/{badges.length}</dd></div>
      </dl>

      <div className="mb-2 mt-7 flex items-end justify-between px-1">
        <h2 className="display text-[26px]">Badges</h2>
        <button onClick={() => push({ name: 'badges' })} className="text-sm font-semibold underline underline-offset-4">Tout voir</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {badges.slice(0, 8).map((b) => (
          <button key={b.key} onClick={() => push({ name: 'badges' })} className={cx('press flex flex-col items-center gap-2 bg-card px-1 py-3', !b.unlocked && 'opacity-60')}>
            <Medallion name={BADGES[b.key].emoji} tier={b.unlocked ? 'gold' : 'locked'} size={36} />
            <span className="text-center text-[10.5px] font-semibold leading-tight">{BADGES[b.key].label}</span>
          </button>
        ))}
      </div>

      <h2 className="display mb-2 mt-7 px-1 text-[26px]">Réglages</h2>
      <div className="overflow-hidden rounded-[20px] bg-card shadow-card">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Moon size={22} className="text-muted" />
          <span className="flex-1 text-sm font-semibold">Thème</span>
          <Segmented className="w-[196px]" value={store.theme} onChange={(theme) => store.patch({ theme })} options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }, { value: 'system', label: 'Auto' }]} />
        </div>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <BellRinging size={22} className="text-muted" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Rappel avant verrouillage</span>
            <span className="block text-xs text-muted">1 h avant chaque publication</span>
          </span>
          <button role="switch" aria-checked={store.notifications} aria-label="Rappel avant verrouillage" onClick={() => store.patch({ notifications: !store.notifications })} className={cx('relative h-7 w-12 rounded-[14px] transition-colors', store.notifications ? 'bg-gain' : 'bg-line-2')}>
            <span className={cx('absolute top-1 size-5 rounded-[14px] bg-white shadow transition-all', store.notifications ? 'left-6' : 'left-1')} />
          </button>
        </div>
        <Row icon={Trophy} label="Mes ligues" onClick={() => push({ name: 'leagues' })} />
        <Row icon={ClockCounterClockwise} label="Historique des ordres" onClick={() => push({ name: 'history' })} />
        <Row icon={BookOpen} label="Règles et barème" onClick={() => push({ name: 'rules' })} />
        <Row icon={SignOut} label="Se déconnecter" onClick={() => store.patch({ onboarded: false })} danger last />
      </div>

      <button onClick={() => store.reset()} className="mt-4 w-full text-center text-sm font-semibold text-muted underline underline-offset-4">Réinitialiser la démo</button>
      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">{DISCLAIMER}<br />StockLeague, version démo 0.5</p>
    </div>
  );
}

function Row({ icon: I, label, onClick, danger, last, right }: { icon: Icon; label: string; onClick: () => void; danger?: boolean; last?: boolean; right?: ReactNode }) {
  return (
    <button onClick={onClick} className={cx('press flex w-full items-center gap-3 px-4 py-3.5 text-left', !last && 'border-b border-line')}>
      <I size={22} className={danger ? 'text-loss' : 'text-muted'} />
      <span className={cx('flex-1 text-sm font-semibold', danger && 'text-loss')}>{label}</span>
      {right ?? <CaretRight size={16} className="text-muted" />}
    </button>
  );
}
