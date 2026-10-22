"""Envoie par e-mail le brief du matin et les alertes de cours déclenchées.

Lancé par une tâche planifiée (GitHub Actions, voir .github/workflows/notifications.yml), depuis le dossier du
projet :

    python -m scripts.send_notifications brief             # le brief, aux comptes qui l'ont demandé
    python -m scripts.send_notifications alerts            # les alertes déclenchées (une fois par jour au plus)
    python -m scripts.send_notifications brief --dry-run   # affiche les e-mails sans les envoyer

Variables d'environnement : DATABASE_URL (la base en ligne, étape 20), SMTP_HOST, SMTP_PORT, SMTP_USER,
SMTP_PASSWORD, SMTP_FROM, SITE_URL (adresse du site, pour les liens), et les clés API facultatives.
"""

from __future__ import annotations

import argparse
import os
import smtplib
import sys
from datetime import date, datetime, timedelta, timezone

import theme  # seulement les fonctions de mise en forme (dates et nombres à la française)
from core import alerts, analytics, market, notify, storage
from core.aggregator import collect_articles
from core.brief import HEADLINE_INSTRUMENTS, Brief, front_page, market_sentence, upcoming_events
from core.config import API_KEYS, CATEGORIES
from core.glossary import GLOSSARY, term_of_the_day


def quotes_for(symbols: set[str]) -> dict:
    """Cotations d'une liste de symboles : {symbole: Quote} (vide si Yahoo ne répond pas)."""
    if not symbols:
        return {}
    try:
        return {q.symbol: q for q in market.fetch_quotes([(s, s, "", "%") for s in sorted(symbols)])}
    except Exception as error:  # une panne de Yahoo ne doit pas empêcher d'envoyer le reste
        print(f"Cours indisponibles : {type(error).__name__}", file=sys.stderr)
        return {}


def my_companies(user: str) -> dict[str, str]:
    """Les entreprises d'un utilisateur (suivis et portefeuille) : {symbole: nom}."""
    mine = {f["value"]: f["label"] for f in storage.list_follows(user, "company")}
    mine |= {p["symbol"]: p["label"] for p in storage.list_positions(user) if p["symbol"] not in mine}
    return mine


def unsubscribe_url(site_url: str) -> str:
    """La page des réglages, où l'on choisit de ne plus recevoir d'e-mails (vide si l'adresse du site est inconnue)."""
    return f"{site_url}/settings" if site_url else ""


def brief_emails(now: datetime, sender: str, site_url: str) -> list[tuple[str, object]]:
    """Un brief par compte abonné : [(user_id, e-mail)]. Les comptes déjà servis aujourd'hui sont sautés."""
    today = now.date().isoformat()
    users = [u for u in storage.users_with_setting("email_brief") if u["email"]
             and storage.get_setting(u["user_id"], "brief_sent") != today]
    if not users:
        return []
    articles, _ = collect_articles({name: os.environ.get(name) for name in API_KEYS})
    recent = [a for a in articles if a.published >= now - timedelta(hours=24)]
    quotes = quotes_for(set(HEADLINE_INSTRUMENTS))
    headlines = [(label, a.title, a.source, a.url) for label, a, _ in front_page(recent, CATEGORIES)]
    topics = analytics.rising_topics(articles, now=now)
    word = term_of_the_day(now.date())
    companies_by_user = {u["user_id"]: my_companies(u["user_id"]) for u in users}
    all_symbols = set().union(*companies_by_user.values())
    company_quotes = quotes_for(all_symbols)
    calendars: dict[str, dict] = {}
    for symbol in all_symbols:
        try:
            calendars[symbol] = market.company_calendar(symbol)
        except Exception:
            calendars[symbol] = {}

    emails = []
    for user in users:
        mine = companies_by_user[user["user_id"]]
        brief = Brief(
            date_label=theme.fr_date(now.astimezone(theme.DISPLAY_TZ)),
            market=market_sentence({symbol: q.change for symbol, q in quotes.items()}),
            headlines=headlines,
            topics=topics,
            companies=[(mine[s], theme.signed(company_quotes[s].change)) for s in mine if s in company_quotes],
            agenda=[(theme.fr_day(day), event) for day, event in
                    upcoming_events({s: calendars.get(s, {}) for s in mine}, mine, now.date())],
            word=(word, GLOSSARY[word][1]),
        )
        subject = f"Le brief FinVeille du {brief.date_label}"
        emails.append((user["user_id"], notify.make_message(
            sender=sender, to=user["email"], subject=subject, text=brief.to_markdown(site_url),
            html_body=brief.to_html(site_url), unsubscribe=unsubscribe_url(site_url))))
    return emails


def alert_emails(today: str, sender: str, site_url: str) -> list[tuple[str, object, list]]:
    """Un e-mail par compte dont des alertes viennent de se déclencher : [(user_id, e-mail, alertes envoyées)]."""
    users = [u for u in storage.users_with_setting("email_alerts") if u["email"]]
    alerts_by_user = {u["user_id"]: storage.list_alerts(u["user_id"]) for u in users}
    quotes = quotes_for({a["symbol"] for items in alerts_by_user.values() for a in items})
    emails = []
    for user in users:
        fired = alerts.check(alerts_by_user[user["user_id"]], quotes)
        due = notify.not_yet_sent(fired, storage.get_setting(user["user_id"], "alerts_sent", {}), today)
        if due:
            subject, text, html_body = notify.alerts_email(due, site_url)
            message = notify.make_message(sender, user["email"], subject, text, html_body,
                                          unsubscribe=unsubscribe_url(site_url))
            emails.append((user["user_id"], message, due))
    return emails


def purge(now: datetime, dry_run: bool = False) -> int:
    """Durée de conservation (RGPD) : efface les comptes sans visite depuis 3 ans, puis les sessions et codes expirés.
    Écrit seulement des nombres dans le journal, jamais d'adresses. Avec `dry_run`, rien n'est effacé, seulement compté.
    Renvoie le nombre de comptes concernés."""
    before = now - timedelta(days=storage.RETENTION_DAYS)
    if dry_run:
        accounts = len(storage.inactive_users(before))
        print(f"{accounts} compte(s) inactif(s) depuis plus de 3 ans seraient effacés (essai à blanc : rien n'est effacé)")
        return accounts
    accounts = len(storage.purge_inactive(before))
    expired = storage.purge_expired(now)
    print(f"{accounts} compte(s) inactif(s) depuis plus de 3 ans effacé(s), {expired} session(s) ou code(s) expiré(s) effacé(s)")
    return accounts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Envoie le brief du matin ou les alertes déclenchées par e-mail.")
    parser.add_argument("what", choices=["brief", "alerts"], help="ce qu'il faut envoyer")
    parser.add_argument("--dry-run", action="store_true", help="affiche les e-mails sans les envoyer")
    args = parser.parse_args(argv)

    if os.environ.get("DATABASE_URL"):
        storage.configure(os.environ["DATABASE_URL"])
    storage.init_db()
    if args.what == "brief":  # une fois par jour : la durée de conservation des données, avant tout envoi
        purge(datetime.now(timezone.utc), args.dry_run)
    settings = notify.SmtpSettings.from_env()
    if settings is None and not args.dry_run:
        print("SMTP non configuré (SMTP_HOST, SMTP_USER…) : rien n'est envoyé.", file=sys.stderr)
        return 1
    sender = settings.sender if settings else "FinVeille <essai@example.com>"
    site_url = os.environ.get("SITE_URL", "").rstrip("/")
    now = datetime.now(timezone.utc)
    today = date.today().isoformat()

    if args.what == "brief":
        emails = [(user, message, None) for user, message in brief_emails(now, sender, site_url)]
    else:
        emails = alert_emails(today, sender, site_url)

    sent = 0
    for user, message, due in emails:
        if args.dry_run:
            print(f"--- À {message['To']} · {message['Subject']}\n{message.get_body(('plain',)).get_content()}")
            continue
        try:
            notify.send(message, settings)
        except (smtplib.SMTPException, OSError) as error:  # serveur injoignable, mot de passe refusé…
            print(f"Échec de l'envoi à {user} : {type(error).__name__}", file=sys.stderr)
            continue
        sent += 1
        # On ne note l'envoi qu'une fois réussi : en cas d'échec, la prochaine exécution réessaiera.
        if due is None:
            storage.set_setting(user, "brief_sent", today)
        else:
            record = storage.get_setting(user, "alerts_sent", {})
            record.update({str(alert["id"]): today for alert, _ in due})
            storage.set_setting(user, "alerts_sent", record)
    print(f"{len(emails)} e-mail(s) préparé(s), {sent} envoyé(s)" + (" (essai à blanc)" if args.dry_run else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
