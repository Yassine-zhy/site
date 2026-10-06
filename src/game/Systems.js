import { Windows } from '../ui/Windows.js';
import { Runes } from './Runes.js';
import { Net } from '../net/Net.js';
import { WorldState } from './WorldState.js';
import { Beacons } from '../world/Beacons.js';
import { Echoes } from './Echoes.js';
import { Chat } from '../ui/Chat.js';
import { Quests } from './Quests.js';
import { NPCs } from './NPCs.js';
import { Dialogue } from '../ui/Dialogue.js';
import { Mind } from '../ai/Mind.js';
import { Interactions } from './Interactions.js';
import { Boss } from './Boss.js';
import { TouchControls } from '../ui/TouchControls.js';
import { Waystones } from './Waystones.js';
import { Expedition } from './Expedition.js';
import { Gathering } from './Gathering.js';
import { Chests } from './Chests.js';
import { Waves } from './Waves.js';

// Démarre les systèmes de jeu une fois le héros créé.
export async function boot(game) {
  const extra = [];
  game.windows = new Windows(game);
  game.toggleWindow = (n) => game.windows.toggle(n);
  game.runes = new Runes(game);
  game.world.beacons = new Beacons(game.scene, game.assets, game.world.terrain, game.world.colliders, game.fx);
  game.worldState = new WorldState(game);
  game.quests = new Quests(game);
  game.npcs = new NPCs(game);
  game.mind = new Mind(game);
  game.dialogue = new Dialogue(game);
  game.echoes = new Echoes(game);
  game.chat = new Chat(game);
  game.waystones = new Waystones(game);
  game.expedition = new Expedition(game);
  game.gathering = new Gathering(game);
  game.chests = new Chests(game);
  game.waves = new Waves(game);
  game.interactions = new Interactions(game);
  game.boss = new Boss(game);
  game.net = new Net(game);
  if (game.input.isTouch) game.touch = new TouchControls(game);
  extra.push(game.waystones, game.expedition, game.gathering, game.chests, game.waves, game.runes, game.worldState, game.quests, game.npcs, game.dialogue, game.echoes, game.chat, game.interactions, game.boss, game.net);
  if (game.touch) extra.push(game.touch);
  game.systems = extra;
  game.worldState.start();
  game.echoes.start();
  game.net.start();
  game.systemsUpdate = (dt) => {
    if (!game.inGame) return;
    game.world.beacons.update(dt, game.elapsed, game.world.sky.state.night);
    for (const s of extra) { try { s.update?.(dt); } catch (e) { console.error(e); } }
  };
  game.emote = (e = 'wave') => {
    if (game.player.dead) return;
    game.player.char.playAction(e === 'sit' ? 'Sit_Floor_Down' : 'Cheer', { full: true });
    game.net.sendEmote(e);
  };
  applyHeroSave(game);
  game.input.on('key', (code) => {
    if (!game.inGame) return;
    const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (typing) return;
    if (code === 'Escape') {
      if (game.windows.current) game.windows.close();
      else if (game.dialogueOpen) game.dialogue.close();
      else game.windows.open('settings');
      return;
    }
    if (game.dialogueOpen || game.chatOpen) return;
    const map = { KeyM: 'map', KeyI: 'inventory', KeyB: 'inventory', KeyJ: 'quests', KeyL: 'quests', KeyK: 'leaderboard', KeyH: 'help', F1: 'help', KeyP: 'party' };
    if (map[code]) game.windows.toggle(map[code]);
    else if (code === 'KeyT' && !game.windowOpen) game.echoes.composeWindow();
    else if (code === 'KeyG' && !game.windowOpen) game.emote('wave');
    else if (code === 'Tab' && !game.windowOpen) game.lockNext();
  });
  // première visite : guide rapide
  if (!game.save?.hadSave && !game.save?.data?.some(Boolean)) game.schedule(1.2, () => {
    const touch = game.input.isTouch;
    game.ui.announce('Aetheria', touch ? 'Suivez le losange doré jusqu’à Maëlis, près de l’église.' : 'Suivez le losange doré jusqu’à Maëlis, près de l’église (E). Touche H pour le guide.', 5);
    game.chat.system(touch
      ? 'Bienvenue à Havrelumière. Pouce gauche : se déplacer (n’importe où à gauche). Glisser à droite : tourner la caméra. Tape sur la scène : attaquer.'
      : 'Bienvenue à Havrelumière. Clic pour capturer la souris, Échap pour la libérer. H : guide du voyageur.', 20);
  });
  addEventListener('beforeunload', () => { game.save?.write(true); game.net?.transport?.close(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.save?.write(true); });
  return extra;
}

// Quêtes et position du héros chargé (au démarrage comme après un changement de sauvegarde).
function applyHeroSave(game) {
  const L = game.save?.loaded;
  game.quests.reset();
  if (L?.quests && L.name === game.hero.name) game.quests.load(L.quests);
  const pos = L?.pos;
  if (pos && L.name === game.hero.name) {
    const gy = game.world.terrain.heightAt(pos[0], pos[2]);
    if (gy !== null && Math.abs(gy - pos[1]) < 3) game.player.spawn(pos[0], gy, pos[2], 0);
  }
}

// Retour en jeu avec un autre héros (les systèmes existent déjà).
export function reenter(game) {
  game.windows.close();
  // commandes tactiles et barre d'action dépendent de la classe
  if (game.touch) {
    const i = game.systems.indexOf(game.touch);
    game.touch.root.remove();
    game.touch = new TouchControls(game);
    if (i >= 0) game.systems[i] = game.touch; else game.systems.push(game.touch);
  }
  game.mind?.reset?.();
  applyHeroSave(game);
  game.net.start();
}
