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
   1. Jetons de design : light-dark(clair, sombre) suit le thème choisi dans Streamlit
   ============================================================================================= */
.stApp {
  --fv-bg: light-dark(#f4f6f9, #0a0d12);
  --fv-surface: light-dark(#ffffff, #11161d);
  --fv-sunken: light-dark(#f7f8fa, #0e1218);
  --fv-hover: light-dark(#f1f4f8, #171d26);
  --fv-line: light-dark(#e4e8ee, #1f2731);
  --fv-line-strong: light-dark(#cdd4de, #2e3846);
  --fv-text: light-dark(#0f1724, #e6eaf0);
  --fv-muted: light-dark(#5b6677, #8e99a9);
  --fv-faint: light-dark(#8a94a3, #5f6a7a);
  --fv-brand: light-dark(#1f4ed8, #6f95ff);
  --fv-brand-soft: light-dark(#ebf0ff, #152038);
  --fv-up: light-dark(#06753a, #3cc27a);
  --fv-down: light-dark(#c92a33, #ff6b6b);
  --fv-up-soft: light-dark(#e6f4ec, #10261b);
  --fv-down-soft: light-dark(#fcebec, #2c1517);
  --fv-warn: light-dark(#a66300, #f3b04b);
  --fv-warn-soft: light-dark(#fff5e3, #271e0f);
  --fv-shadow: light-dark(rgba(16, 24, 40, .06), rgba(0, 0, 0, .35));
  --fv-radius: 10px;
  --fv-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --fv-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --fv-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
[data-testid="stMainBlockContainer"] { max-width: 1240px; padding-top: 4.4rem; padding-bottom: 4rem; }

/* Streamlit décale les listes de st.html (padding-left: 2rem) : on annule pour nos listes « fv-… » */
.stApp ul[class^="fv-"], .stApp ol[class^="fv-"], .stApp dl[class^="fv-"] { padding-left: 0; margin-left: 0; }
ul[class^="fv-"] > li, ol[class^="fv-"] > li { margin-left: 0; padding-left: 0; }

/* =============================================================================================
   2. Barre d'application : logo, menu, compte
   ============================================================================================= */
header[data-testid="stHeader"] { background: var(--fv-surface); border-bottom: 1px solid var(--fv-line); }
[data-testid="stLogoLink"], div:has(> img.stLogo) { display: inline-flex; align-items: center; gap: .55rem;
  color: var(--fv-text) !important; text-decoration: none !important; }
[data-testid="stLogoLink"]::after, div:has(> img.stLogo)::after { content: "FinVeille"; font: 700 1.1rem/1 var(--fv-sans);
  letter-spacing: -.02em; white-space: nowrap; }
img.stLogo { height: 28px !important; width: 28px !important; max-width: none; }
[data-testid="stTopNavSection"], [data-testid="stTopNavLink"] { border-radius: 8px; }
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

/* =============================================================================================
   3. Composants Streamlit (boutons, champs, menus, onglets)
   ============================================================================================= */
.stApp button, .stApp input, .stApp textarea { font-family: var(--fv-sans); }
[data-testid="stBaseButton-secondary"], [data-testid="stBaseButton-secondaryFormSubmit"],
[data-testid="stPopoverButton"], [data-testid="stBaseLinkButton-secondary"] {
  background: var(--fv-surface); border-color: var(--fv-line-strong); box-shadow: 0 1px 2px var(--fv-shadow); }
[data-testid="stBaseButton-secondary"]:hover, [data-testid="stBaseButton-secondaryFormSubmit"]:hover,
[data-testid="stPopoverButton"]:hover, [data-testid="stBaseLinkButton-secondary"]:hover {
  border-color: var(--fv-brand); color: var(--fv-brand); }
[data-testid^="stBaseButton-primary"], [data-testid="stBaseLinkButton-primary"] { color: #fff !important;
  box-shadow: 0 1px 2px var(--fv-shadow); }
[data-testid^="stBaseButton-primary"] p, [data-testid="stBaseLinkButton-primary"] p { color: #fff !important; }
[data-testid="stBaseButton-tertiary"], [data-testid="stBaseLinkButton-tertiary"] { color: var(--fv-muted); }
[data-testid="stBaseButton-tertiary"]:hover, [data-testid="stBaseLinkButton-tertiary"]:hover { color: var(--fv-brand); }
[data-testid="stPopoverBody"] { border-radius: 12px; border-color: var(--fv-line); box-shadow: 0 12px 32px var(--fv-shadow); }
[data-testid="stExpander"] details { background: var(--fv-surface); border-color: var(--fv-line); border-radius: var(--fv-radius); }
[data-testid="stExpander"] summary:hover { color: var(--fv-brand); }
[data-testid="stForm"] { background: var(--fv-surface); border-color: var(--fv-line); border-radius: var(--fv-radius);
  box-shadow: 0 1px 2px var(--fv-shadow); }
[data-testid="stTextInputRootElement"], [data-testid="stNumberInputContainer"], [data-baseweb="select"] > div,
[data-testid="stDateInputField"] { border-radius: 8px !important; }
[data-testid="stBaseButton-pills"], [data-testid="stBaseButton-pillsActive"] { border-radius: 999px; }
[data-testid="stBaseButton-pills"] { background: var(--fv-surface); }
[data-testid="stBaseButton-pillsActive"] { background: var(--fv-brand-soft); border-color: var(--fv-brand);
  color: var(--fv-brand); }
[data-testid="stBaseButton-segmented_controlActive"] { background: var(--fv-brand-soft); color: var(--fv-brand); }
[data-testid="stBaseButton-segmented_control"] { background: var(--fv-surface); }
[data-testid="stSidebar"] { border-right: 1px solid var(--fv-line); }
[data-testid="stCaptionContainer"] { color: var(--fv-muted); }
[data-testid="stAlertContainer"] { border-radius: var(--fv-radius); }
[data-testid="stDataFrame"] { border-radius: var(--fv-radius); }

/* =============================================================================================
   4. Structure des pages : en-tête, sections, cartes
   ============================================================================================= */
.fv-pagehead { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: .8rem 2rem;
  padding-bottom: 1rem; border-bottom: 1px solid var(--fv-line); }
.fv-eyebrow { font-size: .72rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--fv-brand); }
.fv-page-title { margin: .2rem 0 0 !important; padding: 0 !important; font: 700 clamp(1.65rem, 3vw, 2.1rem)/1.15 var(--fv-sans) !important;
  letter-spacing: -.025em; color: var(--fv-text); }
.fv-page-dek { margin: .35rem 0 0; max-width: 72ch; color: var(--fv-muted); font-size: .97rem; line-height: 1.5; }

.fv-section { display: flex; flex-wrap: wrap; align-items: baseline; gap: .2rem .7rem; margin: 1.5rem 0 .15rem; }
.fv-section h3 { margin: 0 !important; padding: 0 !important; font: 600 1.06rem/1.3 var(--fv-sans) !important;
  letter-spacing: -.01em; color: var(--fv-text); }
.fv-section small { font-size: .8rem; color: var(--fv-muted); }

/* Une carte : en HTML (.fv-card) ou un st.container(key="fvpanel_…") (Streamlit ajoute la classe st-key-…) */
.fv-card, [class*="st-key-fvpanel_"], [class*="st-key-fvlead_"], [class*="st-key-fvbox_"], [class*="st-key-fvchart_"] {
  background: var(--fv-surface);
  border: 1px solid var(--fv-line); border-radius: var(--fv-radius); box-shadow: 0 1px 2px var(--fv-shadow); }
.fv-card { padding: 1rem 1.1rem; }
.fv-card + .fv-card { margin-top: .9rem; }
.fv-card-title { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin: 0 0 .7rem;
  font-size: .9rem; font-weight: 600; }
.fv-card-title small { font-weight: 400; font-size: .76rem; color: var(--fv-muted); }
[class*="st-key-fvpanel_"] { gap: 0 !important; padding: .2rem 0; overflow: hidden; }
[class*="st-key-fvbox_"] { padding: 1.3rem 1.4rem 1rem; margin-top: 1rem; }
[class*="st-key-fvchart_"] { padding: .9rem 1rem .5rem; gap: .4rem !important; }
[class*="st-key-fvset_"] { padding: 1.1rem 1.3rem 1.2rem; gap: .9rem !important; background: var(--fv-surface);
  border: 1px solid var(--fv-line); border-radius: var(--fv-radius); box-shadow: 0 1px 2px var(--fv-shadow); }
[class*="st-key-fvset_"] .fv-section { margin-top: 0; }
.fv-box-title { margin: 0 !important; padding: 0 !important; font: 600 1.15rem/1.3 var(--fv-sans) !important; }
.fv-box-text { margin: .35rem 0 0; color: var(--fv-muted); font-size: .9rem; line-height: 1.5; }
.fv-card > .fv-letter:first-child { margin-top: 0; }
.fv-firm.fv-card { padding: 1rem 1.1rem; }
.fv-note { font-size: .78rem; color: var(--fv-muted); line-height: 1.5; }

/* =============================================================================================
   5. Le fil : en-tête, rubriques, articles
   ============================================================================================= */
.fv-sessions { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0; padding: 0; list-style: none; }
.stApp .fv-sessions li { display: inline-flex; align-items: center; gap: .45rem; margin: 0; padding: .28rem .65rem;
  border: 1px solid var(--fv-line); border-radius: 999px; background: var(--fv-surface); font-size: .76rem;
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
.fv-headline { margin: .4rem 0 .25rem !important; padding: 0 !important; font-family: var(--fv-serif) !important;
  font-weight: 600 !important; font-size: 1.16rem !important; line-height: 1.3 !important; letter-spacing: -.003em; }
.fv-headline a { color: var(--fv-text) !important; text-decoration: none !important; }
.fv-headline a:hover, .fv-headline a:focus-visible { color: var(--fv-brand) !important; }
.fv-dek { margin: 0; color: var(--fv-muted); font-size: .9rem; line-height: 1.55;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fv-item.is-read .fv-headline a { color: var(--fv-muted) !important; font-weight: 500; }

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
[class*="st-key-fvcard_"], [class*="st-key-fvcompact_"] { padding: .85rem 1.15rem .35rem; border-bottom: 1px solid var(--fv-line); }
[class*="st-key-fvcard_"]:last-child, [class*="st-key-fvcompact_"]:last-child { border-bottom: 0; }
[class*="st-key-fvcard_"]:hover, [class*="st-key-fvcompact_"]:hover { background: var(--fv-sunken); }
[class*="st-key-fvcompact_"] { padding: .5rem 1.15rem .15rem; }
.fv-item.is-compact .fv-headline { font-size: 1rem !important; margin: .25rem 0 0 !important; }
[class*="st-key-fvcard_"] button, [class*="st-key-fvcard_"] a[data-testid="stBaseLinkButton-tertiary"],
[class*="st-key-fvcompact_"] button, [class*="st-key-fvcompact_"] a[data-testid="stBaseLinkButton-tertiary"],
[class*="st-key-fvlead_"] button, [class*="st-key-fvlead_"] a[data-testid="stBaseLinkButton-tertiary"] {
  min-height: 1.8rem; padding: .1rem .45rem; border-radius: 6px; }
[class*="st-key-fvcard_"] button:hover, [class*="st-key-fvcompact_"] button:hover, [class*="st-key-fvlead_"] button:hover,
[class*="st-key-fvcard_"] a[data-testid="stBaseLinkButton-tertiary"]:hover,
[class*="st-key-fvlead_"] a[data-testid="stBaseLinkButton-tertiary"]:hover { background: var(--fv-hover); }
[class*="st-key-fvcard_"] button p, [class*="st-key-fvcompact_"] button p, [class*="st-key-fvlead_"] button p,
[class*="st-key-fvcard_"] a p, [class*="st-key-fvcompact_"] a p, [class*="st-key-fvlead_"] a p { font-size: .8rem; }

/* La une : une carte plus grande, photo facultative */
[class*="st-key-fvlead_"] { padding: 1.2rem 1.35rem .6rem; }
.fv-lead .fv-headline { font-size: clamp(1.45rem, 2.6vw, 1.95rem) !important; line-height: 1.18 !important;
  letter-spacing: -.012em; margin-top: .55rem !important; }
.fv-lead .fv-dek { font-size: 1rem; -webkit-line-clamp: 4; }
.fv-lead.has-img { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1.4rem; align-items: start; }
.fv-lead figure { margin: 0; }
.fv-lead figure img { display: block; width: 100%; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 8px; }
@media (max-width: 760px) { .fv-lead.has-img { grid-template-columns: 1fr; } .fv-lead figure { order: -1; } }

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
.fv-tape { display: flex; align-items: stretch; margin: -.6rem 0 1.1rem; overflow: hidden; background: var(--fv-surface);
  border: 1px solid var(--fv-line); border-radius: var(--fv-radius); font-size: .78rem; }
.fv-tape-label { display: flex; align-items: center; gap: .45rem; padding: 0 .85rem; border-right: 1px solid var(--fv-line);
  font-size: .68rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--fv-muted); white-space: nowrap; }
.fv-tape-label::before { content: ""; width: .45rem; height: .45rem; border-radius: 50%; background: var(--fv-brand); }
.fv-tape-window { flex: 1; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 3%, #000 97%, transparent); }
.fv-tape-track { display: inline-flex; white-space: nowrap; padding: .5rem 0; animation: fv-tape 110s linear infinite; }
.fv-tape:hover .fv-tape-track { animation-play-state: paused; }
.fv-tick { padding: 0 1.1rem; border-right: 1px solid var(--fv-line); font-family: var(--fv-mono); font-size: .76rem; }
.fv-tick b { margin-right: .5rem; font-family: var(--fv-sans); font-weight: 600; font-size: .78rem; }
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
.fv-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: .7rem; }
.fv-tile { display: grid; grid-template-columns: 1fr 84px; align-items: end; gap: .15rem .6rem;
  grid-template-areas: "label label" "value spark" "delta spark" "sub sub";
  padding: .8rem .9rem .75rem; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--fv-radius); box-shadow: 0 1px 2px var(--fv-shadow); transition: border-color .15s; }
.fv-tile:hover { border-color: var(--fv-line-strong); }
.fv-tile-label { grid-area: label; font-size: .8rem; font-weight: 600; color: var(--fv-text); }
.fv-tile-value { grid-area: value; font-family: var(--fv-mono); font-size: 1.25rem; font-weight: 500; letter-spacing: -.02em;
  line-height: 1.2; }
.fv-tile-delta { grid-area: delta; font-size: .8rem; font-weight: 500; }
.fv-tile img { grid-area: spark; width: 84px; height: 30px; }
.fv-tile-sub { grid-area: sub; margin-top: .25rem; padding-top: .35rem; border-top: 1px solid var(--fv-line);
  font-size: .72rem; color: var(--fv-muted); }

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
  background: linear-gradient(90deg, color-mix(in srgb, #e5484d 62%, var(--fv-surface)), var(--fv-surface),
  color-mix(in srgb, #1e9e4f 62%, var(--fv-surface))); border: 1px solid var(--fv-line); }
@media (max-width: 640px) { .fv-heat { grid-template-columns: 1fr; } .fv-heat-label { padding-top: .4rem; } }

/* =============================================================================================
   7. Chiffres clés, listes, tonalité, tableaux
   ============================================================================================= */
.fv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .7rem; margin-top: .3rem; }
.fv-kpi { padding: .9rem 1rem .85rem; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--fv-radius); box-shadow: 0 1px 2px var(--fv-shadow); min-width: 0; }
.fv-kpi-label { font-size: .78rem; font-weight: 500; color: var(--fv-muted); }
.fv-kpi-value { margin-top: .3rem; font-size: 1.55rem; font-weight: 600; letter-spacing: -.02em; line-height: 1.15;
  font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fv-kpi-sub { margin-top: .25rem; font-size: .76rem; color: var(--fv-muted); }
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
.fv-tone .fv-axis i.pos { left: 50%; background: #1e9e4f; border-radius: 0 4px 4px 0; }
.fv-tone .fv-axis i.neg { right: 50%; background: #e5484d; border-radius: 4px 0 0 4px; }
.fv-tone small { display: block; margin-top: .2rem; color: var(--fv-muted); font-size: .7rem; }

.fv-table-wrap { overflow-x: auto; background: var(--fv-surface); border: 1px solid var(--fv-line);
  border-radius: var(--fv-radius); box-shadow: 0 1px 2px var(--fv-shadow); }
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
  background: linear-gradient(90deg, #e5484d, #c98500 30%, #8c96a5 50%, #74b98b 70%, #1e9e4f); }
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
.fv-firm img { width: 48px; height: 48px; border-radius: 12px; background: #fff; padding: 6px;
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
  background: linear-gradient(90deg, color-mix(in srgb, #e5484d 45%, var(--fv-surface)), var(--fv-hover),
  color-mix(in srgb, #1e9e4f 45%, var(--fv-surface))); }
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
  border-left: 4px solid var(--fv-brand); border-radius: var(--fv-radius); box-shadow: 0 1px 2px var(--fv-shadow); }
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

@media (prefers-reduced-motion: reduce) {
  .fv-tape-window { overflow-x: auto; mask-image: none; }
  .fv-tape-track { animation: none; }
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


def feed_header(article_count: int, source_count: int, fetched_at: datetime) -> None:
    """L'en-tête du fil : date, titre, volume collecté et état des places boursières."""
    now = datetime.now(timezone.utc)
    st.html(
        f"""
        <header class="fv-pagehead">
          <div>
            <div class="fv-eyebrow">{fr_date(now.astimezone(DISPLAY_TZ)).capitalize()} · édition continue</div>
            <h1 class="fv-page-title">Le fil de l'actualité financière</h1>
            <p class="fv-page-dek">{fr_number(article_count, 0)} dépêches de {source_count} sources · dernière
              collecte à {clock(fetched_at)}</p>
          </div>
          {sessions_html(now)}
        </header>
        """
    )


def section(title: str, note: str = "") -> None:
    """Titre de section, avec une précision facultative en gris."""
    st.html(f'<div class="fv-section"><h3>{esc(title)}</h3>{f"<small>{esc(note)}</small>" if note else ""}</div>')


def page_header(title: str, dek: str, eyebrow: str = "") -> None:
    """En-tête de page : rubrique du menu (en bleu), titre et phrase d'introduction."""
    st.html(
        f'<header class="fv-pagehead"><div>{f"<div class={chr(34)}fv-eyebrow{chr(34)}>{esc(eyebrow)}</div>" if eyebrow else ""}'
        f'<h1 class="fv-page-title">{esc(title)}</h1><p class="fv-page-dek">{esc(dek)}</p></div></header>'
    )


def card(body: str, title: str = "", note: str = "") -> str:
    """HTML d'une carte (fond blanc en clair, bleu nuit en sombre), avec un titre facultatif."""
    head = f'<h4 class="fv-card-title">{esc(title)}<small>{esc(note)}</small></h4>' if title else ""
    return f'<section class="fv-card">{head}{body}</section>'


def table(head: list[str], rows: str) -> str:
    """HTML d'un tableau dans sa carte ; défile horizontalement sur un petit écran."""
    header = "".join(f"<th>{cell}</th>" for cell in head)
    return f'<div class="fv-table-wrap"><table class="fv-table"><thead><tr>{header}</tr></thead><tbody>{rows}</tbody></table></div>'


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
    """Applique la mise en forme française à un graphique Altair (à appeler juste avant st.altair_chart)."""
    return chart.configure(locale=ALTAIR_LOCALE)


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
    return (
        f'<div class="fv-tile" title="{esc(summary)}">'
        f'<div class="fv-tile-label">{esc(quote.name)}</div>'
        f'<div class="fv-tile-value">{price(quote.last)}</div>'
        f'<img src="{sparkline_uri(month.tolist(), direction(month_change))}" '
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
