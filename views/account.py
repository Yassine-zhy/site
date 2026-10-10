"""Page « Mon compte » : connexion ou inscription, profil, mot de passe, données personnelles (export, suppression)."""

import json
from datetime import datetime

import streamlit as st

import theme
from core import accounts, storage
from theme import esc
from ui import current_user, local_mode, login_panel, sign_out

theme.page_header("Mon compte", "Ton profil, ta connexion et tes données personnelles.", eyebrow="Outils")

if local_mode():
    # --- Mode local : une seule personne, sans connexion -------------------------------------------
    theme.section("Mode local")
    st.markdown(
        "FinVeille fonctionne ici pour **une seule personne**, sans connexion (`LOCAL_MODE = true` dans les "
        "secrets). Pour un site en ligne, retire ce réglage : chacun pourra créer son compte par **e-mail**, "
        "avec **Google** ou d'autres comptes (voir `guide/22-comptes-par-email.md`)."
    )
    user = storage.LOCAL_USER
else:
    user = current_user()
    if user is None:
        login_panel("account", "Crée ton compte ou connecte-toi",
                    "Gratuit. Retrouve tes favoris, tes suivis, ton portefeuille et tes alertes sur tous tes appareils.")
        st.stop()

    # --- Profil ----------------------------------------------------------------------------------
    theme.section("Profil")
    profile = storage.get_user(user) or {}
    native = user.startswith("mail:")  # compte e-mail + mot de passe géré par FinVeille
    picture = None if native else st.user.get("picture")
    name = profile.get("name") or st.user.get("name") or "Mon compte"
    email = profile.get("email") or st.user.get("email") or ""
    since = datetime.fromisoformat(profile["created_at"]).strftime("%d/%m/%Y") if profile.get("created_at") else "—"
    method = "e-mail et mot de passe" if native else "Google ou compte externe"
    initials = "".join(part[0] for part in name.split()[:2]).upper() or "?"
    avatar = (f'<img src="{theme.safe_url(picture)}" alt="" style="border-radius:50%;padding:0">' if picture
              else f'<span class="fv-avatar">{esc(initials)}</span>')
    st.html(
        f'<div class="fv-firm fv-card">{avatar}<div><h2>{esc(name)}</h2>'
        f"<p>{esc(email)} · connexion par {method} · membre depuis le {since}</p></div></div>"
    )
    with st.container(horizontal=True, gap="small"):
        st.button("Se déconnecter", icon=":material/logout:", on_click=sign_out)
        if native:
            with st.popover("Changer de mot de passe", icon=":material/key:"):
                with st.form("change_password", border=False):
                    old = st.text_input("Mot de passe actuel", type="password", autocomplete="current-password")
                    new = st.text_input("Nouveau mot de passe", type="password", autocomplete="new-password",
                                        help="Au moins 8 caractères, avec des lettres et des chiffres.")
                    if st.form_submit_button("Changer", type="primary"):
                        try:
                            accounts.change_password(email, old, new)
                        except accounts.AccountError as error:
                            st.error(str(error))
                        else:
                            st.success("Mot de passe changé. Tes autres appareils ont été déconnectés.")

# --- Mes données --------------------------------------------------------------------------------
theme.section("Mes données")
stats = storage.counts(user)
st.markdown(
    f"{stats['favorites']} favori(s) · {stats['notes']} note(s) · {stats['follows']} suivi(s) · "
    f"{stats['positions']} position(s) · {stats['alerts']} alerte(s)"
)
with st.container(horizontal=True, gap="small"):
    st.download_button(
        "Télécharger toutes mes données (JSON)",
        data=json.dumps(storage.export_user_data(user), ensure_ascii=False, indent=2).encode("utf-8"),
        file_name="finveille-mes-donnees.json", mime="application/json", icon=":material/download:",
    )
    with st.popover("Supprimer mon compte et mes données", icon=":material/delete_forever:"):
        st.caption("Favoris, notes, suivis, portefeuille, alertes, préférences et mot de passe seront effacés "
                   "définitivement.")
        if st.button("Oui, tout supprimer", type="primary"):
            storage.delete_user_data(user)
            if not local_mode():
                sign_out()  # le compte n'existe plus : on déconnecte
            st.toast("Toutes tes données ont été supprimées")
            st.rerun()

st.caption("Conformément au RGPD, tu peux à tout moment télécharger ou supprimer tes données. FinVeille enregistre "
           "ton e-mail et ton nom pour identifier ton compte, et rien d'autre à ton sujet.")
