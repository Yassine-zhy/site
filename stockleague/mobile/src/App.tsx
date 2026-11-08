import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';
import { TabBar } from './components/tab-bar';
import { Celebrations } from './components/celebrate';
import { ActivityScreen } from './screens/Activity';
import { GlossarySheet } from './screens/GlossarySheet';
import { HomeTab } from './screens/HomeTab';
import { ProfileSetup } from './screens/ProfileSetup';
import { Tutorial } from './screens/Tutorial';
import { BadgesScreen } from './screens/Badges';
import { CreateLeagueScreen } from './screens/CreateLeague';
import { HistoryScreen } from './screens/History';
import { JoinLeagueScreen } from './screens/JoinLeague';
import { LeagueSettingsScreen } from './screens/LeagueSettings';
import { LeagueTab } from './screens/LeagueTab';
import { LeaguesScreen } from './screens/Leagues';
import { LoginScreen } from './screens/Login';
import { MarketScreen } from './screens/Market';
import { OrderSheet } from './screens/OrderSheet';
import { PlayerScreen } from './screens/Player';
import { PortfolioTab } from './screens/PortfolioTab';
import { PredictSheet } from './screens/PredictSheet';
import { ProfileTab } from './screens/ProfileTab';
import { PronosTab } from './screens/PronosTab';
import { RecapScreen } from './screens/Recap';
import { RulesScreen } from './screens/Rules';
import { ShareSheet } from './screens/ShareSheet';
import { StockScreen } from './screens/Stock';
import { WelcomeScreen } from './screens/Welcome';
import { InboxScreen } from './screens/Inbox';
import { RevealScreen } from './screens/Reveal';
import { SeasonPassScreen } from './screens/SeasonPass';
import { StoryScreen } from './screens/Story';
import { SwipeScreen } from './screens/Swipe';
import { TauntSheet } from './screens/TauntSheet';
import { BAR_COLORS, setSystemBars } from './lib/native';
import { NavProvider, useNav, type Route } from './state/nav';
import { StoreProvider, useStore } from './state/store';

function useTheme(): boolean {
  const { theme } = useStore();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      setDark(dark);
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f0b1e' : '#f4f2fb');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  return dark;
}

function routeView(r: Route): ReactNode {
  switch (r.name) {
    case 'stock': return <StockScreen ticker={r.ticker} />;
    case 'player': return <PlayerScreen id={r.id} />;
    case 'market': return <MarketScreen />;
    case 'leagues': return <LeaguesScreen />;
    case 'create': return <CreateLeagueScreen />;
    case 'join': return <JoinLeagueScreen />;
    case 'settings': return <LeagueSettingsScreen />;
    case 'recap': return <RecapScreen />;
    case 'badges': return <BadgesScreen />;
    case 'history': return <HistoryScreen />;
    case 'rules': return <RulesScreen />;
    case 'activity': return <ActivityScreen />;
    case 'swipe': return <SwipeScreen />;
    case 'reveal': return <RevealScreen eventId={r.eventId} />;
    case 'pass': return <SeasonPassScreen />;
    case 'story': return <StoryScreen />;
    case 'inbox': return <InboxScreen />;
    case 'login': return null;
  }
}

function Shell({ dark }: { dark: boolean }) {
  const { tab, stack, sheet } = useNav();
  const top = stack.at(-1);

  // Barre d'état Android : couleur du haut de l'écran visible.
  useEffect(() => {
    const c = BAR_COLORS[dark ? 'dark' : 'light'];
    const onBoard = tab === 'ligue' && !top;
    setSystemBars(onBoard ? c.board : c.bg, !dark && !onBoard);
  }, [dark, tab, top]);
  const Tab = { accueil: HomeTab, ligue: LeagueTab, portefeuille: PortfolioTab, pronos: PronosTab, profil: ProfileTab }[tab];
  const { tutorialDone } = useStore();

  // Empêche le défilement de l'écran du dessous quand un écran ou une feuille est ouvert.
  useEffect(() => {
    document.body.style.overflow = top || sheet ? 'hidden' : '';
  }, [top, sheet]);

  return (
    <>
      <div aria-hidden={!!top || undefined}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
            <Tab />
          </motion.div>
        </AnimatePresence>
        <TabBar />
      </div>
      <AnimatePresence initial={false}>
        {stack.map((r, i) => (
          <motion.div
            key={`${r.name}-${i}`}
            className="fixed inset-0 z-40 overflow-y-auto bg-bg"
            style={{ visibility: i >= stack.length - 2 ? 'visible' : 'hidden' }}
            initial={{ x: '100%' }}
            animate={{ x: i === stack.length - 1 ? 0 : '-18%' }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
          >
            {routeView(r)}
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {sheet?.name === 'order' ? <OrderSheet key={'o' + sheet.ticker + sheet.side} ticker={sheet.ticker} side={sheet.side} /> : null}
        {sheet?.name === 'predict' ? <PredictSheet key={'p' + sheet.eventId} eventId={sheet.eventId} /> : null}
        {sheet?.name === 'share' ? <ShareSheet key="share" /> : null}
        {sheet?.name === 'glossary' ? <GlossarySheet key="glossary" /> : null}
        {sheet?.name === 'taunt' ? <TauntSheet key={'t' + sheet.playerId} playerId={sheet.playerId} /> : null}
      </AnimatePresence>
      {!tutorialDone ? <Tutorial /> : null}
    </>
  );
}

function Root() {
  const dark = useTheme();
  const { onboarded, profileDone, patch } = useStore();
  const [login, setLogin] = useState(false);
  useEffect(() => {
    if (onboarded && profileDone) return;
    const c = BAR_COLORS[dark ? 'dark' : 'light'];
    if (login || onboarded) setSystemBars(c.bg, !dark);
    else setSystemBars(c.board, false);
  }, [onboarded, profileDone, login, dark]);
  let screen: ReactNode;
  if (!onboarded) {
    const enter = () => { setLogin(false); patch({ onboarded: true }); };
    screen = login ? <LoginScreen onBack={() => setLogin(false)} onDone={enter} /> : <WelcomeScreen onDemo={enter} onLogin={() => setLogin(true)} />;
  } else if (!profileDone) {
    screen = <ProfileSetup />;
  } else {
    screen = <NavProvider><Shell dark={dark} /></NavProvider>;
  }
  return (
    <>
      {screen}
      <Celebrations />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
