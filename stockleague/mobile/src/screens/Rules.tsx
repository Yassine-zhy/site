import type { ReactNode } from 'react';
import { Glyph, ScreenHeader } from '../components/ui';
import type { GlyphName } from '../data/glyphs';
import { DISCLAIMER } from '../lib/constants';
import { SCORING } from '../lib/scoring';

export function RulesScreen() {
  const p = SCORING.prediction;
  return (
    <div className="pb-10">
      <ScreenHeader title="Règles et barème" />
      <div className="space-y-3 px-4 pt-4">
        <Rule emoji="money-bag" title="Le portefeuille">
          Chaque joueur reçoit le même capital fictif. Ordres au marché uniquement, actions fractionnées (2 décimales), pas de vente à découvert ni d’effet de levier. Chaque soir après la clôture : <b>points = rendement de la saison en % × {SCORING.portfolio.pointsPerPercent}</b>. Exemple : +7,3 % = 73 points.
        </Rule>
        <Rule emoji="crystal-ball" title="Les pronostics">
          Avant chaque publication de résultats, prédis si le bénéfice par action (BPA) va battre ou manquer l’estimation des analystes.
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-muted"><tr><th className="py-1 font-semibold"></th><th className="font-semibold">Juste</th><th className="font-semibold">Faux</th></tr></thead>
            <tbody className="nums">
              <tr className="border-t border-line"><td className="py-1.5">Normal</td><td className="font-bold text-gain">+{p.correct}</td><td className="font-bold">{p.wrong}</td></tr>
              <tr className="border-t border-line"><td className="py-1.5">Sûr de moi</td><td className="font-bold text-gain">+{p.sureCorrect}</td><td className="font-bold text-loss">{p.sureWrong}</td></tr>
            </tbody>
          </table>
        </Rule>
        <Rule emoji="locked" title="Le verrouillage">
          Publication avant l’ouverture : verrouillage à 9 h 30, heure de New York. Après la clôture : à 16 h. Les pronostics des autres restent cachés jusque-là. Égalité exacte avec l’estimation : pronostic annulé, 0 point.
        </Rule>
        <Rule emoji="fire" title="Les séries">
          Dès {SCORING.streak.threshold} pronostics justes d’affilée, chaque nouveau pronostic juste rapporte <b>+{SCORING.streak.bonusPerCorrect} points</b> de bonus. Une erreur remet la série à zéro ; un pronostic annulé ne la casse pas.
        </Rule>
        <Rule emoji="trophy" title="Le classement">
          Score total = points de portefeuille + points de pronostics. Trois classements : général, portefeuille seul, pronostics seuls. À la fin de la saison, les positions sont gelées au cours de clôture et le gagnant est désigné.
        </Rule>
        <p className="px-1 pt-2 text-xs text-muted">{DISCLAIMER}</p>
      </div>
    </div>
  );
}

function Rule({ emoji, title, children }: { emoji: GlyphName; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[18px] bg-card shadow-card p-4">
      <div className="flex items-center gap-3"><Glyph name={emoji} size={32} /><h2 className="display text-[24px]">{title}</h2></div>
      <div className="mt-2 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}
