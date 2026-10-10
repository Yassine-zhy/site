"""Page « Mon compte » : profil, données personnelles (export, suppression) et déconnexion."""

import json
from datetime import datetime

import streamlit as st

import theme
from core import storage
from theme import esc
from ui import auth_providers, current_user, login_buttons

theme.page_header("Mon compte", "Ton profil et tes données personnelles.")

if not auth_providers():
    # --- Mode local : comptes non configurés -------------------------------------------------
    theme.section("Mode local")
    st.markdown(
        "Les comptes ne sont pas encore activés : l'application fonctionne avec **un seul utilisateur**, "
        "sans connexion. C'est parfait sur ton ordinateur.\n\n"
        "Pour un site en ligne utilisé par plusieurs personnes, active la connexion avec **Google**, "
        "**e-mail** ou **Facebook** : la marche à suivre est dans `guide/14-comptes-utilisateurs.md`."
    )
    user = storage.LOCAL_USER
else:
    user = current_user()
    if user is None:
        theme.section("Connexion")
        st.markdown("Crée un compte ou connecte-toi pour retrouver tes favoris, tes suivis, ton portefeuille et tes "
                    "alertes sur n'importe quel appareil. Aucun mot de passe n'est stocké par FinVeille : la "
                    "connexion est gérée par Google ou par le service Auth0.")
        login_buttons("account")
        st.stop()

    theme.section("Profil")
    profile = storage.get_user(user) or {}
    picture = st.user.get("picture")
    since = datetime.fromisoformat(profile["created_at"]).strftime("%d/%m/%Y") if profile.get("created_at") else "—"
    st.html(
        '<div class="fv-firm">'
        + (f'<img src="{theme.safe_url(picture)}" alt="" style="border-radius:50%">' if picture else "")
        + f"<div><h2>{esc(st.user.get('name') or 'Mon compte')}</h2>"
        f"<p>{esc(st.user.get('email') or '')} · membre depuis le {since}</p></div></div>"
    )
    st.button("Se déconnecter", icon=":material/logout:", on_click=st.logout)

# --- Mes données --------------------------------------------------------------------------------
theme.section("Mes données")
stats = storage.counts(user)
st.markdown(
    f"{stats['favorites']} favori(s) · {stats['notes']} note(s) · {stats['follows']} suivi(s) · "
    f"{stats['positions']} position(s) · {stats['alerts']} alerte(s)"
)
st.download_button(
    "Télécharger toutes mes données (JSON)",
    data=json.dumps(storage.export_user_data(user), ensure_ascii=False, indent=2).encode("utf-8"),
    file_name="finveille-mes-donnees.json", mime="application/json", icon=":material/download:",
)
with st.popover("Supprimer toutes mes données", icon=":material/delete_forever:"):
    st.caption("Favoris, notes, suivis, portefeuille, alertes et préférences seront effacés définitivement.")
    if st.button("Oui, tout supprimer", type="primary"):
        storage.delete_user_data(user)
        st.session_state.pop("fv_known_user", None)
        if auth_providers():
            st.logout()  # le compte est vidé : on déconnecte
        st.toast("Toutes tes données ont été supprimées")
        st.rerun()

st.caption("Conformément au RGPD, tu peux à tout moment télécharger ou supprimer tes données. FinVeille enregistre "
           "ton e-mail et ton nom pour identifier ton compte, et rien d'autre à ton sujet.")
