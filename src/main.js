import './ui/styles.css';
import { Renderer, detectQuality } from './engine/Renderer.js';
import { Assets } from './engine/Assets.js';
import { Input } from './engine/Input.js';
import { Game } from './game/Game.js';
import { Hero } from './game/Hero.js';
import { UI } from './ui/UI.js';
import { Screens } from './ui/Screens.js';
import { boot as bootSystems, reenter } from './game/Systems.js';
import { Platform } from './net/Platform.js';
import { Save } from './game/Save.js';
import { Audio } from './engine/Audio.js';
import { CLASSES } from './config.js';
import { clone } from './engine/math.js';

const params = new URLSearchParams(location.search);
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function main(hotData = {}) {
  const canvas = document.getElementById('game');
  const ui = new UI(document.getElementById('ui'));
  window.__ui = ui;
  let renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    ui.showError('WebGL est indisponible sur cet appareil : Aetheria a besoin de l’accélération 3D du navigateur.');
    throw e;
  }
  const savedQ = Save.localSettings()?.quality;
  renderer.setQuality(params.get('q') || savedQ || detectQuality());
  const input = new Input(canvas);
  const audio = new Audio();
  const platform = new Platform();
  const platformReady = platform.init();
  const assets = new Assets();
  ui.setStep('Chargement des héros et des squelettes…');
  await assets.load((p) => ui.setProgress(p * 0.7));
  const game = new Game({ renderer, assets, input, ui, platform, audio });
  window.game = game;
  if (params.get('maxdt')) game.maxDt = parseFloat(params.get('maxdt'));
  if (params.get('renderEvery')) game.renderEvery = parseInt(params.get('renderEvery'));
  audio.game = game;
  let n = 0;
  await game.buildWorld((s) => { ui.setStep(s); ui.setProgress(0.7 + 0.3 * Math.min(1, ++n / 9)); });
  game.screens = new Screens(ui, game);
  game.updateMenu = (dt) => game.screens.updateMenu(dt);
  await Promise.race([platformReady, new Promise((r) => setTimeout(r, 2500))]);
  game.save = new Save(game, platform);
  await game.save.init();
  game.settings = { ...game.settings, ...(Save.localSettings() || {}) };
  audio.setVolume(game.settings.volume, game.settings.music);
  game.start();
  ui.hideLoading();
  window.__ready = true;

  const begin = async (hero) => {
    audio.unlock();
    game.startHero(hero);
    if (!game.systems) { await bootSystems(game); game.prewarm(); }
    else reenter(game);
    if (!game.save.hadSave) game.quests?.startIntro();
    game.save.soon(1);
  };

  // menu principal : quatre emplacements de sauvegarde
  const openParty = () => game.windows?.open('party');
  const createIn = (i, then) => {
    game.save.select(i);
    game.screens.showCreate((cls, name) => { game.save.select(i); begin(new Hero(cls, name)).then(() => then?.()); }, () => showMainMenu());
  };
  const playSlot = (i, then) => {
    audio.unlock();
    const d = game.save.select(i);
    if (d) begin(Hero.deserialize(d)).then(() => then?.());
    else createIn(i, then);
  };
  const showMainMenu = () => game.screens.showTitle({
    save: game.save,
    online: game.platform?.onlineCount?.() || 0,
    onPlay: (i) => playSlot(i),
    onCreate: (i, multi) => { audio.unlock(); createIn(i, multi ? openParty : null); },
    // multijoueur : on entre dans le monde puis on ouvre la fenêtre des expéditions
    onMulti: (i) => playSlot(i, openParty),
  });
  game.showMainMenu = showMainMenu;

  // reprise après une mise à jour de la page (le jeu continue là où il en était)
  const hot = window.claude?.hot;
  try { hot?.snapshot?.(() => (game.inGame ? { resume: game.save.snapshot() } : {})); } catch { /* */ }
  if (hotData?.resume?.hero) {
    const r = clone(hotData.resume);
    game.save.select(r.slot ?? game.save.slot);
    game.save.loaded = { ...r.hero, pos: r.pos, quests: r.quests, savedAt: r.savedAt };
    game.save.hadSave = true;
    await begin(Hero.deserialize(r.hero));
    return;
  }

  // raccourcis de test : ?play=knight
  if (params.get('play')) {
    const cls = CLASSES[params.get('play')] ? params.get('play') : 'knight';
    await begin(new Hero(cls, params.get('name') || 'Testeur'));
    if (params.get('t')) game.world.sky.override = parseFloat(params.get('t'));
    return;
  }

  showMainMenu();
  platform.onOnline?.((n) => game.screens.setOnline(n));
}

const start = (data) => main(data).catch((e) => { console.error(e); window.__error = String(e && e.stack || e); window.__ui?.showError?.('Erreur : ' + (e.message || e)); });
if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
