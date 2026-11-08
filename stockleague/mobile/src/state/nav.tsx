/**
 * Navigation façon appli native : 5 onglets + une pile d'écrans qui glissent par-dessus
 * + des feuilles qui montent du bas. Le bouton retour d'Android dépile dans cet ordre.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type Tab = 'ligue' | 'portefeuille' | 'pronos' | 'activite' | 'profil';
export type Route =
  | { name: 'stock'; ticker: string }
  | { name: 'player'; id: string }
  | { name: 'market' }
  | { name: 'leagues' }
  | { name: 'create' }
  | { name: 'join' }
  | { name: 'settings' }
  | { name: 'recap' }
  | { name: 'badges' }
  | { name: 'history' }
  | { name: 'rules' }
  | { name: 'login' };
export type Sheet =
  | { name: 'order'; ticker: string; side: 'buy' | 'sell' }
  | { name: 'predict'; eventId: string }
  | { name: 'share' };

type Nav = {
  tab: Tab; stack: Route[]; sheet: Sheet | null;
  setTab: (t: Tab) => void; push: (r: Route) => void; pop: () => void; reset: (t?: Tab) => void;
  openSheet: (s: Sheet) => void; closeSheet: () => void; back: () => boolean;
};
const Ctx = createContext<Nav | null>(null);

declare global {
  interface Window { __appBack?: () => boolean }
}

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<Tab>('ligue');
  const [stack, setStack] = useState<Route[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const ref = useRef({ tab, stack, sheet });
  ref.current = { tab, stack, sheet };

  const setTab = useCallback((t: Tab) => { setTabState(t); setStack([]); window.scrollTo(0, 0); }, []);
  const push = useCallback((r: Route) => setStack((s) => [...s, r]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const reset = useCallback((t: Tab = 'ligue') => { setStack([]); setSheet(null); setTabState(t); }, []);
  const back = useCallback(() => {
    const c = ref.current;
    if (c.sheet) { setSheet(null); return true; }
    if (c.stack.length) { setStack((s) => s.slice(0, -1)); return true; }
    if (c.tab !== 'ligue') { setTabState('ligue'); return true; }
    return false;
  }, []);

  // Bouton retour Android (appelé par l'activité Java) et touche Échap au clavier.
  useEffect(() => {
    window.__appBack = back;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back]);

  const value = useMemo(() => ({ tab, stack, sheet, setTab, push, pop, reset, openSheet: setSheet, closeSheet: () => setSheet(null), back }), [tab, stack, sheet, setTab, push, pop, reset, back]);
  return <Ctx value={value}>{children}</Ctx>;
}

export function useNav(): Nav {
  const n = useContext(Ctx);
  if (!n) throw new Error('useNav hors du NavProvider');
  return n;
}
