// Pipeline d'assets : KayKit (CC0, Kay Lousberg) -> GLB optimisés pour le web.
// Usage : KAYKIT_DIR=/chemin/vers/clones OUT=public/assets node tools/build-assets.mjs
// (dépendances : npm i -D @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions)
// Les dépôts KayKit-Character-Pack-Adventures-1.0, KayKit-Character-Pack-Skeletons-1.0,
// KayKit-Medieval-Hexagon-Pack-1.0 et KayKit-Dungeon-Remastered-1.0 doivent être clonés dans KAYKIT_DIR.
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, weld, quantize, mergeDocuments, unpartition } from '@gltf-transform/functions';
import fs from 'node:fs';
function dropOrphans(doc){ for (const a of doc.getRoot().listAccessors()) { if (a.listParents().every(p=>p.propertyType==='Root')) a.dispose(); } }
function quantizeRotations(doc){
  for (const anim of doc.getRoot().listAnimations()) for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') continue;
    const out = ch.getSampler().getOutput(); const arr = out.getArray();
    if (!(arr instanceof Float32Array)) continue;
    const q = new Int16Array(arr.length); for (let i=0;i<arr.length;i++) q[i] = Math.round(Math.max(-1,Math.min(1,arr[i]))*32767);
    const acc = doc.createAccessor().setType('VEC4').setArray(q).setNormalized(true).setBuffer(doc.getRoot().listBuffers()[0]);
    ch.getSampler().setOutput(acc);
  }
}
import path from 'node:path';

const S = process.env.KAYKIT_DIR;
const OUT = process.env.OUT;
fs.mkdirSync(OUT + '/chars', { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const A = S + '/KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures';
const K = S + '/KayKit-Character-Pack-Skeletons-1.0/addons/kaykit_character_pack_skeletons';
const H = S + '/KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const D = S + '/KayKit-Dungeon-Remastered-1.0/addons/kaykit_dungeon_remastered/Assets/gltf';
const IK = /IK|control-/;

const KEEP_ANIMS = [
  'Idle','Unarmed_Idle','2H_Melee_Idle','Idle_Combat','Idle_B',
  'Walking_A','Walking_B','Walking_C','Walking_Backwards','Walking_D_Skeletons',
  'Running_A','Running_B','Running_C','Running_Strafe_Left','Running_Strafe_Right',
  'Jump_Start','Jump_Idle','Jump_Land','Jump_Full_Short',
  'Dodge_Forward','Dodge_Backward','Dodge_Left','Dodge_Right',
  '1H_Melee_Attack_Chop','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Stab','1H_Melee_Attack_Jump_Chop',
  '2H_Melee_Attack_Chop','2H_Melee_Attack_Slice','2H_Melee_Attack_Spin','2H_Melee_Attack_Spinning','2H_Melee_Attack_Stab',
  'Dualwield_Melee_Attack_Chop','Dualwield_Melee_Attack_Slice','Dualwield_Melee_Attack_Stab',
  '1H_Ranged_Shoot','1H_Ranged_Aiming','2H_Ranged_Shoot','2H_Ranged_Aiming','1H_Ranged_Reload',
  'Block','Blocking','Block_Hit','Block_Attack','Hit_A','Hit_B','Death_A','Death_A_Pose','Death_B','Death_B_Pose',
  'Death_C_Skeletons','Death_C_Pose','Death_C_Skeletons_Resurrect',
  'Spellcast_Shoot','Spellcast_Raise','Spellcast_Long','Spellcasting','Spellcast_Summon',
  'Throw','Unarmed_Melee_Attack_Punch_A','Unarmed_Melee_Attack_Kick',
  'Cheer','Interact','PickUp','Use_Item','Taunt','Sit_Floor_Down','Sit_Floor_Idle','Sit_Chair_Idle','Lie_Idle','Lie_Pose',
  'Spawn_Ground_Skeletons','Skeletons_Awaken_Floor','Skeletons_Inactive_Floor_Pose','Spawn_Air'
];

async function stripChar(file, name) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  root.listAnimations().forEach(a => { a.listSamplers().forEach(x=>x.dispose()); a.listChannels().forEach(x=>x.dispose()); a.dispose(); });
  dropOrphans(doc);
  await doc.transform(prune(), dedup(), weld(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
  const out = OUT + '/chars/' + name + '.glb';
  await io.write(out, doc);
  return fs.statSync(out).size;
}

async function buildAnims() {
  const doc = await io.read(K + '/Characters/gltf/Skeleton_Warrior.glb');
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (!KEEP_ANIMS.includes(a.getName())) { a.listSamplers().forEach(x=>x.dispose()); a.listChannels().forEach(x=>x.dispose()); a.dispose(); continue; }
    for (const ch of a.listChannels()) {
      const n = ch.getTargetNode();
      if (!n || IK.test(n.getName())) { ch.getSampler()?.dispose(); ch.dispose(); continue; }
      // drop scale tracks that are always ~1
      if (ch.getTargetPath() === 'scale') {
        const out = ch.getSampler().getOutput().getArray();
        if (out.every(v => Math.abs(v - 1) < 1e-3)) { ch.getSampler().dispose(); ch.dispose(); continue; }
      }
    }
  }
  // drop meshes & skins; keep node hierarchy for binding
  for (const n of root.listNodes()) { if (n.getMesh()) { n.setMesh(null); } n.setSkin(null); }
  root.listMeshes().forEach(m => m.dispose());
  root.listSkins().forEach(s => s.dispose());
  for (const n of root.listNodes()) if (IK.test(n.getName())) n.dispose();
  dropOrphans(doc);
  await doc.transform(resample({ tolerance: 2e-4 }), prune({ keepLeaves: true }), dedup());
  quantizeRotations(doc); dropOrphans(doc);
  const missing = KEEP_ANIMS.filter(n => !root.listAnimations().some(a => a.getName() === n));
  if (missing.length) console.log('missing anims', missing);
  const out = OUT + '/chars/anims.glb';
  await io.write(out, doc);
  return fs.statSync(out).size;
}

async function buildProps(name, files) {
  const doc = new Document();
  doc.createBuffer();
  const scene = doc.createScene('props');
  for (const [key, f] of files) {
    const src = await io.read(f);
    // wrap each source scene into one named node
    const map = mergeDocuments(doc, src);
    const srcScene = src.getRoot().listScenes()[0];
    const dstScene = map.get(srcScene);
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

const chars = {
  knight: A + '/Characters/gltf/Knight.glb', barbarian: A + '/Characters/gltf/Barbarian.glb',
  mage: A + '/Characters/gltf/Mage.glb', rogue: A + '/Characters/gltf/Rogue.glb', rogue_hooded: A + '/Characters/gltf/Rogue_Hooded.glb',
  skel_minion: K + '/Characters/gltf/Skeleton_Minion.glb', skel_warrior: K + '/Characters/gltf/Skeleton_Warrior.glb',
  skel_rogue: K + '/Characters/gltf/Skeleton_Rogue.glb', skel_mage: K + '/Characters/gltf/Skeleton_Mage.glb',
};
for (const [k, f] of Object.entries(chars)) console.log(k, await stripChar(f, k));
console.log('anims', await buildAnims());

const natureNames = ['tree_single_A','tree_single_B','trees_A_large','trees_A_medium','trees_A_small','trees_B_large','trees_B_medium','trees_B_small','tree_single_A_cut','trees_A_cut',
  'rock_single_A','rock_single_B','rock_single_C','rock_single_D','rock_single_E','cloud_big','cloud_small','waterlily_A','waterlily_B','waterplant_A','waterplant_B','waterplant_C',
  'hill_single_A','mountain_A','mountain_B_grass_trees'];
const propNames = ['barrel','bucket_arrows','bucket_water','crate_A_big','crate_A_small','crate_B_big','crate_long_A','crate_open','flag_blue','flag_red','flag_yellow','flag_green','ladder','pallet','resource_lumber','resource_stone','sack','target','tent','weaponrack','wheelbarrow'];
const buildingNames = ['building_castle_blue','building_tavern_blue','building_market_blue','building_blacksmith_blue','building_windmill_blue','building_well_blue','building_church_blue','building_home_A_blue','building_home_B_blue','building_tower_A_blue','building_tower_B_blue','building_watermill_blue','building_lumbermill_blue','building_archeryrange_blue','building_barracks_blue','building_mine_blue','building_tower_catapult_blue'];
const neutral = ['building_bridge_A','building_destroyed','building_grain','building_scaffolding','fence_stone_straight','fence_wood_straight','fence_wood_straight_gate','wall_straight','wall_straight_gate','wall_corner_A_outside','building_stage_A'];
const find = (dir, n) => { const f = [dir + '/' + n + '.gltf', dir + '/' + n + '.gltf.glb', dir + '/' + n + '.glb'].find(fs.existsSync); if (!f) console.log('MISSING', n); return f; };
console.log('nature', await buildProps('nature', natureNames.map(n => [n, find(H + '/decoration/nature', n)])));
console.log('village', await buildProps('village', [
  ...propNames.map(n => [n, find(H + '/decoration/props', n)]),
  ...buildingNames.map(n => [n.replace('_blue',''), find(H + '/buildings/blue', n)]),
  ...neutral.map(n => [n, find(H + '/buildings/neutral', n)]),
]));
const dungeonNames = fs.readdirSync(D).filter(f => f.endsWith('.glb')).map(f => f.replace(/\.gltf\.glb$|\.glb$/, ''));
console.log('dungeon', await buildProps('dungeon', dungeonNames.map(n => [n, find(D, n)])));
// weapons (adventurers) as props for loot
const SK = K + '/Assets/gltf';
const skelWeapons = ['Skeleton_Axe','Skeleton_Blade','Skeleton_Crossbow','Skeleton_Staff','Skeleton_Shield_Small_A','Skeleton_Shield_Large_A','Skeleton_Arrow'];
const weapons = ['sword_1handed','sword_2handed','axe_1handed','axe_2handed','dagger','staff','wand','crossbow_1handed','crossbow_2handed','shield_round','shield_spikes','shield_square','shield_badge','spellbook_open','mug_full','smokebomb','arrow','quiver'];
console.log('items', await buildProps('items', [...weapons.map(n => [n, find(A + '/Assets/gltf', n)]), ...skelWeapons.map(n => [n, find(SK, n)])]));
