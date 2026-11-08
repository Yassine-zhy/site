// Prépare les ressources embarquées dans l'appli (hors-ligne) : node tools/fetch-assets.mjs
//  - logos des entreprises (démo) → public/logos/<TICKER>.png
//  - portraits des joueurs de démo (Unsplash, licence Unsplash) → public/avatars/<id>.jpg
import fs from 'node:fs';
import path from 'node:path';
import { TICKERS } from '../src/data/tickers.ts';
import { PORTRAITS } from '../src/data/avatar-list.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pub = (...p) => path.join(root, 'public', ...p);

for (const t of TICKERS) {
  const f = pub('logos', `${t.ticker}.png`);
  if (fs.existsSync(f)) continue;
  const res = await fetch(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(t.ticker.replace('.', '-'))}.png`);
  if (!res.ok) { console.warn('logo manquant', t.ticker, res.status); continue; }
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
}

for (const [id, photo] of Object.entries(PORTRAITS)) {
  const f = pub('avatars', `${id}.jpg`);
  if (fs.existsSync(f)) continue;
  const res = await fetch(`https://images.unsplash.com/photo-${photo}?w=320&h=320&fit=crop&crop=faces&q=80&fm=jpg`);
  if (!res.ok) { console.warn('portrait manquant', id, res.status); continue; }
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
}
console.log('✔ ressources prêtes');
