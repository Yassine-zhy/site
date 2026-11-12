// FinVeille — les maquettes (guide 42) : des images de synthèse photoréalistes, rendues à l'avance dans Blender.
//
// Chaque maquette occupe un emplacement de la page, `<div class="fv-obj" data-obj="city" data-obj-data="{…}">`, écrit
// par Python (scene3d.vitrine). Le navigateur n'y calcule plus de 3D : il affiche une image (static/renders/,
// produite par tools/blender/) dans une toile. Pour la ville, un masque rendu avec l'image dit à quelle tour
// appartient chaque pixel : les toits sont peints à la couleur de la séance, le survol nomme la tour et donne sa
// variation, un clic cherche ses dépêches. Plus de WebGL : rien à perdre sur un téléphone, et l'image est plus belle
// que ce qu'un navigateur peut calculer en direct.

const BASE = new URL("../renders/", import.meta.url).href;
const VERSION = new URL(import.meta.url).search;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const signed = (v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2).replace(".", ",")} %`;
const UP = [31, 163, 95], DOWN = [216, 65, 79];

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = BASE + src + VERSION;
  });
}

// --- Ce que fait un clic sur une maquette (l'action est donnée par la page : scene3d.py) -----------------------
//   search  écrire le nom visé dans un champ de recherche de la page, puis aller aux résultats (la ville : ses dépêches)
//   reveal  aller à l'élément de la page qui porte le nom visé, et le faire briller (une tuile, une ligne de tableau)
//   ask     poser à l'assistant la question portée par la fiche visée
//   next    aller au contenu qui suit l'en-tête (le formulaire, le tableau…)
function perform(act, key, el) {
  // la page défile dans stMain, pas dans window : scrollIntoView en douceur y reste parfois sans effet
  // et un défilement en cours s'arrête si la page bouge (Streamlit redessine) : on vérifie, puis on termine
  const show = (node, block = "center", tries = 2) => {
    const main = node.closest('[data-testid="stMain"]');
    if (!main) { node.scrollIntoView({ block }); return; }
    const goal = () => {
      const r = node.getBoundingClientRect(), m = main.getBoundingClientRect();
      const gap = block === "center" ? Math.max(90, (m.height - r.height) / 2) : 90;   // sous la barre de Streamlit
      return Math.min(main.scrollHeight - main.clientHeight, Math.max(0, main.scrollTop + r.top - m.top - gap));
    };
    const smooth = tries > 0 && !reduced();
    main.scrollTo({ top: goal(), behavior: smooth ? "smooth" : "auto" });
    if (smooth) setTimeout(() => { if (node.isConnected && Math.abs(goal() - main.scrollTop) > 40) show(node, block, tries - 1); }, 1200);
  };
  const flash = (node) => {
    node.classList.remove("fv-flash");
    void node.offsetWidth;   // relance l'animation si l'élément brillait déjà
    node.classList.add("fv-flash");
    setTimeout(() => node.classList.remove("fv-flash"), 2000);
  };
  const next = () => {   // le premier bloc de la page après celui de la maquette
    let block = el.closest('[data-testid="stElementContainer"]');
    while (block && !block.nextElementSibling) block = block.parentElement?.closest('[data-testid="stElementContainer"], [data-testid="stVerticalBlock"]');
    let target = block?.nextElementSibling;
    while (target && target.offsetHeight < 8) target = target.nextElementSibling;   // les blocs invisibles (le moteur 3D)
    if (target) show(target, "start");
  };
  const type = (field, value, Proto) => {   // comme au clavier : React voit la saisie, puis la touche Entrée
    Object.getOwnPropertyDescriptor(Proto.prototype, "value").set.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
  };
  if (act.type === "search" && key) {
    const field = [...document.querySelectorAll('[data-testid="stTextInput"] input')]
      .find((input) => (input.placeholder || "").startsWith(act.input || ""));
    if (field) {
      type(field, key, HTMLInputElement);
      // le temps que Streamlit redessine le fil filtré ; show() rattrape un redessin plus lent
      setTimeout(() => { const target = document.querySelector(act.then || "#fv-fil"); if (target) show(target, "start"); }, 1000);
      return;
    }
  }
  if (act.type === "reveal" && key) {
    const nodes = [...document.querySelectorAll(act.in)].filter((node) => node.textContent.includes(key));
    const node = nodes.sort((a, b) => a.textContent.length - b.textContent.length)[0];   // le plus précis
    if (node) { show(node); flash(node); return; }
  }
  if (act.type === "ask") {
    const box = document.querySelector('[data-testid="stChatInputTextArea"]');
    if (box && key) { type(box, key, HTMLTextAreaElement); return; }
    if (box) { show(box); box.focus({ preventScroll: true }); return; }
  }
  next();
}


// --- Une maquette : sa toile, son image, et pour la ville son masque ------------------------------------------------
async function mount(el) {
  const kind = el.dataset.obj;
  let data = {};
  try { data = JSON.parse(el.dataset.objData || "{}"); } catch { /* données illisibles : l'image seule */ }
  el.querySelectorAll("canvas.fv-obj-canvas, .fv-obj-label").forEach((old) => old.remove());
  const canvas = el.insertBefore(Object.assign(document.createElement("canvas"), { className: "fv-obj-canvas" }), el.firstChild);
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.objectFit = "contain";
  const tip = el.querySelector(".fv-obj-tip") || el.appendChild(Object.assign(document.createElement("span"), { className: "fv-obj-tip" }));
  tip.setAttribute("aria-hidden", "true");
  const name = kind === "city" ? `city-${data.place || "france"}` : kind;
  const image = await load(`${name}.webp`);
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  el.classList.remove("is-fallback");
  // la zone de la toile réellement occupée par l'image (elle est centrée, sans déformation)
  const frame = () => {
    const box = canvas.getBoundingClientRect(), k = Math.min(box.width / canvas.width, box.height / canvas.height);
    const w = canvas.width * k, h = canvas.height * k;
    return { box, left: (box.width - w) / 2, top: (box.height - h) / 2, w, h };
  };
  let towers = [], ids = null, tops = [];
  if (kind === "city") {
    towers = (data.towers || []).slice().sort((a, b) => b.w - a.w);
    const [mask, meta] = await Promise.all([load(`${name}-mask.png`), fetch(`${BASE}${name}.json${VERSION}`).then((r) => r.json())]);
    tops = meta.tops;
    const off = Object.assign(document.createElement("canvas"), { width: canvas.width, height: canvas.height });
    const octx = off.getContext("2d", { willReadFrequently: true });
    octx.imageSmoothingEnabled = false;
    octx.drawImage(mask, 0, 0, off.width, off.height);
    const px = octx.getImageData(0, 0, off.width, off.height), d = px.data;
    ids = new Uint8Array(off.width * off.height);   // le numéro de la tour sous chaque pixel (0 : aucune)
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const id = Math.round(d[i] / 6), roof = d[i + 1] > 128, t = towers[id - 1];
      ids[p] = id;
      if (roof && t && t.c != null) {   // le toit : blanc dans l'image, multiplié par la couleur de la séance
        const k = 0.45 + 0.55 * Math.min(1, Math.abs(t.c) / 2.5), c = t.c >= 0 ? UP : DOWN;
        d[i] = 255 + (c[0] - 255) * k; d[i + 1] = 255 + (c[1] - 255) * k; d[i + 2] = 255 + (c[2] - 255) * k; d[i + 3] = 255;
      } else d[i + 3] = 0;
    }
    octx.putImageData(px, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(off, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
  const at = (e) => {   // la tour sous le pointeur
    if (!ids) return null;
    const f = frame(), x = (e.clientX - f.box.left - f.left) / f.w, y = (e.clientY - f.box.top - f.top) / f.h;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return null;
    return towers[ids[Math.floor(y * canvas.height) * canvas.width + Math.floor(x * canvas.width)] - 1] || null;
  };
  const act = data.act;
  el.onpointermove = (e) => {
    const t = at(e), hint = act && (t ? act.hint : act.hintAll || act.hint);
    tip.classList.toggle("is-on", !!(t || hint));
    if (!t && !hint) return;
    tip.innerHTML = "";
    if (t) tip.appendChild(Object.assign(document.createElement("b"), { textContent: t.c != null ? `${t.n}, ${signed(t.c)}` : t.n }));
    if (hint) tip.appendChild(Object.assign(document.createElement("small"), { textContent: hint }));
    const box = el.getBoundingClientRect();
    tip.style.left = `${e.clientX - box.left}px`;
    tip.style.top = `${e.clientY - box.top}px`;
    el.style.cursor = act ? "pointer" : "";
  };
  el.onpointerleave = () => tip.classList.remove("is-on");
  el.onclick = (e) => { if (act) perform(act, at(e)?.n ?? null, el); };
  // le récit de l'accueil : les trois plus fortes hausses (ou baisses) du chapitre sont nommées sur la ville
  const known = towers.map((t, k) => ({ ...t, k })).filter((t) => t.c != null);
  const ups = [...known].sort((a, b) => b.c - a.c).slice(0, 3), downs = [...known].sort((a, b) => a.c - b.c).slice(0, 3);
  let shown = null;
  el.__fvLabels = () => {
    const story = el.closest(".fv-story") && window.__fvStory?.el ? window.__fvStory : null;
    const kindOf = story ? story.kinds[story.chapter] : null, list = kindOf === "up" ? ups : kindOf === "down" ? downs : [];
    const key = `${kindOf}|${canvas.getBoundingClientRect().width | 0}`;
    if (key === shown) return;
    shown = key;
    el.querySelectorAll(".fv-obj-label").forEach((node) => node.remove());
    const f = frame();
    list.forEach((t, i) => {
      const node = Object.assign(document.createElement("span"), { className: "fv-obj-label", textContent: `${t.n} ${signed(t.c)}` });
      node.dataset.tone = t.c >= 0 ? "up" : "down";
      node.style.left = `${f.left + tops[t.k][0] * f.w}px`;
      node.style.top = `${f.top + tops[t.k][1] * f.h - 6}px`;
      node.style.opacity = i === 0 ? "1" : "0.8";
      el.appendChild(node);
    });
  };
  el.__fvLabels();
}

// --- Le chef d'orchestre ------------------------------------------------------------------------------------------
export function installRenders() {
  if (window.__fvObjs) return;
  window.__fvObjs = {};
  document.documentElement.classList.add("fv-obj-on");
  const scan = () => {
    for (const el of document.querySelectorAll(".fv-obj[data-obj]")) {
      const sig = `${el.dataset.obj}|${el.dataset.objData || ""}`;
      if (el.__fvSig !== sig) {
        el.__fvSig = sig;
        mount(el).catch((error) => { el.classList.add("is-fallback"); console.warn("FinVeille : maquette indisponible", el.dataset.obj, error); });
      }
      el.__fvLabels?.();
    }
  };
  let queued = false;
  const rescan = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } };
  new MutationObserver(rescan).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("scroll", rescan, { capture: true, passive: true });   // le chapitre du récit change en défilant
  window.addEventListener("resize", rescan);
  scan();
}
