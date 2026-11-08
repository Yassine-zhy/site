// Télécharge les illustrations 3D Fluent Emoji (MIT) et les réduit à 160 px : node tools/fetch-stickers.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { STICKERS } from '../src/data/stickers.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'public', '3d');
fs.mkdirSync(dir, { recursive: true });
for (const [key, label] of Object.entries(STICKERS)) {
  const out = path.join(dir, `${key}.png`);
  if (fs.existsSync(out)) continue;
  const skin = label.endsWith('*');
  const name = label.replace('*', '');
  const file = name.toLowerCase().replace(/ /g, '_');
  const url = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodeURIComponent(name)}/${skin ? 'Default/3D' : '3D'}/${file}_3d${skin ? '_default' : ''}.png`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('manquant', key, res.status); continue; }
  const tmp = out + '.src.png';
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  execFileSync('python3', ['-I', '-c', 'import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert("RGBA");im.thumbnail((160,160),Image.LANCZOS);im.save(sys.argv[2],optimize=True)', tmp, out]);
  fs.rmSync(tmp);
}
console.log('✔ autocollants 3D prêts', fs.readdirSync(dir).length);
