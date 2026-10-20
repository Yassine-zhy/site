"""Test « de fumée » : chaque page s'affiche sans erreur, avec des données factices (aucun réseau)."""

import json
from pathlib import Path
from unittest import mock

import pandas as pd
import pytest
import streamlit as st
from streamlit.testing.v1 import AppTest

import ui
from conftest import TEST_DATABASE_URL, empty_postgres, make_article
from core import aggregator, assistant, crypto, macro, market
from core.market import Quote

ARTICLES = [
    make_article("Fed holds rates as inflation cools", summary="Le résumé.", source="CNBC", category="macro"),
    make_article("Nvidia shares rally to a record", source="Nasdaq", category="entreprises", hours_ago=2),
    make_article("Bitcoin rebounds", source="CoinDesk", category="crypto", hours_ago=3),
]
# Comme les vraies données : un historique indexé par des dates de séance
HISTORY = pd.Series([7700.0, 7729.7, 7803.3], index=pd.date_range("2026-10-07", periods=3, freq="D", tz="Europe/Paris"))
QUOTES = [Quote("^FCHI", "CAC 40", "Europe", "%", 7803.3, 7729.7, HISTORY)]


@pytest.fixture
def app(db, monkeypatch):
    st.cache_data.clear()
    monkeypatch.setenv("LOCAL_MODE", "true")  # par défaut : une seule personne, sans connexion (étape 22)
    monkeypatch.setattr(aggregator, "build_tasks", lambda keys: [("Test", lambda: list(ARTICLES), ())])
    def fake_quotes(watchlist=None, period="3mo"):
        """Le bandeau (sans argument) reçoit QUOTES ; une liste de symboles reçoit un cours factice pour chacun."""
        if watchlist is None:
            return QUOTES
        return [Quote(symbol, name, group, unit, 108.0, 107.0, HISTORY) for symbol, name, group, unit in watchlist]

    monkeypatch.setattr(ui, "fetch_quotes", fake_quotes)
    monkeypatch.setattr(aggregator, "fetch_yahoo_ticker_news", lambda ticker: [])
    from core import images
    monkeypatch.setattr(images, "share_images", lambda urls: {})  # pas de réseau pendant les tests
    for name in ["GEMINI_API_KEY", "GROQ_API_KEY"]:  # sans clé d'IA par défaut, quelle que soit la machine
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr(ui, "ai_keys", lambda: {})
    # mémoires partagées de l'assistant : neuves à chaque test
    monkeypatch.setattr(assistant, "CACHE", assistant.AnswerCache())
    monkeypatch.setattr(assistant, "ANALYSES", assistant.AnswerCache())
    monkeypatch.setattr(assistant, "LIMITER", assistant.RateLimiter(per_minute=20))
    from core import capacity  # mémoires partagées du site (étape 25) : neuves aussi
    monkeypatch.setattr(ui, "LAST_GOOD", capacity.Memory())
    monkeypatch.setattr(ui, "SYMBOL_QUOTES", capacity.Memory())
    monkeypatch.setattr(capacity, "QUEUE", capacity.RenderQueue())
    closes = pd.DataFrame({"MC.PA": [100.0, 102, 101, 104, 108, 107], "RMS.PA": [200.0, 199, 204, 210, 205, 212],
                           "TTE.PA": [60.0, 61, 60.5, 59, 60, 62], "AIR.PA": [150.0, 152, 149, 155, 157, 156],
                           "^FCHI": [7700.0, 7710, 7690, 7750, 7800, 7803]},
                          index=pd.date_range("2026-01-05", periods=6, freq="D"))
    monkeypatch.setattr(market, "closes_table", lambda symbols, period: closes[[s for s in symbols if s in closes]])
    monkeypatch.setattr(market, "company_profile", lambda symbol: {"shortName": symbol, "trailingPE": 20.0})
    monkeypatch.setattr(market, "company_calendar", lambda symbol: {})
    monkeypatch.setattr(market, "euro_rates", lambda: {"EUR": 1.0, "USD": 1.1})
    # Économie : une série mensuelle factice par indicateur, et des courbes des taux « normales »
    months = pd.date_range("2016-01-01", "2026-09-01", freq="MS")
    fake_macro = {i.key: pd.Series([2.0 + (n % 12) / 10 for n in range(len(months))], index=months)
                  for i in macro.INDICATORS}
    monkeypatch.setattr(macro, "fetch_all", lambda start, indicators=macro.INDICATORS: (fake_macro, []))
    days = pd.date_range("2024-10-01", "2026-10-08", freq="B")
    curve = pd.DataFrame({label: 2 + years / 10 for label, years, *_ in macro.MATURITIES}, index=days)
    monkeypatch.setattr(macro, "fetch_yield_curves", lambda start: {macro.US: curve, macro.EA: curve})
    # Crypto : les réponses d'exemple de CoinGecko et d'alternative.me
    fixtures = Path(__file__).parent / "fixtures"
    markets = crypto.parse_markets(json.loads((fixtures / "coingecko_markets.json").read_text()))
    monkeypatch.setattr(crypto, "fetch_markets", lambda count=20: markets)
    monkeypatch.setattr(crypto, "fetch_global",
                        lambda: crypto.parse_global(json.loads((fixtures / "coingecko_global.json").read_text())))
    monkeypatch.setattr(crypto, "fetch_fear_greed",
                        lambda days=90: crypto.parse_fear_greed(json.loads((fixtures / "fear_greed.json").read_text())))
    with mock.patch.object(ui, "summarize") as fake_summary:
        fake_summary.return_value.to_dict.return_value = {
            "points": ["Point"], "why": None, "engine": "Résumé local", "based_on": "article complet", "note": None,
        }
        yield AppTest.from_file(str(Path(__file__).parent.parent / "app.py"), default_timeout=60)


@pytest.mark.parametrize("page", ["views/feed.py", "views/markets.py", "views/stats.py", "views/following.py",
                                  "views/favorites.py", "views/settings.py", "views/glossary.py", "views/compare.py",
                                  "views/portfolio.py", "views/alerts.py", "views/brief.py",
                                  "views/account.py", "views/economy.py",
                                  "views/simulators.py", "views/crypto.py", "views/quiz.py", "views/assistant.py",
                                  "views/about.py"])
def test_chaque_page_s_affiche(app, page):
    app.run()
    app.switch_page(page).run()
    assert not app.exception


def test_le_pied_de_page_reste_quand_une_page_s_arrete_tot(app):
    app.run()
    app.switch_page("views/quiz.py").run()  # l'accueil du quiz s'arrête avant les questions (ui.end_page)
    assert not app.exception
    assert any("fv-footer" in element.value for element in app.get("html"))


def test_garder_puis_retrouver_dans_les_favoris(app, db):
    app.run()
    next(b for b in app.button if b.label == "Garder").click().run()
    assert db.counts(db.LOCAL_USER)["favorites"] == 1
    app.switch_page("views/favorites.py").run()
    assert any(b.label == "Retirer" for b in app.button)


def test_resume_affiche(app):
    app.run()
    next(b for b in app.button if b.label == "Résumé").click().run()
    assert not app.exception
    assert any(b.label == "Fermer le résumé" for b in app.button)


def test_les_trois_vues_des_marches(app):
    app.run()
    app.switch_page("views/markets.py").run()
    for view in ["CAC 40", "Devises", "Monde"]:
        app.segmented_control(key="markets_view").set_value(view).run()
        assert not app.exception, view


def test_portefeuille_et_alertes_avec_des_donnees(app, db):
    db.add_position(db.LOCAL_USER, "MC.PA", "LVMH", 10, 95.0, "EUR", "2026-01-05")
    db.add_alert(db.LOCAL_USER, "MC.PA", "LVMH", "above", 50.0)  # déclenchée : le cours factice est 108
    app.run()
    assert not app.exception
    assert any("LVMH" in element.value for element in app.get("html"))  # le bandeau d'alerte est affiché
    app.switch_page("views/portfolio.py").run()
    assert not app.exception
    assert any("Mes positions" in element.value for element in app.get("html"))  # la valorisation s'affiche
    app.switch_page("views/alerts.py").run()
    assert not app.exception
    assert any("Déclenchée" in element.value for element in app.get("html"))


# --- Comptes utilisateurs : on simule la connexion en remplaçant les fonctions de ui.py -----------


def test_visiteur_non_connecte(app, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google", "auth0"])
    monkeypatch.setattr(ui, "current_user", lambda: None)
    app.run()
    assert not app.exception
    assert not any(b.label == "Garder" for b in app.button)  # pas d'action personnelle sans compte
    assert any(b.label == "Résumé" for b in app.button)  # mais la lecture reste ouverte à tous
    for page in ["views/favorites.py", "views/following.py", "views/portfolio.py", "views/alerts.py",
                 "views/settings.py", "views/account.py"]:
        app.switch_page(page).run()
        assert not app.exception, page
        assert any(b.label == "Continuer avec Google" for b in app.button), page
        assert any(b.label == "Facebook et autres comptes" for b in app.button), page
        assert any(b.label == "Créer mon compte" for b in app.button), page  # et toujours l'inscription par e-mail
        assert any("fv-footer" in element.value for element in app.get("html")), page  # pied de page conservé
    for page in ["views/brief.py", "views/markets.py", "views/compare.py", "views/glossary.py", "views/stats.py"]:
        app.switch_page(page).run()  # les pages publiques s'affichent normalement
        assert not app.exception, page


def test_les_favoris_vont_dans_le_compte_connecte(app, db, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google"])
    monkeypatch.setattr(ui, "current_user", lambda: "alice@example.com")
    app.run()
    next(b for b in app.button if b.label == "Garder").click().run()
    assert db.counts("alice@example.com")["favorites"] == 1
    assert db.counts(db.LOCAL_USER)["favorites"] == 0
    app.switch_page("views/account.py").run()
    assert not app.exception
    assert any(b.label == "Se déconnecter" for b in app.button)


def test_les_quatre_simulateurs(app):
    app.run()
    app.switch_page("views/simulators.py").run()
    for name in ["Épargne", "Investissement programmé", "Crédit immobilier", "Inflation"]:
        app.segmented_control(key="simulator").set_value(name).run()
        assert not app.exception, name
        assert any("fv-kpi" in element.value for element in app.get("html")), name  # les chiffres clés s'affichent


def test_une_partie_de_quiz_complete(app, db):
    app.run()
    app.switch_page("views/quiz.py").run()
    next(b for b in app.button if b.label == "Commencer").click().run()
    for _ in range(10):
        next(b for b in app.button if b.key and b.key.startswith("choice_")).click().run()  # répond (au hasard)
        assert not app.exception
        next(b for b in app.button if b.label in ("Question suivante", "Voir mon score")).click().run()
    assert any("Ton score" in element.value for element in app.get("html"))
    assert db.get_setting(db.LOCAL_USER, "quiz_best")["total"] == 10  # le meilleur score est enregistré
    assert db.get_setting(db.LOCAL_USER, "quiz_played") == 1


@pytest.mark.skipif(not TEST_DATABASE_URL, reason="FINVEILLE_TEST_DATABASE_URL non défini")
def test_garder_un_article_avec_postgresql(app, monkeypatch):
    """Le même parcours que test_garder_puis_retrouver_dans_les_favoris, avec la base PostgreSQL."""
    store = empty_postgres(monkeypatch)
    app.run()
    next(b for b in app.button if b.label == "Garder").click().run()
    assert store.counts(store.LOCAL_USER)["favorites"] == 1
    app.switch_page("views/favorites.py").run()
    assert any(b.label == "Retirer" for b in app.button)
    app.switch_page("views/settings.py").run()
    assert not app.exception


def test_notifications_par_e_mail_dans_les_reglages(app, db, monkeypatch):
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google"])
    monkeypatch.setattr(ui, "current_user", lambda: "alice@example.com")
    db.touch_user("alice@example.com", "alice@example.com", "Alice")
    app.run()
    app.switch_page("views/settings.py").run()
    toggle = app.toggle(key="pref_email_brief")
    toggle.set_value(True).run()
    assert not app.exception
    assert db.get_setting("alice@example.com", "email_brief") is True
    assert [u["email"] for u in db.users_with_setting("email_brief")] == ["alice@example.com"]



# --- Comptes par e-mail (étape 22) ------------------------------------------------------------------


def fill(app, values: dict) -> None:
    for key, value in values.items():
        app.text_input(key=key).input(value)


def click(app, label: str):
    next(b for b in app.button if b.label == label).click().run()


def test_inscription_par_email_puis_espace_personnel(app, db, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    app.switch_page("views/favorites.py").run()
    assert any(b.label == "Créer mon compte" for b in app.button)  # l'espace personnel demande un compte
    fill(app, {"require_signup_name": "Alice", "require_signup_email": "alice@example.com",
               "require_signup_password": "Bourse2026!", "require_signup_confirm": "Bourse2026!"})
    click(app, "Créer mon compte")
    assert not app.exception
    assert app.session_state["fv_user"] == "mail:alice@example.com"
    assert db.get_user("mail:alice@example.com")["name"] == "Alice"
    assert any("Gardés" in element.value for element in app.get("html"))  # la page Favoris s'affiche


def test_mots_de_passe_differents(app, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    app.switch_page("views/account.py").run()
    fill(app, {"account_signup_email": "alice@example.com", "account_signup_password": "Bourse2026!",
               "account_signup_confirm": "Bourse2027!"})
    click(app, "Créer mon compte")
    assert "différents" in app.error[0].value and "fv_user" not in app.session_state


def test_connexion_puis_deconnexion(app, db, monkeypatch):
    from core import accounts

    monkeypatch.delenv("LOCAL_MODE")
    accounts.register("bob@example.com", "Bourse2026!", "Bob")
    app.run()
    app.switch_page("views/account.py").run()
    fill(app, {"account_login_email": "bob@example.com", "account_login_password": "mauvais123"})
    click(app, "Se connecter")
    assert app.error[0].value == accounts.GENERIC_ERROR
    fill(app, {"account_login_email": "bob@example.com", "account_login_password": "Bourse2026!"})
    click(app, "Se connecter")
    assert app.session_state["fv_user"] == "mail:bob@example.com"
    assert any(b.label == "Se déconnecter" for b in app.button)
    click(app, "Se déconnecter")
    assert "fv_user" not in app.session_state
    assert any(b.label == "Créer mon compte" for b in app.button)


def test_assistant_de_configuration_reserve_a_l_administrateur(app, db, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    monkeypatch.setenv("ADMIN_EMAILS", "alice@example.com")
    db.touch_user("mail:alice@example.com", "alice@example.com", "Alice")
    monkeypatch.setattr(ui, "current_user", lambda: "mail:alice@example.com")
    app.run()
    app.switch_page("views/setup.py").run()
    assert not app.exception
    assert any("oauth2callback" in element.value for element in app.code)
    assert any("Connexion par e-mail" in element.value for element in app.get("html"))


@pytest.fixture
def mailbox(monkeypatch):
    """Un faux serveur d'envoi d'e-mails : les messages « envoyés » sont rangés dans une liste."""
    from core import notify

    sent = []

    class FakeSMTP:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *exc): return False
        def starttls(self): pass
        def login(self, user, password): pass
        def send_message(self, message): sent.append(message)

    monkeypatch.setattr(notify.smtplib, "SMTP", FakeSMTP)
    for name, value in {"SMTP_HOST": "smtp.example.com", "SMTP_USER": "site@example.com", "SMTP_PASSWORD": "x"}.items():
        monkeypatch.setenv(name, value)
    return sent


def code_in(message) -> str:
    import re

    return re.search(r"\b(\d{6})\b", message.get_body(("plain",)).get_content()).group(1)


def test_inscription_avec_code_de_confirmation(app, db, monkeypatch, mailbox):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    app.switch_page("views/account.py").run()
    fill(app, {"account_signup_email": "alice@example.com", "account_signup_password": "Bourse2026!",
               "account_signup_confirm": "Bourse2026!"})
    click(app, "Créer mon compte")
    assert "fv_user" not in app.session_state  # pas encore connecté : l'adresse doit être confirmée
    assert mailbox[0]["To"] == "alice@example.com"
    fill(app, {"account_verify_code": code_in(mailbox[0])})
    click(app, "Activer mon compte")
    assert app.session_state["fv_user"] == "mail:alice@example.com"
    assert db.get_credentials("alice@example.com")["verified"] == 1


def test_mot_de_passe_oublie(app, db, monkeypatch, mailbox):
    from core import accounts

    monkeypatch.delenv("LOCAL_MODE")
    accounts.register("bob@example.com", "Bourse2026!")
    app.run()
    app.switch_page("views/account.py").run()
    fill(app, {"account_reset_email": "bob@example.com"})
    click(app, "Recevoir un code")
    fill(app, {"account_reset_code": code_in(mailbox[-1]), "account_reset_password": "Nouveau2027!"})
    click(app, "Changer mon mot de passe")
    assert app.session_state["fv_user"] == "mail:bob@example.com"
    assert accounts.authenticate("bob@example.com", "Nouveau2027!") == "mail:bob@example.com"


def test_mot_de_passe_oublie_ne_revele_pas_les_comptes(app, monkeypatch, mailbox):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    app.switch_page("views/account.py").run()
    fill(app, {"account_reset_email": "inconnu@example.com"})
    click(app, "Recevoir un code")
    assert mailbox == []  # aucun e-mail pour une adresse inconnue…
    assert any("Si un compte existe" in element.value for element in app.info)  # … mais la même réponse


# --- Assistant IA (étape 24) : une « IA » simulée, sans réseau ----------------------------------------------


@pytest.fixture
def fake_ai(monkeypatch):
    """Une IA qui répond toujours la même chose, en deux morceaux ; `calls` compte les questions reçues."""
    calls = []

    def open_stream(messages, keys, max_tokens=900):
        calls.append(messages)
        return "Groq", iter(["La Fed maintient ses taux [1]", " car l'inflation ralentit."])

    monkeypatch.setattr(ui, "ai_keys", lambda: {"GROQ_API_KEY": "cle-de-test"})
    monkeypatch.setattr(assistant, "open_stream", open_stream)
    return calls


def chat_texts(app) -> str:
    return " ".join(m.value for m in app.markdown) + " ".join(h.value for h in app.get("html"))


def test_assistant_sans_ia_cherche_dans_les_depeches(app):
    app.run()
    app.switch_page("views/assistant.py").run()
    assert any("Mode sans IA" in h.value for h in app.get("html"))
    next(b for b in app.button if b.label == "Que fait la Fed en ce moment ?").click().run()
    assert not app.exception
    texts = chat_texts(app)
    assert "**Fed** :" in texts or "Fed</strong>" in texts or "Réserve fédérale" in texts  # la définition
    assert "Fed holds rates as inflation cools" in texts  # la dépêche trouvée
    assert any(b.label == "Nouvelle conversation" for b in app.button)


def test_assistant_avec_ia_cite_ses_sources_et_garde_la_reponse(app, db, fake_ai):
    app.run()
    app.switch_page("views/assistant.py").run()
    assert any("IA active" in h.value for h in app.get("html"))
    app.chat_input[0].set_value("Que fait la Fed ?").run()
    assert not app.exception
    texts = chat_texts(app)
    assert "La Fed maintient ses taux [[1]](" in texts  # [1] devient un lien vers la dépêche
    assert "Sources citées" in texts and "Fed holds rates" in texts
    assert db.get_setting(db.LOCAL_USER, "ai_usage")["count"] == 1  # une question comptée
    assert len(fake_ai) == 1 and fake_ai[0][0]["role"] == "system"
    # Même question dans une nouvelle conversation : réponse en mémoire, l'IA n'est pas rappelée
    next(b for b in app.button if b.label == "Nouvelle conversation").click().run()
    app.chat_input[0].set_value("que fait la FED").run()
    assert len(fake_ai) == 1
    assert "déjà préparée" in " ".join(c.value for c in app.caption)
    # Une question de suite garde le fil de la conversation
    app.chat_input[0].set_value("Et la BCE ?").run()
    assert len(fake_ai) == 2 and [m["role"] for m in fake_ai[1]][-3:] == ["user", "assistant", "user"]


def test_une_reponse_coupee_n_est_pas_gardee_en_memoire(app, monkeypatch):
    calls = []

    def truncated_stream(messages, keys, max_tokens=1500):
        calls.append(1)

        def pieces():
            yield "La Fed hésite, car l'inflation sur de"
            raise assistant.Truncated("réponse incomplète : longueur maximale atteinte")
        return "Gemini", pieces()

    monkeypatch.setattr(ui, "ai_keys", lambda: {"GEMINI_API_KEY": "cle-de-test"})
    monkeypatch.setattr(assistant, "open_stream", truncated_stream)
    app.run()
    app.switch_page("views/assistant.py").run()
    app.chat_input[0].set_value("Que fait la Fed ?").run()
    assert not app.exception
    assert "réponse incomplète" in " ".join(c.value for c in app.caption)
    next(b for b in app.button if b.label == "Nouvelle conversation").click().run()
    app.chat_input[0].set_value("Que fait la Fed ?").run()
    assert len(calls) == 2  # pas resservie depuis la mémoire : on redemande à l'IA


def test_assistant_quota_des_visiteurs(app, monkeypatch, fake_ai):
    monkeypatch.delenv("LOCAL_MODE")
    monkeypatch.setattr(ui, "current_user", lambda: None)
    monkeypatch.setenv("AI_VISITOR_LIMIT", "1")
    app.run()
    app.switch_page("views/assistant.py").run()
    app.chat_input[0].set_value("Que fait la Fed ?").run()
    app.chat_input[0].set_value("Et le bitcoin ?").run()
    assert not app.exception
    assert len(fake_ai) == 1  # la deuxième question n'est pas envoyée à l'IA…
    captions = " ".join(c.value for c in app.caption)
    assert "quota de questions" in captions and "connecte-toi" in captions
    assert "Bitcoin rebounds" in chat_texts(app)  # … mais reçoit quand même les dépêches


def test_edito_ia_du_brief_et_analyse_d_entreprise(app, db, fake_ai):
    app.run()
    app.switch_page("views/brief.py").run()
    assert not app.exception
    assert any(s.value == "L'édito de l'IA" or "édito" in s.value for s in app.get("html"))
    app.switch_page("views/brief.py").run()
    assert len(fake_ai) == 1  # un seul édito par heure pour tout le site
    db.add_follow(db.LOCAL_USER, "company", "MC.PA", "LVMH")
    app.switch_page("views/following.py").run()
    app.pills(key="follow_view").set_value("company|MC.PA").run()
    next(b for b in app.button if b.label == "Analyser cette entreprise").click().run()
    assert not app.exception
    assert len(fake_ai) == 2 and "MC.PA" in fake_ai[1][0]["content"]
    assert "Rédigé par Groq" in " ".join(c.value for c in app.caption)


def test_analyse_d_entreprise_sans_ia(app, db):
    db.add_follow(db.LOCAL_USER, "company", "MC.PA", "LVMH")
    app.run()
    app.switch_page("views/following.py").run()
    app.pills(key="follow_view").set_value("company|MC.PA").run()
    next(b for b in app.button if b.label == "Analyser cette entreprise").click().run()
    assert not app.exception
    assert any("**Points forts**" in m.value for m in app.markdown)
    assert "sans IA" in " ".join(c.value for c in app.caption)
