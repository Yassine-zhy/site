"""Les pages légales : la configuration déduite des secrets, les textes (core/legal.py) et les quatre pages."""

from pathlib import Path

import pytest
from streamlit.testing.v1 import AppTest

import search
import theme
import ui
from core import legal
from views import legal as views_legal
from test_app import app  # noqa: F401  (la fixture qui monte le site complet avec des données factices)

FULL = {
    "CONTACT_EMAIL": "contact@example.org",
    "DATABASE_URL": "postgresql://user:s3cr3t@ep-cool-123.eu-central-1.aws.neon.tech/finveille",
    "SMTP_HOST": "smtp-relay.brevo.com",
    "SMTP_PASSWORD": "s3cr3t",
    "GEMINI_API_KEY": "s3cr3t-gemini",
    "GROQ_API_KEY": "s3cr3t-groq",
    "auth": {"google": {"client_secret": "s3cr3t", "server_metadata_url": "https://accounts.google.com/.well-known/x"},
             "auth0": {"client_secret": "s3cr3t", "server_metadata_url": "https://mon.eu.auth0.com/.well-known/x"}},
}
TEXTS = [legal.mentions_legales, legal.confidentialite, legal.cookies, legal.conditions]
PAGE_PATHS = ["mentions-legales", "confidentialite", "cookies", "conditions"]


def all_texts(cfg):
    return {text.__name__: text(cfg) for text in TEXTS}


# --- La configuration --------------------------------------------------------------------------------------------


def test_config_sans_secrets():
    cfg = legal.config_from({})
    assert cfg == legal.LegalConfig()
    assert (cfg.contact, cfg.database, cfg.email_provider, cfg.logins, cfg.ai) == (None, None, None, (), ())
    assert cfg.site_url == "https://finveille.streamlit.app" and cfg.hosting == "streamlit"
    assert not cfg.email_accounts


def test_config_complete():
    cfg = legal.config_from(FULL)
    assert cfg.contact == "contact@example.org"
    assert (cfg.database, cfg.email_provider) == ("Neon", "Brevo (France)")
    assert cfg.logins == ("Google", "Auth0") and cfg.ai == ("Gemini", "Groq")
    assert cfg.email_accounts


@pytest.mark.parametrize("url,name", [("postgres://u:p@db.supabase.co:5432/x", "Supabase"),
                                      ("postgres://u:p@dpg-1.frankfurt-postgres.render.com/x", "Render"),
                                      ("postgres://u:p@pg-1.aivencloud.com:1/x", "Aiven"),
                                      ("postgres://u:p@containers.railway.app:1/x", "Railway"),
                                      ("postgres://u:p@db.exemple.fr/x", "un hébergeur de bases de données")])
def test_fournisseurs_de_base(url, name):
    assert legal.config_from({"DATABASE_URL": url}).database == name


@pytest.mark.parametrize("host,name", [("smtp-relay.sendinblue.com", "Brevo (France)"),
                                       ("in-v3.mailjet.com", "Mailjet (France)"),
                                       ("smtp.mail.ovh.net", "OVHcloud (France)"), ("smtp.gmail.com", "Google (Gmail)"),
                                       ("smtp.sendgrid.net", "SendGrid (États-Unis)"),
                                       ("smtp.mailgun.org", "Mailgun (États-Unis)"),
                                       ("smtp.resend.com", "Resend (États-Unis)"), ("smtp.office365.com", "Microsoft"),
                                       ("mail.exemple.fr", "un prestataire d'envoi d'e-mails")])
def test_prestataires_d_e_mails(host, name):
    assert legal.config_from({"SMTP_HOST": host}).email_provider == name


def test_connexions_par_le_domaine_ou_la_section_directe():
    direct = {"auth": {"client_id": "x", "server_metadata_url": "https://login.facebook.com/.well-known/x"}}
    assert legal.config_from(direct).logins == ("Facebook",)
    assert legal.config_from({"auth": {"client_id": "x"}}).logins == ("un service de connexion",)
    nameless = {"auth": {"cookie_secret": "x", "autre": {"server_metadata_url": "https://accounts.google.com/x"}}}
    assert legal.config_from(nameless).logins == ("Google",)
    assert legal.config_from({"auth": {"cookie_secret": "x"}}).logins == ()


def test_valeurs_vides_ignorees():
    cfg = legal.config_from({"CONTACT_EMAIL": " ", "SMTP_HOST": "", "GEMINI_API_KEY": "", "DATABASE_URL": None})
    assert cfg == legal.LegalConfig()


# --- Les textes --------------------------------------------------------------------------------------------------


def test_aucune_valeur_de_secret_dans_les_textes():
    for name, text in all_texts(legal.config_from(FULL)).items():
        assert "s3cr3t" not in text, name
        assert "ep-cool-123" not in text and "smtp-relay" not in text and "mon.eu.auth0" not in text, name


@pytest.mark.parametrize("cfg", [legal.config_from({}), legal.config_from(FULL)])
def test_les_textes_donnent_l_essentiel(cfg):
    texts = all_texts(cfg)
    for name, text in texts.items():
        assert legal.UPDATED in text and "Mise à jour" in text, name
        assert "mentions-legales" in text or name == "mentions_legales"
    assert "Yassine Zouhair" in texts["mentions_legales"]
    assert "106 East Babcock Street, Bozeman" in texts["mentions_legales"]
    assert "Snowflake Inc." in texts["mentions_legales"]
    assert "CNIL" in texts["confidentialite"] and "3 place de Fontenoy" in texts["confidentialite"]
    assert "Yassine Zouhair" in texts["confidentialite"] and "Yassine Zouhair" in texts["conditions"]
    assert "pas de conseil en investissement" in texts["conditions"].lower()
    assert "droit français" in texts["conditions"]
    assert "_streamlit_xsrf" in texts["cookies"] and "fv_session" in texts["cookies"]


def test_chaque_page_renvoie_vers_les_trois_autres():
    for name, text in all_texts(legal.LegalConfig()).items():
        links = [url for _, url in legal.PAGES.values() if f"]({url})" in text]
        assert len(links) >= 3, name


def test_destinataires_seulement_s_ils_sont_configures():
    bare = legal.confidentialite(legal.config_from({}))
    for word in ["Neon", "Brevo", "Gemini", "Groq", "Google", "Auth0"]:
        assert word not in bare, word
    assert "Snowflake" in bare and "SQLite" not in bare and "serveur de l'application" in bare
    full = legal.confidentialite(legal.config_from(FULL))
    for word in ["Neon", "Brevo (France)", "Gemini", "Groq", "Google", "Auth0", "n'y écris jamais d'informations"]:
        assert word in full, word
    only_groq = legal.confidentialite(legal.config_from({"GROQ_API_KEY": "x"}))
    assert "Groq" in only_groq and "Gemini" not in only_groq and "n'y écris jamais" not in only_groq


def test_lignes_du_tableau_selon_la_configuration():
    bare = legal.confidentialite(legal.config_from({}))
    assert "brief du matin" not in bare and "assistant IA" not in bare and "codes à 6 chiffres" not in bare
    full = legal.confidentialite(legal.config_from(FULL))
    assert "brief du matin" in full and "Tes questions à l'assistant IA" in full and "codes à 6 chiffres" in full


def test_cookies_de_connexion_seulement_avec_un_service_de_connexion():
    assert "_streamlit_user" not in legal.cookies(legal.config_from({}))
    text = legal.cookies(legal.config_from(FULL))
    assert "`_streamlit_user`" in text and "Google et Auth0" in text


def test_traceurs_de_l_hebergeur_pour_streamlit():
    text = legal.cookies(legal.LegalConfig(hosting="streamlit"))
    assert "## Les traceurs de l'hébergeur" in text
    for name in ["_ga", "_gid", "_dc_gtm_UA-", "ajs_anonymous_id", "_dd_s", "Heap", "DoubleClick", "streamlit_session",
                 "proxy-tracking-id"]:
        assert name in text, name
    assert "https://www.snowflake.com/en/legal/privacy/privacy-policy/" in text
    other = legal.cookies(legal.LegalConfig(hosting="autre"))
    assert "Les traceurs de l'hébergeur" not in other and "Snowflake" not in other


def test_hebergeur_inconnu_sans_adresse_inventee():
    text = legal.mentions_legales(legal.LegalConfig(hosting="autre"))
    assert "**autre**" in text and "Adresse" not in text and "Snowflake" not in text


def test_contact_a_venir_quand_il_manque():
    for name, text in all_texts(legal.config_from({})).items():
        assert "mailto:" not in text, name
    assert legal.NO_CONTACT == "l'adresse de contact (à venir)"
    for text in (legal.mentions_legales, legal.confidentialite, legal.conditions):
        assert legal.NO_CONTACT in text(legal.config_from({}))
    with_contact = legal.mentions_legales(legal.config_from(FULL))
    assert "[contact@example.org](mailto:contact@example.org)" in with_contact and "à venir" not in with_contact


# --- Les pages ---------------------------------------------------------------------------------------------------

PAGES = [("mentions_page", "Mentions légales"), ("privacy_page", "Politique de confidentialité"),
         ("cookies_page", "Politique des cookies"), ("terms_page", "Conditions d'utilisation")]


def open_page(function: str) -> AppTest:
    """Une des quatre pages, seule (switch_page de AppTest ne connaît que les pages-fichiers)."""
    def script(name):
        from views import legal

        getattr(legal, name)()

    return AppTest.from_function(script, args=(function,), default_timeout=60).run()


def shown(page) -> str:
    return " ".join(element.value for element in page.markdown)


@pytest.mark.parametrize("function,title", PAGES)
def test_chaque_page_s_ouvre_sans_fichier_de_secrets(function, title):
    page = open_page(function)
    assert not page.exception
    assert f"# {title}" in shown(page) and "Mise à jour : 22 octobre 2026" in shown(page)


def set_secrets(monkeypatch, secrets: dict) -> None:
    """Les secrets que les pages lisent (get_secret de ui.py, importé tel quel par views/legal.py)."""
    monkeypatch.setattr(ui, "get_secret", secrets.get)
    monkeypatch.setattr(views_legal, "get_secret", secrets.get)


def test_avertissement_quand_le_contact_manque(monkeypatch):
    set_secrets(monkeypatch, {})
    page = open_page("cookies_page")
    assert [warning.value for warning in page.warning] == [
        "L'adresse de contact n'est pas encore renseignée (réglage CONTACT_EMAIL)."]
    assert "Les traceurs de l'hébergeur" in shown(page)


def test_pas_d_avertissement_avec_un_contact(monkeypatch):
    set_secrets(monkeypatch, {"CONTACT_EMAIL": "moi@example.org"})
    page = open_page("mentions_page")
    assert not page.exception and not page.warning
    assert "moi@example.org" in shown(page) and "à venir" not in shown(page)


def test_la_configuration_lit_les_secrets(monkeypatch):
    secrets = {"CONTACT_EMAIL": "moi@example.org", "SMTP_HOST": "smtp.gmail.com", "GROQ_API_KEY": "x"}
    set_secrets(monkeypatch, secrets)
    cfg = views_legal.config()
    assert (cfg.contact, cfg.email_provider, cfg.ai) == ("moi@example.org", "Google (Gmail)", ("Groq",))


def test_le_pied_de_page_contient_les_quatre_liens(app):
    app.run()
    footer = next(element.value for element in app.get("html") if '<footer class="fv-footer"' in element.value)
    for path in PAGE_PATHS:
        assert f'<a href="./{path}" target="_self">' in footer
    assert [path for _, path in theme.LEGAL_LINKS] == PAGE_PATHS


def test_les_pages_sont_cachees_du_menu(app):
    app.run()
    assert not app.exception  # app.py déclare les quatre pages avec visibility="hidden" (st.Page l'exige valide)
    source = Path(app.__dict__["_script_path"]).read_text()
    assert source.count('visibility="hidden"') >= 6 and all(f'url_path="{path}"' in source for path in PAGE_PATHS)


# --- La recherche ------------------------------------------------------------------------------------------------


@pytest.mark.parametrize("query,title", [("cookies", "Cookies"), ("rgpd", "Confidentialité"),
                                         ("données personnelles", "Confidentialité"), ("vie privée", "Confidentialité"),
                                         ("traceurs", "Cookies"), ("cgu", "Conditions d'utilisation"),
                                         ("conditions générales", "Conditions d'utilisation"),
                                         ("éditeur", "Mentions légales"), ("hébergeur", "Mentions légales")])
def test_la_recherche_trouve_les_pages_legales(query, title):
    assert title in [found for found, _ in search.page_hits(query)]


def test_les_adresses_de_la_recherche_sont_celles_des_pages():
    addresses = dict(search.page_hits("mentions")) | dict(search.page_hits("cookies"))
    assert addresses["Mentions légales"] == "./mentions-legales" and addresses["Cookies"] == "./cookies"
