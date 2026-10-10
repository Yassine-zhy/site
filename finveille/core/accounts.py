"""Comptes « e-mail + mot de passe » gérés par FinVeille lui-même, sans service extérieur.

Règles de sécurité appliquées (recommandations de l'ANSSI et de l'OWASP) :
- le mot de passe n'est jamais enregistré : seulement son **empreinte** scrypt, avec un « sel » aléatoire propre à
  chaque compte (deux mots de passe identiques donnent deux empreintes différentes) ;
- scrypt est volontairement lent et gourmand en mémoire : tester des milliards de mots de passe devient hors de prix ;
- après 5 échecs, le compte est bloqué 15 minutes (contre les attaques « par force brute ») ;
- le même message d'erreur que l'adresse existe ou non (on ne révèle pas qui est inscrit) ;
- la session est un jeton aléatoire de 256 bits ; la base n'en garde que l'empreinte SHA-256.

Les identifiants de ces comptes commencent par « mail: » : ils ne se confondent jamais avec un compte Google qui
aurait la même adresse (personne ne peut ainsi accéder aux données d'un autre en créant un compte à son nom).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from core import storage

PASSWORD_MIN_LENGTH = 8
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
SESSION_DAYS = 30
CODE_MINUTES = 15
CODE_MAX_ATTEMPTS = 5
SCRYPT = {"n": 2**14, "r": 8, "p": 1}  # coût : environ 16 Mo de mémoire et 50 ms par calcul
GENERIC_ERROR = "E-mail ou mot de passe incorrect."
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
_COMMON = {"motdepasse", "password", "azertyuiop", "12345678", "123456789", "qwertyuiop", "finveille", "azerty123"}


class AccountError(Exception):
    """Une erreur à montrer telle quelle à l'utilisateur (message en français, sans détail technique)."""

    def __init__(self, message: str, needs_verification: bool = False):
        super().__init__(message)
        self.needs_verification = needs_verification


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# --- Adresses et mots de passe --------------------------------------------------------------------


def normalize_email(email: str) -> str:
    """« Alice@Example.COM  » → « alice@example.com », ou AccountError si ce n'est pas une adresse."""
    email = (email or "").strip().lower()
    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise AccountError("Adresse e-mail invalide.")
    return email


def check_password_strength(password: str) -> None:
    """Au moins 8 caractères, avec des lettres et des chiffres, et pas un mot de passe archi-connu."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise AccountError(f"Le mot de passe doit contenir au moins {PASSWORD_MIN_LENGTH} caractères.")
    if not (re.search(r"[A-Za-zÀ-ÿ]", password) and re.search(r"\d", password)):
        raise AccountError("Le mot de passe doit contenir des lettres et des chiffres.")
    if password.lower() in _COMMON:
        raise AccountError("Ce mot de passe est trop courant : choisis-en un autre.")


def hash_password(password: str) -> str:
    """Empreinte scrypt au format « scrypt$n$r$p$sel$empreinte » (tout ce qu'il faut pour vérifier plus tard)."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **SCRYPT)
    salt_text, digest_text = base64.b64encode(salt).decode(), base64.b64encode(digest).decode()
    return f"scrypt${SCRYPT['n']}${SCRYPT['r']}${SCRYPT['p']}${salt_text}${digest_text}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, digest = stored.split("$")
        computed = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), dklen=32, n=int(n), r=int(r),
                                  p=int(p))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(computed, base64.b64decode(digest))  # comparaison en temps constant


_DUMMY_HASH = hash_password(secrets.token_hex(8))  # pour répondre aussi lentement quand le compte n'existe pas


def user_id_for(email: str) -> str:
    return f"mail:{email}"


# --- Inscription et connexion ---------------------------------------------------------------------


def register(email: str, password: str, name: str = "", verified: bool = True) -> str:
    """Crée un compte et renvoie son identifiant. `verified=False` : l'adresse devra être confirmée par un code."""
    email = normalize_email(email)
    check_password_strength(password)
    if storage.get_credentials(email):
        raise AccountError("Un compte existe déjà avec cette adresse : connecte-toi, ou utilise « Mot de passe "
                           "oublié ».")
    storage.save_credentials(email, hash_password(password), verified)
    user = user_id_for(email)
    storage.touch_user(user, email, (name or "").strip() or email.split("@")[0])
    return user


def authenticate(email: str, password: str, now: datetime | None = None) -> str:
    """Vérifie l'e-mail et le mot de passe ; renvoie l'identifiant du compte, ou lève AccountError."""
    now = now or _now()
    try:
        email = normalize_email(email)
    except AccountError:
        raise AccountError(GENERIC_ERROR) from None
    credentials = storage.get_credentials(email)
    if credentials is None:
        verify_password(password, _DUMMY_HASH)  # même durée de réponse : on ne révèle pas si le compte existe
        raise AccountError(GENERIC_ERROR)
    locked = credentials["locked_until"] and datetime.fromisoformat(credentials["locked_until"]) > now
    if locked:
        minutes = int((datetime.fromisoformat(credentials["locked_until"]) - now).total_seconds() // 60) + 1
        raise AccountError(f"Trop de tentatives : réessaie dans {minutes} minute{'s' if minutes > 1 else ''}.")
    if not verify_password(password, credentials["password_hash"]):
        failures = credentials["failed_logins"] + 1
        lock = (now + timedelta(minutes=LOCK_MINUTES)).isoformat() if failures >= MAX_FAILED_LOGINS else None
        storage.record_failed_login(email, lock)
        raise AccountError(GENERIC_ERROR)
    if not credentials["verified"]:
        raise AccountError("Confirme d'abord ton adresse avec le code reçu par e-mail.", needs_verification=True)
    storage.reset_failed_logins(email)
    return user_id_for(email)


def change_password(email: str, old_password: str, new_password: str) -> None:
    """Change le mot de passe (l'ancien est demandé) et déconnecte les autres appareils."""
    authenticate(email, old_password)
    check_password_strength(new_password)
    storage.save_credentials(email, hash_password(new_password), verified=True)
    storage.delete_sessions(user_id_for(email))


# --- Sessions (« rester connecté ») ------------------------------------------------------------------


def create_session(user: str, now: datetime | None = None) -> str:
    """Un jeton aléatoire à garder dans un cookie ; la base n'en retient que l'empreinte."""
    token = secrets.token_urlsafe(32)
    expires = (now or _now()) + timedelta(days=SESSION_DAYS)
    storage.save_session(_sha256(token), user, expires.isoformat())
    return token


def session_user(token: str | None, now: datetime | None = None) -> str | None:
    """L'utilisateur d'un jeton de session encore valable, ou None (une session expirée est supprimée)."""
    if not token:
        return None
    session = storage.get_session(_sha256(token))
    if session is None:
        return None
    if datetime.fromisoformat(session["expires_at"]) <= (now or _now()):
        storage.delete_session(_sha256(token))
        return None
    return session["user_id"]


def end_session(token: str | None) -> None:
    if token:
        storage.delete_session(_sha256(token))


# --- Codes envoyés par e-mail (confirmation, mot de passe oublié) -----------------------------------------


def issue_code(email: str, purpose: str, now: datetime | None = None) -> str:
    """Un code à 6 chiffres valable 15 minutes. Seule son empreinte est enregistrée."""
    email = normalize_email(email)
    code = f"{secrets.randbelow(10**6):06d}"
    expires = (now or _now()) + timedelta(minutes=CODE_MINUTES)
    storage.save_code(email, purpose, _sha256(f"{email}:{purpose}:{code}"), expires.isoformat())
    return code


def check_code(email: str, purpose: str, code: str, now: datetime | None = None) -> None:
    """Vérifie un code (5 essais au plus) ; lève AccountError s'il est faux, expiré ou épuisé."""
    email = normalize_email(email)
    stored = storage.get_code(email, purpose)
    if stored is None or datetime.fromisoformat(stored["expires_at"]) <= (now or _now()):
        raise AccountError("Code expiré : demandes-en un nouveau.")
    if stored["attempts"] >= CODE_MAX_ATTEMPTS:
        raise AccountError("Trop d'essais : demande un nouveau code.")
    if not hmac.compare_digest(stored["code_hash"], _sha256(f"{email}:{purpose}:{(code or '').strip()}")):
        storage.count_code_attempt(email, purpose)
        raise AccountError("Code incorrect.")
    storage.delete_code(email, purpose)  # un code ne sert qu'une fois


def confirm_email(email: str, code: str) -> str:
    """Confirme l'adresse avec le code reçu ; renvoie l'identifiant du compte."""
    check_code(email, "verify", code)
    email = normalize_email(email)
    storage.set_verified(email)
    return user_id_for(email)


def reset_password(email: str, code: str, new_password: str) -> str:
    """Nouveau mot de passe grâce au code reçu par e-mail ; déconnecte tous les appareils."""
    check_password_strength(new_password)
    check_code(email, "reset", code)
    email = normalize_email(email)
    storage.save_credentials(email, hash_password(new_password), verified=True)  # le code prouve l'adresse
    storage.delete_sessions(user_id_for(email))
    return user_id_for(email)
