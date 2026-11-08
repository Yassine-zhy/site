import { SheetFrame } from '../components/sheet';
import { Button, Emoji } from '../components/ui';
import { useNav } from '../state/nav';

/** Explication simple du BPA et de la notion d'« attentes ». */
export function GlossarySheet() {
  const { closeSheet } = useNav();
  return (
    <SheetFrame title="C’est quoi le BPA ?">
      <div className="px-5 pt-2">
        <Emoji name="light-bulb" size={48} />
        <p className="display mt-3 text-[32px]">C’est quoi le BPA ?</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
          Le <b className="text-ink">bénéfice par action</b> : le bénéfice du trimestre divisé par le nombre d’actions. C’est le chiffre que la bourse regarde en premier à chaque publication.
        </p>
        <div className="mt-4 space-y-2 rounded-tile border border-line bg-card-2 p-4 text-sm">
          <p><b>Les attentes</b> : la moyenne des estimations des analystes, publiée avant les résultats. Par exemple 1,18 $ pour Nvidia.</p>
          <p><b>« Battre »</b> : le BPA publié est au-dessus (1,25 $). <b>« Manquer »</b> : en dessous (1,10 $).</p>
          <p className="text-muted">Égalité exacte : pronostic annulé, 0 point.</p>
        </div>
        <Button className="mt-5 w-full" onClick={closeSheet}>J’ai compris</Button>
      </div>
    </SheetFrame>
  );
}
