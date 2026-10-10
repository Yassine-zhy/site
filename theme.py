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

import html
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
