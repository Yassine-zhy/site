"""Page « Favoris » : les articles enregistrés pour plus tard."""

import streamlit as st

import theme
from core import storage
from ui import NO_STATUS, article_card, flush_toast

flush_toast()
favorites = storage.list_favorites()  # lus depuis la base : ils restent même s'ils ont quitté le flux
statuses = storage.get_statuses()
notes = storage.get_notes()

theme.page_header("Favoris", "Les articles que tu as gardés pour plus tard.")
theme.section("Gardés", f"{len(favorites)} article{'s' if len(favorites) > 1 else ''}")

if not favorites:
    st.info("Aucun favori pour l'instant. Clique sur « Garder » sous un article pour le retrouver ici.")

for article in favorites:
    article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="fav",
                 note=notes.get(article.id), with_note=True)
