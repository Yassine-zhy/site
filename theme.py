"""L'identité visuelle de FinVeille : une plateforme d'information financière, sobre et lisible.

Principes :
- deux palettes complètes, claire (blanc et gris bleuté) et sombre (bleu nuit), définies en CSS avec
  `light-dark(couleur claire, couleur sombre)` : Streamlit indique le thème actif au navigateur
  (propriété CSS `color-scheme`), donc les couleurs suivent le thème choisi, sans relancer le script ;
- une seule couleur de marque, le bleu FinVeille, pour les actions et les liens ;
- la couleur des données est réservée aux rubriques, à la hausse (▲ vert) et à la baisse (▼ rouge),
  toujours accompagnée d'un signe ou d'un nom : l'information ne repose jamais sur la couleur seule ;
- interface et titres en IBM Plex Sans, titres d'articles en Newsreader (police de presse),
  chiffres alignés en IBM Plex Mono.
"""

from __future__ import annotations

import base64
import html
import time as clock_module
from datetime import datetime, time, timezone
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import streamlit as st

# Couleurs des catégories : palette validée pour le daltonisme sur les deux fonds
# (toujours accompagnées du nom de la catégorie, jamais seules).
CATEGORY_COLORS = {"marches": "#3987e5", "crypto": "#d95926", "entreprises": "#199e70", "macro": "#c98500"}
# Couleurs utilisées dans les images et les graphiques (mini-courbes, cartes de chaleur, Altair) : on ne peut
# pas y utiliser light-dark(), donc ces teintes moyennes sont lisibles sur les deux fonds.
UP = "#1e9e4f"  # hausse : toujours avec ▲ et le signe +
DOWN = "#e5484d"  # baisse : toujours avec ▼ et le signe −
NEUTRAL = "#8c96a5"  # gris neutre des graphiques (repères, courbes de comparaison)
BRAND = "#2451de"  # le bleu FinVeille (logo)
DISPLAY_TZ = ZoneInfo("Europe/Paris")  # fuseau d'affichage des heures

# Les grandes places boursières, d'est en ouest : (ville, fuseau, ouverture, clôture).
# Horaires de la séance principale, sans les jours fériés ni la pause déjeuner de Hong Kong.
EXCHANGES = [
    ("Tokyo", "Asia/Tokyo", time(9, 0), time(15, 30)),
    ("Hong Kong", "Asia/Hong_Kong", time(9, 30), time(16, 0)),
    ("Paris", "Europe/Paris", time(9, 0), time(17, 30)),
    ("Londres", "Europe/London", time(8, 0), time(16, 30)),
    ("New York", "America/New_York", time(9, 30), time(16, 0)),
]

_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
           "novembre", "décembre"]
_MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

CSS = """
<style>
@import url("https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap");

/* =============================================================================================
   1. Jetons de design, en trois couches (guide 26) :
      primitifs (valeurs brutes) → sémantiques (le rôle : fond, texte, hausse…) → composants (bouton, carte…).
      Un composant n'utilise jamais une couleur brute : changer de thème, c'est changer la couche sémantique.
      light-dark(clair, sombre) suit le thème choisi dans Streamlit.
   ============================================================================================= */
.stApp {
  /* --- Primitifs : couleurs ----------------------------------------------------------------- */
  --ink-0: #ffffff;   --ink-50: #f6f8fc;  --ink-100: #eef2f9; --ink-150: #e2e7f0; --ink-200: #c9d2e0;
  --ink-400: #8791a5; --ink-500: #566176; --ink-900: #0b1220;
  --night-950: #060912; --night-900: #0a0e18; --night-850: #0c111d; --night-800: #141c2c; --night-700: #1a2335;
  --night-600: #2a3550; --night-400: #5d6a83; --night-300: #96a2b9; --night-100: #e8edf6;
  --blue-900: #0d1f6b; --blue-700: #1536b4; --blue-600: #2451de; --blue-400: #6d93ff; --blue-200: #a9c1ff;
  --blue-150: #c9d4f5; --blue-100: #dfe7ff; --blue-50: #ecf1ff; --blue-950: #141f3d; --mint-300: #6ee7a8;
  --violet-600: #5b3fd9; --violet-500: #7c3aed; --violet-300: #a78bfa;
  --green-700: #047a3c; --green-400: #34d17f; --green-50: #e3f5ea; --green-950: #0f2a1d;
  --red-700: #c8263a; --red-400: #ff6375; --red-50: #fdeaec; --red-950: #2e1419;
  --amber-700: #9a5b00; --amber-400: #f5b54e; --amber-50: #fff4e0; --amber-950: #2a2111;
  /* --- Primitifs : espacements (base 4 px), rayons, durées ------------------------------------ */
  --space-1: .25rem; --space-2: .5rem; --space-3: .75rem; --space-4: 1rem; --space-5: 1.25rem; --space-6: 1.5rem;
  --space-8: 2rem; --space-10: 2.5rem;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px; --radius-full: 999px;
  --duration-fast: .15s; --duration-base: .2s; --duration-slow: .45s;

  /* --- Sémantiques : le rôle de chaque couleur, en clair et en sombre --------------------------- */
  --fv-bg: light-dark(#f4f6fb, var(--night-950));
  --fv-surface: light-dark(var(--ink-0), var(--night-850));
  --fv-sunken: light-dark(var(--ink-50), var(--night-900));
  --fv-hover: light-dark(var(--ink-100), var(--night-800));
  --fv-line: light-dark(var(--ink-150), var(--night-700));
  --fv-line-strong: light-dark(var(--ink-200), var(--night-600));
  --fv-text: light-dark(var(--ink-900), var(--night-100));
  --fv-muted: light-dark(var(--ink-500), var(--night-300));
  --fv-faint: light-dark(var(--ink-400), var(--night-400));  /* décor seulement (points, filets) : 3,2 à 3,5:1, trop pâle pour du texte */
  --fv-brand: light-dark(var(--blue-600), var(--blue-400));
  --fv-brand-2: light-dark(var(--violet-500), var(--violet-300));  /* le second ton des dégradés */
  --fv-brand-soft: light-dark(var(--blue-50), var(--blue-950));
  --fv-up: light-dark(var(--green-700), var(--green-400));
  --fv-down: light-dark(var(--red-700), var(--red-400));
  --fv-up-soft: light-dark(var(--green-50), var(--green-950));
  --fv-down-soft: light-dark(var(--red-50), var(--red-950));
  --fv-warn: light-dark(var(--amber-700), var(--amber-400));
  --fv-warn-soft: light-dark(var(--amber-50), var(--amber-950));
  --fv-shadow: light-dark(rgba(15, 23, 42, .07), rgba(0, 0, 0, .5));
  --fv-hi: light-dark(rgba(255, 255, 255, 0), rgba(255, 255, 255, .05));  /* reflet du bord supérieur, en sombre */
  --fv-glow: light-dark(rgba(36, 81, 222, .10), rgba(109, 147, 255, .14));
  --fv-glow-2: light-dark(rgba(124, 58, 237, .07), rgba(167, 139, 250, .10));
  --fv-shadow-deep: light-dark(rgba(15, 23, 42, .22), rgba(0, 0, 0, .8));  /* ombre portée des éléments qui flottent */
  --fv-elev: inset 0 1px 0 var(--fv-hi), 0 1px 2px var(--fv-shadow), 0 14px 32px -20px var(--fv-shadow);
  --fv-elev-hover: inset 0 1px 0 var(--fv-hi), 0 2px 4px var(--fv-shadow), 0 22px 44px -22px var(--fv-shadow);
  --fv-radius: var(--radius-lg);
  --fv-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --fv-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --fv-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;

  /* --- Composants ------------------------------------------------------------------------------ */
  --btn-primary-bg: linear-gradient(135deg, var(--blue-600), var(--violet-600));  /* texte blanc : contraste > 6 */
  --btn-primary-glow: 0 8px 20px -8px rgba(36, 81, 222, .55);
  --card-bg: var(--fv-surface); --card-border: var(--fv-line); --card-radius: var(--radius-lg);
  --card-shadow: var(--fv-elev); --card-shadow-hover: var(--fv-elev-hover);
  --chip-radius: var(--radius-full);
  --control-bg: var(--fv-surface); --control-border: var(--fv-line-strong); --control-radius: var(--radius-md);
  --ring: 0 0 0 3px color-mix(in srgb, var(--fv-brand) 26%, transparent);
  --accent-bar: linear-gradient(180deg, var(--fv-brand), var(--fv-brand-2));

  /* Le fond : deux halos très doux (bleu, violet) en haut de page, qui donnent de la profondeur */
  background: radial-gradient(1100px 520px at 8% -8%, var(--fv-glow), transparent 60%),
    radial-gradient(900px 480px at 100% -4%, var(--fv-glow-2), transparent 62%), var(--fv-bg);
  background-attachment: fixed;
}
[data-testid="stMainBlockContainer"] { max-width: 1240px; padding-top: 4.4rem; padding-bottom: 4rem; }

/* Streamlit décale les listes de st.html (padding-left: 2rem) : on annule pour nos listes « fv-… » */
.stApp ul[class^="fv-"], .stApp ol[class^="fv-"], .stApp dl[class^="fv-"] { padding-left: 0; margin-left: 0; }
ul[class^="fv-"] > li, ol[class^="fv-"] > li { margin-left: 0; padding-left: 0; }

/* =============================================================================================
   2. Barre d'application : logo, menu, compte
   ============================================================================================= */
header[data-testid="stHeader"] { background: color-mix(in srgb, var(--fv-surface) 78%, transparent);
  backdrop-filter: saturate(160%) blur(14px); -webkit-backdrop-filter: saturate(160%) blur(14px);
  border-bottom: 1px solid var(--fv-line); }
/* Le nom à côté du symbole : « Fin » à l'encre, « Veille » en bleu (deux pseudo-éléments rangés après l'image) */
[data-testid="stLogoLink"], div:has(> img.stLogo) { display: inline-flex; align-items: center;
  color: var(--fv-text) !important; text-decoration: none !important; }
[data-testid="stLogoLink"]::before, div:has(> img.stLogo)::before { content: "Fin"; order: 1; margin-left: .6rem;
  font: 700 1.16rem/1 var(--fv-sans); letter-spacing: -.02em; color: var(--fv-text); }
[data-testid="stLogoLink"]::after, div:has(> img.stLogo)::after { content: "Veille"; order: 2;
  font: 700 1.16rem/1 var(--fv-sans); letter-spacing: -.02em; color: var(--fv-brand); white-space: nowrap;
  background: linear-gradient(90deg, var(--fv-brand), var(--fv-brand-2)); -webkit-background-clip: text;
  background-clip: text; -webkit-text-fill-color: transparent; }
img.stLogo { height: 28px !important; width: 28px !important; max-width: none; }
[data-testid="stTopNavSection"], [data-testid="stTopNavLink"] { border-radius: 999px; transition: background .15s; }
[data-testid="stTopNavSection"]:hover, [data-testid="stTopNavLink"]:hover { background: var(--fv-hover); }
[data-testid="stTopNavSection"] p, [data-testid="stTopNavLink"] p { font-weight: 500; font-size: .92rem; }

/* Le bloc « compte » est placé dans la barre du haut, à gauche du menu ⋮ */
.st-key-fvaccount { position: fixed; top: .62rem; right: 3.3rem; z-index: 999991; width: auto !important; }
.st-key-fvaccount a { padding: .3rem .7rem; border: 1px solid var(--fv-line-strong); border-radius: 999px;
  background: var(--fv-surface); }
.st-key-fvaccount a:hover { border-color: var(--fv-brand); }
.st-key-fvaccount a p { font-size: .85rem; font-weight: 500; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; }
.st-key-fvaccount button { min-height: 2.2rem; padding: .2rem .9rem; }
@media (max-width: 640px) { .st-key-fvaccount a p { max-width: 6rem; } }

/* Le cookie de session est posé par un composant invisible (ui.sync_cookie) : il ne doit prendre aucune place */
.st-key-fvcookie { display: none !important; }
/* Le bouton « Continuer avec Google » porte le logo officiel de Google (autorisé pour les boutons de connexion) */
[class*="_google"] button p::before { content: ""; display: inline-block; width: 18px; height: 18px;
  margin-right: .55rem; vertical-align: -3px; background: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0ZGQzEwNyIgZD0iTTQzLjYgMjAuNUg0MlYyMEgyNHY4aDExLjNDMzMuNyAzMi43IDI5LjIgMzYgMjQgMzZjLTYuNiAwLTEyLTUuNC0xMi0xMnM1LjQtMTIgMTItMTJjMy4xIDAgNS44IDEuMiA3LjkgMy4xbDUuNy01LjdDMzQgNi4xIDI5LjMgNCAyNCA0IDEyLjkgNCA0IDEyLjkgNCAyNHM4LjkgMjAgMjAgMjAgMjAtOC45IDIwLTIwYzAtMS4zLS4xLTIuNC0uNC0zLjV6Ii8+PHBhdGggZmlsbD0iI0ZGM0QwMCIgZD0ibTYuMyAxNC43IDYuNiA0LjhDMTQuNyAxNS4xIDE5IDEyIDI0IDEyYzMuMSAwIDUuOCAxLjIgNy45IDMuMWw1LjctNS43QzM0IDYuMSAyOS4zIDQgMjQgNCAxNi4zIDQgOS43IDguMyA2LjMgMTQuN3oiLz48cGF0aCBmaWxsPSIjNENBRjUwIiBkPSJNMjQgNDRjNS4yIDAgOS45LTIgMTMuNC01LjJsLTYuMi01LjJDMjkuMiAzNS4xIDI2LjcgMzYgMjQgMzZjLTUuMiAwLTkuNi0zLjMtMTEuMy04bC02LjUgNUM5LjUgMzkuNiAxNi4yIDQ0IDI0IDQ0eiIvPjxwYXRoIGZpbGw9IiMxOTc2RDIiIGQ9Ik00My42IDIwLjVINDJWMjBIMjR2OGgxMS4zYy0uOCAyLjItMi4yIDQuMi00LjEgNS42bDYuMiA1LjJDMzcgMzkuMiA0NCAzNCA0NCAyNGMwLTEuMy0uMS0yLjQtLjQtMy41eiIvPjwvc3ZnPg==") center / contain no-repeat; }

/* Écran de connexion et assistant de configuration */
/* L'assistant IA (views/assistant.py) */
.fv-ai-hero { margin-top: .4rem; padding: 1.4rem 1.6rem 1.5rem; }
.fv-ai-hero .fv-show-list { margin-top: 1.1rem; }
.fv-ai-hero .fv-show-list { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
.fv-ai-status { display: inline-flex; align-items: center; gap: .45rem; padding: .25rem .7rem; border-radius: 99px;
  font-size: .74rem; font-weight: 600; background: rgba(255, 255, 255, .14); color: var(--ink-0); }
.fv-ai-status::before { content: ""; width: .5rem; height: .5rem; border-radius: 50%; background: var(--blue-150); }
.fv-ai-status.is-on::before { background: var(--mint-300); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mint-300) 25%, transparent); }
.fv-cites { margin-top: .6rem; }
.fv-cites-title { margin: 0 0 .4rem !important; font-size: .7rem; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: var(--fv-muted); }
.fv-cites-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: .5rem; }
.fv-cite { display: flex; align-items: flex-start; gap: .55rem; padding: .55rem .7rem; border-radius: 10px;
  background: var(--fv-surface); border: 1px solid var(--fv-line); color: var(--fv-text) !important;
  text-decoration: none !important; transition: border-color .15s, box-shadow .15s; }
.fv-cite:hover { border-color: var(--fv-brand); box-shadow: 0 2px 10px var(--fv-shadow); }
.fv-cite-n { flex: none; display: grid; place-items: center; min-width: 1.35rem; height: 1.35rem; border-radius: 6px;
  font: 600 .72rem/1 var(--fv-mono); background: var(--fv-brand-soft); color: var(--fv-brand); }
.fv-cite img { flex: none; width: 16px; height: 16px; margin-top: .15rem; border-radius: 3px; }
.fv-cite-text { min-width: 0; font-size: .8rem; line-height: 1.35; }
.fv-cite-text b { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font-weight: 600; }
.fv-cite-text small { display: block; margin-top: .15rem; color: var(--fv-muted); font-size: .72rem; }
[data-testid="stChatMessage"] { padding: .9rem 1rem; border-radius: 14px; background: var(--fv-surface);
  border: 1px solid var(--fv-line); }
[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]) { background: var(--fv-hover); }
[data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] a { font-weight: 600; text-decoration: none; }
[class*="st-key-fvanalysis_"], .st-key-fvdigest { padding: 1.1rem 1.25rem; border-radius: 12px;
  border: 1px solid var(--fv-line); border-left: 4px solid var(--fv-brand); background: var(--fv-surface); }
.st-key-fvdigest p { font-family: var(--fv-serif); font-size: 1.08rem; line-height: 1.65; }

/* L'illustration de la page de connexion (theme.showcase_html) */
.fv-showcase { position: relative; overflow: hidden; margin-top: 1rem; padding: 2rem 2rem 2.2rem; border-radius: 16px;
  color: var(--ink-0); background: var(--curve) center bottom / 100% 45% no-repeat,
    radial-gradient(circle at 85% 0%, color-mix(in srgb, var(--mint-300) 28%, transparent), transparent 45%),
    linear-gradient(150deg, var(--blue-600) 0%, var(--blue-700) 55%, var(--blue-900) 100%); box-shadow: 0 12px 40px color-mix(in srgb, var(--blue-700) 25%, transparent); }
.fv-show-eyebrow { margin: 0 0 .4rem; font-size: .72rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--blue-200); }
.fv-show-title { margin: 0 0 1.4rem !important; padding: 0 !important; color: var(--ink-0) !important; max-width: 22ch;
  font: 600 1.7rem/1.2 var(--fv-serif) !important; letter-spacing: -.01em; }
.stApp ul.fv-show-list { position: relative; display: grid; gap: .8rem; margin: 0 !important; padding: 0 !important;
  list-style: none; }
.fv-show-list li { display: flex; gap: .85rem; align-items: center; margin: 0 !important; padding: .7rem .85rem;
  border-radius: 12px; background: rgba(255, 255, 255, .09); border: 1px solid rgba(255, 255, 255, .14);
  backdrop-filter: blur(4px); font-size: .86rem; line-height: 1.35; color: var(--blue-100); }
.fv-show-list b { display: block; color: var(--ink-0); font-size: .93rem; }
.fv-show-icon { display: grid; place-items: center; flex: none; width: 38px; height: 38px; border-radius: 10px;
  background: var(--ink-0); color: var(--blue-700); }
.fv-show-icon img { width: 21px; height: 21px; }
.fv-show-foot { position: relative; display: flex; align-items: center; gap: .5rem; margin: 1.4rem 0 0;
  font-size: .82rem; color: var(--blue-100); }
.fv-show-foot img { width: 18px; height: 18px; }
@media (max-width: 640px) { .fv-showcase { display: none; } }

.fv-or { display: flex; align-items: center; gap: .8rem; margin: .6rem 0 .2rem; font-size: .76rem; color: var(--fv-muted); }
.fv-or::before, .fv-or::after { content: ""; flex: 1; border-top: 1px solid var(--fv-line); }
.fv-avatar { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; flex: none;
  background: var(--fv-brand); color: var(--ink-0); font-weight: 700; font-size: 1.05rem; }
.fv-service { display: inline-block; margin: .45rem 0 .15rem; padding: .12rem .55rem; border-radius: 999px;
  font-size: .75rem; font-weight: 600; background: var(--fv-hover); color: var(--fv-muted); }
.fv-service.is-on { background: var(--fv-up-soft); color: var(--fv-up); }
.fv-service.is-on::before { content: "● "; }

/* =============================================================================================
   3. Composants Streamlit (boutons, champs, menus, onglets)
   ============================================================================================= */
.stApp button, .stApp input, .stApp textarea { font-family: var(--fv-sans); }

/* --- Boutons. États communs : survol, appui (léger enfoncement, sans décaler la mise en page), focus clavier --- */
[data-testid="stBaseButton-secondary"], [data-testid="stBaseButton-secondaryFormSubmit"],
[data-testid="stPopoverButton"], [data-testid="stBaseLinkButton-secondary"] {
  background: var(--control-bg); border-color: var(--control-border); border-radius: var(--control-radius);
  font-weight: 500; box-shadow: inset 0 1px 0 var(--fv-hi), 0 1px 2px var(--fv-shadow);
  transition: border-color var(--duration-fast), background var(--duration-fast), color var(--duration-fast),
    transform var(--duration-fast); }
[data-testid="stBaseButton-secondary"]:hover, [data-testid="stBaseButton-secondaryFormSubmit"]:hover,
[data-testid="stPopoverButton"]:hover, [data-testid="stBaseLinkButton-secondary"]:hover {
  border-color: var(--fv-brand); color: var(--fv-brand); background: color-mix(in srgb, var(--fv-brand-soft) 60%, var(--control-bg)); }
/* Bouton principal : dégradé bleu → violet (texte blanc lisible sur les deux teintes : contraste > 6) */
[data-testid^="stBaseButton-primary"], [data-testid="stBaseLinkButton-primary"] { color: var(--ink-0) !important;
  border: 0 !important; border-radius: var(--control-radius); font-weight: 600;
  background: var(--btn-primary-bg) !important;
  box-shadow: 0 1px 2px var(--fv-shadow), var(--btn-primary-glow);
  transition: filter var(--duration-fast), transform var(--duration-fast); }
[data-testid^="stBaseButton-primary"]:hover, [data-testid="stBaseLinkButton-primary"]:hover { filter: brightness(1.08); }
[data-testid^="stBaseButton-primary"] p, [data-testid="stBaseLinkButton-primary"] p { color: var(--ink-0) !important; }
.stApp button:active:not(:disabled), .stApp a[data-testid^="stBaseLinkButton"]:active { transform: scale(.98); }
[data-testid="stBaseButton-tertiary"], [data-testid="stBaseLinkButton-tertiary"] { color: var(--fv-muted); }
[data-testid="stBaseButton-tertiary"]:hover, [data-testid="stBaseLinkButton-tertiary"]:hover { color: var(--fv-brand); }
.stApp button:disabled { opacity: .5; cursor: not-allowed; }
.stApp a:focus-visible, .stApp button:focus-visible, .stApp [role="radio"]:focus-visible, .stApp summary:focus-visible {
  outline: 2px solid var(--fv-brand); outline-offset: 2px; }

/* --- Champs de saisie et listes : une même surface, une bordure, un halo de marque au focus --- */
[data-testid="stTextInputRootElement"], [data-testid="stNumberInputContainer"], [data-baseweb="select"] > div,
[data-testid="stDateInputField"], [data-baseweb="textarea"] {
  background: var(--control-bg) !important; border-color: var(--control-border) !important;
  border-radius: var(--control-radius) !important; transition: border-color var(--duration-fast), box-shadow var(--duration-fast); }
[data-testid="stTextInputRootElement"]:focus-within, [data-testid="stNumberInputContainer"]:focus-within,
[data-baseweb="select"] > div:focus-within, [data-baseweb="textarea"]:focus-within {
  border-color: var(--fv-brand) !important; box-shadow: var(--ring); }
[data-baseweb="input"], [data-baseweb="base-input"], [data-testid="stNumberInputContainer"] input { background: transparent !important; }
[data-testid="stChatInput"] > div { background: var(--control-bg); border: 1px solid var(--control-border);
  border-radius: var(--radius-lg); box-shadow: 0 18px 40px -24px var(--fv-shadow-deep); }
[data-testid="stChatInput"] > div:focus-within { border-color: var(--fv-brand); box-shadow: var(--ring); }
[data-testid="stWidgetLabel"] p { font-weight: 500; color: var(--fv-text); }

/* --- Sélecteur segmenté (Monde / CAC 40 / Devises…) : un rail en creux, le choix actif en relief --- */
.stApp [role="radiogroup"]:has(> [data-variant="segmented_control"]) { display: inline-flex; flex-wrap: wrap; gap: 3px;
  padding: 3px; border: 1px solid var(--fv-line); border-radius: calc(var(--control-radius) + 3px); background: var(--fv-sunken); }
.stApp [data-variant="segmented_control"] { margin: 0 !important; border: 0 !important; border-radius: var(--control-radius) !important;
  background: transparent !important; color: var(--fv-muted) !important; box-shadow: none !important;
  transition: background var(--duration-fast), color var(--duration-fast); }
.stApp [data-variant="segmented_control"]:hover { color: var(--fv-text) !important; }
.stApp [data-variant="segmented_control"][aria-checked="true"] { background: var(--fv-surface) !important;
  color: var(--fv-text) !important; box-shadow: 0 1px 3px var(--fv-shadow), inset 0 1px 0 var(--fv-hi), 0 0 0 1px var(--fv-line) !important; }
.stApp [data-variant="segmented_control"][aria-checked="true"] p { font-weight: 600; }

/* --- Pastilles (rubriques, filtres) : le choix actif se teinte de la couleur de marque --- */
.stApp [data-variant="pills"] { border-radius: var(--chip-radius) !important; background: var(--control-bg) !important;
  border-color: var(--fv-line-strong) !important; color: var(--fv-text) !important;
  transition: border-color var(--duration-fast), background var(--duration-fast); }
.stApp [data-variant="pills"]:hover { border-color: var(--fv-brand) !important; }
.stApp [data-variant="pills"][aria-pressed="true"] { background: var(--fv-brand-soft) !important;
  border-color: var(--fv-brand) !important; color: var(--fv-brand) !important; }
.stApp [data-variant="pills"][aria-pressed="true"] p { font-weight: 600; }

/* --- Panneaux : menus déroulants, sections repliables, formulaires, alertes, bulles --- */
[data-testid="stPopoverBody"] { border-radius: var(--radius-lg); border-color: var(--fv-line);
  background: var(--fv-surface); box-shadow: 0 24px 48px -20px var(--fv-shadow-deep); }
[data-testid="stExpander"] details { background: var(--fv-surface); border-color: var(--fv-line); border-radius: var(--fv-radius);
  box-shadow: var(--fv-elev); }
[data-testid="stExpander"] summary p { font-weight: 600; }
[data-testid="stExpander"] summary:hover { color: var(--fv-brand); }
[data-testid="stForm"] { background: var(--fv-surface); border-color: var(--fv-line); border-radius: var(--fv-radius);
  box-shadow: var(--fv-elev); }
[data-testid="stAlertContainer"] { border-radius: var(--fv-radius); border: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
[data-testid="stToast"] { background: var(--fv-surface); border: 1px solid var(--fv-line); border-radius: var(--radius-lg);
  box-shadow: 0 24px 48px -20px var(--fv-shadow-deep); }
[data-testid="stSidebar"] { border-right: 1px solid var(--fv-line); }
[data-testid="stDataFrame"] { border-radius: var(--fv-radius); }
/* Streamlit pâlit les légendes (opacité 60 %) : 2,5:1 seulement. La couleur secondaire suffit (5,7 à 7,3:1). */
[data-testid="stCaptionContainer"] { color: var(--fv-muted); opacity: 1; }
/* La valeur au-dessus d'un curseur : le bleu de Streamlit n'atteint que 4,2:1 sur le fond sombre ; celui de la
   marque, 6,5:1 */
[data-testid="stSliderThumbValue"] p { color: var(--fv-brand) !important; font-weight: 600; }
/* Le code dans le texte (noms de fichiers, réglages) : lisible dans les deux thèmes */
.stApp :not(pre) > code { padding: .1em .4em; border: 1px solid var(--fv-line); border-radius: var(--radius-sm);
  background: var(--fv-hover) !important; color: var(--fv-text) !important; font: .86em var(--fv-mono); }
/* Les badges de Streamlit (actif / inactif) : texte à pleine couleur sur leur teinte */
.stApp .stMarkdownBadge { color: var(--fv-text) !important; font-weight: 600; }

/* =============================================================================================
   4. Structure des pages : en-tête, sections, cartes
   ============================================================================================= */
/* L'en-tête de page « héros », dans le style des visuels de la marque (docs/branding) : pas de boîte, un grand
   titre dont la fin passe en dégradé, le quadrillage de salle de marché qui s'efface, et sur les pages principales
   des tuiles de cours qui flottent en perspective. */
.fv-hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); align-items: center;
  gap: 1.75rem 3rem; margin: 0 0 .5rem; padding: 1.4rem 0 1.8rem; isolation: isolate; }
.fv-hero.has-aside { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); }
.fv-hero::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .7;
  background-image: linear-gradient(var(--fv-line) 1px, transparent 1px), linear-gradient(90deg, var(--fv-line) 1px, transparent 1px);
  background-size: 32px 32px;
  -webkit-mask-image: radial-gradient(60% 85% at 85% 45%, #000, transparent 75%);
  mask-image: radial-gradient(60% 85% at 85% 45%, #000, transparent 75%); }
.fv-hero.has-aside::after { content: ""; position: absolute; z-index: -1; right: 0; top: 10%; width: 45%; height: 80%;
  pointer-events: none; background: radial-gradient(closest-side, var(--fv-glow), transparent); }
.fv-hero-title { margin: .95rem 0 0 !important; padding: 0 !important; max-width: 20ch; text-wrap: balance;
  font: 700 clamp(2.1rem, 4vw, 3.15rem)/1.05 var(--fv-sans) !important; letter-spacing: -.038em; color: var(--fv-text); }
.fv-hero.is-home .fv-hero-title { font-size: clamp(2.35rem, 4.8vw, 3.75rem) !important; }
.fv-hero-title em { display: inline-block; font-style: normal;  /* la fin du titre reste d'un seul tenant */
  background: linear-gradient(90deg, var(--fv-brand), var(--fv-brand-2));
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.fv-hero-dek { margin: 1rem 0 0; max-width: 62ch; color: var(--fv-muted); font-size: 1.1rem; line-height: 1.6; }
.fv-hero .fv-sessions { margin-top: 1.35rem; }
.fv-hero-copy > * { animation: fv-rise var(--duration-slow) cubic-bezier(.2, .7, .2, 1) both; }
.fv-hero-copy > :nth-child(2) { animation-delay: 60ms; }
.fv-hero-copy > :nth-child(3) { animation-delay: 120ms; }
.fv-hero.is-live .fv-hero-copy > * { animation: none; }  /* le fil se redessine chaque minute : pas d'entrée animée */
@keyframes fv-rise { from { opacity: 0; transform: translateY(10px); } }

/* Les tuiles flottantes : une composition décalée, inclinée comme dans la bannière */
.fv-hero-aside { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem;
  padding: .5rem 0 2rem; transform: perspective(1400px) rotateY(-11deg) rotateX(4deg); transform-origin: 70% 50%; }
.fv-float { --c: var(--fv-faint); position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr);
  align-items: end; gap: .2rem .75rem; padding: 1rem 1.1rem .95rem;
  overflow: hidden; border: 1px solid var(--fv-line-strong); border-radius: var(--radius-lg);
  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 13%, transparent), transparent 70%),
    color-mix(in srgb, var(--fv-surface) 90%, transparent);
  box-shadow: inset 0 1px 0 var(--fv-hi), 0 28px 56px -26px var(--fv-shadow-deep); backdrop-filter: blur(10px); }
.fv-float::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--c); }
.fv-float.is-up { --c: var(--fv-up); }
.fv-float.is-down { --c: var(--fv-down); }
.fv-float:nth-child(2) { translate: 0 1.75rem; }
.fv-float:nth-child(3) { grid-column: 1 / span 1; translate: 32% -.25rem; }
.fv-float-name, .fv-float-value { grid-column: 1 / -1; }
.fv-float-name { font-size: .8rem; font-weight: 600; color: var(--fv-muted); }
.fv-float-value { font: 600 1.5rem/1.15 var(--fv-mono); letter-spacing: -.01em; color: var(--fv-text);
  font-variant-numeric: tabular-nums; }
.fv-float-delta { justify-self: start; margin-top: .25rem; padding: .1rem .5rem; border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--c) 14%, transparent); font: 600 .8rem/1.4 var(--fv-mono); }
.fv-float-delta span { color: inherit; }
.fv-float.is-up .fv-float-delta { color: var(--fv-up); }
.fv-float.is-down .fv-float-delta { color: var(--fv-down); }
.fv-float > img { justify-self: end; width: 100%; max-width: 104px; height: 34px; }
@media (max-width: 900px) {
  .fv-hero.has-aside { grid-template-columns: minmax(0, 1fr); }
  .fv-hero-aside { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .6rem; padding: 0; transform: none; }
  .fv-float, .fv-float:nth-child(2), .fv-float:nth-child(3) { translate: none; grid-column: auto; padding: .75rem .8rem .7rem; }
  .fv-float > img { display: none; }
  .fv-float-value { font-size: 1.05rem; }
}
@media (max-width: 640px) {
  .fv-hero { padding: .5rem 0 1.1rem; }
  .fv-hero-dek { font-size: 1rem; }
  .fv-float-name { font-size: .72rem; }
  .fv-float-value { font-size: .95rem; }
  .fv-float-delta { font-size: .7rem; padding: .05rem .35rem; }
}
.fv-eyebrow { display: inline-flex; align-items: center; gap: .45rem; padding: .22rem .7rem .22rem .55rem;
  border: 1px solid color-mix(in srgb, var(--fv-brand) 28%, transparent); border-radius: 999px;
  background: var(--fv-brand-soft); font-size: .68rem; font-weight: 700; letter-spacing: .09em;
  text-transform: uppercase; color: var(--fv-brand); }
.fv-eyebrow::before { content: ""; width: .45rem; height: .45rem; border-radius: 50%;
  background: linear-gradient(135deg, var(--fv-brand), var(--fv-brand-2)); }

.fv-section { display: flex; flex-wrap: wrap; align-items: baseline; gap: .2rem .8rem; margin: 2.4rem 0 .5rem; }
/* Plan de la page : titre h1 (l'en-tête), sections h2, articles et titres de cartes h3 (aucun niveau sauté) */
.fv-section h2 { display: inline-flex; align-items: center; gap: .55rem; margin: 0 !important; padding: 0 !important;
  font: 700 1.3rem/1.3 var(--fv-sans) !important; letter-spacing: -.02em; color: var(--fv-text); }
.fv-section h2::before { content: ""; width: 4px; height: 1.05em; border-radius: 2px; background: var(--accent-bar); }
.fv-section small { font-size: .86rem; color: var(--fv-muted); }

/* Une carte : en HTML (.fv-card) ou un st.container(key="fvpanel_…") (Streamlit ajoute la classe st-key-…) */
.fv-card, [class*="st-key-fvpanel_"], [class*="st-key-fvlead_"], [class*="st-key-fvbox_"], [class*="st-key-fvchart_"] {
  background: var(--card-bg);
  border: 1px solid var(--card-border); border-radius: var(--card-radius); box-shadow: var(--card-shadow); }
.fv-card { padding: 1.15rem 1.25rem; }
.fv-card + .fv-card { margin-top: .9rem; }
.fv-card-title { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem;
  margin: 0 0 .8rem !important; padding: 0 !important; font: 650 .95rem/1.3 var(--fv-sans) !important;
  letter-spacing: -.01em; color: var(--fv-text); }
.fv-card-title small { font-weight: 400; font-size: .76rem; color: var(--fv-muted); }
[class*="st-key-fvpanel_"] { gap: 0 !important; padding: .2rem 0; overflow: hidden; }
[class*="st-key-fvbox_"] { padding: 1.3rem 1.4rem 1rem; margin-top: 1rem; }
[class*="st-key-fvchart_"] { padding: .9rem 1rem .5rem; gap: .4rem !important; }
[class*="st-key-fvset_"] { padding: 1.1rem 1.3rem 1.2rem; gap: .9rem !important; background: var(--fv-surface);
  border: 1px solid var(--fv-line); border-radius: var(--fv-radius); box-shadow: var(--fv-elev); }
[class*="st-key-fvset_"] .fv-section { margin-top: 0; }
.fv-box-title { margin: 0 !important; padding: 0 !important; font: 600 1.15rem/1.3 var(--fv-sans) !important; }
.fv-box-text { margin: .35rem 0 0; color: var(--fv-muted); font-size: .9rem; line-height: 1.5; }
.fv-card > .fv-letter:first-child { margin-top: 0; }
.fv-firm.fv-card { padding: 1.15rem 1.25rem; }
.fv-note { font-size: .78rem; color: var(--fv-muted); line-height: 1.5; }

/* =============================================================================================
   5. Le fil : en-tête, rubriques, articles
   ============================================================================================= */
.fv-sessions { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0; padding: 0; list-style: none; }
.stApp .fv-sessions li { display: inline-flex; align-items: center; gap: .45rem; margin: 0; padding: .3rem .7rem;
  border: 1px solid var(--fv-line); border-radius: 999px; background: color-mix(in srgb, var(--fv-surface) 80%, transparent); font-size: .76rem;
  color: var(--fv-muted); white-space: nowrap; }
.fv-sessions li::before { content: ""; width: .45rem; height: .45rem; border-radius: 50%; background: var(--fv-faint); }
.fv-sessions li.is-open { color: var(--fv-text); }
.fv-sessions li.is-open::before { background: var(--fv-up); box-shadow: 0 0 0 3px var(--fv-up-soft); }
.fv-sessions b { font-weight: 600; color: var(--fv-text); }
.fv-sessions time { font-family: var(--fv-mono); font-size: .72rem; }

.fv-cat { display: inline-flex; align-items: center; gap: .35rem; padding: .08rem .45rem; border-radius: 5px;
  background: color-mix(in srgb, var(--c) 13%, transparent); color: color-mix(in srgb, var(--c) 55%, var(--fv-text));
  font-size: .68rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }
.fv-cat::before { content: ""; width: .42rem; height: .42rem; border-radius: 50%; background: var(--c); }
.fv-kicker { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .75rem; font-size: .78rem; color: var(--fv-muted); }
.fv-src { display: inline-flex; align-items: center; gap: .4rem; color: var(--fv-text); font-weight: 500; }
.fv-src img { width: 16px; height: 16px; border-radius: 4px; }
.fv-time { font-family: var(--fv-mono); font-size: .74rem; }
.fv-flag { padding: .05rem .4rem; border-radius: 5px; background: var(--fv-hover); font-size: .68rem; font-weight: 600; }
.fv-echo { padding: .05rem .45rem; border-radius: 5px; background: var(--fv-brand-soft); color: var(--fv-brand);
  font-size: .7rem; font-weight: 600; }
.fv-headline { margin: .45rem 0 .3rem !important; padding: 0 !important; font-family: var(--fv-serif) !important;
  font-weight: 600 !important; font-size: 1.22rem !important; line-height: 1.28 !important; letter-spacing: -.006em; }
.fv-headline a { color: var(--fv-text) !important; text-decoration: none !important; }
.fv-headline a:hover, .fv-headline a:focus-visible { color: var(--fv-brand) !important; }
.fv-dek { margin: 0; color: var(--fv-muted); font-size: .9rem; line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fv-item.is-read .fv-headline a { color: var(--fv-muted) !important; font-weight: 500; }

/* Le squelette de chargement : des formes grises qui ondulent doucement, à la place des articles à venir */
.fv-skeleton { display: grid; gap: 1rem; }
.fv-sk { display: block; height: .8rem; border-radius: 6px; animation: fv-shimmer 1.4s ease-in-out infinite;
  background: linear-gradient(90deg, var(--fv-hover) 0%, var(--fv-line) 45%, var(--fv-hover) 90%); background-size: 300% 100%; }
.fv-sk-title { height: 1.45rem; border-radius: 8px; }
.fv-sk-media { height: auto; min-height: 15rem; border-radius: 12px; }
.fv-sk-lead, .fv-sk-tile { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: var(--card-radius);
  box-shadow: var(--card-shadow); }
.fv-sk-lead { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.5rem; padding: 1.2rem; }
.fv-sk-stack { display: grid; align-content: start; gap: .75rem; padding-top: .3rem; }
.fv-sk-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
.fv-sk-tile { display: grid; gap: .65rem; padding-bottom: 1.1rem; overflow: hidden; }
.fv-sk-tile .fv-sk-media { min-height: 8.5rem; border-radius: 0; }
.fv-sk-tile > .fv-sk:not(.fv-sk-media) { margin-left: 1rem; max-width: calc(100% - 2rem); }
@keyframes fv-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (max-width: 760px) { .fv-sk-lead, .fv-sk-tiles { grid-template-columns: minmax(0, 1fr); }
  .fv-sk-tile:nth-child(n+2) { display: none; } .fv-sk-lead .fv-sk-media { min-height: 11rem; } }
.fv-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* Les dépêches arrivent en cascade (300 à 450 ms), une seule fois : Streamlit garde les éléments déjà affichés */
[class*="st-key-fvlead_"], [class*="st-key-fvtile_"], [class*="st-key-fvcard_"] {
  animation: fv-rise var(--duration-slow) cubic-bezier(.2, .7, .2, 1) both; }
[class*="st-key-fvtile_"] { animation-delay: 80ms; }
[data-testid="stColumn"]:nth-child(2) > div > [class*="st-key-fvtile_"] { animation-delay: 140ms; }
[data-testid="stColumn"]:nth-child(3) > div > [class*="st-key-fvtile_"] { animation-delay: 200ms; }


/* Barre d'outils du fil : la recherche passe sur sa propre ligne sur un petit écran */
.st-key-fvtoolbar { flex-wrap: wrap; row-gap: .5rem; }
.st-key-fvtoolbar > div:first-child { flex: 1 1 18rem; }
@media (max-width: 640px) {
  .stApp .fv-sessions { flex-wrap: nowrap; overflow-x: auto; padding-bottom: .2rem; scrollbar-width: none; }
}

/* Tendances : des « puces » cliquables qui lancent la recherche */
.fv-trends-label { display: inline-flex; align-items: center; gap: .35rem; font-size: .7rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; color: var(--fv-brand); white-space: nowrap; }
.fv-trends-label::before { content: "↗"; font-size: .9rem; }
.st-key-fvtrends { flex-wrap: wrap; row-gap: .4rem; margin-top: -.2rem; }
.st-key-fvtrends button { min-height: 1.75rem; padding: .1rem .7rem; border: 1px solid var(--fv-line) !important;
  border-radius: 999px; background: var(--fv-surface); color: var(--fv-text); }
.st-key-fvtrends button:hover { border-color: var(--fv-brand) !important; color: var(--fv-brand); }
.st-key-fvtrends button p { font-size: .8rem; }

/* Chaque article est un st.container(key="fvcard_…") à l'intérieur d'une carte « fvpanel_ » */
[class*="st-key-fvcard_"], [class*="st-key-fvcompact_"] { position: relative; padding: .95rem 1.25rem .4rem;
  border-bottom: 1px solid var(--fv-line); transition: background .15s; }
[class*="st-key-fvcard_"]::before { content: ""; position: absolute; left: 0; top: .9rem; bottom: .9rem; width: 3px;
  border-radius: 0 3px 3px 0; background: var(--accent-bar); opacity: 0;
  transition: opacity .15s; }
[class*="st-key-fvcard_"]:hover::before { opacity: 1; }
[class*="st-key-fvcard_"]:last-child, [class*="st-key-fvcompact_"]:last-child { border-bottom: 0; }
[class*="st-key-fvcard_"]:hover, [class*="st-key-fvcompact_"]:hover { background: var(--fv-sunken); }
[class*="st-key-fvcompact_"] { padding: .5rem 1.15rem .15rem; }
.fv-item.is-compact .fv-headline { font-size: 1rem !important; margin: .25rem 0 0 !important; }
[class*="st-key-fvcard_"] button, [class*="st-key-fvcard_"] a[data-testid="stBaseLinkButton-tertiary"],
[class*="st-key-fvcompact_"] button, [class*="st-key-fvcompact_"] a[data-testid="stBaseLinkButton-tertiary"],
[class*="st-key-fvlead_"] button, [class*="st-key-fvlead_"] a[data-testid="stBaseLinkButton-tertiary"],
[class*="st-key-fvtile_"] button, [class*="st-key-fvtile_"] a[data-testid="stBaseLinkButton-tertiary"] {
  min-height: 1.8rem; padding: .1rem .45rem; border-radius: 6px; }
[class*="st-key-fvcard_"] button:hover, [class*="st-key-fvcompact_"] button:hover, [class*="st-key-fvlead_"] button:hover,
[class*="st-key-fvtile_"] button:hover, [class*="st-key-fvtile_"] a[data-testid="stBaseLinkButton-tertiary"]:hover,
[class*="st-key-fvcard_"] a[data-testid="stBaseLinkButton-tertiary"]:hover,
[class*="st-key-fvlead_"] a[data-testid="stBaseLinkButton-tertiary"]:hover { background: var(--fv-hover); }
[class*="st-key-fvcard_"] button p, [class*="st-key-fvcompact_"] button p, [class*="st-key-fvlead_"] button p,
[class*="st-key-fvcard_"] a p, [class*="st-key-fvcompact_"] a p, [class*="st-key-fvlead_"] a p { font-size: .8rem; }

/* Les images : la photo de l'article (sans photo, rien : l'article passe en version texte) */
.fv-media { display: block; overflow: hidden; border-radius: 12px; background: var(--fv-hover); }
.fv-media > img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; transition: transform .45s ease; }
.fv-media:hover > img { transform: scale(1.035); }

/* La une : grande image à gauche, texte à droite */
[class*="st-key-fvlead_"] { padding: 1.2rem 1.3rem .65rem; border-radius: 18px; }
.fv-item.layout-lead { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 1.4rem; align-items: center; }
.layout-lead .fv-media > img { aspect-ratio: 4 / 3; }
.fv-lead .fv-headline { font-size: clamp(1.4rem, 2.4vw, 1.85rem) !important; line-height: 1.18 !important;
  letter-spacing: -.012em; margin-top: .55rem !important; }
.fv-lead .fv-dek { font-size: .98rem; -webkit-line-clamp: 5; }
@media (max-width: 760px) { .fv-item.layout-lead { grid-template-columns: 1fr; gap: .9rem; } }
/* Une sans photo : le titre prend toute la largeur, comme la manchette d'un journal */
.fv-item.layout-lead.no-media { display: block; padding: .3rem .2rem .2rem 1.1rem; border-left: 4px solid var(--c); }
.fv-lead.no-media .fv-headline { font-size: clamp(1.6rem, 3vw, 2.3rem) !important; max-width: 30ch; }
.fv-lead.no-media .fv-dek { max-width: 75ch; -webkit-line-clamp: 3; }

/* Les autres titres : vignettes avec image en haut */
[class*="st-key-fvtile_"] { height: 100%; padding: 0 0 .35rem; gap: .25rem !important; overflow: hidden;
  background: var(--fv-surface); border: 1px solid var(--fv-line); border-radius: var(--fv-radius);
  box-shadow: var(--fv-elev); transition: transform .2s ease, box-shadow .2s, border-color .2s; }
[class*="st-key-fvtile_"]:hover { transform: translateY(-2px); border-color: var(--fv-line-strong); box-shadow: var(--fv-elev-hover); }
/* Vignette sans photo : un liseré de la couleur de la rubrique, et le chapeau en plus du titre */
.layout-tile.no-media { border-top: 3px solid var(--c); }
.layout-tile.no-media .fv-item-text { padding-top: .9rem; }
.layout-tile.no-media .fv-dek { margin-top: .2rem; -webkit-line-clamp: 3; font-size: .85rem; }
@media (prefers-reduced-motion: reduce) { [class*="st-key-fvtile_"] { transition: none; } [class*="st-key-fvtile_"]:hover { transform: none; } }
.layout-tile .fv-media { border-radius: 0; }
.layout-tile .fv-item-text { padding: .7rem .9rem 0; }
.layout-tile .fv-ago { display: none; }  /* colonne étroite : l'heure suffit… */
.layout-tile .fv-kicker { flex-wrap: nowrap; overflow: hidden; white-space: nowrap; }  /* … sur une seule ligne */
.layout-tile .fv-headline { font-size: 1.02rem !important; line-height: 1.3 !important; min-height: 3.9em;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.fv-tile-src { display: flex; align-items: center; gap: .4rem; margin: .3rem 0 0; font-size: .78rem; color: var(--fv-muted); }
.fv-tile-src img { width: 14px; height: 14px; border-radius: 3px; }
[class*="st-key-fvtile_"] [class*="st-key-fvactions_"] { padding: 0 .5rem; }

/* Une ligne du fil, avec une petite image à droite */
.fv-item.has-thumb { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 1.1rem; align-items: start; }
.fv-thumb { display: block; overflow: hidden; border-radius: 10px; margin-top: .25rem; box-shadow: 0 1px 2px var(--fv-shadow); }
.fv-thumb > img { display: block; width: 140px; aspect-ratio: 3 / 2; object-fit: cover; transition: transform .35s ease; }
.fv-thumb:hover > img { transform: scale(1.04); }
@media (max-width: 640px) { .fv-item.has-thumb { grid-template-columns: minmax(0, 1fr) 96px; }
  .fv-thumb > img { width: 96px; } }
@media (prefers-reduced-motion: reduce) { .fv-media > img, .fv-thumb > img { transition: none; } }

/* Colonne de droite */
.fv-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
.fv-bars li { display: grid; grid-template-columns: 7rem 1fr 2.2rem; align-items: center; gap: .6rem; margin: 0; font-size: .82rem; }
.fv-track { height: 6px; border-radius: 3px; background: var(--fv-hover); overflow: hidden; }
.fv-track i { display: block; height: 100%; min-width: 2px; border-radius: 3px; background: var(--c, var(--fv-brand)); }
.fv-bars .fv-cat { justify-self: start; }
.fv-num { text-align: right; font-variant-numeric: tabular-nums; }
.fv-sources { list-style: none; margin: 0; padding: 0; }
.fv-sources li { display: flex; align-items: center; gap: .55rem; margin: 0; padding: .42rem 0;
  border-bottom: 1px solid var(--fv-line); font-size: .84rem; }
.fv-sources li:last-child { border-bottom: 0; }
.fv-sources li img { width: 16px; height: 16px; border-radius: 4px; }
.fv-sources li span:last-child { margin-left: auto; color: var(--fv-muted); font-variant-numeric: tabular-nums; }

/* =============================================================================================
   6. Données de marché : bandeau, hausse/baisse, tuiles, carte de chaleur
   ============================================================================================= */
.fv-tape { display: flex; align-items: stretch; margin: -.6rem 0 1.2rem; overflow: hidden; border-radius: 12px;
  background: color-mix(in srgb, var(--fv-surface) 85%, transparent); border: 1px solid var(--fv-line);
  box-shadow: inset 0 1px 0 var(--fv-hi), 0 1px 2px var(--fv-shadow); font-size: .78rem; }
.fv-tape-label { display: flex; align-items: center; gap: .5rem; padding: 0 .95rem; border-right: 1px solid var(--fv-line);
  font-size: .66rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--fv-text); white-space: nowrap;
  background: linear-gradient(90deg, var(--fv-brand-soft), transparent); }
.fv-tape-label::before { content: ""; width: .5rem; height: .5rem; border-radius: 50%; background: var(--fv-up);
  box-shadow: 0 0 0 3px var(--fv-up-soft); animation: fv-pulse 2.4s ease-in-out infinite; }
@keyframes fv-pulse { 50% { box-shadow: 0 0 0 6px transparent; } }
.fv-tape-window { flex: 1; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent); }
.fv-tape-track { display: inline-flex; white-space: nowrap; padding: .55rem 0; animation: fv-tape 110s linear infinite; }
/* Un contenu qui bouge doit pouvoir s'arrêter : survol, focus clavier ou doigt posé (et « moins d'animations ») */
.fv-tape:hover .fv-tape-track, .fv-tape:focus-within .fv-tape-track, .fv-tape:active .fv-tape-track { animation-play-state: paused; }
.fv-tick { display: inline-flex; align-items: baseline; gap: .45rem; padding: 0 1.15rem; font-family: var(--fv-mono);
  font-size: .76rem; border-right: 1px solid var(--fv-line); }
.fv-tick b { font-family: var(--fv-sans); font-weight: 600; font-size: .78rem; color: var(--fv-text); }
@keyframes fv-tape { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* Hausse / baisse : le chiffre et la flèche prennent la couleur (contraste vérifié sur les deux thèmes) */
.fv-up, .fv-down { font-variant-numeric: tabular-nums; }
.fv-up { color: var(--fv-up); }
.fv-down { color: var(--fv-down); }
.fv-flat { color: var(--fv-muted); }
.fv-up::before, .fv-down::before, .fv-flat::before { display: inline-block; margin-right: .25rem; font-size: .78em; }
.fv-up::before { content: "▲"; }
.fv-down::before { content: "▼"; }
.fv-flat::before { content: "■"; font-size: .6em; vertical-align: .12em; }
.fv-pill-up, .fv-pill-down { padding: .08rem .45rem; border-radius: 5px; }
.fv-pill-up { background: var(--fv-up-soft); }
.fv-pill-down { background: var(--fv-down-soft); }

.fv-group { margin: 1rem 0 .45rem; font-size: .74rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--fv-muted); }
.fv-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(215px, 1fr)); gap: .8rem; }
.fv-tile { position: relative; display: grid; grid-template-columns: 1fr 96px; align-items: end; gap: .2rem .7rem;
  grid-template-areas: "label label" "value spark" "delta spark" "sub sub"; overflow: hidden;
  padding: .95rem 1rem .85rem; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--fv-radius); box-shadow: var(--fv-elev); transition: transform .2s ease, box-shadow .2s, border-color .2s; }
.fv-tile::before { content: ""; position: absolute; inset: 0 0 auto; height: 3px; background: var(--fv-faint); opacity: .7; }
.fv-tile.is-up::before { background: linear-gradient(90deg, var(--fv-up), transparent); }
.fv-tile.is-down::before { background: linear-gradient(90deg, var(--fv-down), transparent); }
.fv-tile.is-up { background: linear-gradient(180deg, color-mix(in srgb, var(--fv-up-soft) 70%, transparent), var(--fv-surface) 55%); }
.fv-tile.is-down { background: linear-gradient(180deg, color-mix(in srgb, var(--fv-down-soft) 70%, transparent), var(--fv-surface) 55%); }
.fv-tile:hover { transform: translateY(-2px); border-color: var(--fv-line-strong); box-shadow: var(--fv-elev-hover); }
.fv-tile-label { grid-area: label; font-size: .8rem; font-weight: 600; color: var(--fv-muted); letter-spacing: .01em; }
.fv-tile-value { grid-area: value; margin-top: .15rem; font-family: var(--fv-mono); font-size: 1.45rem; font-weight: 500;
  letter-spacing: -.03em; line-height: 1.15; color: var(--fv-text); }
.fv-tile-delta { grid-area: delta; font-size: .8rem; font-weight: 600; }
.fv-tile-delta .fv-up, .fv-tile-delta .fv-down { display: inline-block; padding: .08rem .45rem; border-radius: 6px; }
.fv-tile-delta .fv-up { background: var(--fv-up-soft); }
.fv-tile-delta .fv-down { background: var(--fv-down-soft); }
.fv-tile img { grid-area: spark; width: 96px; height: 34px; }
.fv-tile-sub { grid-area: sub; margin-top: .45rem; padding-top: .45rem; border-top: 1px dashed var(--fv-line);
  font-size: .72rem; color: var(--fv-muted); }
@media (prefers-reduced-motion: reduce) { .fv-tile { transition: none; } .fv-tile:hover { transform: none; } }

.fv-heat { display: grid; grid-template-columns: 9.5rem 1fr; gap: 4px 1rem; align-items: stretch; }
.fv-heat-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 4px; }
.fv-heat-label { font-size: .78rem; font-weight: 600; padding-top: .55rem; color: var(--fv-muted); }
.fv-cell { padding: .5rem .6rem; border-radius: 6px; font-size: .78rem; line-height: 1.3;
  background: color-mix(in srgb, var(--c) var(--a), var(--fv-surface)); border: 1px solid var(--fv-line); }
.fv-cell b { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-cell span { font-family: var(--fv-mono); font-size: .76rem; color: var(--fv-text); }
.fv-cell span::before { color: inherit; }
.fv-heat-legend { display: flex; align-items: center; gap: .6rem; margin-top: .8rem; font-size: .74rem; color: var(--fv-muted); }
.fv-heat-legend i { width: 140px; height: 8px; border-radius: 4px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--fv-down) 62%, var(--fv-surface)), var(--fv-surface),
  color-mix(in srgb, var(--fv-up) 62%, var(--fv-surface))); border: 1px solid var(--fv-line); }
@media (max-width: 640px) { .fv-heat { grid-template-columns: 1fr; } .fv-heat-label { padding-top: .4rem; } }

/* =============================================================================================
   7. Chiffres clés, listes, tonalité, tableaux
   ============================================================================================= */
/* Les chiffres clés, dans le style des tuiles de la marque : léger voile de couleur, liseré dégradé en haut */
.fv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .9rem; margin-top: .4rem; }
.fv-kpi { position: relative; padding: 1.15rem 1.2rem 1.05rem; border: 1px solid var(--fv-line); border-radius: var(--radius-lg);
  background: linear-gradient(180deg, color-mix(in srgb, var(--fv-brand) 7%, transparent), transparent 60%), var(--fv-surface);
  box-shadow: inset 0 1px 0 var(--fv-hi), 0 18px 40px -26px var(--fv-shadow-deep); min-width: 0; overflow: hidden; }
.fv-kpi::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
  background: linear-gradient(90deg, var(--fv-brand), var(--fv-brand-2)); }
.fv-kpi-label { font-size: .8rem; font-weight: 600; color: var(--fv-muted); }
.fv-kpi-value { margin-top: .4rem; font-size: 1.85rem; font-weight: 700; letter-spacing: -.02em; line-height: 1.12;
  font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-kpi-sub { margin-top: .3rem; font-size: .8rem; color: var(--fv-muted); }
.fv-breadth { display: flex; height: 6px; border-radius: 3px; overflow: hidden; gap: 2px; margin: .5rem 0 .3rem; }
.fv-breadth i { display: block; }
.fv-chart-title { display: flex; align-items: center; justify-content: space-between; margin: .5rem 0 -.1rem; font-size: .8rem; }
.fv-chart-title small { color: var(--fv-muted); font-variant-numeric: tabular-nums; }

.fv-list { list-style: none; margin: 0; padding: 0; }
.fv-list li { display: grid; grid-template-columns: 18px minmax(6rem, 10rem) 1fr 2.6rem; align-items: center; gap: .65rem;
  margin: 0; padding: .45rem 0; border-bottom: 1px solid var(--fv-line); font-size: .85rem; }
.fv-list li:last-child { border-bottom: 0; }
.fv-list li img { width: 18px; height: 18px; border-radius: 4px; }
.fv-list small { color: var(--fv-muted); font-family: var(--fv-mono); font-size: .7rem; margin-left: .35rem; }
.fv-tone { list-style: none; margin: 0; padding: 0; }
.fv-tone li { display: grid; grid-template-columns: 8rem 1fr 3.6rem; align-items: center; gap: .7rem; margin: 0;
  padding: .55rem 0; border-bottom: 1px solid var(--fv-line); font-size: .82rem; }
.fv-tone li:last-child { border-bottom: 0; }
.fv-tone .fv-axis { position: relative; height: 10px; }
.fv-tone .fv-axis::before { content: ""; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px;
  background: var(--fv-line-strong); }
.fv-tone .fv-axis i { position: absolute; top: 1px; height: 8px; }
.fv-tone .fv-axis i.pos { left: 50%; background: var(--fv-up); border-radius: 0 4px 4px 0; }
.fv-tone .fv-axis i.neg { right: 50%; background: var(--fv-down); border-radius: 4px 0 0 4px; }
.fv-tone small { display: block; margin-top: .2rem; color: var(--fv-muted); font-size: .7rem; }

.fv-table-wrap { overflow-x: auto; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--fv-radius); box-shadow: var(--fv-elev); }
.fv-table { width: 100%; border-collapse: collapse; font-size: .86rem; }
.fv-table th { padding: .55rem .8rem; background: var(--fv-sunken); border-bottom: 1px solid var(--fv-line);
  text-align: right; font-size: .7rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase;
  color: var(--fv-muted); white-space: nowrap; }
.fv-table td { padding: .55rem .8rem; border-bottom: 1px solid var(--fv-line); text-align: right;
  font-variant-numeric: tabular-nums; white-space: nowrap; }
.fv-table th:first-child, .fv-table td:first-child { text-align: left; }
.fv-table td:first-child { font-weight: 600; white-space: normal; }
.fv-table tbody tr:last-child td { border-bottom: 0; }
.fv-table tbody tr:hover td { background: var(--fv-sunken); }
.fv-table small { color: var(--fv-muted); font-weight: 400; }
.fv-table .fv-swatch { display: inline-block; width: 10px; height: 10px; margin-right: .5rem; vertical-align: -1px;
  border-radius: 3px; background: var(--c); }

.fv-ranking { list-style: none; margin: 0; padding: 0; }
.fv-ranking li { display: flex; justify-content: space-between; gap: 1rem; margin: 0; padding: .5rem 0;
  border-bottom: 1px solid var(--fv-line); font-size: .86rem; }
.fv-ranking li:last-child { border-bottom: 0; }
.fv-ranking small { color: var(--fv-muted); }
.fv-agenda { list-style: none; margin: 0; padding: 0; }
.fv-agenda li { display: flex; justify-content: space-between; gap: 1rem; margin: 0; padding: .5rem 0;
  border-bottom: 1px solid var(--fv-line); font-size: .85rem; }
.fv-agenda li:last-child { border-bottom: 0; }
.fv-agenda li span:last-child { text-align: right; font-weight: 500; }
.fv-agenda small { display: block; font-weight: 400; color: var(--fv-muted); font-size: .72rem; }
.fv-convert { margin: .3rem 0 .2rem; font-size: 1.9rem; font-weight: 600; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums; }
.fv-convert small { display: block; margin-top: .2rem; font-size: .8rem; font-weight: 400; color: var(--fv-muted); letter-spacing: 0; }

/* Tableau de bord économique */
.fv-move { color: var(--fv-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fv-macro td { vertical-align: middle; }
.fv-mcell { display: inline-grid; grid-template-columns: auto 64px; align-items: center; gap: 0 .7rem; text-align: right; }
.fv-mcell b { font-size: 1.02rem; font-weight: 600; }
.fv-mcell img { grid-row: span 2; width: 64px; height: 24px; }
.fv-mcell small { font-size: .72rem; color: var(--fv-muted); }
.fv-macro td:first-child small { display: block; margin-top: .15rem; font-weight: 400; font-size: .74rem; color: var(--fv-muted);
  white-space: normal; max-width: 22rem; }
.fv-verdict { display: inline-block; margin-top: .45rem; padding: .1rem .5rem; border-radius: 5px; font-size: .74rem; font-weight: 600;
  background: var(--fv-brand-soft); color: var(--fv-brand); }

/* Cryptomonnaies : nom avec logo, jauge de l'indice peur et avidité */
.fv-coin { display: inline-flex; align-items: center; gap: .55rem; }
.fv-coin img { width: 20px; height: 20px; border-radius: 50%; }
.fv-coin small { font-family: var(--fv-mono); }
.fv-table td img.fv-spark { display: block; width: 96px; height: 28px; margin-left: auto; }
.fv-gauge-value { display: flex; align-items: baseline; gap: .6rem; margin: .2rem 0 .8rem; }
.fv-gauge-value b { font-family: var(--fv-mono); font-size: 2.4rem; font-weight: 500; letter-spacing: -.03em; line-height: 1; }
.fv-gauge-value span { font-size: 1rem; font-weight: 600; }
.fv-gauge-bar { position: relative; height: 10px; border-radius: 5px;
  background: linear-gradient(90deg, var(--fv-down), var(--fv-warn) 30%, var(--fv-faint) 50%,
    color-mix(in srgb, var(--fv-up) 60%, var(--fv-faint)) 70%, var(--fv-up)); }
.fv-gauge-bar i { position: absolute; top: -5px; width: 6px; height: 20px; margin-left: -3px; border-radius: 3px;
  background: var(--fv-text); box-shadow: 0 0 0 2px var(--fv-surface); }
.fv-gauge-scale { display: flex; justify-content: space-between; margin-top: .4rem; font-size: .72rem; color: var(--fv-muted); }
.fv-gauge-history { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-top: 1rem; }
.fv-gauge-history div { padding: .5rem .6rem; border: 1px solid var(--fv-line); border-radius: 8px; font-size: .74rem;
  color: var(--fv-muted); }
.fv-gauge-history b { display: block; font-size: .95rem; color: var(--fv-text); }

/* Quiz */
.fv-quiz-question small { font-size: .74rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
  color: var(--fv-brand); }
.fv-quiz-question p { margin: .5rem 0 .1rem; font-family: var(--fv-serif); font-size: 1.25rem; line-height: 1.5; }
.fv-quiz-choice { padding: .55rem 1rem; border: 1px solid var(--fv-line-strong); border-radius: 8px; text-align: center;
  background: var(--fv-surface); font-size: .95rem; color: var(--fv-muted); }
.fv-quiz-choice.is-right { border-color: var(--fv-up); background: var(--fv-up-soft); color: var(--fv-up); font-weight: 600; }
.fv-quiz-choice.is-wrong { border-color: var(--fv-down); background: var(--fv-down-soft); color: var(--fv-down); font-weight: 600; }
.fv-quiz-feedback { margin: .3rem 0; font-weight: 600; }
.fv-quiz-feedback.is-right { color: var(--fv-up); }
.fv-quiz-feedback.is-wrong { color: var(--fv-down); }
.fv-quiz-wrong { font-size: .8rem; color: var(--fv-down); }

/* =============================================================================================
   8. Fiche entreprise
   ============================================================================================= */
.fv-firm { display: flex; align-items: center; gap: .9rem; margin: .8rem 0 .3rem; }
.fv-firm img { width: 48px; height: 48px; border-radius: 12px; background: var(--ink-0); padding: 6px;
  border: 1px solid var(--fv-line); }
.fv-firm h2 { margin: 0 !important; padding: 0 !important; font: 700 clamp(1.4rem, 2.6vw, 1.8rem)/1.15 var(--fv-sans) !important;
  letter-spacing: -.02em; }
.fv-firm p { margin: .2rem 0 0; font-size: .8rem; color: var(--fv-muted); }
.fv-quote-big { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 1rem; margin: .6rem 0 .2rem; }
.fv-quote-big b { font-family: var(--fv-mono); font-size: 1.9rem; font-weight: 500; letter-spacing: -.03em; }
.fv-quote-big span { font-size: .95rem; font-weight: 500; }
.fv-quote-big small { font-size: .78rem; color: var(--fv-muted); }
.fv-ratios { margin: 0; display: grid; grid-template-columns: 1fr auto; }
.fv-ratios dt, .fv-ratios dd { margin: 0; padding: .45rem 0; border-bottom: 1px solid var(--fv-line); font-size: .85rem; }
.fv-ratios dt { cursor: help; color: var(--fv-muted); }
.fv-ratios dd { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.fv-range { margin: 1rem 0 .2rem; font-size: .78rem; color: var(--fv-muted); }
.fv-range-bar { position: relative; height: 6px; margin: .5rem 0 .35rem; border-radius: 3px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--fv-down) 45%, var(--fv-surface)), var(--fv-hover),
  color-mix(in srgb, var(--fv-up) 45%, var(--fv-surface))); }
.fv-range-bar i { position: absolute; top: -5px; width: 4px; height: 16px; margin-left: -2px; border-radius: 2px;
  background: var(--fv-text); box-shadow: 0 0 0 2px var(--fv-surface); }
.fv-range-ends { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; }

/* =============================================================================================
   9. Résumé, notes, glossaire, brief
   ============================================================================================= */
.fv-brief { margin: .6rem 0 .3rem; padding: .8rem 1rem .7rem; border: 1px solid color-mix(in srgb, var(--fv-brand) 25%, transparent);
  background: var(--fv-brand-soft); border-radius: 8px; }
.fv-brief-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .2rem 1rem; margin-bottom: .4rem;
  font-size: .7rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--fv-brand); }
.fv-brief-head small { font-size: .72rem; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--fv-muted); }
.fv-brief ul { margin: 0; padding-left: 1.1rem; }
.fv-brief li { margin: .25rem 0; font-size: .92rem; line-height: 1.5; }
.fv-brief-why { margin: .45rem 0 0; font-size: .9rem; line-height: 1.5; }
.fv-brief-note { margin: .45rem 0 0; font-size: .72rem; color: var(--fv-muted); }
.fv-note-block { margin: .5rem 0 .1rem; padding: .5rem .85rem; border-left: 3px solid var(--fv-warn);
  background: var(--fv-warn-soft); border-radius: 0 6px 6px 0; font-size: .92rem; }
.fv-note-block b { display: block; margin-bottom: .15rem; font-size: .66rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--fv-warn); }

.fv-word { margin: .5rem 0 .4rem; padding: 1.1rem 1.25rem; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-left: 4px solid var(--fv-brand); border-radius: var(--fv-radius); box-shadow: var(--fv-elev); }
.fv-word small { font-size: .7rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--fv-brand); }
.fv-word h3 { margin: .3rem 0 .35rem !important; padding: 0 !important; font: 700 1.5rem/1.2 var(--fv-sans) !important;
  letter-spacing: -.02em; }
.fv-word p { margin: 0; font-size: .97rem; line-height: 1.55; color: var(--fv-muted); }
.fv-letter { margin: 1.4rem 0 .3rem; padding-bottom: .3rem; border-bottom: 1px solid var(--fv-line);
  font-size: 1.15rem; font-weight: 700; color: var(--fv-brand); }
.fv-gloss { margin: 0; }
.fv-gloss dt { margin-top: .8rem; font-weight: 600; font-size: .95rem; }
.fv-gloss dt small { margin-left: .5rem; padding: .05rem .4rem; border-radius: 5px; background: var(--fv-hover);
  font-weight: 500; font-size: .7rem; color: var(--fv-muted); }
.fv-gloss dd { margin: .2rem 0 0; color: var(--fv-muted); font-size: .92rem; line-height: 1.55; }

.fv-edition-line { margin: .6rem 0 0; font-size: .8rem; color: var(--fv-muted); }
.fv-lede { margin: .2rem 0 .8rem; font-family: var(--fv-serif); font-size: clamp(1.15rem, 2vw, 1.4rem); line-height: 1.5; }
.fv-front { list-style: none; margin: 0; padding: 0; }
.fv-front li { margin: 0; padding: .8rem 0 .85rem; border-bottom: 1px solid var(--fv-line); }
.fv-front li:last-child { border-bottom: 0; }
.fv-front li a { display: block; margin: .4rem 0 .2rem; color: var(--fv-text) !important; text-decoration: none !important;
  font-family: var(--fv-serif); font-weight: 600; font-size: 1.15rem; line-height: 1.3; }
.fv-front li a:hover { color: var(--fv-brand) !important; }
.fv-front small { color: var(--fv-muted); font-size: .76rem; }
.fv-topics { list-style: none; margin: 0; padding: 0; counter-reset: topic; }
.fv-topics li { display: grid; grid-template-columns: 1.7rem 1fr auto; gap: .5rem; align-items: baseline; margin: 0;
  padding: .5rem 0; border-bottom: 1px solid var(--fv-line); counter-increment: topic; font-size: .92rem; }
.fv-topics li:last-child { border-bottom: 0; }
.fv-topics li::before { content: counter(topic); font-family: var(--fv-mono); font-size: .8rem; font-weight: 500;
  color: var(--fv-brand); }
.fv-topics li span:first-child { font-weight: 600; }
.fv-topics small { color: var(--fv-muted); font-size: .76rem; font-variant-numeric: tabular-nums; }

/* =============================================================================================
   10. Alertes
   ============================================================================================= */
.fv-alert-banner { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem 1rem; margin: -.3rem 0 1.1rem;
  padding: .6rem .9rem; background: var(--fv-warn-soft); border: 1px solid color-mix(in srgb, var(--fv-warn) 35%, transparent);
  border-radius: var(--fv-radius); font-size: .86rem; }
.fv-alert-banner b { display: inline-flex; align-items: center; gap: .4rem; font-size: .7rem; font-weight: 700;
  letter-spacing: .08em; text-transform: uppercase; color: var(--fv-warn); }
.fv-alert-banner b::before { content: ""; width: .5rem; height: .5rem; border-radius: 50%; background: var(--fv-warn); }
.fv-alert-banner a { margin-left: auto; color: var(--fv-warn) !important; font-size: .8rem; font-weight: 600; }
.fv-status { display: inline-flex; align-items: center; gap: .4rem; font-size: .78rem; font-weight: 600; color: var(--fv-warn); }
.fv-status::before { content: ""; width: .5rem; height: .5rem; border-radius: 50%; border: 1.5px solid currentColor; }
.fv-status.is-on::before { background: currentColor; }
.fv-status.is-off { color: var(--fv-muted); font-weight: 500; }
[class*="st-key-fvalert_"] { padding: .55rem 1.1rem; border-bottom: 1px solid var(--fv-line); }
[class*="st-key-fvalert_"]:last-child { border-bottom: 0; }
.fv-alert-row { display: grid; grid-template-columns: 7.5rem 1fr auto; gap: .2rem 1rem; align-items: baseline; font-size: .9rem; }
.fv-alert-row small { color: var(--fv-muted); font-size: .78rem; }
@media (max-width: 640px) { .fv-alert-row { grid-template-columns: 1fr; } }

/* =============================================================================================
   11. Pied de page
   ============================================================================================= */
.fv-footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 1rem 2.5rem; margin: 3.5rem 0 0;
  padding: 1.6rem 0 0; border-top: 1px solid var(--fv-line); }
.fv-wordmark { font: 700 1.2rem/1 var(--fv-sans); letter-spacing: -.02em; color: var(--fv-text); }
.fv-wordmark em { font-style: normal; background: linear-gradient(90deg, var(--fv-brand), var(--fv-brand-2));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.fv-footer-brand p { margin: .45rem 0 0; font-size: .85rem; color: var(--fv-muted); }
.fv-footer-links { display: flex; flex-wrap: wrap; gap: .35rem 1.2rem; align-content: start; justify-content: flex-end; }
.fv-footer-links a { font-size: .85rem; font-weight: 500; color: var(--fv-muted) !important; text-decoration: none !important; }
.fv-footer-links a:hover { color: var(--fv-brand) !important; }
.fv-footer-note { grid-column: 1 / -1; margin: .4rem 0 0; font-size: .74rem; line-height: 1.6; color: var(--fv-muted); }
@media (max-width: 640px) { .fv-footer { grid-template-columns: 1fr; } .fv-footer-links { justify-content: flex-start; } }

/* Sur écran tactile, chaque bouton fait au moins 44 px de haut : on vise sans zoomer */
@media (pointer: coarse) {
  .stApp button, .stApp a[data-testid^="stBaseLinkButton"], .stApp [data-testid="stPopoverButton"],
  [data-testid="stSidebarNavLink"], [data-testid="stLogoLink"], [data-testid="stTextInputRootElement"],
  [data-testid="stNumberInputContainer"], [data-baseweb="select"] > div { min-height: 44px; }
  [data-testid="stMainMenuButton"], [data-testid="stExpandSidebarButton"], [data-testid="stBaseButton-headerNoPadding"],
  [data-testid="stBaseButton-elementToolbar"], [data-testid="stNumberInputStepDown"], [data-testid="stNumberInputStepUp"],
  [data-testid="stChatInputSubmitButton"] { min-width: 44px; min-height: 44px; }
  [data-testid="stTooltipHoverTarget"] { padding: .7rem; margin: -.7rem; }  /* la bulle d'aide « ? » : zone élargie */
  .fv-footer-links a { display: inline-flex; align-items: center; min-height: 44px; }
  .fv-headline a { padding-block: .9rem; }  /* zone de toucher agrandie, sans rien déplacer (lien en ligne) */
  ul[class^="fv-"] li > a { display: inline-flex; align-items: center; min-height: 44px; }  /* listes de dépêches */
  [data-testid="stPageLink-NavLink"] { min-height: 44px; }
}
.stApp button, .stApp a[href], .stApp [role="tab"], .stApp summary { cursor: pointer; touch-action: manipulation; }

@media (prefers-reduced-motion: reduce) {
  .fv-tape-window { overflow-x: auto; mask-image: none; }
  .fv-tape-track, .fv-tape-label::before, .fv-sk, .fv-hero-copy > *, [class*="st-key-fvlead_"],
  [class*="st-key-fvtile_"], [class*="st-key-fvcard_"] { animation: none; }
}
</style>
"""


def inject_css() -> None:
    """Ajoute la feuille de style à la page (à appeler une fois par exécution, dans app.py)."""
    st.html(CSS)


# --- Petites fonctions de mise en forme --------------------------------------------------------


def esc(text: str | None) -> str:
    """Protège un texte avant de l'insérer dans du HTML (sinon un titre contenant <script> serait exécuté)."""
    return html.escape(text or "", quote=True)


def safe_url(url: str | None) -> str:
    """N'accepte que les liens web : un lien « javascript:… » pourrait exécuter du code."""
    return esc(url) if url and url.startswith(("http://", "https://")) else "#"


def favicon_url(url: str) -> str:
    """Logo (favicon) du site d'un article, via le service public de Google."""
    domain = urlparse(url).netloc.removeprefix("www.")
    return f"https://www.google.com/s2/favicons?domain={esc(domain)}&sz=64"


def fr_number(value: float, decimals: int = 2) -> str:
    """Nombre à la française : 8 012,34 (espace fine insécable pour les milliers, virgule décimale)."""
    text = f"{value:,.{decimals}f}"
    return text.replace(",", "\u202f").replace(".", ",")  # \u202f : espace fine insécable


def fr_date(moment: datetime) -> str:
    """« samedi 10 octobre 2026 ». (On évite locale.setlocale, qui dépend de la configuration du système.)"""
    return f"{_DAYS[moment.weekday()]} {moment.day} {_MONTHS[moment.month - 1]} {moment.year}"


def fr_day(moment) -> str:
    """« 9 octobre » (accepte une date ou un datetime)."""
    return f"{moment.day} {_MONTHS[moment.month - 1]}"


SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500"]  # 4 séries au plus, ordre fixe (palette validée)


def clock(moment: datetime) -> str:
    """Heure locale (Paris) : « 14:32 » aujourd'hui, « 9 oct. 18:40 » sinon."""
    local = moment.astimezone(DISPLAY_TZ)
    if local.date() == datetime.now(DISPLAY_TZ).date():
        return local.strftime("%H:%M")
    return f"{local.day} {_MONTHS_SHORT[local.month - 1]} {local:%H:%M}"


def time_ago(published: datetime) -> str:
    """« il y a 5 min », « il y a 3 h », « il y a 2 j »."""
    minutes = int((datetime.now(timezone.utc) - published).total_seconds() // 60)
    if minutes < 60:
        return f"il y a {max(minutes, 0)} min"
    if minutes < 24 * 60:
        return f"il y a {minutes // 60} h"
    return f"il y a {minutes // (24 * 60)} j"


def exchange_status(now: datetime) -> list[tuple[str, str, bool]]:
    """Pour chaque place boursière : (ville, heure locale, séance ouverte ?)."""
    rows = []
    for city, zone, opens, closes in EXCHANGES:
        local = now.astimezone(ZoneInfo(zone))
        is_open = local.weekday() < 5 and opens <= local.time() < closes  # lundi = 0 … vendredi = 4
        rows.append((city, local.strftime("%H:%M"), is_open))
    return rows


# --- Blocs d'interface ------------------------------------------------------------------------


def sessions_html(now: datetime) -> str:
    """Les places boursières en pastilles : point vert = séance ouverte (le texte le dit aussi)."""
    items = "".join(
        f'<li class="{"is-open" if is_open else ""}" title="{city} : séance {"ouverte" if is_open else "fermée"}">'
        f'<b>{city}</b><time>{hour}</time>{"ouverte" if is_open else "fermée"}</li>'
        for city, hour, is_open in exchange_status(now)
    )
    return f'<ul class="fv-sessions" aria-label="Places boursières">{items}</ul>'


def float_tile(quote) -> str:
    """Une tuile de cours « flottante » de l'en-tête : nom, cours, variation de la séance, courbe sur un mois."""
    month_change = quote.change_over(21)
    trend = direction(quote.change).removeprefix("fv-")
    summary = f"{quote.name} : {price(quote.last)}, {signed(quote.change, quote.unit)} sur la séance"
    return (
        f'<div class="fv-float is-{trend}" title="{esc(summary)}">'
        f'<span class="fv-float-name">{esc(quote.name)}</span>'
        f'<span class="fv-float-value">{price(quote.last)}</span>'
        f'<span class="fv-float-delta">{change(quote.change, quote.unit)}</span>'
        f'<img src="{sparkline_uri(quote.history.tail(22).tolist(), direction(month_change), 104, 36)}" '
        f'alt="Un mois : {esc(signed(month_change, quote.unit))}"></div>'
    )


def hero_html(title: str, dek: str, eyebrow: str = "", accent: str = "", quotes=(), extra: str = "",
              classes: str = "") -> str:
    """L'en-tête « héros » d'une page : sur-titre, grand titre (la fin `accent` en dégradé de marque), phrase
    d'introduction, et à droite des tuiles de cours flottantes si `quotes` en contient."""
    aside = "".join(float_tile(quote) for quote in quotes)
    classes = " ".join(filter(None, ["fv-hero", "has-aside" if aside else "", classes]))
    return (
        f'<header class="{classes}"><div class="fv-hero-copy">'
        + (f'<div class="fv-eyebrow">{esc(eyebrow)}</div>' if eyebrow else "")
        + f'<h1 class="fv-hero-title">{esc(title)}{f" <em>{esc(accent)}</em>" if accent else ""}</h1>'
        + f'<p class="fv-hero-dek">{dek}</p>{extra}</div>'
        + (f'<div class="fv-hero-aside" role="group" aria-label="Les marchés en un coup d\'œil">{aside}</div>'
           if aside else "")
        + "</header>"
    )


def feed_header(article_count: int, source_count: int, fetched_at: datetime, quotes=()) -> None:
    """L'en-tête du fil : date, titre, volume collecté, places boursières et trois cours qui flottent."""
    now = datetime.now(timezone.utc)
    st.html(hero_html(
        "L'actualité financière,", f"{fr_number(article_count, 0)} dépêches de {source_count} sources, classées par "
        f"rubrique et expliquées · dernière collecte à {clock(fetched_at)}",
        eyebrow=f"{fr_date(now.astimezone(DISPLAY_TZ)).capitalize()} · édition continue", accent="en continu.",
        quotes=quotes, extra=sessions_html(now), classes="is-home is-live",
    ))


def feed_skeleton() -> str:
    """Le squelette du fil, affiché pendant la recherche des photos : la mise en page se devine au lieu d'un vide,
    et rien ne saute quand les articles arrivent."""
    def bar(width: str = "100%", kind: str = "") -> str:
        return f'<i class="fv-sk{kind}" style="width:{width}"></i>'
    lead = (f'<div class="fv-sk-lead">{bar(kind=" fv-sk-media")}<div class="fv-sk-stack">{bar("32%")}'
            f'{bar("92%", " fv-sk-title")}{bar("68%", " fv-sk-title")}{bar("96%")}{bar("84%")}{bar("60%")}</div></div>')
    tile = f'<div class="fv-sk-tile">{bar(kind=" fv-sk-media")}{bar("38%")}{bar("88%", " fv-sk-title")}{bar("55%")}</div>'
    return (f'<div class="fv-skeleton" role="status"><span class="fv-sr">Chargement du fil…</span>'
            f'<div class="fv-section"><h2>À la une</h2></div>{lead}<div class="fv-sk-tiles">{tile * 3}</div></div>')


def section(title: str, note: str = "") -> None:
    """Titre de section, avec une précision facultative en gris."""
    st.html(f'<div class="fv-section"><h2>{esc(title)}</h2>{f"<small>{esc(note)}</small>" if note else ""}</div>')


def page_header(title: str, dek: str, eyebrow: str = "", accent: str = "", quotes=()) -> None:
    """En-tête de page : rubrique du menu, grand titre (avec sa fin en dégradé), phrase d'introduction et,
    sur les pages principales, quelques cours en tuiles flottantes."""
    st.html(hero_html(title, esc(dek), eyebrow, accent, quotes))


def card(body: str, title: str = "", note: str = "") -> str:
    """HTML d'une carte (fond blanc en clair, bleu nuit en sombre), avec un titre facultatif."""
    head = f'<h3 class="fv-card-title">{esc(title)}<small>{esc(note)}</small></h3>' if title else ""
    return f'<section class="fv-card">{head}{body}</section>'


def table(head: list[str], rows: str) -> str:
    """HTML d'un tableau dans sa carte ; défile horizontalement sur un petit écran."""
    header = "".join(f"<th>{cell}</th>" for cell in head)
    return f'<div class="fv-table-wrap"><table class="fv-table"><thead><tr>{header}</tr></thead><tbody>{rows}</tbody></table></div>'


_ICONS = {  # pictogrammes au trait (24 × 24), dessinés en SVG : aucune image à télécharger
    "star": '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    "wallet": '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14.5h2"/>',
    "bell": '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
    "mail": '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    "spark": '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
}


def svg_uri(svg: str) -> str:
    """Une image SVG en « data URI ». st.html retire les balises <svg> de la page (sécurité) : on passe donc par
    <img src="data:…"> ou par un fond CSS, qui ne peuvent pas exécuter de code."""
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def icon(name: str, color: str = "#1536b4") -> str:
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{color}" '
           f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{_ICONS[name]}</svg>')
    return f'<img src="{svg_uri(svg)}" alt="">'


_CURVE = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160" preserveAspectRatio="none">'
          '<path d="M0 130 C40 120 60 135 95 110 S150 70 185 85 S245 60 280 45 S350 30 400 12 V160 H0Z" fill="#fff" '
          'fill-opacity=".08"/><path d="M0 130 C40 120 60 135 95 110 S150 70 185 85 S245 60 280 45 S350 30 400 12" '
          'fill="none" stroke="#6ee7a8" stroke-opacity=".7" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>')


def showcase_html() -> str:
    """L'illustration de la page de connexion : le logo, ce que le compte apporte, une courbe et des cartes
    décoratives (un dessin, pas des données réelles)."""
    features = [
        ("star", "Favoris et notes", "Garde les articles importants avec tes remarques."),
        ("wallet", "Portefeuille virtuel", "Entraîne-toi à investir, sans risquer un euro."),
        ("bell", "Alertes de cours", "Un e-mail dès qu'un seuil est franchi."),
        ("mail", "Le brief du matin", "L'essentiel de la veille dans ta boîte, à 7 h 45."),
    ]
    rows = "".join(f'<li><span class="fv-show-icon">{icon(name)}</span><span><b>{esc(title)}</b>{esc(text)}</span></li>'
                   for name, title, text in features)
    return (
        f'<div class="fv-showcase" style="--curve:url({svg_uri(_CURVE)})">'
        '<p class="fv-show-eyebrow">Ton compte FinVeille</p>'
        '<h3 class="fv-show-title">Ta veille financière, partout avec toi.</h3>'
        f'<ul class="fv-show-list">{rows}</ul>'
        f'<p class="fv-show-foot">{icon("spark", "#6ee7a8")}Gratuit, sans publicité, tes données t\'appartiennent.</p></div>'
    )


def sources_html(sources: list[dict], title: str = "Sources") -> str:
    """Les dépêches citées par l'IA, numérotées comme dans sa réponse, avec un lien vers chacune."""
    items = []
    for source in sources:
        try:
            when = clock(datetime.fromisoformat(source["published"]))
        except (KeyError, ValueError):
            when = ""
        items.append(
            f'<a class="fv-cite" href="{safe_url(source["url"])}" target="_blank" rel="noopener">'
            f'<span class="fv-cite-n">{int(source["n"])}</span>'
            f'<img src="{favicon_url(source["url"])}" alt="" loading="lazy">'
            f'<span class="fv-cite-text"><b>{esc(source["title"])}</b>'
            f'<small>{esc(source["source"])}{" · " + esc(when) if when else ""}</small></span></a>'
        )
    return (f'<div class="fv-cites"><p class="fv-cites-title">{esc(title)}</p>'
            f'<div class="fv-cites-grid">{"".join(items)}</div></div>')


def assistant_hero_html(engine: str | None, articles: int) -> str:
    """L'accueil de l'assistant, avant la première question."""
    status = (f'<span class="fv-ai-status is-on">IA active · {esc(engine)}</span>' if engine else
              '<span class="fv-ai-status">Mode sans IA : recherche dans les dépêches et le glossaire</span>')
    points = [
        ("spark", f"Il lit les {articles} dépêches du moment et les cours des marchés avant de répondre."),
        ("star", "Il cite ses sources : clique sur [1], [2]… pour vérifier dans l'article."),
        ("mail", "Il explique les termes difficiles, comme un professeur patient."),
    ]
    rows = "".join(f'<li><span class="fv-show-icon">{icon(name)}</span><span>{esc(text)}</span></li>'
                   for name, text in points)
    # Le grand titre est dans l'en-tête de la page : la carte ne garde que l'état de l'IA et ses trois promesses
    return (f'<div class="fv-showcase fv-ai-hero" style="--curve:url({svg_uri(_CURVE)})">{status}'
            f'<ul class="fv-show-list">{rows}</ul></div>')


def category_tag(key: str, label: str) -> str:
    """HTML d'une étiquette de catégorie : une pastille de couleur + le nom (jamais la couleur seule)."""
    return f'<span class="fv-cat" style="--c:{CATEGORY_COLORS.get(key, NEUTRAL)}">{esc(label)}</span>'


# --- Données de marché ------------------------------------------------------------------------

TAPE_SECONDS = 110  # durée d'un tour complet du bandeau (doit correspondre au CSS)


def signed(value: float, unit: str = "%", decimals: int = 2) -> str:
    """« +0,95 % », « −1,20 % », « +3,0 pb » (vrai signe moins typographique)."""
    if unit == "pb":
        decimals = 1
    sign = "+" if value > 0 else "−" if value < 0 else ""
    return f"{sign}{fr_number(abs(value), decimals)} {unit}"


def direction(value: float, threshold: float = 0.005) -> str:
    """Classe CSS de direction : fv-up (▲ vert), fv-down (▼ rouge) ou fv-flat (■ gris)."""
    return "fv-up" if value > threshold else "fv-down" if value < -threshold else "fv-flat"


def change(value: float, unit: str = "%", decimals: int = 2) -> str:
    """HTML d'une variation colorée avec sa flèche : ▲ +1,20 %."""
    return f'<span class="{direction(value)}">{signed(value, unit, decimals)}</span>'


def move(value: float, unit: str = "pt", decimals: int = 1) -> str:
    """Évolution « neutre » (flèche grise) : la hausse de l'inflation ou des taux n'est ni bonne ni mauvaise en soi."""
    arrow = "▲" if value > 0.005 else "▼" if value < -0.005 else "■"
    return f'<span class="fv-move">{arrow} {signed(value, unit, decimals)}</span>'


def period_label(moment, frequency: str = "mois") -> str:
    """« 8 oct. 2026 » (jour), « sept. 2026 » (mois) ou « T1 2026 » (trimestre)."""
    if frequency == "jour":
        return f"{moment.day} {_MONTHS_SHORT[moment.month - 1]} {moment.year}"
    if frequency == "trimestre":
        return f"T{(moment.month - 1) // 3 + 1} {moment.year}"
    return f"{_MONTHS_SHORT[moment.month - 1]} {moment.year}"


def price(value: float) -> str:
    """Cours avec un nombre de décimales adapté à sa grandeur (4 pour une devise, 0 au-delà de 10 000)."""
    decimals = 4 if value < 10 else 2 if value < 10_000 else 0
    return fr_number(value, decimals)


# Les graphiques Altair (Vega-Lite) en français : virgule décimale, espace fine pour les milliers, noms des mois.
ALTAIR_LOCALE = {
    "number": {"decimal": ",", "thousands": "\u202f", "grouping": [3], "currency": ["", "\u202f€"]},
    "time": {
        "dateTime": "%A %e %B %Y à %X", "date": "%d/%m/%Y", "time": "%H:%M:%S",
        "periods": ["", ""],
        "days": [d.capitalize() for d in ["dimanche"] + _DAYS[:6]],
        "shortDays": ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
        "months": _MONTHS,
        "shortMonths": _MONTHS_SHORT,
    },
}


def french(chart):
    """Mise en forme française et style FinVeille d'un graphique Altair (à appeler juste avant st.altair_chart).

    Les couleurs du texte et des grilles restent celles du thème Streamlit (elles suivent le clair et le sombre) ;
    on ne règle ici que ce qui vaut pour les deux : la police du site, pas de cadre ni de traits d'axe, une grille
    en pointillés discrets, des légendes en pastilles rondes.
    """
    return (
        chart.configure(locale=ALTAIR_LOCALE, font="IBM Plex Sans")
        .configure_axis(domain=False, ticks=False, labelPadding=8, gridDash=[2, 4], labelFontSize=12,
                        titleFontSize=12, titleFontWeight=500, titlePadding=10)
        .configure_view(stroke=None)
        .configure_legend(symbolType="circle", symbolSize=80, labelFontSize=12, titleFontWeight=600)
    )


def sparkline_uri(values: list[float], end_class: str, width: int = 84, height: int = 30) -> str:
    """Mini-courbe en SVG, encodée comme une image (st.html n'accepte pas le SVG intégré).

    Courbe colorée selon la direction de la période, avec une aire très légère pour la lisibilité.
    """
    values = [float(v) for v in values]
    low, high = min(values), max(values)
    span = (high - low) or 1
    step = (width - 8) / max(len(values) - 1, 1)
    points = [(4 + i * step, height - 4 - (v - low) / span * (height - 8)) for i, v in enumerate(values)]
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    end_x, end_y = points[-1]
    color = {"fv-up": UP, "fv-down": DOWN}.get(end_class, NEUTRAL)
    area = f"4,{height} {path} {end_x:.1f},{height}"
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<polygon points="{area}" fill="{color}" fill-opacity=".1"/>'
        f'<polyline points="{path}" fill="none" stroke="{color}" stroke-width="1.6" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        f'<circle cx="{end_x:.1f}" cy="{end_y:.1f}" r="2.6" fill="{color}"/></svg>'
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def quote_tile(quote) -> str:
    """Une tuile de cotation : nom, cours, variation de la séance, mini-courbe sur un mois."""
    month = quote.history.tail(22)
    month_change = quote.change_over(21)
    summary = (
        f"{quote.name} : {price(quote.last)}, {signed(quote.change, quote.unit)} sur la séance, "
        f"{signed(month_change, quote.unit)} sur un mois"
    )
    trend = direction(quote.change).removeprefix("fv-")  # « up », « down » ou « flat » : l'accent de la tuile
    return (
        f'<div class="fv-tile is-{trend}" title="{esc(summary)}">'
        f'<div class="fv-tile-label">{esc(quote.name)}</div>'
        f'<div class="fv-tile-value">{price(quote.last)}</div>'
        f'<img src="{sparkline_uri(month.tolist(), direction(month_change), 96, 34)}" '
        f'alt="Un mois : {esc(signed(month_change, quote.unit))}">'
        f'<div class="fv-tile-delta">{change(quote.change, quote.unit)}</div>'
        f'<div class="fv-tile-sub">1 mois : {change(month_change, quote.unit)}</div>'
        f"</div>"
    )


def ticker_tape(quotes) -> None:
    """Le bandeau défilant des cours, en haut de chaque page."""
    if not quotes:
        return
    items = "".join(
        f'<span class="fv-tick"><b>{esc(q.name)}</b>{price(q.last)} {change(q.change, q.unit)}</span>'
        for q in quotes
    )
    # Le contenu est répété deux fois : en décalant de 50 %, la boucle est invisible.
    # Le délai négatif, calé sur l'horloge, évite que le bandeau reparte du début à chaque rafraîchissement.
    delay = -(clock_module.time() % TAPE_SECONDS)
    st.html(
        f'<div class="fv-tape" role="marquee" aria-label="Cours des marchés"><span class="fv-tape-label">Marchés</span>'
        f'<div class="fv-tape-window"><div class="fv-tape-track" style="animation-delay:{delay:.1f}s">{items}{items}</div>'
        f"</div></div>"
    )


FOOTER_LINKS = [("Le fil", ""), ("Le brief", "brief"), ("Assistant IA", "assistant"), ("Marchés", "markets"),
                ("Économie", "economy"), ("Crypto", "crypto"), ("Glossaire", "glossary")]


def footer() -> None:
    """Le pied de page, sur toutes les pages : la marque, les rubriques, les sources et l'avertissement."""
    links = "".join(f'<a href="./{path}" target="_self">{esc(label)}</a>' for label, path in FOOTER_LINKS)
    st.html(
        '<footer class="fv-footer">'
        '<div class="fv-footer-brand"><span class="fv-wordmark">Fin<em>Veille</em></span>'
        "<p>La veille financière et économique mondiale, mise à jour en continu.</p></div>"
        f'<nav class="fv-footer-links" aria-label="Rubriques">{links}</nav>'
        '<p class="fv-footer-note">Sources : flux RSS des médias cités, Yahoo Finance (cours différés), BCE, Réserve '
        "fédérale, CoinGecko. Résumés et réponses de l'IA à vérifier dans les articles. Informations pédagogiques : "
        "pas un conseil en investissement.</p></footer>"
    )


def compact_money(value: float, currency: str = "") -> str:
    """« 187,3 Md€ », « 4,9 Md$ » : montants en milliards ou millions, à la française."""
    symbol = {"EUR": "€", "USD": "$", "GBP": "£", "JPY": "¥"}.get(currency, f" {currency}" if currency else "")
    if abs(value) >= 1e9:
        return f"{fr_number(value / 1e9, 1)} Md{symbol}"
    if abs(value) >= 1e6:
        return f"{fr_number(value / 1e6, 1)} M{symbol}"
    return f"{fr_number(value, 0)}{symbol}"


def alert_banner(fired) -> None:
    """Bandeau affiché en haut de toutes les pages quand des alertes sont déclenchées."""
    from core.alerts import describe  # import local : theme.py reste indépendant de core/ pour le reste

    items = " · ".join(f"{esc(describe(alert))} (cours {price(quote.last)})" for alert, quote in fired)
    plural = "s" if len(fired) > 1 else ""
    st.html(
        f'<div class="fv-alert-banner" role="alert"><b>Alerte{plural}</b><span>{items}</span>'
        f'<a href="alerts" target="_self">Gérer mes alertes →</a></div>'
    )
