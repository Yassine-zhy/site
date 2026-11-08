import { Avatar, Button, CompanyLogo, Glyph, LogoMark } from '../components/ui';
import type { GlyphName } from '../data/glyphs';
import { APP_NAME, DISCLAIMER } from '../lib/constants';

const POINTS: { icon: GlyphName; title: string; text: string }[] = [
  { icon: 'money-bag', title: '10 000 $ fictifs', text: 'De vraies actions, aux vrais cours du marché.' },
  { icon: 'crystal-ball', title: 'Des pronostics', text: 'Apple, Nike, Tesla vont-elles battre les attentes ?' },
  { icon: 'trophy', title: 'Une saison, un gagnant', text: 'Classement en direct, titres chaque soir.' },
];
const CARDS = [
  { id: 'lea', rank: 2, pts: '+121', ticker: 'V' },
  { id: 'yanis', rank: 1, pts: '+134', ticker: 'AVGO' },
  { id: 'mehdi', rank: 3, pts: '+108', ticker: 'TSLA' },
];
const TIER = ['', 'var(--gold)', 'var(--silver)', 'var(--bronze)'];

/** Écran d'accueil au premier lancement. */
export function WelcomeScreen({ onDemo, onLogin }: { onDemo: () => void; onLogin: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#07090d] px-5 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)] text-[#f3f5f8]">
      <div className="flex items-center gap-2 pt-2"><LogoMark size={30} /><span className="display text-[26px]">{APP_NAME}</span></div>

      {/* Le produit d'un coup d'œil : le podium d'une vraie ligue */}
      <div className="mt-7 grid grid-cols-[1fr_1.18fr_1fr] items-end gap-2" aria-hidden>
        {CARDS.map((c) => (
          <div key={c.id}>
            <div className="relative overflow-hidden rounded-[2px]" style={{ aspectRatio: c.rank === 1 ? '3 / 4.1' : '3 / 3.6', boxShadow: `inset 0 0 0 1px ${TIER[c.rank]}` }}>
              <Avatar id={c.id} size={300} className="!h-full !w-full" />
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 to-transparent" />
              <span className="display absolute top-1 left-2 text-[32px]" style={{ color: TIER[c.rank] }}>{c.rank}</span>
              <CompanyLogo ticker={c.ticker} size={24} className="absolute top-2 right-2" />
              <span className="display absolute bottom-2 left-2 text-[22px] nums">{c.pts} pts</span>
            </div>
            <div className="h-[3px]" style={{ background: TIER[c.rank] }} />
          </div>
        ))}
      </div>

      <h1 className="display mt-7 text-[58px] leading-[0.86]">La bourse, version championnat entre amis.</h1>
      <ul className="mt-6 space-y-3.5">
        {POINTS.map((p) => (
          <li key={p.title} className="flex items-start gap-3">
            <Glyph name={p.icon} size={26} className="mt-0.5" />
            <span>
              <span className="block text-[16px] font-bold">{p.title}</span>
              <span className="block text-[14px] text-[#8590a2]">{p.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto grid gap-2 pt-8">
        <Button variant="gold" onClick={onLogin}>Créer mon compte</Button>
        <button onClick={onDemo} className="press h-[52px] text-[16px] font-bold text-[#f3f5f8]">Explorer la démo sans compte</button>
        <p className="mt-1 text-center text-[11px] leading-relaxed text-[#8590a2]">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
