"""FinVeille — point d'entrée de l'application.

Lancer avec :  streamlit run app.py

Ce fichier configure la page, applique l'identité visuelle, prépare la base de données,
affiche le bandeau des cours, les alertes déclenchées et le menu de navigation. Chaque
page vit dans son propre fichier, dans le dossier views/.
"""

from pathlib import Path

import streamlit as st

import theme
from core import alerts, storage
from ui import auth_providers, current_user, load_quotes, load_symbol_quotes

# Le logo : un carré bleu et une courbe (le nom « FinVeille » est ajouté à côté en CSS, voir theme.py)
LOGO = str(Path(__file__).parent / "assets" / "logo.svg")

st.set_page_config(page_title="FinVeille", page_icon=LOGO, layout="wide")
st.logo(LOGO, size="large")
theme.inject_css()
storage.init_db()


def account_bar() -> None:
    """Dans la barre du haut, à droite : « Se connecter », ou le nom de l'utilisateur connecté.

    Rien en mode local. Le conteneur porte la clé « fvaccount » : theme.py le place dans la barre du haut.
    """
    providers = auth_providers()
    if not providers:
        return
    with st.container(horizontal=True, vertical_alignment="center", key="fvaccount"):
        if current_user():
            st.page_link("views/account.py", label=st.user.get("given_name") or st.user.get("name")
                         or st.user.get("email") or "Mon compte", icon=":material/account_circle:")
        elif len(providers) == 1:
            st.button("Se connecter", key="bar_login", type="primary", on_click=st.login,
                      args=(providers[0],) if providers[0] else ())
        else:  # plusieurs services : la page « Mon compte » propose un bouton par service
            st.page_link("views/account.py", label="Se connecter", icon=":material/login:")


@st.fragment(run_every="2min")
def tape():
    """Le bandeau des cours et les alertes déclenchées, en haut de chaque page, rafraîchis toutes les 2 minutes."""
    theme.ticker_tape(load_quotes())
    user = current_user()
    if user and (my_alerts := storage.list_alerts(user)):
        quotes = load_symbol_quotes(tuple(sorted({a["symbol"] for a in my_alerts})))
        if fired := alerts.check(my_alerts, quotes):
            theme.alert_banner(fired)


tape()

# Un dictionnaire {section: pages} : dans le menu du haut, chaque section devient un menu déroulant.
pages = {
    "Actualité": [
        st.Page("views/feed.py", title="Le fil", icon=":material/newspaper:", default=True),
        st.Page("views/brief.py", title="Le brief", icon=":material/summarize:"),
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
        st.Page("views/account.py", title="Mon compte", icon=":material/account_circle:"),
    ],
}
page = st.navigation(pages, position="top")
account_bar()  # après st.navigation : st.page_link a besoin que les pages soient déclarées
page.run()
