import { Avatar, Button, CompanyLogo, Emoji, LogoMark } from '../components/ui';
import type { EmojiName } from '../data/emoji-list';
import { APP_NAME, DISCLAIMER } from '../lib/constants';

const POINTS: { emoji: EmojiName; title: string; text: string }[] = [
  { emoji: 'money-bag', title: '10 000 $ fictifs', text: 'De vraies actions, aux vrais cours du marché.' },
  { emoji: 'crystal-ball', title: 'Des pronostics', text: 'Apple, Nike, Tesla vont-elles battre les attentes ?' },
  { emoji: 'trophy', title: 'Une saison, un gagnant', text: 'Classement en direct et titres chaque soir.' },
];

/** Écran d'accueil au premier lancement. */
export function WelcomeScreen({ onDemo, onLogin }: { onDemo: () => void; onLogin: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col bg-board px-5 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)] text-board-ink">
      <div className="flex items-center gap-2 pt-2"><LogoMark size={34} /><span className="display text-[26px]">{APP_NAME}</span></div>

      {/* Mosaïque de vrais logos et de joueurs : le sujet de l'appli, d'un coup d'œil */}
      <div className="relative mt-8 h-[168px]" aria-hidden>
        {[['AAPL', 6, 10, -8], ['NVDA', 62, 0, 6], ['TSLA', 78, 64, -4], ['NKE', 20, 80, 5], ['META', 44, 50, -3]].map(([t, x, y, r]) => (
          <span key={t as string} className="absolute" style={{ left: `${x}%`, top: y as number, transform: `rotate(${r}deg)` }}>
            <CompanyLogo ticker={t as string} size={58} className="shadow-[0_10px_24px_-10px_rgb(0_0_0/0.6)]" />
          </span>
        ))}
        <span className="absolute left-[38%] top-[-6px] rotate-[4deg]"><Avatar id="lea" size={52} ring="gold" /></span>
        <span className="absolute left-[64%] top-[108px] -rotate-[5deg]"><Avatar id="yanis" size={46} /></span>
        <span className="absolute left-[2%] top-[118px]"><Emoji name="trophy" size={40} /></span>
      </div>

      <h1 className="display mt-6 text-[52px] leading-[0.92]">La bourse, version championnat entre amis.</h1>
      <ul className="mt-6 space-y-3">
        {POINTS.map((p) => (
          <li key={p.title} className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-[11px] bg-board-2"><Emoji name={p.emoji} size={28} /></span>
            <span>
              <span className="block text-[15px] font-bold">{p.title}</span>
              <span className="block text-[13px] opacity-70">{p.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto grid gap-2 pt-8">
        <Button variant="gold" onClick={onLogin}>Créer mon compte</Button>
        <Button variant="ghost" className="text-board-ink" onClick={onDemo}>Explorer la démo sans compte</Button>
        <p className="mt-2 text-center text-[11px] leading-relaxed opacity-60">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
