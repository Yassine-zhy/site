"""Comptes e-mail + mot de passe : inscription, connexion, blocage, sessions, codes (SQLite et PostgreSQL)."""

from datetime import datetime, timedelta, timezone

import pytest

from core import accounts
from core.accounts import AccountError

PASSWORD = "Bourse2026!"


def test_le_mot_de_passe_n_est_jamais_stocke_en_clair(store):
    accounts.register("Alice@Example.com ", PASSWORD, "Alice")
    stored = store.get_credentials("alice@example.com")["password_hash"]
    assert PASSWORD not in stored and stored.startswith("scrypt$")
    assert accounts.hash_password(PASSWORD) != accounts.hash_password(PASSWORD)  # un sel différent à chaque fois
    assert accounts.verify_password(PASSWORD, stored) and not accounts.verify_password("autre1234", stored)


def test_inscription_puis_connexion(store):
    user = accounts.register("alice@example.com", PASSWORD, "Alice")
    assert user == "mail:alice@example.com"  # jamais confondu avec un compte Google de même adresse
    assert store.get_user(user)["name"] == "Alice"
    assert accounts.authenticate("ALICE@example.com", PASSWORD) == user
    with pytest.raises(AccountError, match="existe déjà"):
        accounts.register("alice@example.com", PASSWORD)


@pytest.mark.parametrize("password, message", [("court1", "8 caractères"), ("seulementdeslettres", "chiffres"),
                                               ("12345678", "chiffres"), ("azerty123", "trop courant")])
def test_mots_de_passe_trop_faibles_refuses(store, password, message):
    with pytest.raises(AccountError, match=message):
        accounts.register("bob@example.com", password)


def test_adresse_invalide():
    with pytest.raises(AccountError, match="invalide"):
        accounts.normalize_email("pas-une-adresse")


def test_meme_message_que_le_compte_existe_ou_non(store):
    accounts.register("alice@example.com", PASSWORD)
    for email in ["alice@example.com", "inconnu@example.com"]:
        with pytest.raises(AccountError) as error:
            accounts.authenticate(email, "mauvais123")
        assert str(error.value) == accounts.GENERIC_ERROR


def test_blocage_apres_cinq_echecs(store):
    accounts.register("alice@example.com", PASSWORD)
    now = datetime.now(timezone.utc)
    for _ in range(accounts.MAX_FAILED_LOGINS):
        with pytest.raises(AccountError):
            accounts.authenticate("alice@example.com", "mauvais123", now)
    with pytest.raises(AccountError, match="Trop de tentatives"):
        accounts.authenticate("alice@example.com", PASSWORD, now)  # même le bon mot de passe est refusé
    later = now + timedelta(minutes=accounts.LOCK_MINUTES + 1)
    assert accounts.authenticate("alice@example.com", PASSWORD, later) == "mail:alice@example.com"


def test_session_valable_puis_expiree(store):
    token = accounts.create_session("mail:alice@example.com")
    assert accounts.session_user(token) == "mail:alice@example.com"
    assert accounts.session_user("jeton-invente") is None and accounts.session_user(None) is None
    assert store.get_session(token) is None  # la base ne garde que l'empreinte du jeton
    future = datetime.now(timezone.utc) + timedelta(days=accounts.SESSION_DAYS + 1)
    assert accounts.session_user(token, future) is None
    accounts.end_session(token)


def test_deconnexion(store):
    token = accounts.create_session("mail:alice@example.com")
    accounts.end_session(token)
    assert accounts.session_user(token) is None


def test_confirmation_de_l_adresse_par_code(store):
    accounts.register("alice@example.com", PASSWORD, verified=False)
    with pytest.raises(AccountError) as error:
        accounts.authenticate("alice@example.com", PASSWORD)
    assert error.value.needs_verification
    code = accounts.issue_code("alice@example.com", "verify")
    with pytest.raises(AccountError, match="incorrect"):
        accounts.confirm_email("alice@example.com", "000000" if code != "000000" else "111111")
    assert accounts.confirm_email("alice@example.com", code) == "mail:alice@example.com"
    assert accounts.authenticate("alice@example.com", PASSWORD) == "mail:alice@example.com"
    with pytest.raises(AccountError, match="expiré"):
        accounts.confirm_email("alice@example.com", code)  # un code ne sert qu'une fois


def test_code_limite_en_essais_et_en_temps(store):
    code = accounts.issue_code("alice@example.com", "reset")
    for _ in range(accounts.CODE_MAX_ATTEMPTS):
        with pytest.raises(AccountError):
            accounts.check_code("alice@example.com", "reset", "abcdef")
    with pytest.raises(AccountError, match="Trop d'essais"):
        accounts.check_code("alice@example.com", "reset", code)
    code = accounts.issue_code("alice@example.com", "reset")
    later = datetime.now(timezone.utc) + timedelta(minutes=accounts.CODE_MINUTES + 1)
    with pytest.raises(AccountError, match="expiré"):
        accounts.check_code("alice@example.com", "reset", code, later)


def test_mot_de_passe_oublie_deconnecte_partout(store):
    user = accounts.register("alice@example.com", PASSWORD)
    token = accounts.create_session(user)
    code = accounts.issue_code("alice@example.com", "reset")
    accounts.reset_password("alice@example.com", code, "NouveauSecret42")
    assert accounts.session_user(token) is None  # les anciennes sessions sont fermées
    assert accounts.authenticate("alice@example.com", "NouveauSecret42") == user


def test_changement_de_mot_de_passe(store):
    accounts.register("alice@example.com", PASSWORD)
    with pytest.raises(AccountError):
        accounts.change_password("alice@example.com", "mauvais123", "NouveauSecret42")
    accounts.change_password("alice@example.com", PASSWORD, "NouveauSecret42")
    assert accounts.authenticate("alice@example.com", "NouveauSecret42")


def test_suppression_du_compte_efface_le_mot_de_passe(store):
    user = accounts.register("alice@example.com", PASSWORD)
    accounts.create_session(user)
    store.add_follow(user, "theme", "inflation", "inflation")
    store.delete_user_data(user)
    assert store.get_credentials("alice@example.com") is None and store.get_user(user) is None
    accounts.register("alice@example.com", PASSWORD)  # l'adresse est de nouveau libre
