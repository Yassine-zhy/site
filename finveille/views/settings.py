"""Page « Réglages » : préférences, apparence, clés API et données personnelles."""

import pandas as pd
import streamlit as st

import theme
from core import storage
from core.config import AI_KEYS, API_KEYS, CATEGORIES
from ui import ai_keys, api_keys, require_user

theme.page_header("Réglages", "Tes préférences sont enregistrées dans ton compte et conservées.", eyebrow="Outils")
user = require_user()


def save(setting: str, widget_key: str) -> None:
    """Callback commun : enregistre la nouvelle valeur d'un widget comme préférence."""
    storage.set_setting(user, setting, st.session_state[widget_key])
    st.toast("Préférence enregistrée")


left, right = st.columns([1.15, 1], gap="large")

# --- Le fil -----------------------------------------------------------------------------------
# Chaque groupe de réglages est une carte : un st.container(key="fvset_…") mis en forme par theme.py
with left, st.container(key="fvset_feed"):
    theme.section("Le fil")
    st.pills(
        "Rubriques affichées par défaut", options=list(CATEGORIES), format_func=CATEGORIES.get, selection_mode="multi",
        default=storage.get_setting(user, "default_categories", []), key="pref_categories",
        on_change=save, args=("default_categories", "pref_categories"),
        help="Aucune rubrique sélectionnée = toutes les rubriques.",
    )
    st.select_slider(
        "Articles chargés à la fois", options=[15, 30, 50, 80], value=storage.get_setting(user, "page_size", 30),
        key="pref_page_size", on_change=save, args=("page_size", "pref_page_size"),
    )
    st.segmented_control(
        "Présentation du fil", options=["confort", "compact"],
        format_func={"confort": "Confort (avec chapeau)", "compact": "Compacte (une ligne)"}.get,
        default=storage.get_setting(user, "density", "confort"), key="pref_density", on_change=save,
        args=("density", "pref_density"),
    )
    st.toggle(
        "Cacher les articles lus par défaut", value=storage.get_setting(user, "hide_read", False),
        key="pref_hide_read", on_change=save, args=("hide_read", "pref_hide_read"),
    )
    st.toggle(
        "Afficher la photo de l'article à la une", value=storage.get_setting(user, "show_images", False),
        key="pref_show_images", on_change=save, args=("show_images", "pref_show_images"),
        help="Désactivé par défaut : un fil sans images est plus rapide à parcourir et plus sobre.",
    )

# --- Résumé et apparence ----------------------------------------------------------------------
with left, st.container(key="fvset_summary"):
    theme.section("Résumé automatique")
    engines = {"auto": "Automatique : IA si une clé est disponible, sinon résumé local",
               "local": "Toujours le résumé local (rien n'est envoyé en ligne)"}
    st.radio(
        "Moteur", options=list(engines), format_func=engines.get,
        index=list(engines).index(storage.get_setting(user, "summary_engine", "auto")),
        key="pref_engine", on_change=save, args=("summary_engine", "pref_engine"), label_visibility="collapsed",
    )

with left, st.container(key="fvset_look"):
    theme.section("Apparence")
    current = {"dark": "sombre", "light": "clair"}.get(st.context.theme.type or "", "inconnu")
    st.markdown(
        f"Le thème se choisit dans le menu **⋮** en haut à droite : **Système** (suit ton ordinateur ou ton "
        f"téléphone), **Clair** ou **Sombre** (bleu nuit). Thème détecté au dernier chargement : **{current}**."
    )

# --- Clés API ---------------------------------------------------------------------------------
with right, st.container(key="fvset_keys"):
    theme.section("Sources et clés API")
    st.caption("Les clés se renseignent dans `.streamlit/secrets.toml` (en local) ou dans les *Secrets* de "
               "l'hébergeur. Toutes sont gratuites et facultatives.")
    keys = api_keys() | ai_keys()
    for name, (label, signup_url) in (API_KEYS | AI_KEYS).items():
        if keys.get(name):
            st.markdown(f":green-badge[active] **{label}**")
        else:
            st.markdown(f":gray-badge[inactive] **{label}** · [obtenir une clé gratuite]({signup_url})")

# --- Mes données ------------------------------------------------------------------------------
with right, st.container(key="fvset_data"):
    theme.section("Mes données")
    stats = storage.counts(user)
    where = ("une base PostgreSQL en ligne : elles sont conservées" if storage.backend() == "postgres" else
             "un fichier SQLite sur le serveur (data/finveille.db)")
    st.caption(f"Tes données sont enregistrées dans {where}.")
    st.markdown(
        f"{stats['favorites']} favori(s) · {stats['read']} article(s) lu(s) · {stats['hidden']} masqué(s) · "
        f"{stats['follows']} suivi(s) · {stats['summaries']} résumé(s) enregistré(s)"
    )

    favorites = storage.list_favorites(user)
    with st.container(horizontal=True, gap="small"):
        if favorites:
            table = pd.DataFrame(
                {"titre": a.title, "source": a.source, "rubrique": CATEGORIES.get(a.category, a.category),
                 "publié le": a.published.strftime("%Y-%m-%d %H:%M"), "lien": a.url}
                for a in favorites
            )
            st.download_button(
                "Exporter mes favoris (CSV)", data=table.to_csv(index=False).encode("utf-8-sig"),
                file_name="finveille-favoris.csv", mime="text/csv", icon=":material/download:",
            )

        with st.popover("Réinitialiser…", icon=":material/restart_alt:"):
            st.caption("Ces actions sont définitives.")
            if st.button("Réafficher tous les articles masqués", width="stretch"):
                storage.reset_flag(user, "is_hidden")
                st.toast("Tous les articles masqués sont de nouveau visibles")
            if st.button("Marquer tous les articles comme non lus", width="stretch"):
                storage.reset_flag(user, "is_read")
                st.toast("Tous les articles sont marqués comme non lus")
            if user == storage.LOCAL_USER:  # les résumés sont partagés par tous : seul le mode local peut les effacer
                if st.button("Effacer les résumés enregistrés", width="stretch"):
                    storage.clear_summaries()
                    st.toast("Résumés effacés")
    st.page_link("views/account.py", label="Exporter ou supprimer toutes mes données", icon=":material/shield_person:")
