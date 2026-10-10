"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py
"""

from datetime import datetime, timezone

import streamlit as st

from core.aggregator import collect_articles
from core.config import CATEGORIES
from core.filters import filter_articles

PAGE_SIZE = 30  # nombre d'articles affichés par « page »
CATEGORY_COLORS = {"marches": "blue", "crypto": "orange", "entreprises": "violet", "macro": "green"}

st.set_page_config(page_title="FinVeille", page_icon="📰")


@st.cache_data(ttl=600, show_spinner="Récupération des actualités…")
def load_articles():
    """Appelle les sources au plus une fois toutes les 10 minutes (600 s)."""
    return collect_articles()


def md_escape(text: str) -> str:
    """Neutralise les caractères spéciaux du Markdown (sinon « $5 … $10 » devient une formule)."""
    for char in "\\`*_[]$<>#":
        text = text.replace(char, "\\" + char)
    return text


def time_ago(published: datetime) -> str:
    """« il y a 5 min », « il y a 3 h », « il y a 2 j »."""
    minutes = int((datetime.now(timezone.utc) - published).total_seconds() // 60)
    if minutes < 60:
        return f"il y a {max(minutes, 0)} min"
    if minutes < 24 * 60:
        return f"il y a {minutes // 60} h"
    return f"il y a {minutes // (24 * 60)} j"


def show_more():
    """Appelée au clic sur « Afficher plus » : on agrandit la fenêtre d'articles visibles."""
    st.session_state.visible_count += PAGE_SIZE


# --- Données ------------------------------------------------------------------------------
articles, errors = load_articles()

# st.session_state survit aux relances du script (contrairement aux variables normales).
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
    if st.button("🔄 Actualiser les sources", width="stretch"):
        load_articles.clear()
        st.rerun()
    if errors:
        with st.expander(f"⚠️ {len(errors)} source(s) indisponible(s)"):
            for error in errors:
                st.caption(error)

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
st.caption(f"**{len(filtered)}** articles sur {len(articles)}")

# --- Le fil ---------------------------------------------------------------------------------
for article in filtered[: st.session_state.visible_count]:
    with st.container(border=True):
        st.markdown(f"#### [{md_escape(article.title)}]({article.url})")
        color = CATEGORY_COLORS.get(article.category, "gray")
        st.caption(
            f":{color}-badge[{CATEGORIES[article.category]}] · {md_escape(article.source)} · "
            f"{time_ago(article.published)}"
        )
        if article.summary:
            st.write(md_escape(article.summary))

if not filtered:
    st.info("Aucun article ne correspond à ces filtres. Essaie un autre mot-clé ou retire un filtre.")
elif len(filtered) > st.session_state.visible_count:
    st.button("Afficher plus", on_click=show_more, width="stretch")
