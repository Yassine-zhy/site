"""L'identité visuelle de FinVeille : un quotidien financier transposé à l'écran.

Principes :
- l'encre (noir sur papier, crème sur ardoise) est la couleur de marque ;
- la couleur est réservée aux données : catégories, hausse et baisse ;
- titres en Newsreader (police à empattements pensée pour la presse), interface en IBM Plex Sans,
  chiffres alignés en IBM Plex Mono.

Toutes les couleurs ci-dessous fonctionnent sur le fond clair ET sur le fond sombre : quand
l'utilisateur change de thème, Streamlit ne relance pas le script, donc on ne peut pas choisir
les couleurs en Python selon le thème. Les gris, eux, sont calculés en CSS à partir de la
couleur du texte (`color-mix(... currentColor ...)`) et s'adaptent donc tout seuls.
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
UP = "#008300"  # hausse : toujours avec ▲ et le signe +
DOWN = "#e34948"  # baisse : toujours avec ▼ et le signe −
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
/* ---------- Jetons de design ---------- */
.stApp {
  --fv-serif: "Newsreader", Georgia, "Times New Roman", serif;
  --fv-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --fv-up: #008300;
  --fv-down: #e34948;
  /* Gris dérivés de la couleur du texte : ils suivent automatiquement le thème clair/sombre */
  --fv-muted: color-mix(in srgb, currentColor 66%, transparent);
  --fv-rule: color-mix(in srgb, currentColor 15%, transparent);
  --fv-rule-strong: color-mix(in srgb, currentColor 70%, transparent);
  --fv-tint: color-mix(in srgb, currentColor 5%, transparent);
}
[data-testid="stMainBlockContainer"] { max-width: 1200px; padding-top: 4.2rem; }

/* ---------- Bandeau de titre (le « masthead » d'un journal) ---------- */
.fv-mast { border-bottom: 4px double var(--fv-rule-strong); padding-bottom: .8rem; }
.fv-dateline { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 1.2rem;
  padding-bottom: .55rem; border-bottom: 1px solid var(--fv-rule); font-size: .78rem; }
.fv-dateline strong { font-weight: 600; }
.fv-dateline .fv-edition { color: var(--fv-muted); }
.fv-clocks { display: flex; flex-wrap: wrap; gap: .2rem 1rem; margin: 0 0 0 auto; padding: 0; list-style: none;
  font-family: var(--fv-mono); font-size: .72rem; }
.fv-clocks li { margin: 0; white-space: nowrap; color: var(--fv-muted); }
.fv-clocks li::before { content: ""; display: inline-block; width: .5rem; height: .5rem; margin-right: .35rem;
  border: 1.5px solid currentColor; border-radius: 50%; vertical-align: -.02rem; }
.fv-clocks li.is-open { color: inherit; }
.fv-clocks li.is-open::before { background: currentColor; }
.fv-brand { display: flex; align-items: center; gap: .8rem; margin-top: .9rem; }
.fv-wordmark { font-family: var(--fv-serif); font-weight: 700; font-size: clamp(2.4rem, 6vw, 3.8rem);
  line-height: .95; letter-spacing: -.025em; }
.fv-tagline { margin: .45rem 0 0; font-family: var(--fv-serif); font-style: italic; font-size: 1.05rem;
  color: var(--fv-muted); }

/* Le logo : trois chandeliers boursiers dessinés en CSS (corps + mèche) */
.fv-mark { display: inline-flex; align-items: center; gap: 4px; height: 2.6rem; }
.fv-mark i { position: relative; display: block; width: 8px; background: currentColor; border-radius: 1px; }
.fv-mark i::before { content: ""; position: absolute; left: 3.5px; width: 1px; background: currentColor; }
.fv-mark i:nth-child(1) { height: 40%; transform: translateY(18%); }
.fv-mark i:nth-child(1)::before { top: -35%; bottom: -30%; }
.fv-mark i:nth-child(2) { height: 30%; transform: translateY(-5%); background: transparent;
  box-shadow: inset 0 0 0 1.5px currentColor; }
.fv-mark i:nth-child(2)::before { top: -55%; bottom: 100%; height: 55%; }
.fv-mark i:nth-child(3) { height: 62%; transform: translateY(-18%); }
.fv-mark i:nth-child(3)::before { top: -22%; bottom: -14%; }

/* ---------- Titres de rubrique ---------- */
.fv-section { display: flex; align-items: baseline; gap: .8rem; margin: 1.2rem 0 .1rem;
  font-size: .72rem; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
.fv-section::after { content: ""; flex: 1; border-top: 1px solid var(--fv-rule-strong); transform: translateY(-.25em); }
.fv-section small { font-size: .74rem; font-weight: 400; letter-spacing: .01em; text-transform: none;
  color: var(--fv-muted); }
.fv-page-title { margin: .2rem 0 0; font-family: var(--fv-serif); font-weight: 700;
  font-size: clamp(2rem, 4vw, 2.8rem); letter-spacing: -.02em; line-height: 1.05; }
.fv-page-dek { margin: .35rem 0 .2rem; color: var(--fv-muted); font-family: var(--fv-serif); font-style: italic;
  font-size: 1.05rem; }

/* ---------- Articles ---------- */
.fv-kicker { display: flex; flex-wrap: wrap; align-items: center; gap: .25rem .9rem; font-size: .76rem; }
.fv-kicker .fv-src, .fv-kicker .fv-time, .fv-kicker .fv-ago { color: var(--fv-muted); }
.fv-cat { display: inline-flex; align-items: center; gap: .4rem; color: inherit; font-size: .68rem;
  font-weight: 600; letter-spacing: .11em; text-transform: uppercase; }
.fv-cat::before { content: ""; width: .62rem; height: .62rem; border-radius: 2px; background: var(--c); }
.fv-src { display: inline-flex; align-items: center; gap: .35rem; }
.fv-src img { width: 14px; height: 14px; border-radius: 3px; }
.fv-time { font-family: var(--fv-mono); font-size: .72rem; }
.fv-flag { font-size: .66rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  padding: .05rem .35rem; border: 1px solid var(--fv-rule-strong); border-radius: 2px; }
.fv-headline { margin: .35rem 0 .3rem !important; padding: 0 !important; font-family: var(--fv-serif) !important;
  font-weight: 600 !important; font-size: 1.3rem !important; line-height: 1.22 !important; letter-spacing: -.005em; }
.fv-headline a { color: inherit !important; text-decoration: none !important;
  background: linear-gradient(currentColor, currentColor) no-repeat 0 100% / 0 1px; transition: background-size .2s; }
.fv-headline a:hover, .fv-headline a:focus-visible { background-size: 100% 1px; }
.fv-dek { margin: 0; color: var(--fv-muted); font-size: .93rem; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.fv-item.is-read .fv-headline { color: var(--fv-muted); font-weight: 500 !important; }
.fv-lead .fv-headline { font-size: clamp(1.65rem, 3.2vw, 2.35rem) !important; line-height: 1.1 !important;
  letter-spacing: -.015em; }
.fv-lead .fv-dek { font-size: 1.02rem; -webkit-line-clamp: 4; }
.fv-lead.has-img { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.4rem;
  align-items: start; }
.fv-lead figure { margin: 0; }
.fv-lead figure img { display: block; width: 100%; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 2px; }
@media (max-width: 760px) { .fv-lead.has-img { grid-template-columns: 1fr; } .fv-lead figure { order: -1; } }

/* Chaque carte est un st.container(key="fvcard_…") : Streamlit lui ajoute la classe CSS st-key-fvcard_… */
[class*="st-key-fvcard_"] { padding: .55rem 0 .35rem; border-bottom: 1px solid var(--fv-rule); }
[class*="st-key-fvcard_"] button { min-height: 1.9rem; }
[class*="st-key-fvlead_"] { padding-bottom: .9rem; border-bottom: 1px solid var(--fv-rule-strong); }

/* ---------- Colonne de droite ---------- */
.fv-rail-title { margin: 0 0 .5rem; font-size: .72rem; font-weight: 600; letter-spacing: .14em;
  text-transform: uppercase; padding-bottom: .35rem; border-bottom: 1px solid var(--fv-rule-strong); }
.fv-bars { list-style: none; margin: 0; padding: 0; display: grid; gap: .45rem; }
.fv-bars li { display: grid; grid-template-columns: 6.6rem 1fr 2.4rem; align-items: center; gap: .6rem;
  margin: 0; font-size: .82rem; }
.fv-bars .fv-track { height: 8px; }
.fv-bars .fv-track i { display: block; height: 100%; min-width: 2px; border-radius: 0 4px 4px 0; background: var(--c); }
.fv-bars .fv-num { text-align: right; font-variant-numeric: tabular-nums; }
.fv-sources { list-style: none; margin: 0; padding: 0; }
.fv-sources li { display: flex; align-items: center; gap: .5rem; margin: 0; padding: .32rem 0;
  border-bottom: 1px solid var(--fv-rule); font-size: .84rem; }
.fv-sources li img { width: 14px; height: 14px; border-radius: 3px; }
.fv-sources li span:last-child { margin-left: auto; color: var(--fv-muted); font-variant-numeric: tabular-nums; }
.fv-note { font-size: .78rem; color: var(--fv-muted); line-height: 1.45; }

@media (prefers-reduced-motion: reduce) { .fv-headline a { transition: none; } }

/* ---------- Bandeau défilant des cours ---------- */
.fv-tape { overflow: hidden; margin: -1.2rem 0 1.1rem; border-block: 1px solid var(--fv-rule);
  font-family: var(--fv-mono); font-size: .76rem;
  mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
.fv-tape-track { display: inline-flex; white-space: nowrap; padding: .42rem 0; animation: fv-tape 110s linear infinite; }
.fv-tape:hover .fv-tape-track { animation-play-state: paused; }
.fv-tick { padding-right: 2.4rem; }
.fv-tick b { font-family: "IBM Plex Sans", sans-serif; font-weight: 600; margin-right: .45rem; }
@keyframes fv-tape { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* Hausse / baisse : la flèche porte la couleur, le chiffre reste à l'encre */
.fv-up::before, .fv-down::before, .fv-flat::before { display: inline-block; margin-right: .25rem; font-size: .8em; }
.fv-up::before { content: "▲"; color: var(--fv-up); }
.fv-down::before { content: "▼"; color: var(--fv-down); }
.fv-flat::before { content: "■"; color: var(--fv-muted); font-size: .6em; vertical-align: .12em; }

/* ---------- Tuiles de cotation ---------- */
.fv-group { margin: .9rem 0 .35rem; font-size: .78rem; font-weight: 600; color: var(--fv-muted); }
.fv-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 0 1.4rem; }
.fv-tile { display: grid; grid-template-columns: 1fr 84px; align-items: end; gap: .1rem .6rem;
  grid-template-areas: "label label" "value spark" "delta spark" "sub sub";
  padding: .6rem 0 .7rem; border-top: 1px solid var(--fv-rule-strong); }
.fv-tile-label { grid-area: label; font-size: .8rem; font-weight: 600; }
.fv-tile-value { grid-area: value; font-size: 1.38rem; font-weight: 600; letter-spacing: -.01em; line-height: 1.15; }
.fv-tile-delta { grid-area: delta; font-size: .82rem; font-variant-numeric: tabular-nums; }
.fv-tile img { grid-area: spark; width: 84px; height: 30px; }
.fv-tile-sub { grid-area: sub; font-size: .72rem; color: var(--fv-muted); }

/* ---------- Carte des performances ---------- */
.fv-heat { display: grid; grid-template-columns: 9.5rem 1fr; gap: 3px 1rem; align-items: stretch; }
.fv-heat-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 3px; }
.fv-heat-label { font-size: .78rem; font-weight: 600; padding-top: .55rem; }
.fv-cell { padding: .5rem .6rem; border-radius: 2px; font-size: .78rem; line-height: 1.3;
  background: color-mix(in srgb, var(--c) var(--a), transparent); }
.fv-cell b { display: block; font-weight: 600; }
.fv-cell span { font-family: var(--fv-mono); font-size: .76rem; }
.fv-heat-legend { display: flex; align-items: center; gap: .6rem; margin-top: .7rem; font-size: .74rem; color: var(--fv-muted); }
.fv-heat-legend i { width: 140px; height: 8px; border-radius: 2px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--fv-down) 62%, transparent),
  color-mix(in srgb, currentColor 6%, transparent), color-mix(in srgb, var(--fv-up) 62%, transparent)); }
@media (max-width: 640px) { .fv-heat { grid-template-columns: 1fr; } .fv-heat-label { padding-top: .4rem; } }

/* ---------- Chiffres clés, barres, tonalité ---------- */
.fv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0 1.4rem; }
.fv-kpi { padding: .6rem 0 .8rem; border-top: 1px solid var(--fv-rule-strong); }
.fv-kpi-label { font-size: .8rem; font-weight: 600; }
.fv-kpi-value { margin-top: .15rem; font-size: 1.9rem; font-weight: 600; letter-spacing: -.015em; line-height: 1.1; }
.fv-kpi-sub { margin-top: .15rem; font-size: .76rem; color: var(--fv-muted); }
.fv-chart-title { display: flex; align-items: baseline; justify-content: space-between; margin: .4rem 0 -.2rem;
  font-size: .8rem; }
.fv-chart-title small { color: var(--fv-muted); font-variant-numeric: tabular-nums; }
.fv-list { list-style: none; margin: 0; padding: 0; }
.fv-list li { display: grid; grid-template-columns: 16px 9.5rem 1fr 2rem; align-items: center; gap: .6rem;
  margin: 0; padding: .34rem 0; border-bottom: 1px solid var(--fv-rule); font-size: .84rem; }
.fv-list li img { width: 16px; height: 16px; border-radius: 3px; }
.fv-list .fv-track i { display: block; height: 8px; min-width: 2px; border-radius: 0 4px 4px 0; background: var(--fv-muted); }
.fv-list .fv-num { text-align: right; font-variant-numeric: tabular-nums; }
.fv-list small { color: var(--fv-muted); font-family: var(--fv-mono); font-size: .7rem; margin-left: .3rem; }
.fv-tone { list-style: none; margin: 0; padding: 0; }
.fv-tone li { display: grid; grid-template-columns: 7.5rem 1fr 3.4rem; align-items: center; gap: .7rem; margin: 0;
  padding: .45rem 0; border-bottom: 1px solid var(--fv-rule); font-size: .82rem; }
.fv-tone .fv-axis { position: relative; height: 10px; }
.fv-tone .fv-axis::before { content: ""; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px;
  background: var(--fv-rule-strong); }
.fv-tone .fv-axis i { position: absolute; top: 1px; height: 8px; }
.fv-tone .fv-axis i.pos { left: 50%; background: var(--fv-up); border-radius: 0 4px 4px 0; }
.fv-tone .fv-axis i.neg { right: 50%; background: var(--fv-down); border-radius: 4px 0 0 4px; }
.fv-tone .fv-num { text-align: right; font-variant-numeric: tabular-nums; }
.fv-tone small { display: block; color: var(--fv-muted); font-size: .7rem; }


/* ---------- Fiche entreprise ---------- */
.fv-firm { display: flex; align-items: center; gap: .9rem; margin: .4rem 0 .2rem; }
.fv-firm img { width: 44px; height: 44px; border-radius: 8px; background: #fff; padding: 4px;
  box-shadow: inset 0 0 0 1px var(--fv-rule); }
.fv-firm h2 { margin: 0 !important; padding: 0 !important; font-family: var(--fv-serif) !important; font-weight: 700 !important;
  font-size: clamp(1.6rem, 3vw, 2.2rem) !important; letter-spacing: -.015em; line-height: 1.1 !important; }
.fv-firm p { margin: .15rem 0 0; font-size: .8rem; color: var(--fv-muted); }
.fv-quote-big { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 1rem; margin: .6rem 0 .2rem; }
.fv-quote-big b { font-size: 2.2rem; font-weight: 600; letter-spacing: -.02em; }
.fv-quote-big span { font-size: .95rem; font-variant-numeric: tabular-nums; }
.fv-quote-big small { font-size: .78rem; color: var(--fv-muted); }
.fv-ratios { margin: 0; display: grid; grid-template-columns: 1fr auto; }
.fv-ratios dt, .fv-ratios dd { margin: 0; padding: .42rem 0; border-bottom: 1px solid var(--fv-rule); font-size: .85rem; }
.fv-ratios dt { cursor: help; text-decoration: underline dotted color-mix(in srgb, currentColor 35%, transparent);
  text-underline-offset: 3px; }
.fv-ratios dd { text-align: right; font-variant-numeric: tabular-nums; font-weight: 500; }
.fv-range { margin: .9rem 0 .2rem; font-size: .78rem; }
.fv-range-bar { position: relative; height: 6px; margin: .45rem 0 .3rem; border-radius: 3px;
  background: color-mix(in srgb, currentColor 14%, transparent); }
.fv-range-bar i { position: absolute; top: -4px; width: 3px; height: 14px; margin-left: -1.5px; border-radius: 1px;
  background: currentColor; }
.fv-range-ends { display: flex; justify-content: space-between; color: var(--fv-muted); font-variant-numeric: tabular-nums; }

/* ---------- Résumé (« L'essentiel ») ---------- */
.fv-brief { margin: .5rem 0 .2rem; padding: .7rem .95rem .6rem; border-left: 2px solid currentColor;
  background: var(--fv-tint); border-radius: 0 3px 3px 0; }
.fv-brief-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .2rem 1rem; margin-bottom: .35rem;
  font-size: .7rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
.fv-brief-head small { font-size: .72rem; font-weight: 400; letter-spacing: 0; text-transform: none; color: var(--fv-muted); }
.fv-brief ul { margin: 0; padding-left: 1.1rem; }
.fv-brief li { margin: .2rem 0; font-size: .92rem; line-height: 1.45; }
.fv-brief-why { margin: .45rem 0 0; font-size: .9rem; line-height: 1.45; }
.fv-brief-note { margin: .45rem 0 0; font-size: .72rem; color: var(--fv-muted); }

/* ---------- Vue compacte, notes, glossaire ---------- */
[class*="st-key-fvcompact_"] { padding: .35rem 0 .15rem; border-bottom: 1px solid var(--fv-rule); }
[class*="st-key-fvcompact_"] button { min-height: 1.6rem; }
.fv-item.is-compact .fv-headline { font-size: 1.05rem !important; margin: .2rem 0 0 !important; }
.fv-note-block { margin: .4rem 0 .1rem; padding: .45rem .8rem; border-left: 2px solid var(--fv-rule-strong);
  font-family: var(--fv-serif); font-style: italic; font-size: .98rem; }
.fv-note-block b { display: block; font-family: "IBM Plex Sans", sans-serif; font-style: normal; font-size: .66rem;
  font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--fv-muted); margin-bottom: .1rem; }
.fv-word { margin: .5rem 0 .4rem; padding: 1rem 1.2rem; border: 1px solid var(--fv-rule-strong); border-radius: 3px; }
.fv-word small { font-size: .68rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
.fv-word h3 { margin: .25rem 0 .3rem !important; padding: 0 !important; font-family: var(--fv-serif) !important;
  font-size: 1.7rem !important; font-weight: 700 !important; }
.fv-word p { margin: 0; font-size: 1rem; line-height: 1.5; }
.fv-letter { margin: 1.3rem 0 .2rem; font-family: var(--fv-serif); font-size: 1.6rem; font-weight: 700; line-height: 1;
  border-bottom: 1px solid var(--fv-rule-strong); padding-bottom: .25rem; }
.fv-gloss { margin: 0; }
.fv-gloss dt { margin-top: .7rem; font-weight: 600; font-size: .95rem; }
.fv-gloss dt small { margin-left: .5rem; font-weight: 400; font-size: .72rem; color: var(--fv-muted); }
.fv-gloss dd { margin: .15rem 0 0; color: var(--fv-muted); font-size: .92rem; line-height: 1.5; }

/* ---------- Tableaux, palmarès, convertisseur, agenda ---------- */
.fv-table { width: 100%; border-collapse: collapse; font-size: .86rem; }
.fv-table th { text-align: right; font-weight: 600; font-size: .74rem; letter-spacing: .04em; padding: .45rem .5rem;
  border-bottom: 1px solid var(--fv-rule-strong); }
.fv-table th:first-child, .fv-table td:first-child { text-align: left; }
.fv-table td { text-align: right; padding: .45rem .5rem; border-bottom: 1px solid var(--fv-rule);
  font-variant-numeric: tabular-nums; }
.fv-table td:first-child { font-weight: 600; }
.fv-table .fv-swatch { display: inline-block; width: 14px; height: 3px; margin-right: .45rem; vertical-align: middle;
  border-radius: 2px; background: var(--c); }
.fv-ranking { list-style: none; margin: 0; padding: 0; }
.fv-ranking li { display: flex; justify-content: space-between; gap: 1rem; margin: 0; padding: .38rem 0;
  border-bottom: 1px solid var(--fv-rule); font-size: .86rem; }
.fv-ranking li span:last-child { font-variant-numeric: tabular-nums; }
.fv-breadth { display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px; margin: .4rem 0 .3rem; }
.fv-breadth i { display: block; }
.fv-convert { margin: .3rem 0 .6rem; font-size: 2rem; font-weight: 600; letter-spacing: -.015em; }
.fv-convert small { display: block; font-size: .8rem; font-weight: 400; color: var(--fv-muted); letter-spacing: 0; }
.fv-agenda { list-style: none; margin: .2rem 0 0; padding: 0; }
.fv-agenda li { display: flex; justify-content: space-between; gap: 1rem; margin: 0; padding: .4rem 0;
  border-bottom: 1px solid var(--fv-rule); font-size: .85rem; }
.fv-agenda li span:last-child { text-align: right; font-weight: 500; }
.fv-agenda small { display: block; font-weight: 400; color: var(--fv-muted); font-size: .72rem; }

/* ---------- Portefeuille et alertes ---------- */
.fv-alert-banner { display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem 1rem; margin: -.4rem 0 1rem;
  padding: .55rem .9rem; border: 1px solid var(--fv-rule-strong); border-left: 4px solid currentColor;
  border-radius: 2px; font-size: .86rem; }
.fv-alert-banner b { font-size: .68rem; letter-spacing: .14em; text-transform: uppercase; }
.fv-alert-banner a { margin-left: auto; color: inherit !important; font-size: .8rem; }
.fv-status { display: inline-flex; align-items: center; gap: .4rem; font-size: .78rem; font-weight: 600; }
.fv-status::before { content: ""; width: .55rem; height: .55rem; border-radius: 50%; border: 1.5px solid currentColor; }
.fv-status.is-on::before { background: currentColor; }
.fv-status.is-off { color: var(--fv-muted); font-weight: 400; }
[class*="st-key-fvalert_"] { padding: .35rem 0; border-bottom: 1px solid var(--fv-rule); }
.fv-alert-row { display: grid; grid-template-columns: 7.5rem 1fr auto; gap: .2rem 1rem; align-items: baseline; font-size: .9rem; }
.fv-alert-row small { color: var(--fv-muted); font-size: .78rem; }
@media (max-width: 640px) { .fv-alert-row { grid-template-columns: 1fr; } }

@media (prefers-reduced-motion: reduce) {
  .fv-tape { overflow-x: auto; mask-image: none; }
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
    return text.replace(",", " ").replace(".", ",")


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


def masthead(article_count: int, source_count: int, fetched_at: datetime) -> None:
    """Le bandeau de titre : date, horloges des places boursières, nom du journal."""
    now = datetime.now(timezone.utc)
    clocks = "".join(
        f'<li class="{"is-open" if is_open else ""}" title="{city} : séance {"ouverte" if is_open else "fermée"}">'
        f'{city} {hour} · {"ouverte" if is_open else "fermée"}</li>'
        for city, hour, is_open in exchange_status(now)
    )
    st.html(
        f"""
        <header class="fv-mast">
          <div class="fv-dateline">
            <span><strong>{fr_date(now.astimezone(DISPLAY_TZ)).capitalize()}</strong></span>
            <span class="fv-edition">Édition continue · collecte de {clock(fetched_at)}</span>
            <ul class="fv-clocks" aria-label="Places boursières">{clocks}</ul>
          </div>
          <div class="fv-brand">
            <span class="fv-mark" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="fv-wordmark">FinVeille</span>
          </div>
          <p class="fv-tagline">La veille financière et économique mondiale —
            {article_count} dépêches de {source_count} sources.</p>
        </header>
        """
    )


def section(title: str, note: str = "") -> None:
    """Titre de rubrique en petites capitales, suivi d'un filet."""
    st.html(f'<div class="fv-section">{esc(title)}{f" <small>{esc(note)}</small>" if note else ""}</div>')


def page_header(title: str, dek: str) -> None:
    """Titre de page (pages autres que le fil) avec une ligne d'introduction."""
    st.html(f'<h1 class="fv-page-title">{esc(title)}</h1><p class="fv-page-dek">{esc(dek)}</p>')


def category_tag(key: str, label: str) -> str:
    """HTML d'une étiquette de catégorie : un carré de couleur + le nom (jamais la couleur seule)."""
    return f'<span class="fv-cat" style="--c:{CATEGORY_COLORS.get(key, "#8a8780")}">{esc(label)}</span>'


# --- Données de marché ------------------------------------------------------------------------

TAPE_SECONDS = 110  # durée d'un tour complet du bandeau (doit correspondre au CSS)


def signed(value: float, unit: str = "%", decimals: int = 2) -> str:
    """« +0,95 % », « −1,20 % », « +3,0 pb » (vrai signe moins typographique)."""
    if unit == "pb":
        decimals = 1
    sign = "+" if value > 0 else "\u2212" if value < 0 else ""
    return f"{sign}{fr_number(abs(value), decimals)}\u202f{unit}"


def direction(value: float, threshold: float = 0.005) -> str:
    """Classe CSS de direction : fv-up (▲), fv-down (▼) ou fv-flat (■)."""
    return "fv-up" if value > threshold else "fv-down" if value < -threshold else "fv-flat"


def price(value: float) -> str:
    """Cours avec un nombre de décimales adapté à sa grandeur (4 pour une devise, 0 au-delà de 10 000)."""
    decimals = 4 if value < 10 else 2 if value < 10_000 else 0
    return fr_number(value, decimals)


def sparkline_uri(values: list[float], end_class: str, width: int = 84, height: int = 30) -> str:
    """Mini-courbe en SVG, encodée comme une image (st.html n'accepte pas le SVG intégré).

    Ligne grise neutre ; seul le dernier point porte la couleur de la direction.
    """
    values = [float(v) for v in values]
    low, high = min(values), max(values)
    span = (high - low) or 1
    step = (width - 8) / max(len(values) - 1, 1)
    points = [(4 + i * step, height - 4 - (v - low) / span * (height - 8)) for i, v in enumerate(values)]
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    end_x, end_y = points[-1]
    end_color = {"fv-up": UP, "fv-down": DOWN}.get(end_class, "#8a8780")
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<polyline points="{path}" fill="none" stroke="#8a8780" stroke-width="1.6" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        f'<circle cx="{end_x:.1f}" cy="{end_y:.1f}" r="3.2" fill="{end_color}"/></svg>'
    )
    return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()


def quote_tile(quote) -> str:
    """Une tuile de cotation : nom, cours, variation de la séance, mini-courbe sur un mois."""
    month = quote.history.tail(22)
    month_change = quote.change_over(21)
    kind = direction(quote.change)
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
        f'<div class="fv-tile-delta"><span class="{kind}">{signed(quote.change, quote.unit)}</span></div>'
        f'<div class="fv-tile-sub">Sur un mois : {signed(month_change, quote.unit)}</div>'
        f"</div>"
    )


def ticker_tape(quotes) -> None:
    """Le bandeau défilant des cours, en haut de chaque page."""
    if not quotes:
        return
    items = "".join(
        f'<span class="fv-tick"><b>{esc(q.name)}</b>{price(q.last)} '
        f'<span class="{direction(q.change)}">{signed(q.change, q.unit)}</span></span>'
        for q in quotes
    )
    # Le contenu est répété deux fois : en décalant de 50 %, la boucle est invisible.
    # Le délai négatif, calé sur l'horloge, évite que le bandeau reparte du début à chaque rafraîchissement.
    delay = -(clock_module.time() % TAPE_SECONDS)
    st.html(
        f'<div class="fv-tape" role="marquee" aria-label="Cours des marchés">'
        f'<div class="fv-tape-track" style="animation-delay:{delay:.1f}s">{items}{items}</div></div>'
    )


def compact_money(value: float, currency: str = "") -> str:
    """« 187,3 Md€ », « 4,9 Md$ » : montants en milliards ou millions, à la française."""
    symbol = {"EUR": "€", "USD": "$", "GBP": "£", "JPY": "¥"}.get(currency, f" {currency}" if currency else "")
    if abs(value) >= 1e9:
        return f"{fr_number(value / 1e9, 1)}\u202fMd{symbol}"
    if abs(value) >= 1e6:
        return f"{fr_number(value / 1e6, 1)}\u202fM{symbol}"
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
