"""Page « Favoris » : les articles enregistrés pour plus tard."""

import streamlit as st

from core import storage
from ui import NO_STATUS, article_card

st.title("⭐ Favoris")

favorites = storage.list_favorites()  # lus depuis la base : ils restent même s'ils ont quitté le flux
statuses = storage.get_statuses()

if not favorites:
    st.info("Aucun favori pour l'instant. Clique sur « Favori » sous un article pour le retrouver ici.")

for article in favorites:
    article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="fav")
