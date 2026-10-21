// FinVeille — le mouvement des pages (guide 32), avec GSAP et ScrollTrigger.
//
// Peu d'effets, mais tirés du monde de la Bourse :
// - l'accueil raconte la séance au défilement : un chapitre à la fois (la séance, la plus forte hausse, la plus forte
//   baisse, l'actualité) ; le décor 3D lit le chapitre en cours (window.__fvStory) et y braque sa caméra ;
// - les cours arrivent en rouleaux, comme sur un tableau de cotation ;
// - les dépêches s'impriment de gauche à droite, comme sur un fil d'agence ;
// - les horloges des places boursières tournent dans le navigateur (la page n'a pas à se redessiner).
// Rien n'est caché en attendant une animation : sans JavaScript, tout reste lisible.

const BASE = new URL(".", import.meta.url).href;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const scroller = () => document.querySelector('[data-testid="stMain"], [data-testid="stAppScrollToBottomContainer"]');

let gsapReady = null;
function loadGsap() {   // GSAP est distribué en script classique : on l'ajoute à la page, une seule fois
  gsapReady ??= (async () => {
    for (const name of ["gsap.min.js", "ScrollTrigger.min.js"]) {
      await new Promise((resolve, reject) => {
        const tag = document.createElement("script");
        tag.src = BASE + name; tag.onload = resolve; tag.onerror = reject;
        document.head.appendChild(tag);
      });
    }
    window.gsap.registerPlugin(window.ScrollTrigger);
    return window.gsap;
  })();
  return gsapReady;
}

// --- Les cours en rouleaux ----------------------------------------------------------------------------------------
// Chaque chiffre devient une petite colonne 0-9 qui défile jusqu'à sa valeur. Le texte d'origine reste dans la page
// pour les lecteurs d'écran ; la colonne est décorative (aria-hidden). Le chiffre final est en place dès le départ.
const ODOMETERS = ".fv-odo, .fv-float-value, .fv-kpi-value, .fv-tile-value";

function buildOdometer(el) {
  const text = el.textContent;
  if (!/\d/.test(text) || el.children.length) return null;
  const visual = document.createElement("span");
  visual.className = "fv-odo-run";
  visual.setAttribute("aria-hidden", "true");
  const strips = [];
  for (const ch of text) {
    if (/\d/.test(ch)) {
      const box = document.createElement("span"), strip = document.createElement("span");
      box.className = "fv-odo-d"; strip.className = "fv-odo-strip";
      strip.innerHTML = "<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>";
      strip.dataset.digit = ch;
      strip.style.transform = `translateY(${-Number(ch) * 10}%)`;
      // le chiffre final, invisible, donne sa largeur à la colonne (et la suit quand la police se charge)
      const ghost = document.createElement("span");
      ghost.className = "fv-odo-ghost"; ghost.textContent = ch;
      box.append(ghost, strip); visual.appendChild(box); strips.push(strip);
    } else {
      visual.appendChild(document.createTextNode(ch));
    }
  }
  const sr = document.createElement("span");
  sr.className = "fv-sr"; sr.textContent = text;
  el.textContent = "";
  el.append(sr, visual);
  return strips;
}

function roll(gsap, strips) {
  gsap.fromTo(strips, { yPercent: (i, t) => -10 * ((Number(t.dataset.digit) + 3 + i) % 10) },
    { yPercent: (i, t) => -10 * Number(t.dataset.digit), duration: 1.15, ease: "power3.out",
      stagger: { each: 0.045, from: "end" }, overwrite: true });
}

function odometers(gsap, ST) {
  for (const el of document.querySelectorAll(ODOMETERS)) {
    if (el.dataset.fvOdo) continue;
    el.dataset.fvOdo = "1";
    if (reduced()) continue;
    const strips = buildOdometer(el);
    if (!strips) continue;
    for (const s of strips) s.style.transform = "";
    gsap.set(strips, { yPercent: (i, t) => -10 * Number(t.dataset.digit) });
    el.__fvRoll = () => roll(gsap, strips);
    // dans le récit de l'accueil, c'est le changement de chapitre qui lance le rouleau
    if (!el.closest(".fv-ch")) ST.create({ trigger: el, start: "top 95%", once: true, onEnter: el.__fvRoll });
  }
}

// --- Les dépêches qui s'impriment ----------------------------------------------------------------------------------
const WIRES = '[class*="st-key-fvcard_"], [class*="st-key-fvcompact_"], [class*="st-key-fvtile_"], [class*="st-key-fvlead_"]';

function wires(gsap, ST) {
  const fresh = [...document.querySelectorAll(WIRES)].filter((el) => !el.dataset.fvWire);
  fresh.forEach((el) => { el.dataset.fvWire = "1"; });
  if (!fresh.length || reduced()) return;
  ST.batch(fresh, {
    start: "top 96%", once: true,
    onEnter: (els) => gsap.fromTo(els, { clipPath: "inset(0 100% 0 0)" },
      { clipPath: "inset(0 0% 0 0)", duration: 0.65, ease: "power2.out", stagger: 0.07, clearProps: "clipPath" }),
  });
}

// --- Le récit de la séance (accueil) ---------------------------------------------------------------------------------
// La section est haute de plusieurs écrans ; sa scène reste collée en haut (position: sticky). Le défilement à
// travers la section choisit le chapitre affiché.
function installStory() {
  const state = (window.__fvStory = { el: null, chapter: 0, progress: 0, kinds: [] });
  const setup = (story) => {
    state.el = story;
    state.chapters = [...story.querySelectorAll(".fv-ch")];
    state.kinds = state.chapters.map((c) => c.dataset.kind);
    state.rail = [...story.querySelectorAll(".fv-story-rail li")];
    state.chapter = -1;
    document.documentElement.classList.add("fv-story-on");
    state.rail.forEach((item, i) => {   // cliquer un chapitre du rail y emmène
      item.querySelector("button")?.addEventListener("click", () => {
        const sc = scroller(), stage = story.querySelector(".fv-story-stage");
        const span = story.offsetHeight - stage.offsetHeight;
        const stuck = parseFloat(getComputedStyle(stage).top) || 0;   // la scène se colle à cette distance du haut
        const storyTop = story.getBoundingClientRect().top - sc.getBoundingClientRect().top;
        const wanted = stuck - (i + 0.5) / state.chapters.length * span;
        sc.scrollTo({ top: sc.scrollTop + storyTop - wanted, behavior: reduced() ? "auto" : "smooth" });
      });
    });
  };
  const update = () => {
    const story = document.querySelector(".fv-story");
    if (!story) {
      if (state.el) { state.el = null; document.documentElement.classList.remove("fv-story-on"); }
      return;
    }
    if (story !== state.el) setup(story);
    const stage = story.querySelector(".fv-story-stage");
    const box = story.getBoundingClientRect(), top = stage.getBoundingClientRect().top - box.top;
    const span = Math.max(1, story.offsetHeight - stage.offsetHeight);
    state.progress = clamp(top / span);
    const n = state.chapters.length;
    const chapter = Math.min(n - 1, Math.floor(state.progress * n * 0.9999));
    state.rail.forEach((item, i) => item.style.setProperty("--fill", clamp(state.progress * n - i).toFixed(3)));
    if (chapter !== state.chapter) {
      state.chapter = chapter;
      state.chapters.forEach((c, i) => {
        c.classList.toggle("is-active", i === chapter);
        c.setAttribute("aria-hidden", i === chapter ? "false" : "true");
      });
      state.rail.forEach((item, i) => item.classList.toggle("is-active", i === chapter));
      for (const el of state.chapters[chapter].querySelectorAll(".fv-odo")) el.__fvRoll?.();
    }
  };
  document.addEventListener("scroll", update, { capture: true, passive: true });
  window.addEventListener("resize", update);
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } })
    .observe(document.body, { childList: true, subtree: true });
  update();
}

// --- Les horloges des places boursières ------------------------------------------------------------------------------
function installClocks() {
  const tick = () => {
    for (const el of document.querySelectorAll("[data-fv-tz]")) {
      const now = new Date();
      const local = new Intl.DateTimeFormat("fr-FR", { timeZone: el.dataset.fvTz, hour: "2-digit", minute: "2-digit",
        weekday: "short", hour12: false }).formatToParts(now);
      const get = (type) => local.find((p) => p.type === type)?.value || "";
      const hour = `${get("hour")}:${get("minute")}`;
      const minutes = Number(get("hour")) * 60 + Number(get("minute"));
      const weekend = /sam|dim/i.test(get("weekday"));
      const open = !weekend && minutes >= Number(el.dataset.fvOpen) && minutes < Number(el.dataset.fvClose);
      const time = el.querySelector("time"), state = el.querySelector(".fv-state");
      if (time && time.textContent !== hour) time.textContent = hour;
      if (state) state.textContent = open ? "ouverte" : "fermée";
      el.classList.toggle("is-open", open);
    }
  };
  tick();
  setInterval(tick, 20_000);
}

export async function installMotion() {
  if (window.__fvMotion) return;
  window.__fvMotion = true;
  installClocks();
  installStory();
  let gsap;
  try { gsap = await loadGsap(); } catch { return; }   // sans GSAP : pas de rouleaux ni d'impression, rien ne casse
  const ST = window.ScrollTrigger;
  let current = null, queued = false, refresh = 0;
  const scan = () => {
    queued = false;
    const sc = scroller();
    if (!sc) return;
    if (sc !== current) {   // nouvelle zone de défilement (autre page) : on repart de zéro
      ST.getAll().forEach((t) => t.kill());
      current = sc;
      ST.defaults({ scroller: sc });
    }
    odometers(gsap, ST);
    wires(gsap, ST);
    clearTimeout(refresh);
    refresh = setTimeout(() => ST.refresh(), 250);
  };
  // seulement quand un élément arrive : un cours qui change n'échange qu'un texte, et chaque refresh remet la page
  // en haut un instant (il mesure), ce qui coupe un défilement en cours (le clic sur une maquette)
  const added = (records) => records.some((r) => [...r.addedNodes].some((n) => n.nodeType === 1));
  new MutationObserver((records) => { if (!queued && added(records)) { queued = true; setTimeout(scan, 120); } })
    .observe(document.body, { childList: true, subtree: true });
  scan();
  // le chapitre affiché au chargement fait rouler ses chiffres
  setTimeout(() => {
    const s = window.__fvStory;
    if (s?.el && s.chapters[s.chapter]) for (const el of s.chapters[s.chapter].querySelectorAll(".fv-odo")) el.__fvRoll?.();
  }, 400);
}
