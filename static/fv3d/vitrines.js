// FinVeille — les maquettes (guide 33) : des objets 3D posés dans la page, et non plus seulement derrière elle.
//
// Chaque objet occupe un emplacement de la page, `<div class="fv-obj" data-obj="globe" data-obj-data="{…}">`, écrit
// par Python (scene3d.vitrine). Il y est dessiné dans sa propre toile, transparente, avec un halo lumineux (bloom) sur
// ce qui brille : fenêtres, arêtes, données. Les bords de la toile se fondent dans la page (CSS) : l'objet défile avec
// elle, passe sous les menus, et semble posé dans l'interface.
//
// Les objets répondent : au survol, leur nom et leur chiffre ; on les fait tourner du doigt ou à la souris ; ils se
// tournent un peu vers le pointeur. Au repos, rien n'est redessiné. « Moins d'animations » : ni montage, ni parallaxe.

import * as THREE from "./three.module.min.js";
import { RoomEnvironment } from "./addons/RoomEnvironment.js";
import { EffectComposer } from "./addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./addons/postprocessing/OutputPass.js";
import { MODELS } from "./models.js";
import { outline, palette } from "./kit.js";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const coarse = () => window.matchMedia("(pointer: coarse)").matches;
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

function darkMode() {   // le thème de Streamlit, d'après la couleur du fond
  const app = document.querySelector(".stApp");
  const m = (app ? getComputedStyle(app).backgroundColor : "").match(/\d+(\.\d+)?/g);
  if (!m) return true;
  const [r, g, b] = m.map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.4;
}

function pageColor() {   // la couleur du fond de la page : elle change avec le thème
  const app = document.querySelector(".stApp");
  return new THREE.Color(app ? getComputedStyle(app).backgroundColor : "rgb(6, 9, 18)");
}

// --- Le rendu d'une vitrine : sa toile, la lumière d'une pièce (reflets), le halo de ce qui brille --------------------
class Lens {
  constructor(canvas, dark) {
    // une toile transparente : la page (ses dégradés, ses particules) se voit derrière l'objet ; le halo s'y ajoute
    // comme une lumière (alpha nul, couleur prémultipliée)
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true,
      powerPreference: "high-performance" }));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;   // les couleurs d'information restent exactes ; le halo adoucit les lumières
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(r);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // une pièce claire : des reflets doux dans le verre
    pmrem.dispose();
    r.setClearColor(0x000000, 0);
    this.dark = dark;
  }
  setup(scene, camera, w, h, dpr) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    if (!this.composer) {   // l'image passe par trois étapes : la scène, le halo, puis les couleurs de l'écran
      const target = new THREE.WebGLRenderTarget(w * dpr, h * dpr, { type: THREE.HalfFloatType, samples: coarse() ? 2 : 4 });
      this.composer = new EffectComposer(this.renderer, target);
      this.composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), this.dark ? 0.5 : 0.22, 0.32, this.dark ? 0.72 : 0.9);
      // le halo s'ajoute à la couleur sans toucher à la transparence : autour de l'objet, il éclaire la page
      Object.assign(bloom.blendMaterial, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
      bloom.enabled = this.dark;   // sur une page claire, un halo additif blanchirait le fond
      this.composer.addPass(bloom);
      this.composer.addPass(new OutputPass());
    }
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
  }
  draw() { this.composer.render(); }
  dispose() {
    this.composer?.dispose();
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();   // le navigateur limite le nombre de contextes WebGL : on rend le sien
  }
}

// --- Une vitrine : un emplacement de la page et son objet --------------------------------------------------------
const recent = new Map();   // un objet redessiné juste après une mise à jour de la page ne rejoue pas son montage

class Vitrine {
  constructor(el, dark, sig) {
    this.el = el; this.sig = sig;
    this.kind = el.dataset.obj;
    let data = {};
    try { data = JSON.parse(el.dataset.objData || "{}"); } catch { /* données illisibles : l'objet par défaut */ }
    this.canvas = el.querySelector("canvas.fv-obj-canvas") || el.insertBefore(Object.assign(document.createElement("canvas"),
      { className: "fv-obj-canvas" }), el.firstChild);
    this.canvas.setAttribute("aria-hidden", "true");
    this.lens = new Lens(this.canvas, dark);
    this.scene = new THREE.Scene();
    this.scene.environment = this.lens.env;
    this.scene.environmentIntensity = dark ? 0.9 : 0.8;
    this.pal = palette(dark);
    this.model = (MODELS[this.kind] || MODELS.paper)(data, this.pal, this.scene);
    outline(this.model.root, this.pal);   // les arêtes de lumière, sur tous les volumes
    this.pivot = new THREE.Group();   // l'objet tourne dans la lumière, qui reste fixe
    this.pivot.add(this.model.root);
    this.scene.add(this.pivot);
    const view = this.model.view;
    this.camera = new THREE.PerspectiveCamera(view.fov || 28, 1, 0.1, 400);
    this.cam = { pos: new THREE.Vector3(...view.pos), look: new THREE.Vector3(...view.look) };
    this.goal = { pos: this.cam.pos.clone(), look: this.cam.look.clone() };
    const last = recent.get(this.kind);
    // le temps du montage, en secondes ; un objet que la page vient de redessiner (nouveaux cours) ne le rejoue pas
    this.t = reduced() || (last && performance.now() - last < 30_000) ? 99 : 0;
    this.yaw = 0; this.yawGoal = 0; this.spin = 0; this.tiltX = 0; this.tiltY = 0;
    this.hover = null; this.visible = false; this.dirty = true;
    this.labels = new Map();
    this.ray = new THREE.Raycaster();
    this.tip = el.querySelector(".fv-obj-tip") || el.appendChild(Object.assign(document.createElement("span"), { className: "fv-obj-tip" }));
    this.tip.setAttribute("aria-hidden", "true");
    this.resize();
    this.listen();
  }
  resize() {
    const w = Math.max(1, this.el.clientWidth), h = Math.max(1, this.el.clientHeight);
    // un téléphone dessine moins de pixels : l'objet reste net, la batterie tient
    const dpr = Math.min(window.devicePixelRatio || 1, coarse() || w * h > 400_000 ? 1.5 : 2);
    this.css = [w, h];
    this.lens.setup(this.scene, this.camera, w, h, dpr);
    this.camera.aspect = w / h;
    // un emplacement plus étroit que prévu : la caméra recule pour que l'objet tienne en largeur
    this.reach = Math.max(1, (this.model.view.aspect || 1.25) / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
  listen() {
    const el = this.el;
    let drag = null;
    this.onMove = (e) => {
      const box = el.getBoundingClientRect();
      if (drag) {
        const dx = e.clientX - drag.x;
        if (drag.touch && !drag.horizontal) {   // au doigt : un geste vertical fait défiler la page
          if (Math.abs(e.clientY - drag.y) > 10 && Math.abs(dx) < 10) { drag = null; return; }
          if (Math.abs(dx) > 10) drag.horizontal = true; else return;
        }
        this.yawGoal = drag.yaw + dx * 0.012;
        this.spin = (e.clientX - drag.lastX) * 0.012 * 60;
        drag.lastX = e.clientX;
        this.dirty = true;
      }
      if (e.pointerType === "mouse") this.pick((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height, e);
    };
    this.onDown = (e) => {
      drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, yaw: this.yawGoal, touch: e.pointerType !== "mouse" };
      this.spin = 0;
      if (!drag.touch) el.setPointerCapture?.(e.pointerId);
      el.classList.add("is-grabbing");
    };
    this.onUp = (e) => {
      drag = null;
      el.classList.remove("is-grabbing");
      if (e.pointerType !== "mouse") {   // au doigt : un simple toucher montre l'étiquette
        const box = el.getBoundingClientRect();
        this.pick((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height, e);
      }
    };
    this.onLeave = () => { this.pick(null); };
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onUp);
    el.addEventListener("pointerleave", this.onLeave);
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(el);
  }
  pick(x, y, e) {   // ce qu'il y a sous le pointeur : son nom et son chiffre
    let hit = null;
    if (x != null && this.model.pick) {
      this.ray.setFromCamera(new THREE.Vector2(x * 2 - 1, -(y * 2 - 1)), this.camera);
      hit = this.model.pick(this.ray);
    }
    const id = hit ? hit.id : null;
    if (id !== this.hover) {
      this.hover = id;
      this.model.setHover?.(id);
      this.dirty = true;
    }
    this.tip.textContent = hit ? hit.text : "";
    this.tip.classList.toggle("is-on", !!hit);
    if (hit && e) {
      const box = this.el.getBoundingClientRect();
      this.tip.style.left = `${e.clientX - box.left}px`;
      this.tip.style.top = `${e.clientY - box.top}px`;
    }
  }
  step(dt, pointer, story) {   // avance d'une image ; vrai s'il faut redessiner
    let busy = this.dirty;
    this.dirty = false;
    if (this.t < 99) {
      this.t += dt;
      busy = true;
      if (this.t > (this.model.intro || 2.4)) this.t = 99;
    }
    // le récit de l'accueil choisit la pose de la caméra (maquette du CAC 40)
    if (story && this.model.pose) {
      const pose = this.model.pose(story.kinds[story.chapter] || "overview");
      this.goal.pos.set(...pose.pos).applyEuler(this.pivot.rotation);   // la pose suit l'objet s'il a tourné
      this.goal.look.set(...pose.look).applyEuler(this.pivot.rotation);
    }
    const follow = 1 - Math.exp(-dt * 3);
    const gap = this.cam.pos.distanceTo(this.goal.pos) + this.cam.look.distanceTo(this.goal.look);
    if (gap > 0.002) { this.cam.pos.lerp(this.goal.pos, follow); this.cam.look.lerp(this.goal.look, follow); busy = true; }
    // la rotation : le geste, puis son élan qui s'éteint
    if (Math.abs(this.spin) > 0.001 && !reduced()) { this.yawGoal += this.spin * dt; this.spin *= Math.exp(-dt * 3); busy = true; }
    // l'objet se tourne un peu vers le pointeur (souris seulement)
    let tx = 0, ty = 0;
    if (pointer && !reduced()) {
      const box = this.el.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, (pointer.x - (box.left + box.width / 2)) / window.innerWidth * 2)) * 0.16;
      ty = Math.max(-1, Math.min(1, (pointer.y - (box.top + box.height / 2)) / window.innerHeight * 2)) * 0.05;
    }
    const k = 1 - Math.exp(-dt * 4);
    const dy = (this.yawGoal + tx) - this.yaw, dx = ty - this.tiltX;
    if (Math.abs(dy) > 0.0005 || Math.abs(dx) > 0.0005) { this.yaw += dy * k; this.tiltX += dx * k; busy = true; }
    if (this.model.update && this.model.update(this.t, dt)) busy = true;
    if (!busy) return false;
    this.pivot.rotation.set(this.tiltX, this.yaw, 0);
    const back = this.reach;
    this.camera.position.copy(this.cam.look).addScaledVector(this.cam.pos.clone().sub(this.cam.look), back);
    this.camera.lookAt(this.cam.look);
    this.camera.updateMatrixWorld();
    this.placeLabels();
    return true;
  }
  placeLabels() {   // les étiquettes sont du texte de la page, posé au-dessus du point 3D qu'elles nomment
    const wanted = this.model.labels ? this.model.labels() : [];
    const seen = new Set();
    for (const item of wanted) {
      let node = this.labels.get(item.id);
      if (!node) {
        node = document.createElement("span");
        node.className = "fv-obj-label";
        node.setAttribute("aria-hidden", "true");
        this.el.appendChild(node);
        this.labels.set(item.id, node);
      }
      seen.add(item.id);
      if (node.textContent !== item.text) node.textContent = item.text;
      node.dataset.tone = item.tone || "";
      const p = this.model.root.localToWorld(item.pos.clone());
      p.project(this.camera);
      const x = (p.x + 1) / 2 * this.css[0], y = (1 - p.y) / 2 * this.css[1];
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      // une étiquette dont le point sort de la vitrine s'efface : elle ne doit jamais couvrir le texte voisin
      const inside = x > 40 && x < this.css[0] - 40 && y > 30 && y < this.css[1];
      node.style.opacity = inside ? (item.opacity ?? 1).toFixed(3) : "0";
    }
    for (const [id, node] of this.labels) if (!seen.has(id)) { node.remove(); this.labels.delete(id); }
  }
  dispose() {
    recent.set(this.kind, performance.now());
    this.resizer.disconnect();
    this.el.removeEventListener("pointermove", this.onMove);
    this.el.removeEventListener("pointerdown", this.onDown);
    this.el.removeEventListener("pointerup", this.onUp);
    this.el.removeEventListener("pointercancel", this.onUp);
    this.el.removeEventListener("pointerleave", this.onLeave);
    for (const node of this.labels.values()) node.remove();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.bumpMap?.dispose(); m.emissiveMap?.dispose(); m.dispose(); }
    });
    this.lens.dispose();
  }
}

// --- Le chef d'orchestre ------------------------------------------------------------------------------------------
export function installVitrines() {
  if (window.__fvObjs) return;
  window.__fvObjs = { list: [] };
  const state = { dark: darkMode(), page: pageColor().getHexString() };
  document.documentElement.classList.add("fv-obj-on");   // les illustrations de secours s'effacent
  const live = new Map();
  window.__fvObjs.live = live;
  // visible ou non : mesuré à chaque image (un emplacement dans une scène collée au défilement trompe l'observateur
  // d'intersection du navigateur) ; une vitrine qui réapparaît est redessinée
  const seen = { observe() {}, unobserve() {} };
  const inView = (v) => {
    const r = v.el.getBoundingClientRect();
    const now = r.width > 0 && r.bottom > -160 && r.top < window.innerHeight + 160;
    if (now && !v.visible) v.dirty = true;
    v.visible = now;
    return now;
  };
  const scan = () => {
    const dark = darkMode(), page = pageColor().getHexString();
    if (dark !== state.dark || page !== state.page) {   // le thème a changé : les objets changent de matière
      Object.assign(state, { dark, page });
      for (const [el, v] of live) { v.dispose(); live.delete(el); seen.unobserve(el); }
    }
    for (const el of document.querySelectorAll(".fv-obj[data-obj]")) {
      const sig = `${el.dataset.obj}|${el.dataset.objData || ""}`;
      const old = live.get(el);
      if (old && old.sig === sig) continue;
      if (old) old.dispose();
      try {
        live.set(el, new Vitrine(el, state.dark, sig));
        seen.observe(el);
        el.classList.remove("is-fallback");
      } catch (error) {   // pas de contexte WebGL de plus : l'illustration de secours reste
        el.classList.add("is-fallback");
        console.warn("FinVeille : maquette impossible", el.dataset.obj, error);
      }
    }
    for (const [el, v] of live) if (!el.isConnected) { v.dispose(); live.delete(el); seen.unobserve(el); }
  };
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } })
    .observe(document.body, { childList: true, subtree: true });
  scan();

  let pointer = null;
  if (finePointer()) window.addEventListener("pointermove", (e) => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!document.hidden && !window.__fvObjs.manual) {
      const story = window.__fvStory?.el ? window.__fvStory : null;
      for (const v of live.values()) {
        if (!inView(v)) continue;
        if (v.step(dt, pointer, v.el.closest(".fv-story") ? story : null)) v.lens.draw();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // pour le tournage de la bande-annonce (tools/footage.py) : avancer le temps image par image
  window.__fvObjs.tick = (ms) => {
    window.__fvObjs.manual = true;
    const story = window.__fvStory?.el ? window.__fvStory : null;
    for (const v of live.values()) {
      if (!inView(v)) continue;
      v.dirty = true;
      if (v.step(ms / 1000, pointer, v.el.closest(".fv-story") ? story : null)) v.lens.draw();
    }
  };
}
