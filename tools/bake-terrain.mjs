// Pré-calcule le relief du continent : public/assets/terrain-h.bin (hauteurs) et terrain-c.bin
// (couleurs + matières du sol). Le jeu n'a plus qu'à lire ces fichiers. Lancé par « npm run build ».
//   --if-stale : ne recalcule que si la signature a changé
import fs from 'node:fs';
import path from 'node:path';
import { bakeHeights, bakeSurface, continentSignature, packBaked, unpackBaked } from '../src/world/Continent.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'public', 'assets');
const fh = path.join(dir, 'terrain-h.bin'), fc = path.join(dir, 'terrain-c.bin');
const sig = continentSignature();
const fresh = (f) => { try { const b = fs.readFileSync(f); return !!unpackBaked(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch { return false; } };
if (process.argv.includes('--if-stale') && fresh(fh) && fresh(fc)) { console.log('relief à jour (' + sig + ')'); process.exit(0); }
const t0 = performance.now();
const prog = (label, n) => (j) => { if (j % 256 === 0) process.stdout.write(`\r${label} ${Math.round(j / n * 100)} %   `); };
const h = bakeHeights(prog('hauteurs', 2049));
const t1 = performance.now();
const { color, mats, biome } = bakeSurface(h, prog('surface', 1024));
process.stdout.write('\r');
fs.writeFileSync(fh, packBaked(sig, 'h', [h]));
fs.writeFileSync(fc, packBaked(sig, 'c', [color, mats, biome]));
try { fs.unlinkSync(path.join(dir, 'terrain.bin')); } catch { /* ancien format */ }
console.log(`relief pré-calculé (${sig}) : hauteurs ${Math.round(t1 - t0)} ms, surface ${Math.round(performance.now() - t1)} ms`);
