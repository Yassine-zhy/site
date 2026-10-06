// Construit la version "Artifact" (page unique hébergée par claude.ai) à partir de dist/ :
// CSS et JS sont intégrés à la page, les modèles 3D sont publiés à côté (assets/...).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'artifact');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [, 'Aetheria'])[1];
const fontLinks = [...html.matchAll(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g)].map((m) => m[0]).join('\n');
const cssFiles = [...html.matchAll(/<link[^>]+href="\.\/(assets\/[^"]+\.css)"[^>]*>/g)].map((m) => m[1]);
const jsFiles = [...html.matchAll(/<script[^>]+src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g)].map((m) => m[1]);
const body = (html.match(/<body>([\s\S]*?)<\/body>/) || [, ''])[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();

const css = cssFiles.map((f) => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n');
const js = jsFiles.map((f) => fs.readFileSync(path.join(dist, f), 'utf8')).join('\n').replace(/<\/script/gi, '<\\/script');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const page = `<title>${title}</title>
${fontLinks}
<style>
${css}
</style>
${body}
<script type="module">
${js}
</script>
`;
fs.writeFileSync(path.join(out, 'index.html'), page);
// modèles 3D
const copy = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
const files = {};
const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.glb')) { const rel = path.relative(dist, p).split(path.sep).join('/'); copy(p, path.join(out, rel)); files[rel] = 'artifact/' + rel; } } };
walk(path.join(dist, 'assets'));
fs.writeFileSync(path.join(out, 'files.json'), JSON.stringify(files, null, 2));
// page de test locale (squelette identique à celui de la plateforme)
fs.writeFileSync(path.join(out, 'local.html'), `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`);
console.log('page', (page.length / 1024).toFixed(0) + ' Kio', '·', Object.keys(files).length, 'modèles');
