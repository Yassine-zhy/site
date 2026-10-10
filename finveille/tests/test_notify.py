"""E-mails : construction des messages, envoi (serveur SMTP factice), script planifié, anti-doublon."""

from datetime import date

import pandas as pd
import pytest

from conftest import make_article
from core import market, notify
from core.brief import Brief, front_page, upcoming_events
from core.market import Quote
from scripts import send_notifications as script

SETTINGS = notify.SmtpSettings("smtp.example.com", 587, "moi@example.com", "secret", "FinVeille <moi@example.com>")


class FakeSMTP:
    """Se fait passer pour smtplib.SMTP : enregistre ce qu'on lui demande au lieu d'envoyer."""

    sent: list = []

    def __init__(self, host, port, timeout=None):
        self.calls = [("connect", host, port)]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.calls.append(("starttls",))

    def login(self, user, password):
        self.calls.append(("login", user))

    def send_message(self, message):
        FakeSMTP.sent.append((self.calls + [("send",)], message))


@pytest.fixture
def fake_smtp(monkeypatch):
    FakeSMTP.sent = []
    monkeypatch.setattr(notify.smtplib, "SMTP", FakeSMTP)
    return FakeSMTP


def quote(symbol, last, previous):
    history = pd.Series([previous, last], index=pd.date_range("2026-10-08", periods=2, freq="D"))
    return Quote(symbol, symbol, "", "%", last, previous, history)


# --- Briques ---------------------------------------------------------------------------------------


def test_reglages_smtp_lus_dans_l_environnement():
    assert notify.SmtpSettings.from_env({}) is None
    settings = notify.SmtpSettings.from_env({"SMTP_HOST": "smtp.gmail.com", "SMTP_USER": "a@b.c", "SMTP_PASSWORD": "x"})
    assert (settings.port, settings.sender) == (587, "a@b.c")  # valeurs par défaut


def test_un_message_en_texte_et_en_html():
    message = notify.make_message("A <a@b.c>", "d@e.f", "Objet", "Bonjour", "<p>Bonjour</p>")
    assert message["To"] == "d@e.f" and message.is_multipart()
    assert message.get_body(("plain",)).get_content().strip() == "Bonjour"
    assert "<p>Bonjour</p>" in message.get_body(("html",)).get_content()


def test_envoi_chiffre_puis_identifie(fake_smtp):
    notify.send(notify.make_message("a@b.c", "d@e.f", "Objet", "texte", "<p>html</p>"), SETTINGS)
    calls, _ = fake_smtp.sent[0]
    assert [c[0] for c in calls] == ["connect", "starttls", "login", "send"]  # chiffrement AVANT le mot de passe


def test_e_mail_d_alerte():
    alert = {"id": 1, "symbol": "MC.PA", "label": "LVMH <SA>", "kind": "below", "threshold": 400.0}
    subject, text, html = notify.alerts_email([(alert, quote("MC.PA", 380.0, 381.0))], "https://site")
    assert subject == "FinVeille · 1 alerte déclenchée"
    assert "LVMH <SA> en dessous de 400 : cours 380,00 (−0,26 % sur la séance)" in text
    assert "&lt;SA&gt;" in html and "<SA>" not in html  # le nom est échappé dans le HTML
    assert "https://site/alerts" in text


def test_une_alerte_n_est_envoyee_qu_une_fois_par_jour():
    fired = [({"id": 1}, None), ({"id": 2}, None)]
    assert notify.not_yet_sent(fired, {"1": "2026-10-10"}, "2026-10-10") == [({"id": 2}, None)]
    assert len(notify.not_yet_sent(fired, {"1": "2026-10-09"}, "2026-10-10")) == 2  # la veille ne compte pas


def test_brief_en_html_echappe_et_complet():
    brief = Brief("samedi 10 octobre 2026", "Le CAC 40 gagne 1 %.",
                  headlines=[("Marchés", "Titre <script>", "CNBC", "https://ex.com/a")],
                  companies=[("LVMH", "+1,00 %")], word=("PER", "Prix ÷ bénéfice."))
    html = brief.to_html("https://site")
    assert "Samedi 10 octobre 2026" in html and "Mes entreprises" in html and "Le mot du jour" in html
    assert "<script>" not in html and "Titre &lt;script&gt;" in html


def test_une_et_agenda_du_brief():
    articles = [make_article("Fed holds rates steady amid inflation", source="CNBC", category="macro"),
                make_article("Fed holds rates steady as inflation cools", source="BBC", category="macro")]
    page = front_page(articles, {"macro": "Macro", "crypto": "Crypto"})
    assert len(page) == 1 and page[0][0] == "Macro" and page[0][2] == 1  # reprise par une autre source
    calendars = {"MC.PA": {"earnings": date(2026, 10, 20), "ex_dividend": date(2026, 9, 1)}}
    assert upcoming_events(calendars, {"MC.PA": "LVMH"}, date(2026, 10, 10)) == [
        (date(2026, 10, 20), "LVMH publie ses résultats")]  # le dividende passé n'apparaît pas


# --- Le script planifié ----------------------------------------------------------------------------


@pytest.fixture
def subscriber(db, monkeypatch):
    db.touch_user("alice@example.com", "alice@example.com", "Alice")
    db.set_setting("alice@example.com", "email_alerts", True)
    db.set_setting("alice@example.com", "email_brief", True)
    db.add_alert("alice@example.com", "MC.PA", "LVMH", "below", 400.0)
    db.add_follow("alice@example.com", "company", "MC.PA", "LVMH")
    db.touch_user("bob@example.com", "bob@example.com", "Bob")  # Bob n'a rien demandé
    db.add_alert("bob@example.com", "MC.PA", "LVMH", "below", 400.0)
    monkeypatch.setattr(market, "fetch_quotes", lambda watchlist=None, period="3mo": [
        quote(symbol, 380.0, 381.0) for symbol, *_ in (watchlist or [("^FCHI",)])])
    monkeypatch.setattr(market, "company_calendar", lambda symbol: {})
    monkeypatch.setattr(script, "collect_articles", lambda keys: ([make_article("Une dépêche", category="macro")], []))
    for name, value in {"SMTP_HOST": "smtp.example.com", "SMTP_USER": "moi@example.com", "SMTP_PASSWORD": "x",
                        "SMTP_FROM": "FinVeille <moi@example.com>"}.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    return db


def test_les_alertes_partent_une_seule_fois(subscriber, fake_smtp, capsys):
    assert script.main(["alerts"]) == 0
    assert [m["To"] for _, m in fake_smtp.sent] == ["alice@example.com"]  # pas Bob : il ne s'est pas abonné
    today = date.today().isoformat()
    assert subscriber.get_setting("alice@example.com", "alerts_sent") == {"1": today}
    script.main(["alerts"])  # une heure plus tard : rien de nouveau
    assert len(fake_smtp.sent) == 1


def test_le_brief_part_une_fois_par_jour(subscriber, fake_smtp):
    script.main(["brief"])
    script.main(["brief"])
    assert len(fake_smtp.sent) == 1
    message = fake_smtp.sent[0][1]
    assert message["Subject"].startswith("Le brief FinVeille du ")
    assert "LVMH" in message.get_body(("plain",)).get_content()  # ses entreprises suivies


def test_essai_a_blanc_sans_envoi(subscriber, fake_smtp, capsys):
    assert script.main(["alerts", "--dry-run"]) == 0
    assert fake_smtp.sent == [] and "essai à blanc" in capsys.readouterr().out
    assert subscriber.get_setting("alice@example.com", "alerts_sent") is None  # rien n'est noté comme envoyé


def test_sans_smtp_le_script_refuse(subscriber, monkeypatch, capsys):
    monkeypatch.delenv("SMTP_HOST")
    assert script.main(["alerts"]) == 1
    assert "SMTP non configuré" in capsys.readouterr().err
