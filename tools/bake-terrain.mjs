// Pré-calcule le relief et les couleurs de toutes les îles : public/assets/terrain.bin
// (le téléphone n'a plus qu'à lire le fichier au lieu de tout recalculer). Lancé par « npm run build ».
import fs from 'node:fs';
import path from 'node:path';
import { Terrain, bakeTerrain } from '../src/world/Terrain.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const t0 = performance.now();
const buf = bakeTerrain(new Terrain());
const out = path.join(root, 'public', 'assets', 'terrain.bin');
fs.writeFileSync(out, Buffer.from(buf));
console.log(`relief pré-calculé : ${(buf.byteLength / 1048576).toFixed(1)} Mo en ${Math.round(performance.now() - t0)} ms`);
