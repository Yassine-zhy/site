"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py

Ce fichier configure la page, applique l'identité visuelle, prépare la base de données et
affiche le menu de navigation. Chaque page vit dans son propre fichier, dans le dossier views/.
"""

import streamlit as st

import theme
from core import storage

st.set_page_config(page_title="FinVeille", page_icon=":material/candlestick_chart:", layout="wide")
theme.inject_css()
storage.init_db()

pages = [
    st.Page("views/feed.py", title="Le fil", icon=":material/newspaper:", default=True),
    st.Page("views/favorites.py", title="Favoris", icon=":material/bookmark:"),
]
st.navigation(pages, position="top").run()
