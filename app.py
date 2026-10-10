"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py
"""

from datetime import datetime, timezone

import streamlit as st

from core.aggregator import collect_articles

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


st.title("📰 FinVeille")
st.caption("L'actualité financière et économique mondiale, au même endroit.")

if st.button("🔄 Actualiser"):
    load_articles.clear()  # vide le cache : le prochain appel interroge à nouveau les sources

articles, errors = load_articles()

if errors:
    with st.expander(f"⚠️ {len(errors)} source(s) indisponible(s)"):
        for error in errors:
            st.write(error)

st.write(f"**{len(articles)}** articles")

for article in articles[:50]:
    with st.container(border=True):
        st.markdown(f"#### [{md_escape(article.title)}]({article.url})")
        st.caption(f"{article.source} · {time_ago(article.published)}")
        if article.summary:
            st.write(md_escape(article.summary))
