"""Page « Favoris » : les articles enregistrés pour plus tard."""

import streamlit as st

import theme
from core import storage
from ui import NO_STATUS, article_card, flush_toast, require_user

flush_toast()
theme.page_header("Tes favoris,", "Les articles que tu as gardés pour plus tard.", eyebrow="Mon espace", accent="à lire plus tard.")
user = require_user()
favorites = storage.list_favorites(user)  # lus depuis la base : ils restent même s'ils ont quitté le flux
statuses = storage.get_statuses(user)
notes = storage.get_notes(user)

theme.section("Gardés", f"{len(favorites)} article{'s' if len(favorites) > 1 else ''}")

if not favorites:
    st.info("Aucun favori pour l'instant. Clique sur « Garder » sous un article pour le retrouver ici.")

with st.container(key="fvpanel_favorites"):
    for article in favorites:
        article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="fav",
                     note=notes.get(article.id), with_note=True, user=user)
