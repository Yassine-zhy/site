"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py

Ce fichier configure la page, prépare la base de données et affiche le menu de navigation.
Chaque page vit dans son propre fichier, dans le dossier views/.
"""

import streamlit as st

from core import storage

st.set_page_config(page_title="FinVeille", page_icon="📰")
storage.init_db()

pages = [
    st.Page("views/feed.py", title="Fil d'actualité", icon="📰", default=True),
    st.Page("views/favorites.py", title="Favoris", icon="⭐"),
]
st.navigation(pages, position="top").run()
