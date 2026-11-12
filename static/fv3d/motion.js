// FinVeille — ce qui bouge dans les pages (guides 32 et 41) : le récit de l'accueil et les horloges des places.
//
// Le récit suit le défilement (il répond à un geste du visiteur) ; les horloges donnent l'heure et l'état de chaque
// place sans redessiner la page. Les chiffres en rouleaux et l'apparition « imprimée » des cartes ont été retirés
// (guide 41), et GSAP avec eux : ces effets ne disaient rien, retardaient la lecture des chiffres, et leurs mesures
// de la page gênaient le défilement et le clavier sur téléphone.

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const scroller = () => document.querySelector('[data-testid="stMain"], [data-testid="stAppScrollToBottomContainer"]');

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

export function installMotion() {
  if (window.__fvMotion) return;
  window.__fvMotion = true;
  installClocks();
  installStory();
}
