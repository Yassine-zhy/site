"""Page « À propos » : le projet, son auteur et ce qu'il y a sous le capot."""

from pathlib import Path

import streamlit as st

import theme
from core.config import RSS_FEEDS
from core.glossary import GLOSSARY
from theme import esc

STEPS = len(list((Path(__file__).parent.parent / "guide").glob("[0-9][0-9]-*.md")))  # une étape = un guide
STACK = ["Python", "Streamlit", "Three.js · WebGL", "Altair", "pandas", "yfinance", "PostgreSQL", "Gemini",
         "Playwright", "pytest"]

theme.page_header("Le projet,", "FinVeille rassemble l'actualité financière, les marchés et l'économie en un seul "
                  "endroit, et les explique simplement.", eyebrow="À propos", accent="en coulisses.", art="account",
                  scene="about")

theme.section("L'auteur")
initials = "".join(part[0] for part in theme.AUTHOR.split()[:2])
st.html(theme.card(
    f'<div class="fv-about-card"><span class="fv-about-avatar" aria-hidden="true">{esc(initials)}</span>'
    f'<div><h3>{esc(theme.AUTHOR)}</h3><p>Étudiant en finance. Conception, développement et design de FinVeille, '
    f"construit pas à pas et documenté en {STEPS} étapes.</p></div></div>"
))

theme.section("En chiffres")
st.html(
    '<div class="fv-bento">'
    f'<div><b><em>{len(RSS_FEEDS)}</em></b><span>sources d\'actualité, lues au plus toutes les 15 minutes</span></div>'
    '<div><b>40</b><span>valeurs du CAC 40, en tours de lumière sur le fil</span></div>'
    f'<div><b>{len(GLOSSARY)}</b><span>termes de la finance, expliqués simplement</span></div>'
    f'<div><b>{STEPS}</b><span>étapes, chacune expliquée dans un guide</span></div>'
    "<div class=\"is-wide\"><b>Une IA <em>qui cite</em></b><span>Résumés et réponses s'appuient sur les dépêches du "
    "moment : chaque affirmation renvoie à son article.</span></div>"
    "<div class=\"is-wide\"><b>Un monde <em>en 3D</em></b><span>Chaque page a son décor, construit à partir des "
    "vraies données : la ville du CAC 40, le globe des places boursières, la chaîne du bitcoin.</span></div>"
    "</div>"
)

theme.section("Sous le capot")
st.html('<ul class="fv-stack">' + "".join(f"<li>{esc(name)}</li>" for name in STACK) + "</ul>"
        '<p class="fv-note" style="margin-top:1rem">Accessibilité mesurée par un audit automatique de toutes les pages '
        "(contrastes, y compris sur le décor 3D, et cibles tactiles), en thème clair comme en sombre. Informations "
        "pédagogiques : pas un conseil en investissement.</p>")
