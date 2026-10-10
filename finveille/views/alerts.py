"""Page « Alertes » : être prévenu quand un cours franchit un seuil."""

import streamlit as st

import theme
from core import storage
from core.alerts import KINDS, describe, is_triggered
from theme import esc
from ui import company_choices, flush_toast, load_symbol_quotes


def remove(alert_id: int) -> None:
    storage.delete_alert(alert_id)
    st.session_state["fv_toast"] = "Alerte supprimée"


flush_toast()
theme.page_header("Alertes", "Sois prévenu quand un cours franchit un seuil : un bandeau s'affiche alors en haut "
                  "de toutes les pages.")
choices = company_choices()

with st.form("new_alert", clear_on_submit=True):
    left, middle, right = st.columns([1.4, 1.2, 0.8])
    symbol = left.selectbox("Entreprise ou indice", ["^FCHI", "^GSPC", *choices],
                            format_func=lambda s: {"^FCHI": "CAC 40", "^GSPC": "S&P 500"}.get(s) or f"{choices.get(s, s)} · {s}",
                            index=None, placeholder="Choisis ou tape un symbole", accept_new_options=True)
    kind = middle.selectbox("Condition", list(KINDS), format_func=KINDS.get)
    threshold = right.number_input("Seuil", min_value=0.0, value=0.0, step=1.0)
    if st.form_submit_button("Créer l'alerte", type="primary", icon=":material/notifications:"):
        if not symbol or threshold <= 0:
            st.error("Choisis une valeur et un seuil supérieur à zéro.")
        else:
            symbol = symbol.strip().upper() if not symbol.startswith("^") else symbol
            label = {"^FCHI": "CAC 40", "^GSPC": "S&P 500"}.get(symbol) or choices.get(symbol, symbol)
            storage.add_alert(symbol, label, kind, threshold)
            st.session_state["fv_toast"] = "Alerte créée"
            st.rerun()

alerts = storage.list_alerts()
theme.section("Mes alertes", f"{len(alerts)} alerte{'s' if len(alerts) > 1 else ''}")
if not alerts:
    st.caption("Aucune alerte. Exemple : « LVMH en dessous de 370 », ou « CAC 40 : variation du jour d'au moins 2 % ».")
    st.stop()

quotes = load_symbol_quotes(tuple(sorted({a["symbol"] for a in alerts})))
for alert in alerts:
    quote = quotes.get(alert["symbol"])
    with st.container(key=f"fvalert_{alert['id']}", horizontal=True, vertical_alignment="center"):
        if quote is None:
            status, detail = '<span class="fv-status is-off">Cours indisponible</span>', ""
        else:
            fired = is_triggered(alert, quote.last, quote.change)
            status = (f'<span class="fv-status {"is-on" if fired else "is-off"}">'
                      f'{"Déclenchée" if fired else "En veille"}</span>')
            if alert["kind"] == "move":
                detail = f"variation du jour : {theme.signed(quote.change)}"
            else:
                distance = (alert["threshold"] / quote.last - 1) * 100
                detail = f"cours {theme.price(quote.last)} · seuil à {theme.signed(distance)} du cours"
        st.html(f'<div class="fv-alert-row">{status}<span>{esc(describe(alert))}</span><small>{detail}</small></div>',
                width="stretch")
        st.button("Supprimer", key=f"del_alert_{alert['id']}", icon=":material/delete:", type="tertiary",
                  on_click=remove, args=(alert["id"],))

st.caption("Les alertes sont vérifiées à chaque affichage de FinVeille (et toutes les 2 minutes tant qu'une page est "
           "ouverte). Elles ne t'envoient pas d'e-mail.")
