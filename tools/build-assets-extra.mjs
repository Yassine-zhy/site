// Packs KayKit supplémentaires (CC0) -> GLB : cimetières et landes hantées (Halloween Bits),
// mobilier de campement et vivres (Furniture Bits, Restaurant Bits).
// Usage : KAYKIT_DIR=/chemin/vers/clones OUT=public/assets node tools/build-assets-extra.mjs
// (dépendances : npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions)
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, quantize, mergeDocuments, unpartition } from '@gltf-transform/functions';
import fs from 'node:fs';

const S = process.env.KAYKIT_DIR, OUT = process.env.OUT;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const HW = S + '/KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf';
const FU = S + '/KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf';
const RE = S + '/KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf';

function dropOrphans(doc) { for (const a of doc.getRoot().listAccessors()) if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose(); }
const find = (dir, n) => { const f = [dir + '/' + n + '.gltf', dir + '/' + n + '.glb'].find(fs.existsSync); if (!f) console.log('MISSING', dir, n); return f; };

async function buildProps(name, files) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene('props');
  for (const [key, f] of files) {
    if (!f) continue;
    const src = await io.read(f);
    const map = mergeDocuments(doc, src);
    const dstScene = map.get(src.getRoot().listScenes()[0]);
    const holder = doc.createNode(key);
    for (const c of dstScene.listChildren()) holder.addChild(c);
    dstScene.dispose();
    scene.addChild(holder);
  }
  doc.getRoot().setDefaultScene(scene);
  dropOrphans(doc);
  await doc.transform(unpartition(), dedup(), prune(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const out = OUT + '/' + name + '.glb';
  await io.write(out, doc);
  return fs.statSync(out).size;
}

const halloween = fs.readdirSync(HW).filter((f) => f.endsWith('.gltf')).map((f) => f.replace(/\.gltf$/, '')).sort();
console.log('halloween', await buildProps('halloween', halloween.map((n) => [n, find(HW, n)])));
const furniture = ['table_medium', 'table_medium_long', 'table_small', 'chair_A_wood', 'chair_B_wood', 'chair_stool_wood', 'shelf_A_big', 'shelf_B_large_decorated', 'cabinet_medium_decorated', 'lamp_standing', 'rug_rectangle_stripes_A', 'rug_oval_A', 'book_set', 'bed_single_A', 'cactus_medium_A', 'cactus_medium_B', 'cactus_small_A', 'cactus_small_B'];
const food = ['crate_potatoes', 'crate_onions', 'crate_tomatoes', 'crate_carrots', 'crate_cheese', 'crate_ham', 'stew_pot', 'pot_A_stew', 'jar_A_large', 'jar_B_medium', 'jar_C_large', 'food_stew', 'food_dinner', 'plate', 'bowl', 'table_round_A_decorated', 'kitchentable_A_large_decorated'];
console.log('camp', await buildProps('camp', [...furniture.map((n) => [n, find(FU, n)]), ...food.map((n) => [n, find(RE, n)])]));
