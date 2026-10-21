"""Page « Mes suivis » : entreprises et thèmes suivis, fils dédiés et fiches entreprises."""

import streamlit as st

import theme
from core import storage
from sheet import company_sheet, follow
from ui import (NO_STATUS, api_keys, article_card, end_page, flush_toast, load_followed, load_followed_quotes,
                require_user, search_companies)

SUGGESTIONS = [("company", "MC.PA", "LVMH"), ("company", "AIR.PA", "Airbus"), ("company", "NVDA", "Nvidia"),
               ("company", "AAPL", "Apple"), ("theme", "inflation", "inflation"), ("theme", "BCE", "BCE")]


def unfollow(user: str, kind: str, value: str, label: str) -> None:
    storage.remove_follow(user, kind, value)
    st.session_state.pop("follow_view", None)  # revient à la vue d'ensemble
    st.toast(f"Tu ne suis plus {label}")


def add_theme(user: str) -> None:
    """Callback du champ « thème » : la valeur saisie est lue via sa clé dans session_state."""
    value = st.session_state.get("new_theme", "").strip()
    if value:
        follow(user, "theme", value, value)
    st.session_state.new_theme = ""


def news_list(user: str, articles, empty_message: str, key_prefix: str) -> None:
    statuses = storage.get_statuses(user)
    visible = [a for a in articles if not statuses.get(a.id, NO_STATUS)["is_hidden"]]
    if not visible:
        st.caption(empty_message)
    with st.container(key=f"fvpanel_{key_prefix}"):
        for article in visible[:20]:
            article_card(article, statuses.get(article.id, NO_STATUS), key_prefix=key_prefix, user=user)


# --- La page ----------------------------------------------------------------------------------
flush_toast()
theme.page_header("Tes suivis,", "Les entreprises et les thèmes que tu suis, avec leur fil et leur fiche.",
                  eyebrow="Mon espace", accent="en un seul fil.", art="following")
user = require_user()

with st.container(horizontal=True, gap="small"):
    with st.popover("Suivre une entreprise", icon=":material/add_business:"):
        query = st.text_input("Nom ou symbole", placeholder="LVMH, Airbus, Apple, MC.PA…")
        if query:
            results = search_companies(query)
            if not results:
                st.caption("Aucun résultat. Essaie le nom anglais ou le symbole boursier.")
            for result in results:
                st.button(
                    f"{result['name']} · {result['symbol']} · {result['exchange']}",
                    key=f"add_{result['symbol']}", type="tertiary",
                    on_click=follow, args=(user, "company", result["symbol"], result["name"]),
                )
    with st.popover("Suivre un thème", icon=":material/tag:"):
        st.text_input("Mot-clé", key="new_theme", placeholder="inflation, BCE, intelligence artificielle…",
                      on_change=add_theme, args=(user,))
        st.caption("Appuie sur Entrée pour valider.")

follows = storage.list_follows(user)

if not follows:
    theme.section("Pour commencer")
    st.caption("Tu ne suis rien pour l'instant. Quelques idées :")
    with st.container(horizontal=True, gap="small"):
        for kind, value, label in SUGGESTIONS:
            st.button(label, key=f"suggest_{value}", icon=":material/add:", on_click=follow, args=(user, kind, value, label))
    end_page()

keys = api_keys()
feeds, errors = load_followed(tuple((f["kind"], f["value"], f["label"]) for f in follows), keys)
companies = [f for f in follows if f["kind"] == "company"]

options = ["__all__"] + [f"{f['kind']}|{f['value']}" for f in follows]
labels = {"__all__": "Vue d'ensemble"} | {f"{f['kind']}|{f['value']}": f["label"] for f in follows}
view = st.pills("Suivis", options, format_func=labels.get, default="__all__", key="follow_view",
                label_visibility="collapsed") or "__all__"

if view == "__all__":
    if companies:
        theme.section("Mes entreprises")
        quotes = load_followed_quotes(tuple((f["value"], f["label"]) for f in companies))
        if quotes:
            st.html(f'<div class="fv-tiles">{"".join(map(theme.quote_tile, quotes))}</div>')
    combined = sorted({a.id: a for items in feeds.values() for a in items}.values(),
                      key=lambda a: a.published, reverse=True)
    theme.section("Mon fil", f"{len(combined)} dépêches")
    news_list(user, combined, "Aucune dépêche pour tes suivis pour le moment.", "follow_all")
else:
    kind, value = view.split("|", 1)
    label = labels[view]
    if kind == "company":
        st.page_link("views/quote.py", label="Ouvrir la fiche complète : résultats, analystes, dividendes",
                     icon=":material/query_stats:", query_params={"s": value})
        company_sheet(value, label, feeds.get((kind, value), []), user)
    theme.section(f"Actualités · {label}", f"{len(feeds.get((kind, value), []))} dépêches")
    news_list(user, feeds.get((kind, value), []), "Aucune dépêche trouvée pour le moment.", f"follow_{value}")
    st.button(f"Ne plus suivre {label}", icon=":material/remove_circle:", on_click=unfollow,
              args=(user, kind, value, label))

if errors:
    with st.expander(f"{len(errors)} source(s) indisponible(s)", icon=":material/warning:"):
        for error in errors:
            st.caption(error)
