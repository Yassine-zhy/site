"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py

Ce fichier configure la page, applique l'identité visuelle, prépare la base de données,
affiche le bandeau des cours, les alertes déclenchées et le menu de navigation. Chaque
page vit dans son propre fichier, dans le dossier views/.
"""

import streamlit as st

import theme
from core import alerts, storage
from ui import load_quotes, load_symbol_quotes

st.set_page_config(page_title="FinVeille", page_icon=":material/candlestick_chart:", layout="wide")
theme.inject_css()
storage.init_db()


@st.fragment(run_every="2min")
def tape():
    """Le bandeau des cours et les alertes déclenchées, en haut de chaque page, rafraîchis toutes les 2 minutes."""
    theme.ticker_tape(load_quotes())
    if my_alerts := storage.list_alerts():
        quotes = load_symbol_quotes(tuple(sorted({a["symbol"] for a in my_alerts})))
        if fired := alerts.check(my_alerts, quotes):
            theme.alert_banner(fired)


tape()

# Un dictionnaire {section: pages} : dans le menu du haut, chaque section devient un menu déroulant.
pages = {
    "Actualité": [
        st.Page("views/feed.py", title="Le fil", icon=":material/newspaper:", default=True),
        st.Page("views/stats.py", title="En chiffres", icon=":material/monitoring:"),
    ],
    "Marchés": [
        st.Page("views/markets.py", title="Marchés", icon=":material/candlestick_chart:"),
        st.Page("views/compare.py", title="Comparer", icon=":material/compare_arrows:"),
    ],
    "Mon espace": [
        st.Page("views/following.py", title="Mes suivis", icon=":material/star:"),
        st.Page("views/portfolio.py", title="Portefeuille", icon=":material/account_balance_wallet:"),
        st.Page("views/alerts.py", title="Alertes", icon=":material/notifications:"),
        st.Page("views/favorites.py", title="Favoris", icon=":material/bookmark:"),
    ],
    "Outils": [
        st.Page("views/glossary.py", title="Glossaire", icon=":material/menu_book:"),
        st.Page("views/settings.py", title="Réglages", icon=":material/settings:"),
    ],
}
st.navigation(pages, position="top").run()
