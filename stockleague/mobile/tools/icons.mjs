// Génère les icônes Android (lanceur) et l'icône web à partir de l'emblème : node tools/icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
// Playwright est préinstallé globalement (sinon : npm i -D playwright).
const { chromium } = createRequire(import.meta.url)('playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Emblème : podium dont les marches sont des barres de graphique, marche du vainqueur en jaune.
const mark = (bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  ${bg ? '<rect width="32" height="32" rx="7" fill="#0B1A30"/>' : ''}
  <rect x="6.5" y="14" width="5.5" height="11" rx="1" fill="#FFFFFF" opacity="0.88"/>
  <rect x="13.25" y="7" width="5.5" height="18" rx="1" fill="#F2B705"/>
  <rect x="20" y="18" width="5.5" height="7" rx="1" fill="#FFFFFF" opacity="0.6"/></svg>`;
fs.writeFileSync(path.join(root, 'public', 'icon.svg'), mark());

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, size, out, { round = false, inset = 0, bg = 'transparent' } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center;${round ? 'border-radius:50%;overflow:hidden;background:#0B1A30' : ''}"><div style="width:${size - inset * 2}px;height:${size - inset * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body>`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true });
}
for (const [d, k] of Object.entries(DENS)) {
  const dir = path.join(root, 'android', 'res', `mipmap-${d}`);
  await render(mark(), 48 * k, path.join(dir, 'ic_launcher.png'));
  await render(mark(false), 48 * k, path.join(dir, 'ic_launcher_round.png'), { round: true, inset: 8 * k });
  // Icône adaptative : premier plan sur 108 dp, zone sûre centrale de 66 dp.
  await render(mark(false), 108 * k, path.join(dir, 'ic_launcher_foreground.png'), { inset: 30 * k });
}
await browser.close();
console.log('✔ icônes générées');
