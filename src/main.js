import { Renderer, detectQuality } from './engine/Renderer.js';
import { Assets } from './engine/Assets.js';
import { Input } from './engine/Input.js';
import { Game } from './game/Game.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
renderer.setQuality(params.get('q') || detectQuality());
const assets = new Assets();
const input = new Input(canvas);
window.__log = [];
(async () => {
  await assets.load((p) => { window.__progress = p; });
  const game = new Game({ renderer, assets, input });
  window.game = game;
  game.buildWorld((s) => window.__log.push(s));
  if (params.get('t')) game.world.sky.override = parseFloat(params.get('t'));
  game.spawnPlayer(params.get('cls') || 'knight', 'Test');
  game.start();
  window.__ready = true;
})().catch((e) => { console.error(e); window.__error = String(e && e.stack || e); });
