"""Page « Fil d'actualité » : tous les articles, filtrables."""

import streamlit as st

from core import storage
from core.config import API_KEYS, CATEGORIES
from core.filters import filter_articles
from ui import NO_STATUS, api_keys, article_card, load_articles

PAGE_SIZE = 30  # nombre d'articles affichés par « page »


def show_more():
    """Appelée au clic sur « Afficher plus » : on agrandit la fenêtre d'articles visibles."""
    st.session_state.visible_count += PAGE_SIZE


keys = api_keys()
articles, errors = load_articles(keys)
statuses = storage.get_statuses()

if "visible_count" not in st.session_state:
    st.session_state.visible_count = PAGE_SIZE

# --- Barre latérale : filtres secondaires ---------------------------------------------------
with st.sidebar:
    st.header("Filtres")
    sources = st.multiselect(
        "Sources",
        options=sorted({article.source for article in articles}),
        placeholder="Toutes les sources",
    )
    hide_read = st.toggle("Cacher les articles lus")
    show_hidden = st.toggle("Voir les articles masqués")
    if st.button("🔄 Actualiser les sources", width="stretch"):
        load_articles.clear()
        st.rerun()
    if errors:
        with st.expander(f"⚠️ {len(errors)} source(s) indisponible(s)"):
            for error in errors:
                st.caption(error)

    st.subheader("API", divider="gray")
    for name, (label, signup_url) in API_KEYS.items():
        if keys[name]:
            st.caption(f":green-badge[active] {label}")
        else:
            st.caption(f":gray-badge[inactive] {label} · [obtenir une clé gratuite]({signup_url})")

# --- En-tête : recherche et catégories (visibles même sur mobile) --------------------------
st.title("📰 FinVeille")
st.caption("L'actualité financière et économique mondiale, au même endroit.")

query = st.text_input(
    "Rechercher", placeholder="🔎 Mot-clé ou entreprise : inflation, Nvidia, BCE…", label_visibility="collapsed"
)
categories = st.pills(
    "Catégories",
    options=list(CATEGORIES),
    format_func=lambda key: CATEGORIES[key],
    selection_mode="multi",
    label_visibility="collapsed",
)

filtered = filter_articles(articles, categories=categories, sources=sources, query=query)


def is_visible(article) -> bool:
    status = statuses.get(article.id, NO_STATUS)
    if status["is_hidden"]:
        return show_hidden  # un article masqué n'apparaît que si on le demande
    return not (hide_read and status["is_read"])


filtered = [article for article in filtered if is_visible(article)]
st.caption(f"**{len(filtered)}** articles sur {len(articles)}")

# --- Le fil ---------------------------------------------------------------------------------
for article in filtered[: st.session_state.visible_count]:
    article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="feed")

if not filtered:
    st.info("Aucun article ne correspond à ces filtres. Essaie un autre mot-clé ou retire un filtre.")
elif len(filtered) > st.session_state.visible_count:
    st.button("Afficher plus", on_click=show_more, width="stretch")
