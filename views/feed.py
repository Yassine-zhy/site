"""Page « Le fil » : la une, les tendances, le fil en continu et ses chiffres."""

from collections import Counter
from datetime import datetime, timedelta, timezone

import streamlit as st

import theme
from core import analytics, storage
from core.config import API_KEYS, CATEGORIES
from core.filters import filter_articles
from theme import esc
from ui import NO_STATUS, api_keys, article_card, current_user, flush_toast, load_articles, setting

user = current_user()  # None : visiteur non connecté (il voit le fil, sans favoris ni « lu »)
PAGE_SIZE = setting(user, "page_size", 30)  # nombre d'articles affichés par « page » (réglable)


def show_more():
    """Appelée au clic sur « Afficher plus » : on agrandit la fenêtre d'articles visibles."""
    st.session_state.visible_count += PAGE_SIZE


def search_for(term: str) -> None:
    """Clic sur une tendance : on la recherche (entre guillemets si elle contient plusieurs mots)."""
    st.session_state.feed_query = f'"{term}"' if " " in term else term


if "visible_count" not in st.session_state:
    st.session_state.visible_count = PAGE_SIZE

keys = api_keys()
articles, errors, fetched_at = load_articles(keys)


# --- En-tête : se redessine toutes les minutes (horloges des places boursières) -----------------
@st.fragment(run_every="1min")
def header():
    current, _, collected = load_articles(keys)
    theme.feed_header(len(current), len({a.source for a in current}), collected)


header()

# --- Barre d'outils : recherche, filtres, actualisation -----------------------------------------
with st.container(horizontal=True, vertical_alignment="center", gap="small", key="fvtoolbar"):
    query = st.text_input(
        "Rechercher", key="feed_query", label_visibility="collapsed", icon=":material/search:", width="stretch",
        placeholder='Rechercher : inflation, Nvidia, "banque centrale", -crypto, source:cnbc…',
        help='Mots-clés (tous doivent apparaître) · "expression exacte" · -mot pour exclure · source:nom pour une source',
    )
    with st.popover("Filtres", icon=":material/tune:"):
        sources = st.multiselect("Sources", options=sorted({a.source for a in articles}),
                                 placeholder="Toutes les sources", key="feed_sources")
        hide_read = st.toggle("Cacher les articles lus", value=setting(user, "hide_read", False), disabled=not user)
        show_hidden = st.toggle("Voir les articles masqués", disabled=not user)
        compact = st.toggle("Vue compacte", value=setting(user, "density", "confort") == "compact",
                            help="Une ligne par article, sans chapeau : idéal pour parcourir vite.")
        images = st.toggle("Photo de l'article à la une", value=setting(user, "show_images", False))
        if not user:
            st.caption("Connecte-toi pour garder des articles, les marquer comme lus ou les masquer.")
        active = sum(1 for name in API_KEYS if keys[name])
        st.caption(f"{active} API active(s) sur {len(API_KEYS)} · "
                   + (f"{len(errors)} source(s) indisponible(s) : " + " ; ".join(errors) if errors else
                      "toutes les sources répondent"))
        st.page_link("views/settings.py", label="Clés API et réglages", icon=":material/settings:")
    if st.button("Actualiser", icon=":material/refresh:", help="Interroger les sources maintenant"):
        load_articles.clear()
        st.rerun()

categories = st.pills(
    "Rubriques", options=list(CATEGORIES), format_func=lambda key: CATEGORIES[key], selection_mode="multi",
    default=setting(user, "default_categories", []), label_visibility="collapsed",
)

# --- Tendances : les sujets qui montent, cliquables ------------------------------------------------
if trends := analytics.rising_topics(articles, now=datetime.now(timezone.utc))[:6]:
    with st.container(horizontal=True, vertical_alignment="center", gap="small", key="fvtrends"):
        st.html('<span class="fv-trends-label">Tendances</span>', width="content")
        for term, count, before in trends:
            st.button(term, key=f"trend_{term}", type="tertiary", on_click=search_for, args=(term,),
                      help=f"{count} dépêches en 24 h ({'nouveau sujet' if before == 0 else f'{before} la veille'})")


def pick_lead(filtered):
    """La une : l'histoire reprise par le plus de sources depuis 12 h (sinon 24 h, sinon 48 h).

    Renvoie (article, nombre d'autres sources qui la reprennent, explication affichée sous le titre).
    """
    now = datetime.now(timezone.utc)
    for hours in (12, 24, 48):
        ranked = analytics.most_covered([a for a in filtered[:150] if a.published >= now - timedelta(hours=hours)])
        if ranked and ranked[0][1] > 0:
            return ranked[0][0], ranked[0][1], f"l'histoire la plus reprise depuis {hours} h"
    # Aucune histoire reprise (nuit, week-end) : la dernière dépêche qui a un vrai chapeau
    lead = next((a for a in filtered[:10] if len(a.summary or "") > 80), filtered[0])
    return lead, 0, "la dernière dépêche"


# --- Le corps de la page : se met à jour tout seul toutes les 5 minutes --------------------
@st.fragment(run_every="5min")
def body(query, categories, sources, hide_read, show_hidden, compact, images):
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

    main, rail = st.columns([2.25, 1], gap="large")

    with main:
        if not filtered:
            theme.section("Aucun résultat")
            st.info("Aucun article ne correspond à ces filtres. Essaie un autre mot-clé ou retire un filtre.")
            return
        lead, echoes, why = pick_lead(filtered)
        theme.section("À la une", why)
        article_card(lead, statuses.get(lead.id, NO_STATUS), key_prefix="feed", lead=True, user=user,
                     echoes=echoes, show_image=images)

        rest = [a for a in filtered if a is not lead]
        theme.section("En continu", f"{len(filtered)} dépêches")
        with st.container(key="fvpanel_feed"):
            for article in rest[: st.session_state.visible_count]:
                article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="feed", compact=compact,
                             user=user)
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
        theme.card(f'<ul class="fv-bars">{bars}</ul>', "Par rubrique", f"{total} dépêches")
        + theme.card(f'<ul class="fv-sources">{source_rows}</ul>', "Sources les plus actives")
        + f'<p class="fv-note" style="margin-top:.9rem">Collecte de {theme.clock(collected)}. La page vérifie les '
        "nouveautés toutes les 5 minutes ; les sources sont interrogées au plus toutes les 15 minutes.</p>"
    )


body(query, categories, sources, hide_read, show_hidden, compact, images)
