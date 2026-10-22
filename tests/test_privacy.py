"""Vie privée (RGPD) : aucune requête du navigateur vers Google, consentement à l'inscription, durée de conservation
des données, lien de désinscription des e-mails, avertissement près de l'assistant IA."""

import re
import tomllib
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import streamlit as st

import theme
import ui
from conftest import make_article
from core import storage
from scripts import send_notifications as script
# Les décors des tests de pages et d'e-mails : l'appli factice, l'IA simulée, les abonnés et le faux serveur SMTP
from test_app import app, click, fake_ai, fill  # noqa: F401
from test_notify import fake_smtp, subscriber  # noqa: F401

ROOT = Path(__file__).resolve().parent.parent
GOOGLE = re.compile(r"google\.com|gstatic\.com|googleapis\.com|googleusercontent", re.I)
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 40


@pytest.fixture(autouse=True)
def fake_logos(monkeypatch):
    """Le téléchargement des logos est simulé (aucun réseau) ; les mémoires du serveur sont vidées avant chaque test."""
    calls = []

    def download(domain):
        calls.append(domain)
        if domain == "panne.example":
            raise OSError("le service ne répond pas")
        return "data:image/png;base64,iVBORw0KGgo="

    st.cache_data.clear()
    for memory in (ui._NO_FAVICON, ui._WARM, ui.UNKNOWN):  # UNKNOWN : « inconnu » retenu par un test précédent
        memory._items.clear()
    monkeypatch.setattr(ui, "_download_favicon", download)
    return calls


def all_html(app) -> str:
    """Tout ce que la page envoie au navigateur sous forme de HTML ou de Markdown."""
    return " ".join(e.value for e in [*app.get("html"), *app.markdown, *app.caption])


# --- 1. Les polices sont servies par le site ---------------------------------------------------------


def test_la_config_ne_reference_plus_google_fonts():
    text = (ROOT / ".streamlit" / "config.toml").read_text(encoding="utf-8")
    assert not GOOGLE.search(text)
    config = tomllib.loads(text)["theme"]
    assert config["font"] == "IBM Plex Sans" and config["codeFont"] == "IBM Plex Mono"
    assert "http" not in config["headingFont"]


def test_chaque_police_declaree_existe():
    faces = tomllib.loads((ROOT / ".streamlit" / "config.toml").read_text(encoding="utf-8"))["theme"]["fontFaces"]
    assert faces
    for face in faces:
        assert face["url"].startswith("app/static/fonts/"), face  # servie par le site (enableStaticServing)
        path = ROOT / face["url"].removeprefix("app/")
        assert path.is_file() and path.read_bytes()[:4] == b"wOF2", face
    families = {face["family"] for face in faces}
    assert {"IBM Plex Sans", "IBM Plex Mono", "Newsreader", "Schibsted Grotesk"} <= families
    assert (ROOT / "static" / "fonts" / "OFL.txt").is_file()  # la licence voyage avec les polices


def test_aucune_adresse_google_dans_le_code_de_l_appli():
    """Ni polices, ni logos : seul ui.py nomme le service de logos (appelé par le serveur), et core/summarizer.py
    l'API de Gemini (aussi appelée par le serveur)."""
    skipped = {"tests", "video", "node_modules", "docs", "tools", "guide", "__pycache__", ".git"}
    offenders = []
    for path in ROOT.rglob("*"):
        if path.suffix not in {".py", ".js", ".css", ".toml"} or skipped & set(path.relative_to(ROOT).parts):
            continue
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if re.search(r"fonts\.googleapis|gstatic|s2/favicons", line) and path.name != "ui.py":
                offenders.append(f"{path.relative_to(ROOT)} : {line.strip()[:80]}")
    assert not offenders


# --- 2. Les logos des sources, récupérés par le serveur ------------------------------------------------


def test_l_icone_de_secours_est_un_data_uri():
    icon = theme.fallback_icon("lemonde.fr")
    assert icon.startswith("data:image/svg+xml;base64,")
    assert not GOOGLE.search(icon) and "http" not in icon.replace("http://www.w3.org", "")
    assert theme.fallback_icon("") != ""  # même sans domaine
    assert theme.favicon_url("https://www.lemonde.fr/a") == theme.fallback_icon("lemonde.fr")
    assert theme.favicon_url("https://www.lemonde.fr/a", {"lemonde.fr": "data:image/png;base64,AA"}) == (
        "data:image/png;base64,AA")


def test_le_telechargement_renvoie_un_data_uri(monkeypatch):
    class Reponse:
        status_code, content = 200, PNG
        headers = {"Content-Type": "image/png"}

        def raise_for_status(self):
            pass

    asked = []
    monkeypatch.undo()  # retire le faux téléchargement : on teste le vrai, avec un faux requests.get
    monkeypatch.setattr(ui.requests, "get", lambda url, **kw: asked.append((url, kw)) or Reponse())
    uri = ui._download_favicon("lemonde.fr")
    assert uri.startswith("data:image/png;base64,")
    assert asked[0][0] == "https://www.google.com/s2/favicons?domain=lemonde.fr&sz=64" and asked[0][1]["timeout"] <= 5
    Reponse.headers = {"Content-Type": "text/html"}  # pas une image
    with pytest.raises(ValueError):
        ui._download_favicon("lemonde.fr")
    Reponse.headers, Reponse.content = {"Content-Type": "image/png"}, b"0" * (ui.FAVICON_MAX_BYTES + 1)  # trop gros
    with pytest.raises(ValueError):
        ui._download_favicon("lemonde.fr")
    with pytest.raises(ValueError):  # un domaine qui n'en est pas un n'est jamais envoyé au service
        ui._download_favicon("a.com&sz=1#")


def test_en_cas_d_echec_l_icone_neutre_et_pas_de_nouvel_essai(fake_logos):
    assert ui.favicon("https://panne.example/x") == theme.fallback_icon("panne.example")
    assert ui.favicon("https://panne.example/y") == theme.fallback_icon("panne.example")
    assert fake_logos.count("panne.example") == 1  # un seul essai pendant 10 minutes
    assert ui.favicon("") == theme.fallback_icon("")


def test_le_logo_est_garde_en_memoire(fake_logos):
    first = ui.favicon("https://www.lemonde.fr/a")
    assert first.startswith("data:image/png") and ui.favicon("https://lemonde.fr/b") == first
    assert fake_logos == ["lemonde.fr"]


def test_plusieurs_logos_en_parallele(fake_logos):
    urls = [f"https://site{i}.example/a" for i in range(8)] + ["https://panne.example"]
    icons = ui.favicons(urls)
    assert set(icons) == {f"site{i}.example" for i in range(8)} | {"panne.example"}
    assert icons["site3.example"].startswith("data:image/png")
    assert icons["panne.example"].startswith("data:image/svg+xml")
    assert sorted(fake_logos) == sorted({u.split("/")[2] for u in urls})


def test_les_articles_et_les_sources_citees_n_ont_aucune_adresse_google():
    article = make_article("Un titre", source="CNBC", url="https://www.cnbc.com/a")
    for layout in ("row", "tile", "lead", "compact"):
        html = ui.article_html(article, False, layout, image=None)
        assert not GOOGLE.search(html), layout
    assert "data:image/png" in ui.article_html(article, False, "row")
    sources = [{"n": 1, "url": "https://www.cnbc.com/a", "title": "T", "source": "CNBC",
                "published": "2026-10-10T10:00:00+00:00"}]
    html = theme.sources_html(sources, "Sources", ui.favicons(s["url"] for s in sources))
    assert "data:image/png" in html and not GOOGLE.search(html)
    assert not GOOGLE.search(theme.sources_html(sources))  # sans table : l'icône neutre


@pytest.mark.parametrize("page", ["views/feed.py", "views/stats.py", "views/assistant.py"])
def test_les_pages_n_ont_aucune_adresse_google(app, page):
    app.run()
    app.switch_page(page).run()
    assert not app.exception
    assert "data:image" in all_html(app)  # les logos sont bien là, insérés dans la page
    assert not GOOGLE.search(all_html(app))


def test_l_assistant_n_a_aucune_adresse_google_avec_des_sources(app, fake_ai):
    app.run()
    app.switch_page("views/assistant.py").run()
    app.chat_input[0].set_value("Que fait la Fed ?").run()
    html = all_html(app)
    assert "Sources citées" in html and "data:image" in html and not GOOGLE.search(html)


# --- 3. Le consentement à l'inscription --------------------------------------------------------------


def signup(app, consent: bool):
    app.switch_page("views/account.py").run()
    fill(app, {"account_signup_email": "alice@example.com", "account_signup_password": "Bourse2026!",
               "account_signup_confirm": "Bourse2026!", "account_signup_consent": consent})
    click(app, "Créer mon compte")


def test_la_case_de_consentement_est_decochee_et_a_ses_liens(app, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    app.switch_page("views/account.py").run()
    box = app.checkbox(key="account_signup_consent")
    assert box.value is False
    assert "./conditions" in box.label and "./confidentialite" in box.label


def test_sans_la_case_le_compte_n_est_pas_cree(app, db, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    signup(app, consent=False)
    assert "fv_user" not in app.session_state and db.get_credentials("alice@example.com") is None
    assert [e.value for e in app.error] == [ui.CONSENT_MISSING]


def test_avec_la_case_le_compte_est_cree(app, db, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    app.run()
    signup(app, consent=True)
    assert not app.exception and app.session_state["fv_user"] == "mail:alice@example.com"


def test_les_services_de_connexion_rappellent_les_conditions(app, monkeypatch):
    monkeypatch.delenv("LOCAL_MODE")
    monkeypatch.setattr(ui, "auth_providers", lambda: ["google"])
    app.run()
    app.switch_page("views/account.py").run()
    captions = " ".join(c.value for c in app.caption)
    assert "En te connectant, tu acceptes les [conditions d'utilisation](./conditions)" in captions
    assert "[politique de confidentialité](./confidentialite)" in captions


def test_la_page_mon_compte_annonce_l_effacement_automatique(app):
    app.run()
    app.switch_page("views/account.py").run()
    captions = " ".join(c.value for c in app.caption)
    assert "Un compte sans connexion pendant 3 ans est effacé automatiquement" in captions
    assert "(./confidentialite)" in captions


# --- 4. Effacer les comptes inactifs ----------------------------------------------------------------


def seen(db, user, days_ago, now):
    db.touch_user(user, user, user)
    with db.connect() as conn:
        conn.execute("UPDATE users SET last_seen = ? WHERE user_id = ?",
                     ((now - timedelta(days=days_ago)).isoformat(), user))


def test_purge_inactive_efface_les_comptes_oublies(store):
    now = datetime(2026, 10, 22, tzinfo=timezone.utc)
    seen(store, "vieux@example.com", 3 * 365 + 5, now)
    seen(store, "recent@example.com", 100, now)
    store.set_flag("vieux@example.com", make_article("Un article"), "is_favorite", True)
    store.add_follow("vieux@example.com", "company", "MC.PA", "LVMH")
    store.add_follow("recent@example.com", "company", "MC.PA", "LVMH")
    store.save_session("hash-vieux", "vieux@example.com", (now + timedelta(days=5)).isoformat())
    assert store.purge_inactive(now - timedelta(days=store.RETENTION_DAYS)) == ["vieux@example.com"]
    assert store.get_user("vieux@example.com") is None
    assert store.list_favorites("vieux@example.com") == [] and store.list_follows("vieux@example.com") == []
    assert store.get_session("hash-vieux") is None
    assert store.get_user("recent@example.com") and len(store.list_follows("recent@example.com")) == 1
    assert store.purge_inactive(now - timedelta(days=store.RETENTION_DAYS)) == []  # rien de plus la fois suivante


def test_purge_inactive_efface_aussi_le_mot_de_passe_et_epargne_le_mode_local(store):
    now = datetime(2026, 10, 22, tzinfo=timezone.utc)
    store.save_credentials("vieux@example.com", "hash", True)
    seen(store, "mail:vieux@example.com", 2000, now)
    store.touch_user("mail:vieux@example.com", "vieux@example.com", "Vieux")
    with store.connect() as conn:
        conn.execute("UPDATE users SET last_seen = ? WHERE user_id = 'mail:vieux@example.com'",
                     ((now - timedelta(days=2000)).isoformat(),))
    seen(store, store.LOCAL_USER, 2000, now)
    assert store.purge_inactive(now - timedelta(days=1095)) == ["mail:vieux@example.com"]
    assert store.get_credentials("vieux@example.com") is None
    assert store.get_user(store.LOCAL_USER) is not None


def test_purge_expired_efface_sessions_et_codes_perimes(store):
    now = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)
    store.save_session("vivante", "a@example.com", (now + timedelta(days=3)).isoformat())
    store.save_session("morte", "a@example.com", (now - timedelta(minutes=1)).isoformat())
    store.save_code("a@example.com", "verify", "hash", (now - timedelta(hours=1)).isoformat())
    store.save_code("a@example.com", "reset", "hash", (now + timedelta(minutes=10)).isoformat())
    assert store.purge_expired(now) == 2
    assert store.get_session("morte") is None and store.get_session("vivante") is not None
    assert store.get_code("a@example.com", "verify") is None and store.get_code("a@example.com", "reset") is not None
    assert store.purge_expired(now) == 0


def test_une_visite_met_a_jour_last_seen(store):
    before = datetime.now(timezone.utc) - timedelta(days=2000)
    seen(store, "alice@example.com", 2000, datetime.now(timezone.utc))
    store.touch_user("alice@example.com", "alice@example.com", "Alice")
    assert datetime.fromisoformat(store.get_user("alice@example.com")["last_seen"]) > before + timedelta(days=1999)


def test_une_session_restauree_par_cookie_met_a_jour_last_seen(app, db, monkeypatch):
    """Un visiteur qui revient avec son cookie n'a pas à se reconnecter : sa visite doit quand même compter."""
    from core import accounts

    monkeypatch.delenv("LOCAL_MODE")
    accounts.register("bob@example.com", "Bourse2026!", "Bob")
    token = accounts.create_session("mail:bob@example.com")
    with db.connect() as conn:
        conn.execute("UPDATE users SET last_seen = '2020-01-01T00:00:00+00:00'")
    monkeypatch.setattr(ui, "_cookie_token", lambda: token)
    app.run()
    app.switch_page("views/favorites.py").run()
    assert app.session_state["fv_user"] == "mail:bob@example.com"
    assert db.get_user("mail:bob@example.com")["last_seen"] > "2026"


def test_le_script_efface_les_comptes_inactifs_avant_le_brief(subscriber, fake_smtp, capsys):
    seen(subscriber, "oublie@example.com", 3 * 365 + 30, datetime.now(timezone.utc))
    script.main(["brief"])
    out = capsys.readouterr().out
    assert "1 compte(s) inactif(s) depuis plus de 3 ans effacé(s)" in out
    assert "oublie@example.com" not in out  # jamais d'adresse dans le journal
    assert subscriber.get_user("oublie@example.com") is None and subscriber.get_user("alice@example.com")


def test_le_script_en_essai_a_blanc_compte_sans_effacer(subscriber, fake_smtp, capsys):
    seen(subscriber, "oublie@example.com", 3 * 365 + 30, datetime.now(timezone.utc))
    script.main(["brief", "--dry-run"])
    assert "1 compte(s) inactif(s)" in capsys.readouterr().out
    assert subscriber.get_user("oublie@example.com") is not None


def test_les_alertes_n_effacent_rien(subscriber, fake_smtp):
    seen(subscriber, "oublie@example.com", 3 * 365 + 30, datetime.now(timezone.utc))
    script.main(["alerts"])
    assert subscriber.get_user("oublie@example.com") is not None  # le ménage est fait une fois par jour, avec le brief


# --- 5. Les e-mails : lien et en-tête de désinscription -----------------------------------------------


SETTINGS_URL = "https://finveille.example/settings"


def test_le_brief_contient_le_lien_de_desinscription(subscriber, fake_smtp, monkeypatch):
    monkeypatch.setenv("SITE_URL", "https://finveille.example/")
    script.main(["brief"])
    message = fake_smtp.sent[0][1]
    assert message["List-Unsubscribe"] == f"<{SETTINGS_URL}>"
    assert SETTINGS_URL in message.get_body(("plain",)).get_content()
    assert f'href="{SETTINGS_URL}"' in message.get_body(("html",)).get_content()


def test_l_alerte_contient_le_lien_de_desinscription(subscriber, fake_smtp, monkeypatch):
    monkeypatch.setenv("SITE_URL", "https://finveille.example")
    script.main(["alerts"])
    message = fake_smtp.sent[0][1]
    assert message["List-Unsubscribe"] == f"<{SETTINGS_URL}>"
    assert SETTINGS_URL in message.get_body(("plain",)).get_content()
    assert f'href="{SETTINGS_URL}"' in message.get_body(("html",)).get_content()


def test_sans_adresse_du_site_pas_d_en_tete_mais_la_consigne_reste(subscriber, fake_smtp, monkeypatch):
    monkeypatch.delenv("SITE_URL", raising=False)
    script.main(["brief"])
    message = fake_smtp.sent[0][1]
    assert message["List-Unsubscribe"] is None
    assert "Réglages → Notifications par e-mail" in message.get_body(("plain",)).get_content()


def test_les_codes_de_confirmation_n_ont_pas_d_en_tete_de_desinscription():
    from core import notify

    message = notify.make_message("a@b.c", "d@e.f", "Code", "123456", "<p>123456</p>")
    assert message["List-Unsubscribe"] is None  # un e-mail demandé par la personne, pas une lettre d'information


# --- 6. L'assistant IA ------------------------------------------------------------------------------


def test_l_assistant_previent_que_la_question_part_chez_un_tiers(app, fake_ai):
    app.run()
    app.switch_page("views/assistant.py").run()
    text = " ".join(c.value for c in app.caption)
    assert "Ta question est envoyée au service d'IA qui rédige la réponse (Groq)" in text  # le moteur configuré
    assert "Gemini" not in text and "N'y écris pas d'informations personnelles" in text


def test_sans_ia_configuree_pas_d_avertissement(app):
    app.run()
    app.switch_page("views/assistant.py").run()
    assert "Ta question est envoyée" not in " ".join(c.value for c in app.caption)


def test_les_deux_moteurs_sont_nommes_quand_les_deux_sont_configures(app, monkeypatch):
    monkeypatch.setattr(ui, "ai_keys", lambda: {"GEMINI_API_KEY": "a", "GROQ_API_KEY": "b"})
    app.run()
    app.switch_page("views/assistant.py").run()
    assert "(Google Gemini ou Groq)" in " ".join(c.value for c in app.caption)
