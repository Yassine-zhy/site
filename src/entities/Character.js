import * as THREE from 'three';

const LOWER = new Set(['root', 'hips', 'upperlegl', 'upperlegr', 'lowerlegl', 'lowerlegr', 'footl', 'footr', 'toesl', 'toesr']);
const splitCache = new Map();

function nodeOf(track) { return track.name.slice(0, track.name.lastIndexOf('.')); }

// Découpe un clip en deux couches : bas du corps (jambes) et haut du corps (bras, buste, tête).
function splitClip(clip) {
  let s = splitCache.get(clip);
  if (s) return s;
  const lower = new THREE.AnimationClip(clip.name + '#lower', clip.duration, clip.tracks.filter((t) => LOWER.has(nodeOf(t))));
  const upper = new THREE.AnimationClip(clip.name + '#upper', clip.duration, clip.tracks.filter((t) => !LOWER.has(nodeOf(t))));
  s = { lower, upper, full: clip };
  splitCache.set(clip, s);
  return s;
}

// Personnage animé KayKit : mixeur à deux couches, armes, flash d'impact, dissolution.
export class Character {
  constructor(assets, model, { scale = 1, show = null, attach = [], tint = null } = {}) {
    this.assets = assets;
    this.object = new THREE.Group();
    this.model = assets.character(model);
    this.model.scale.setScalar(scale);
    this.scale = scale;
    this.object.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.layers = { lower: { action: null, name: null }, upper: { action: null, name: null } };
    this.loco = null;
    this.locoScale = 1;
    this.oneShot = null;
    this.flash = 0;
    this.materials = [];
    this.bones = {};
    this.model.traverse((o) => {
      if (o.isBone || o.type === 'Object3D' || o.isGroup) this.bones[o.name] = o;
      if (o.isMesh) this.materials.push(...(Array.isArray(o.material) ? o.material : [o.material]));
    });
    if (tint) for (const m of this.materials) m.color.multiply(new THREE.Color(tint));
    if (show) this.showOnly(show);
    for (const [prop, bone, s = 1] of attach) this.attach(prop, bone, s);
    this.mixer.addEventListener('finished', (e) => this.onFinished(e));
    this.opacity = 1;
  }

  // n'affiche que les accessoires listés parmi ceux tenus en main / sur la tête
  showOnly(names) {
    const keep = new Set(names);
    this.model.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      const parent = o.parent?.name || '';
      if (/handslot/.test(parent)) o.visible = keep.has(o.name);
    });
  }

  attach(propName, boneName, s = 1) {
    const bone = this.bones[boneName] || this.bones[boneName.replace(/\./g, '')];
    if (!bone) return null;
    const p = this.assets.prop(propName);
    p.scale.setScalar(s);
    p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); this.materials.push(o.material); } });
    bone.add(p);
    return p;
  }

  action(clipName, layer) {
    const clip = this.assets.clip(clipName);
    if (!clip) { console.warn('Animation manquante', clipName); return null; }
    const parts = splitClip(clip);
    return this.mixer.clipAction(parts[layer], this.model);
  }

  fadeLayer(layer, clipName, { fade = 0.2, loop = true, timeScale = 1, startAt = null } = {}) {
    const L = this.layers[layer];
    const act = this.action(clipName, layer);
    if (!act) return null;
    if (L.action === act && L.name === clipName) { act.timeScale = timeScale; return act; }
    act.reset();
    act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    act.clampWhenFinished = !loop;
    act.timeScale = timeScale;
    act.enabled = true;
    act.setEffectiveWeight(1);
    if (startAt !== null) act.time = startAt;
    if (L.action && fade > 0) { act.play(); act.crossFadeFrom(L.action, fade, false); }
    else { if (L.action) L.action.stop(); act.play(); }
    L.action = act; L.name = clipName;
    return act;
  }

  // Locomotion (boucle) sur le bas du corps, et sur le haut si aucune action n'est en cours.
  setLocomotion(name, timeScale = 1, fade = 0.2) {
    const changed = this.loco !== name;
    this.loco = name; this.locoScale = timeScale;
    const lower = this.fadeLayer('lower', name, { fade, timeScale });
    if (!this.oneShot) {
      const up = this.fadeLayer('upper', name, { fade, timeScale });
      if (changed && lower && up) up.time = lower.time;
    }
  }

  // Action ponctuelle : sur tout le corps (full) ou seulement le haut (attaque en courant).
  playAction(name, { full = false, timeScale = 1, fade = 0.12, onDone = null, hold = false } = {}) {
    const clip = this.assets.clip(name);
    if (!clip) return 0;
    this.oneShot = { name, full, onDone, hold };
    this.fadeLayer('upper', name, { fade, loop: false, timeScale });
    if (full) this.fadeLayer('lower', name, { fade, loop: false, timeScale });
    return clip.duration / timeScale;
  }

  // Action en boucle (canalisation, blocage) jusqu'à stopAction().
  playLoop(name, { full = false, timeScale = 1, fade = 0.15 } = {}) {
    this.oneShot = { name, full, loop: true };
    this.fadeLayer('upper', name, { fade, loop: true, timeScale });
    if (full) this.fadeLayer('lower', name, { fade, loop: true, timeScale });
  }

  stopAction(fade = 0.2) {
    if (!this.oneShot) return;
    const wasFull = this.oneShot.full;
    this.oneShot = null;
    if (this.loco) {
      const lower = this.layers.lower;
      if (wasFull) this.fadeLayer('lower', this.loco, { fade, timeScale: this.locoScale });
      const up = this.fadeLayer('upper', this.loco, { fade, timeScale: this.locoScale });
      if (up && lower.action) up.time = lower.action.time;
    }
  }

  onFinished(e) {
    const os = this.oneShot;
    if (!os || os.loop) return;
    const upAct = this.layers.upper.action;
    if (e.action !== upAct && !(os.full && e.action === this.layers.lower.action)) return;
    if (os.hold) { os.onDone?.(); return; }
    const cb = os.onDone;
    this.stopAction(0.18);
    cb?.();
  }

  hitFlash(color = '#ffffff', amount = 1) {
    this.flash = amount;
    this.flashColor = this.flashColor || new THREE.Color();
    this.flashColor.set(color);
  }

  setOpacity(o) {
    if (o === this.opacity) return;
    this.opacity = o;
    for (const m of this.materials) {
      m.transparent = o < 1;
      m.opacity = o;
      m.depthWrite = o >= 1;
    }
  }

  update(dt) {
    this.mixer.update(dt);
    if (this.flash > 0 || this._flashing) {
      this.flash = Math.max(0, this.flash - dt * 5);
      this._flashing = this.flash > 0;
      for (const m of this.materials) {
        const be = m.userData.baseEmissive;
        if (!m.emissive) continue;
        if (this.flash > 0) { m.emissive.copy(this.flashColor); m.emissiveIntensity = this.flash * 1.4; }
        else if (be) { m.emissive.copy(be); m.emissiveIntensity = m.userData.baseEmissiveIntensity ?? 1; }
        else { m.emissive.setRGB(0, 0, 0); }
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.object.removeFromParent();
    for (const m of this.materials) m.dispose();
  }
}
