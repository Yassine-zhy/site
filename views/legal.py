"""Les pages légales : mentions légales, confidentialité, cookies, conditions d'utilisation.

Les textes viennent de core/legal.py (fonctions pures) ; cette page y ajoute la configuration réelle du site, lue dans
les secrets : seuls les services configurés y figurent. app.py déclare les quatre fonctions comme des pages cachées.
"""

import re

import streamlit as st

import theme
from core import legal
from ui import get_secret

SECRET_NAMES = ("CONTACT_EMAIL", "SITE_URL", "HOSTING", "DATABASE_URL", "SMTP_HOST", "GEMINI_API_KEY", "GROQ_API_KEY")

# Largeur de lecture confortable ; un tableau trop large défile seul, sans faire défiler la page (téléphone)
CSS = """<style>
.st-key-fvlegal { max-width: 760px; }
.st-key-fvlegal [data-testid="stMarkdownContainer"] { line-height: 1.7; }
.st-key-fvlegal h2 { margin-top: 1.4rem; font-size: 1.45rem !important; }
.st-key-fvlegal h1 { display: none; }  /* le titre est déjà dans l'en-tête de la page */
.st-key-fvlegal table { display: block; max-width: 100%; overflow-x: auto; }
.st-key-fvlegal th, .st-key-fvlegal td { vertical-align: top; min-width: 7rem; }
</style>"""


def config() -> legal.LegalConfig:
    """La configuration légale d'après les secrets ; sans fichier de secrets, tout est vide."""
    secrets = {name: get_secret(name) for name in SECRET_NAMES}
    try:
        secrets["auth"] = st.secrets.get("auth")
    except Exception:  # pas de fichier secrets.toml, ou secrets illisibles : aucune connexion par service
        secrets["auth"] = None
    return legal.config_from(secrets)


def same_tab(text: str) -> str:
    """Les liens vers les autres pages s'ouvrent dans l'onglet courant (st.markdown ouvre un nouvel onglet)."""
    return re.sub(r"\[([^\]]+)\]\((\./[^)]+)\)", r'<a href="\2" target="_self">\1</a>', text)


def show(title: str, accent: str, dek: str, text) -> None:
    cfg = config()
    theme.page_header(title, dek, eyebrow="Informations légales", accent=accent)
    st.html(CSS)
    with st.container(key="fvlegal"):
        st.markdown(same_tab(text(cfg)), unsafe_allow_html=True)


def mentions_page() -> None:
    show("Les mentions", "légales.", "Qui édite FinVeille, qui l'héberge et à qui appartiennent les contenus.",
         legal.mentions_legales)


def privacy_page() -> None:
    show("La", "confidentialité.", "Quelles données FinVeille traite, pourquoi, et comment tu gardes la main dessus.",
         legal.confidentialite)


def cookies_page() -> None:
    show("Les", "cookies.", "Ce que ton navigateur garde quand tu utilises FinVeille, et pourquoi.", legal.cookies)


def terms_page() -> None:
    show("Les conditions", "d'utilisation.", "Les règles du jeu : un service gratuit d'information, sans conseil "
         "en investissement.", legal.conditions)
