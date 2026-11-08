import type { ReactNode } from 'react';
import { useNav } from '../state/nav';

/** Feuille qui monte du bas de l'écran (ordre, pronostic, partage). */
export function SheetFrame({ children, title }: { children: ReactNode; title?: string }) {
  const { closeSheet } = useNav();
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="anim-fade absolute inset-0 bg-[#050b14]/55" aria-label="Fermer" onClick={closeSheet} />
      <div className="anim-sheet relative max-h-[92dvh] overflow-y-auto rounded-t-[2px] bg-card pb-[max(env(safe-area-inset-bottom),16px)] shadow-card">
        <div className="sticky top-0 z-10 bg-card pt-2.5 pb-1">
          <div className="mx-auto h-1 w-10 rounded-none bg-line-2" />
        </div>
        {children}
      </div>
    </div>
  );
}
