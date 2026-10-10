"""Envoi d'e-mails : le brief du matin et les alertes de cours déclenchées.

Le protocole d'envoi du courrier électronique s'appelle SMTP. Il faut un compte chez un service d'envoi :
Gmail (avec un « mot de passe d'application »), Brevo (300 e-mails par jour gratuits)… Les réglages sont lus
dans les variables d'environnement, jamais écrits dans le code :

    SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=…  SMTP_PASSWORD=…  SMTP_FROM="FinVeille <…>"
"""

from __future__ import annotations

import html
import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from core.alerts import describe


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    user: str
    password: str
    sender: str  # « FinVeille <moi@gmail.com> »

    @classmethod
    def from_env(cls, env=None) -> SmtpSettings | None:
        """Les réglages SMTP, ou None s'ils ne sont pas renseignés."""
        env = os.environ if env is None else env
        if not env.get("SMTP_HOST") or not env.get("SMTP_USER"):
            return None
        return cls(
            host=env["SMTP_HOST"],
            port=int(env.get("SMTP_PORT") or 587),
            user=env["SMTP_USER"],
            password=env.get("SMTP_PASSWORD", ""),
            sender=env.get("SMTP_FROM") or env["SMTP_USER"],
        )


def make_message(sender: str, to: str, subject: str, text: str, html_body: str) -> EmailMessage:
    """Un e-mail en deux versions : texte brut (lu par toutes les messageries) et HTML (mis en forme)."""
    message = EmailMessage()
    message["From"], message["To"], message["Subject"] = sender, to, subject
    message.set_content(text)
    message.add_alternative(html_body, subtype="html")
    return message


def send(message: EmailMessage, settings: SmtpSettings) -> None:
    """Envoie un e-mail. Port 465 : connexion chiffrée d'emblée ; sinon (587) : chiffrement demandé avec STARTTLS."""
    if settings.port == 465:
        with smtplib.SMTP_SSL(settings.host, settings.port, timeout=30) as server:
            server.login(settings.user, settings.password)
            server.send_message(message)
        return
    with smtplib.SMTP(settings.host, settings.port, timeout=30) as server:
        server.starttls()  # la suite (mot de passe compris) circule chiffrée
        server.login(settings.user, settings.password)
        server.send_message(message)


def _price(value: float) -> str:
    decimals = 4 if value < 10 else 2
    return f"{value:,.{decimals}f}".replace(",", " ").replace(".", ",")


def _change(value: float) -> str:
    """« +1,20 % », « −0,24 % » (vrai signe moins)."""
    return f"{value:+.2f}".replace("-", "\u2212").replace(".", ",") + "\u202f%"


def alerts_email(fired: list[tuple[dict, object]], site_url: str = "") -> tuple[str, str, str]:
    """(objet, texte, HTML) de l'e-mail qui annonce des alertes déclenchées. `fired` : [(alerte, cotation)]."""
    plural = "s" if len(fired) > 1 else ""
    subject = f"FinVeille · {len(fired)} alerte{plural} déclenchée{plural}"
    lines = [f"{describe(alert)} : cours {_price(quote.last)} ({_change(quote.change)} sur la séance)"
             for alert, quote in fired]
    text = "Alertes déclenchées :\n\n" + "\n".join(f"- {line}" for line in lines)
    text += f"\n\nGérer mes alertes : {site_url}/alerts" if site_url else ""
    items = "".join(f'<li style="margin:0 0 8px">{html.escape(line)}</li>' for line in lines)
    link = (f'<p><a href="{html.escape(site_url)}/alerts" style="color:#1f4ed8">Gérer mes alertes</a></p>'
            if site_url else "")
    html_body = (
        '<div style="max-width:600px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;'
        'color:#0f1724"><p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#a66300;margin:0">'
        f'FinVeille · alerte{plural}</p><h1 style="font-size:22px;margin:6px 0 14px">{html.escape(subject[12:])}</h1>'
        f'<ul style="padding-left:18px;font-size:15px;line-height:1.5">{items}</ul>{link}'
        '<p style="color:#5b6677;font-size:13px;margin-top:24px">Cours différés (Yahoo Finance). Chaque alerte est '
        "envoyée au plus une fois par jour. Pour ne plus recevoir ces e-mails : Réglages → Notifications par "
        "e-mail.</p></div>"
    )
    return subject, text, html_body


def code_email(code: str, purpose: str) -> tuple[str, str, str]:
    """(objet, texte, HTML) de l'e-mail qui contient un code à 6 chiffres."""
    action = "confirmer ton adresse" if purpose == "verify" else "choisir un nouveau mot de passe"
    subject = f"FinVeille · ton code : {code}"
    text = (f"Ton code pour {action} : {code}\n\nIl est valable 15 minutes. Si tu n'as rien demandé, ignore cet "
            "e-mail : personne ne peut se connecter sans ce code.")
    html_body = (
        '<div style="max-width:480px;margin:0 auto;padding:24px 20px;font-family:Arial,Helvetica,sans-serif;'
        'color:#0f1724"><p style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1f4ed8;margin:0">'
        f'FinVeille</p><p style="font-size:16px">Ton code pour {action} :</p>'
        f'<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:8px 0 16px">{html.escape(code)}</p>'
        '<p style="color:#5b6677;font-size:13px">Il est valable 15 minutes. Si tu n\'as rien demandé, ignore cet '
        "e-mail : personne ne peut se connecter sans ce code.</p></div>"
    )
    return subject, text, html_body


def not_yet_sent(fired: list[tuple[dict, object]], sent: dict[str, str], today: str) -> list[tuple[dict, object]]:
    """Les alertes déclenchées qui n'ont pas encore été envoyées aujourd'hui (une alerte = un e-mail par jour)."""
    return [(alert, quote) for alert, quote in fired if sent.get(str(alert["id"])) != today]
