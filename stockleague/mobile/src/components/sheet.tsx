import { motion, useDragControls } from 'motion/react';
import type { ReactNode } from 'react';
import { useNav } from '../state/nav';

/** Feuille qui monte du bas (ressort) et se ferme en la faisant glisser vers le bas. */
export function SheetFrame({ children, title }: { children: ReactNode; title?: string }) {
  const { closeSheet } = useNav();
  const drag = useDragControls();
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <motion.button className="absolute inset-0 bg-[#140b3a]/45" aria-label="Fermer" onClick={closeSheet} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
      <motion.div
        className="relative max-h-[92dvh] overflow-y-auto rounded-t-[26px] bg-card pb-[max(env(safe-area-inset-bottom),16px)]"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 460, damping: 42 }}
        drag="y" dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) closeSheet(); }}
      >
        <div className="sticky top-0 z-10 cursor-grab touch-none bg-card pt-3 pb-2" onPointerDown={(e) => drag.start(e)}>
          <div className="mx-auto h-1.5 w-11 rounded-[3px] bg-line-2" />
        </div>
        {children}
      </motion.div>
    </div>
  );
}
