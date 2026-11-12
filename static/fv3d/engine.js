// FinVeille — le moteur du site dans le navigateur (guides 30, 33 et 41).
//
// Chargé par scene3d.py (un composant Streamlit) à chaque affichage d'une page : show() installe, une seule fois par
// page ouverte, les maquettes (renders.js) et les petits comportements du site : liens qui restent dans l'onglet,
// défilement de la conversation avec l'assistant, raccourci de recherche, thème des dialogues, horloges et récit de
// l'accueil (motion.js). Le fond de particules qui occupait ce fichier a été retiré (guide 41) : il ne montrait
// aucune donnée et prenait un contexte WebGL de plus, de trop sur un téléphone.

import { installRenders } from "./renders.js";

// motion.js arrive avec la version de ce fichier (?v=…, scene3d.py) : un correctif y est pris tout de suite, au lieu
// d'attendre que le navigateur oublie l'ancienne copie (le serveur ne dit pas combien de temps la garder)
const VERSION = new URL(import.meta.url).search;
const installMotion = () => import(`./motion.js${VERSION}`).then((m) => m.installMotion())
  .catch((error) => console.warn("FinVeille : animations indisponibles", error));

// navigateur : on y inscrit la nouvelle adresse et on le prévient, comme le ferait le bouton « Précédent ».
function installLinks() {
  if (window.__fvLinks) return;
  window.__fvLinks = true;
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest(".fv-footer a, a.fv-credit") : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.classList.contains("fv-footer-top-link")) {   // « Haut de page » : la zone qui défile remonte en douceur
      e.preventDefault();
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelector('[data-testid="stMain"], [data-testid="stAppScrollToBottomContainer"]')
        ?.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      return;
    }
    if (!a.getAttribute("href")?.startsWith("./")) return;   // seulement les pages du site
    const url = new URL(a.getAttribute("href"), window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    window.history.pushState({}, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
  });
}

// --- La page Assistant : la question qu'on vient de poser remonte en haut de l'écran, la réponse s'écrit dessous -----
function installChat() {
  if (window.__fvChat) return;
  window.__fvChat = true;
  let known = -1, queued = false;
  const check = () => {
    queued = false;
    const log = document.querySelector(".st-key-fvchatlog");
    if (!log) { known = -1; return; }
    // les questions : les messages à l'icône « personne » (les réponses portent le logo du site)
    const asked = log.querySelectorAll('[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarCustom"])');
    if (known >= 0 && asked.length > known) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      asked[asked.length - 1].scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    }
    known = asked.length;
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(check); } })
    .observe(document.body, { childList: true, subtree: true });
}

// --- Les dialogues de Streamlit (« Rechercher ») : le thème de la page ------------------------------------------------
// Streamlit ne donne le thème (color-scheme) qu'à .stApp, et ses dialogues sont posés à côté : sans lui, les couleurs
// light-dark() de theme.py y restaient claires en mode sombre (un champ blanc, un texte presque invisible).
function installDialogTheme() {
  if (window.__fvDialogTheme) return;
  window.__fvDialogTheme = true;
  let queued = false;
  const sync = () => {
    queued = false;
    const app = document.querySelector(".stApp");
    if (!app) return;
    const scheme = getComputedStyle(app).colorScheme;
    for (const dialog of document.querySelectorAll('[data-testid="stDialog"]')) {
      if (dialog.style.colorScheme !== scheme) dialog.style.colorScheme = scheme;
    }
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(sync); } })
    .observe(document.body, { childList: true, subtree: true });
}

// --- La recherche du site : la touche « / » ou Ctrl+K (Cmd+K) ouvre le dialogue « Rechercher » (search.py) ---------
function installShortcut() {
  if (window.__fvShortcut) return;
  window.__fvShortcut = true;
  const typing = (el) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.isComposing) return;
    const slash = e.key === "/" && !e.ctrlKey && !e.metaKey && !typing(e.target);
    const palette = (e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey) && !e.shiftKey;
    if (!slash && !palette) return;
    const button = document.querySelector(".st-key-fvsearch_open button");
    if (!button || document.querySelector('[role="dialog"]')) return;   // déjà ouvert : la touche reste à la page
    e.preventDefault();
    button.click();
  });
  // Quand le dialogue s'ouvre, le curseur va dans son champ (sur téléphone, le navigateur peut refuser : tant pis)
  let queued = false;
  const focusField = () => {
    queued = false;
    const field = document.querySelector('[role="dialog"] .st-key-fvsearch_q input');
    if (field && !field.dataset.fvFocused) {
      field.dataset.fvFocused = "1";
      if (!typing(document.activeElement)) field.focus();   // Streamlit met le focus sur le dialogue lui-même
    }
  };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(focusField); } })
    .observe(document.body, { childList: true, subtree: true });
}

// Après une mise en ligne, une page restée ouverte se reconnecte et charge la nouvelle version de ce fichier (VERSION,
// « ?v=… ») par-dessus l'ancienne, toujours active (deux décors, les maquettes de l'ancienne) : la page est alors
// rechargée une fois, proprement. `__fvObjs` sans `__fvVersion` : une version d'avant ce contrôle.

export function show() {
  if (window.__fvVersion ? window.__fvVersion !== VERSION : !!window.__fvObjs) {
    location.reload();
    return () => {};
  }
  window.__fvVersion = VERSION;
  installMotion();
  installLinks();
  installChat();
  installShortcut();
  installDialogTheme();
  installRenders();
  return () => {};
}
