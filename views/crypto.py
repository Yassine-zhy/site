"""Page « Crypto » : les 20 premières cryptomonnaies, le marché, l'indice peur et avidité et l'actualité crypto."""

from datetime import timedelta

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core.crypto import fear_greed_label
from theme import esc, safe_url
from ui import api_keys, load_articles, load_crypto, load_fear_greed

theme.page_header(
    "Les cryptomonnaies,",
    "Les 20 premières cryptomonnaies par capitalisation, la taille du marché et l'humeur des investisseurs. "
    "Cours en euros (CoinGecko), mis à jour toutes les 5 minutes.",
    eyebrow="Crypto", accent="en euros.",
)

coins, overview = load_crypto()
history = load_fear_greed()

# --- Chiffres clés ---------------------------------------------------------------------------------
items = []
if overview.get("market_cap"):
    change = overview.get("change_24h")
    items.append(("Capitalisation totale", theme.compact_money(overview["market_cap"], "EUR"),
                  (theme.change(change) + " sur 24 h") if change is not None else ""))
if overview.get("btc_dominance") is not None:
    items.append(("Dominance du bitcoin", f"{theme.fr_number(overview['btc_dominance'], 1)} %",
                  f"ether : {theme.fr_number(overview.get('eth_dominance') or 0, 1)} % de la capitalisation"))
if overview.get("volume"):
    items.append(("Volume échangé (24 h)", theme.compact_money(overview["volume"], "EUR"),
                  f"{theme.fr_number(overview.get('coins') or 0, 0)} cryptomonnaies recensées"))
if history:
    _, value, label = history[-1]
    items.append(("Peur et avidité", f"{value}<small style='font-size:.9rem;font-weight:500'> / 100</small>", label))
if items:
    st.html('<div class="fv-kpis">' + "".join(
        f'<div class="fv-kpi"><div class="fv-kpi-label">{esc(label)}</div><div class="fv-kpi-value">{value}</div>'
        f'<div class="fv-kpi-sub">{sub}</div></div>' for label, value, sub in items) + "</div>")

if not coins:
    st.warning("Les cours des cryptomonnaies ne sont pas disponibles pour le moment (CoinGecko limite le nombre de "
               "requêtes gratuites). Réessaie dans quelques minutes.", icon=":material/cloud_off:")

# --- Classement ------------------------------------------------------------------------------------
if coins:
    theme.section("Les 20 premières cryptomonnaies", "par capitalisation")

    def pct(value) -> str:
        return theme.change(value) if value is not None else "—"

    def spark(coin) -> str:
        if len(coin.sparkline) < 2:
            return ""
        points = coin.sparkline[:: max(len(coin.sparkline) // 42, 1)] + coin.sparkline[-1:]  # ~42 points suffisent
        kind = theme.direction(coin.change_7d or 0)
        change = theme.signed(coin.change_7d) if coin.change_7d is not None else "—"
        return f'<img class="fv-spark" src="{theme.sparkline_uri(points, kind, 96, 28)}" alt="Sept jours : {esc(change)}">'

    rows = "".join(
        f"<tr><td><span class='fv-coin'><small>{coin.rank}</small>"
        f"<img src='{safe_url(coin.image)}' alt='' loading='lazy'>{esc(coin.name)} <small>{esc(coin.symbol)}</small>"
        f"</span></td><td>{theme.price(coin.price)} €</td><td>{pct(coin.change_24h)}</td><td>{pct(coin.change_7d)}</td>"
        f"<td>{pct(coin.change_30d)}</td><td>{theme.compact_money(coin.market_cap, 'EUR')}</td><td>{spark(coin)}</td></tr>"
        for coin in coins
    )
    st.html(theme.table(["Cryptomonnaie", "Cours", "24 h", "7 jours", "30 jours", "Capitalisation", "7 jours"], rows))
    with st.expander("Trier et explorer les données", icon=":material/table:"):
        st.dataframe(
            pd.DataFrame({"Rang": c.rank, "Nom": c.name, "Symbole": c.symbol, "Cours (€)": c.price,
                          "24 h (%)": c.change_24h, "7 j (%)": c.change_7d, "30 j (%)": c.change_30d,
                          "Capitalisation (€)": c.market_cap, "Volume 24 h (€)": c.volume,
                          "Écart au plus haut (%)": c.from_ath} for c in coins),
            hide_index=True,
            column_config={col: st.column_config.NumberColumn(format="%.2f") for col in
                           ["24 h (%)", "7 j (%)", "30 j (%)", "Écart au plus haut (%)"]},
        )

# --- Peur et avidité --------------------------------------------------------------------------------
if history:
    theme.section("L'indice peur et avidité", "0 = peur extrême · 100 = avidité extrême")
    left, right = st.columns([1, 1.6], gap="large")
    moment, value, label = history[-1]
    with left:
        def ago(days: int) -> str:
            past = [v for m, v, _ in history if m <= moment - timedelta(days=days)]
            return f"<b>{past[-1]}</b>{fear_greed_label(past[-1])}" if past else "<b>—</b>"

        st.html(theme.card(
            f'<div class="fv-gauge-value"><b>{value}</b><span>{esc(label)}</span></div>'
            f'<div class="fv-gauge-bar" title="{value} / 100"><i style="left:{value}%"></i></div>'
            '<div class="fv-gauge-scale"><span>Peur extrême</span><span>Neutre</span><span>Avidité extrême</span></div>'
            f'<div class="fv-gauge-history"><div>Hier{ago(1)}</div><div>Il y a 7 jours{ago(7)}</div>'
            f"<div>Il y a 30 jours{ago(30)}</div></div>",
            "Aujourd'hui", theme.period_label(moment, "jour"),
        ))
        st.caption("Un indice très bas signale la panique (certains y voient une occasion d'achat), un indice très "
                   "haut l'euphorie (un risque de correction). C'est un thermomètre, pas une prévision.")
    with right:
        frame = pd.DataFrame([{"date": m, "indice": v, "humeur": lbl} for m, v, lbl in history])
        base = alt.Chart(frame).encode(x=alt.X("date:T", title=None, axis=alt.Axis(format="%b %Y", grid=False,
                                                                                  labelAngle=0, domainOpacity=0.4)))
        line = base.mark_line(strokeWidth=1.8, color="#3987e5").encode(
            y=alt.Y("indice:Q", title=None, scale=alt.Scale(domain=[0, 100]),
                    axis=alt.Axis(values=[0, 25, 50, 75, 100], gridOpacity=0.18, domain=False, ticks=False)),
            tooltip=[alt.Tooltip("date:T", title="Date", format="%d/%m/%Y"), alt.Tooltip("indice:Q", title="Indice"),
                     alt.Tooltip("humeur:N", title="Humeur")],
        )
        neutral = alt.Chart(pd.DataFrame({"y": [50]})).mark_rule(color=theme.NEUTRAL, strokeDash=[4, 4]).encode(y="y:Q")
        with st.container(key="fvchart_feargreed"):
            st.altair_chart(theme.french((neutral + line).properties(height=260, background="transparent")),
                            width="stretch")

# --- Actualité crypto -------------------------------------------------------------------------------
articles, _, _ = load_articles(api_keys())
news = [a for a in articles if a.category == "crypto"][:6]
if news:
    theme.section("L'actualité crypto", "les dernières dépêches du fil")
    items = "".join(
        f'<li><small>{esc(a.source)} · {theme.time_ago(a.published)}</small>'
        f'<a href="{safe_url(a.url)}" target="_blank" rel="noopener">{esc(a.title)}</a></li>'
        for a in news
    )
    st.html(theme.card(f'<ul class="fv-front">{items}</ul>'))

st.caption("Les cryptomonnaies sont des actifs très volatils, non garantis : leur cours peut perdre plus de la moitié "
           "de sa valeur en quelques mois. Sources : CoinGecko (cours, capitalisations), alternative.me (indice "
           "Crypto Fear & Greed). Données fournies à titre informatif.")
