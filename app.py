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
from ui import current_user, get_secret, is_admin, load_quotes, load_symbol_quotes, local_mode, sync_cookie

# Le logo : un carré bleu et une courbe (le nom « FinVeille » est ajouté à côté en CSS, voir theme.py)
LOGO = str(Path(__file__).parent / "assets" / "logo.svg")

st.set_page_config(page_title="FinVeille", page_icon=LOGO, layout="wide")
st.logo(LOGO, size="large")
theme.inject_css()
if database_url := get_secret("DATABASE_URL"):  # base PostgreSQL en ligne (guide 20) ; sinon SQLite
    storage.configure(database_url)
storage.init_db()
sync_cookie()  # pose ou efface le cookie « rester connecté » après une connexion ou une déconnexion


def account_bar() -> None:
    """Dans la barre du haut, à droite : « Se connecter », ou le prénom de l'utilisateur connecté.

    Rien en mode local. Le conteneur porte la clé « fvaccount » : theme.py le place dans la barre du haut.
    """
    if local_mode():
        return
    user = current_user()
    with st.container(horizontal=True, vertical_alignment="center", key="fvaccount"):
        if user:
            name = (storage.get_user(user) or {}).get("name") or "Mon compte"
            st.page_link("views/account.py", label=name.split()[0] if name.split() else name,
                         icon=":material/account_circle:")
        else:
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
        st.Page("views/economy.py", title="Économie", icon=":material/account_balance:"),
        st.Page("views/crypto.py", title="Crypto", icon=":material/currency_bitcoin:"),
        st.Page("views/compare.py", title="Comparer", icon=":material/compare_arrows:"),
    ],
    "Mon espace": [
        st.Page("views/following.py", title="Mes suivis", icon=":material/star:"),
        st.Page("views/portfolio.py", title="Portefeuille", icon=":material/account_balance_wallet:"),
        st.Page("views/alerts.py", title="Alertes", icon=":material/notifications:"),
        st.Page("views/favorites.py", title="Favoris", icon=":material/bookmark:"),
    ],
    "Outils": [
        st.Page("views/simulators.py", title="Simulateurs", icon=":material/calculate:"),
        st.Page("views/quiz.py", title="Quiz", icon=":material/quiz:"),
        st.Page("views/glossary.py", title="Glossaire", icon=":material/menu_book:"),
        st.Page("views/settings.py", title="Réglages", icon=":material/settings:"),
        st.Page("views/account.py", title="Mon compte", icon=":material/account_circle:"),
    ],
}
if is_admin(current_user()):  # l'assistant de configuration n'est visible que par l'administrateur
    pages["Outils"].append(st.Page("views/setup.py", title="Configuration", icon=":material/admin_panel_settings:"))
page = st.navigation(pages, position="top")
account_bar()  # après st.navigation : st.page_link a besoin que les pages soient déclarées
page.run()
