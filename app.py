"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py

Ce fichier configure la page, applique l'identité visuelle, prépare la base de données,
affiche le bandeau des cours et le menu de navigation. Chaque page vit dans son propre
fichier, dans le dossier views/.
"""

import streamlit as st

import theme
from core import storage
from ui import load_quotes

st.set_page_config(page_title="FinVeille", page_icon=":material/candlestick_chart:", layout="wide")
theme.inject_css()
storage.init_db()


@st.fragment(run_every="2min")
def tape():
    """Le bandeau des cours, en haut de chaque page, rafraîchi toutes les 2 minutes."""
    theme.ticker_tape(load_quotes())


tape()

pages = [
    st.Page("views/feed.py", title="Le fil", icon=":material/newspaper:", default=True),
    st.Page("views/markets.py", title="Marchés", icon=":material/candlestick_chart:"),
    st.Page("views/stats.py", title="En chiffres", icon=":material/monitoring:"),
    st.Page("views/following.py", title="Mes suivis", icon=":material/star:"),
    st.Page("views/favorites.py", title="Favoris", icon=":material/bookmark:"),
    st.Page("views/settings.py", title="Réglages", icon=":material/settings:"),
]
st.navigation(pages, position="top").run()
