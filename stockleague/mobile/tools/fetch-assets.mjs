// Prépare les ressources embarquées dans l'appli (hors-ligne) : node tools/fetch-assets.mjs
//  - logos des entreprises (démo) → public/logos/<TICKER>.png
//  - icônes Fluent Emoji Flat (Microsoft, licence MIT) → public/emoji/<nom>.svg
//  - avatars illustrés DiceBear « Notionists » (licence CC0) → public/avatars/<seed>.svg
import fs from 'node:fs';
import path from 'node:path';
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { TICKERS } from '../src/data/tickers.ts';
import { EMOJI } from '../src/data/emoji-list.ts';
import { AVATAR_SEEDS } from '../src/data/avatar-list.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pub = (...p) => path.join(root, 'public', ...p);

for (const t of TICKERS) {
  const f = pub('logos', `${t.ticker}.png`);
  if (fs.existsSync(f)) continue;
  const res = await fetch(`https://financialmodelingprep.com/image-stock/${encodeURIComponent(t.ticker.replace('.', '-'))}.png`);
  if (!res.ok) { console.warn('logo manquant', t.ticker, res.status); continue; }
  fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
}

const emoji = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/@iconify-json/fluent-emoji-flat/icons.json'), 'utf8'));
for (const name of EMOJI) {
  const icon = emoji.icons[name];
  if (!icon) { console.warn('emoji manquant', name); continue; }
  const w = icon.width ?? emoji.width ?? 32, h = icon.height ?? emoji.height ?? 32;
  fs.writeFileSync(pub('emoji', `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icon.body}</svg>`);
}

for (const seed of AVATAR_SEEDS) {
  const svg = createAvatar(notionists, { seed, backgroundColor: ['transparent'] }).toString();
  fs.writeFileSync(pub('avatars', `${seed}.svg`), svg);
}
console.log('✔ ressources prêtes');
