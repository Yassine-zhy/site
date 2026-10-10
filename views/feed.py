"""Page « Fil d'actualité » : la une, le fil en continu et ses chiffres."""

from collections import Counter

import streamlit as st

import theme
from core import storage
from core.config import API_KEYS, CATEGORIES
from core.filters import filter_articles
from theme import esc
from ui import NO_STATUS, api_keys, article_card, current_user, flush_toast, load_articles, setting

user = current_user()  # None : visiteur non connecté (il voit le fil, sans favoris ni « lu »)
PAGE_SIZE = setting(user, "page_size", 30)  # nombre d'articles affichés par « page » (réglable)


def show_more():
    """Appelée au clic sur « Afficher plus » : on agrandit la fenêtre d'articles visibles."""
    st.session_state.visible_count += PAGE_SIZE


if "visible_count" not in st.session_state:
    st.session_state.visible_count = PAGE_SIZE

keys = api_keys()
articles, errors, fetched_at = load_articles(keys)


# --- Bandeau de titre : se redessine toutes les minutes (horloges des places boursières) ------
@st.fragment(run_every="1min")
def masthead():
    current, _, collected = load_articles(keys)
    theme.masthead(len(current), len({a.source for a in current}), collected)


masthead()

# --- Barre latérale : filtres secondaires ---------------------------------------------------
with st.sidebar:
    st.header("Filtres")
    sources = st.multiselect(
        "Sources",
        options=sorted({article.source for article in articles}),
        placeholder="Toutes les sources",
    )
    hide_read = st.toggle("Cacher les articles lus", value=setting(user, "hide_read", False))
    show_hidden = st.toggle("Voir les articles masqués")
    compact = st.toggle("Vue compacte", value=setting(user, "density", "confort") == "compact",
                        help="Une ligne par article, sans chapeau : idéal pour parcourir vite.")
    if st.button("Actualiser maintenant", icon=":material/refresh:", width="stretch"):
        load_articles.clear()
        st.rerun()
    if errors:
        with st.expander(f"{len(errors)} source(s) indisponible(s)", icon=":material/warning:"):
            for error in errors:
                st.caption(error)

    active = sum(1 for name in API_KEYS if keys[name])
    st.caption(f"{len(API_KEYS) - active} API inactive(s) sur {len(API_KEYS)}.")
    st.page_link("views/settings.py", label="Clés API et réglages", icon=":material/settings:")

# --- Recherche et rubriques (en haut : visibles même sur mobile) ---------------------------
query = st.text_input(
    "Rechercher", placeholder='Rechercher : inflation, Nvidia, "banque centrale", -crypto, source:cnbc…',
    label_visibility="collapsed", icon=":material/search:",
    help='Mots-clés (tous doivent apparaître) · "expression exacte" · -mot pour exclure · source:nom pour une source',
)
categories = st.pills(
    "Rubriques",
    options=list(CATEGORIES),
    format_func=lambda key: CATEGORIES[key],
    selection_mode="multi",
    default=setting(user, "default_categories", []),
    label_visibility="collapsed",
)


# --- Le corps de la page : se met à jour tout seul toutes les 5 minutes --------------------
@st.fragment(run_every="5min")
def body(query, categories, sources, hide_read, show_hidden, compact):
    flush_toast()
    current, _, collected = load_articles(keys)  # nouvelles données dès que le cache (15 min) a expiré
    statuses = storage.get_statuses(user) if user else {}

    def is_visible(article) -> bool:
        status = statuses.get(article.id, NO_STATUS)
        if status["is_hidden"]:
            return show_hidden  # un article masqué n'apparaît que si on le demande
        return not (hide_read and status["is_read"])

    filtered = filter_articles(current, categories=categories, sources=sources, query=query)
    filtered = [article for article in filtered if is_visible(article)]

    main, rail = st.columns([2.2, 1], gap="large")

    with main:
        if not filtered:
            theme.section("Aucun résultat")
            st.info("Aucun article ne correspond à ces filtres. Essaie un autre mot-clé ou retire un filtre.")
            return
        # À la une : l'article le plus récent qui a une photo (parmi les 6 premiers), sinon le premier.
        lead = next((a for a in filtered[:6] if a.image), filtered[0])
        theme.section("À la une")
        article_card(lead, statuses.get(lead.id, NO_STATUS), key_prefix="feed", lead=True, user=user)

        rest = [a for a in filtered if a is not lead]
        theme.section("En continu", f"{len(filtered)} dépêches")
        for article in rest[: st.session_state.visible_count]:
            article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="feed", compact=compact, user=user)
        if len(rest) > st.session_state.visible_count:
            st.button("Afficher plus", on_click=show_more, width="stretch")

    with rail:
        rail_blocks(filtered, collected)


def rail_blocks(filtered, collected):
    """La colonne de droite : le fil en chiffres."""
    by_category = Counter(article.category for article in filtered)
    top = max(by_category.values(), default=1)
    total = sum(by_category.values()) or 1
    bars = "".join(
        f'<li title="{esc(label)} : {by_category[key]} dépêches ({by_category[key] / total:.0%})">'
        f'{theme.category_tag(key, label)}'
        f'<span class="fv-track"><i style="--c:{theme.CATEGORY_COLORS[key]};width:{by_category[key] / top:.0%}"></i></span>'
        f'<span class="fv-num">{by_category[key]}</span></li>'
        for key, label in CATEGORIES.items()
    )
    sources = Counter(article.source for article in filtered).most_common(8)
    domains = {article.source: article.url for article in filtered}
    source_rows = "".join(
        f'<li><img src="{theme.favicon_url(domains[name])}" alt="" loading="lazy"><span>{esc(name)}</span>'
        f"<span>{count}</span></li>"
        for name, count in sources
    )
    st.html(
        f"""
        <section><h4 class="fv-rail-title">Le fil en chiffres</h4><ul class="fv-bars">{bars}</ul></section>
        <section style="margin-top:1.6rem"><h4 class="fv-rail-title">Sources les plus actives</h4>
          <ul class="fv-sources">{source_rows}</ul></section>
        <p class="fv-note" style="margin-top:1.2rem">Collecte de {theme.clock(collected)}. La page vérifie
          les nouveautés toutes les 5 minutes ; les sources sont interrogées au plus toutes les 15 minutes.</p>
        """
    )


body(query, categories, sources, hide_read, show_hidden, compact)
