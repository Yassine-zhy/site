"""Page « En chiffres » : tableau de bord du flux d'actualité."""

from datetime import datetime, timedelta, timezone

import altair as alt
import pandas as pd
import streamlit as st

import theme
from core import analytics
from core.config import CATEGORIES, COMPANIES
from theme import esc
from ui import api_keys, favicons, load_articles

articles, _, collected = load_articles(api_keys())
day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
recent = [a for a in articles if a.published >= day_ago]

theme.page_header("Le fil", "Ce que raconte le flux d'actualité des dernières 24 heures.", eyebrow="Actualité",
                  accent="en chiffres.", art="stats")

# --- Chiffres clés ----------------------------------------------------------------------------
mentions = analytics.company_mentions(recent)
sentiments = [s for s in map(analytics.article_sentiment, recent) if s is not None]
tone = sum(sentiments) / len(sentiments) if sentiments else 0.0
tone_label = "plutôt positive" if tone > 0.1 else "plutôt négative" if tone < -0.1 else "neutre"
top_ticker, top_count = mentions.most_common(1)[0] if mentions else (None, 0)

kpis = [
    ("Dépêches sur 24 h", theme.fr_number(len(recent), 0), f"{len(articles)} dans le fil au total"),
    ("Sources actives", str(len({a.source for a in recent})), "au moins une dépêche en 24 h"),
    ("Entreprise la plus citée", esc(COMPANIES[top_ticker][0]) if top_ticker else "—",
     f"{top_count} dépêche{'s' if top_count > 1 else ''}" if top_ticker else "aucune grande entreprise repérée"),
    ("Tonalité moyenne", f'<span class="{theme.direction(tone, 0.1)}">{theme.signed(tone, "", 2).strip()}</span>',
     f"{tone_label} · {len(sentiments)} dépêches notées"),
]
st.html(
    '<div class="fv-kpis">'
    + "".join(
        f'<div class="fv-kpi"><div class="fv-kpi-label">{label}</div><div class="fv-kpi-value">{value}</div>'
        f'<div class="fv-kpi-sub">{sub}</div></div>'
        for label, value, sub in kpis
    )
    + "</div>"
)

# --- Volume par heure : petits multiples, un graphique par rubrique ----------------------------
theme.section("Dépêches par heure", "24 dernières heures, heure de ton navigateur")
volume = pd.DataFrame(analytics.hourly_volume(articles))
y_max = max(int(volume["depeches"].max()), 1) if not volume.empty else 1

columns = st.columns(2, gap="large")
for index, (key, label) in enumerate(CATEGORIES.items()):
    subset = volume[volume["categorie"] == key]
    with columns[index % 2], st.container(key=f"fvchart_volume_{key}"):
        st.html(
            f'<div class="fv-chart-title">{theme.category_tag(key, label)}'
            f'<small>{int(subset["depeches"].sum())} dépêches</small></div>'
        )
        chart = (
            alt.Chart(subset)
            .mark_bar(color=theme.CATEGORY_COLORS[key], cornerRadiusEnd=3, size=9)
            .encode(
                x=alt.X("heure:T", title=None, axis=alt.Axis(format="%H h", labelAngle=0, tickCount=6, grid=False,
                                                              domainOpacity=0.4, tickOpacity=0.4)),
                y=alt.Y("depeches:Q", title=None, scale=alt.Scale(domain=[0, y_max]),
                        axis=alt.Axis(tickMinStep=1, tickCount=3, gridOpacity=0.18, domain=False, ticks=False)),
                tooltip=[alt.Tooltip("heure:T", title="Heure", format="%d/%m %H h"),
                         alt.Tooltip("depeches:Q", title="Dépêches")],
            )
            .properties(height=130, background="transparent")
        )
        st.altair_chart(theme.french(chart), width="stretch")

left, right = st.columns([1.05, 1], gap="large")

# --- Entreprises les plus citées ------------------------------------------------------------
with left:
    theme.section("Entreprises les plus citées", "24 h")
    top = mentions.most_common(10)
    if top:
        largest = top[0][1]
        icons = favicons(f"https://{COMPANIES[t][1]}" for t, _ in top)  # logos récupérés par le serveur, en parallèle
        rows = "".join(
            f'<li title="{esc(COMPANIES[t][0])} : {n} dépêche{"s" if n > 1 else ""}">'
            f'<img src="{theme.favicon_url(COMPANIES[t][1], icons)}" alt="" loading="lazy">'
            f'<span>{esc(COMPANIES[t][0])}<small>{esc(t)}</small></span>'
            f'<span class="fv-track"><i style="width:{n / largest:.0%}"></i></span><span class="fv-num">{n}</span></li>'
            for t, n in top
        )
        st.html(theme.card(f'<ul class="fv-list">{rows}</ul>'))
    else:
        st.caption("Aucune des grandes entreprises suivies n'apparaît dans les dépêches des dernières 24 heures.")

# --- Tonalité par rubrique : barres divergentes autour de zéro --------------------------------
with right:
    theme.section("Tonalité par rubrique", "de −1 à +1")
    rows = []
    for key, label in CATEGORIES.items():
        scores = [s for s in map(analytics.article_sentiment, (a for a in recent if a.category == key)) if s is not None]
        mean = sum(scores) / len(scores) if scores else 0.0
        width = min(abs(mean), 1) * 50  # la moitié de la largeur = ±1
        bar = f'<i class="{"pos" if mean >= 0 else "neg"}" style="width:{width:.1f}%"></i>' if scores else ""
        rows.append(
            f'<li title="{esc(label)} : {theme.signed(mean, "", 2).strip()} ({len(scores)} dépêches notées)">'
            f'<span>{theme.category_tag(key, label)}<small>{len(scores)} notées</small></span>'
            f'<span class="fv-axis">{bar}</span>'
            f'<span class="fv-num {theme.direction(mean, 0.1) if scores else ""}">'
            f'{theme.signed(mean, "", 2).strip() if scores else "—"}</span></li>'
        )
    st.html(theme.card(f'<ul class="fv-tone">{"".join(rows)}</ul>'))
    st.caption(
        "Tonalité estimée avec un petit lexique de mots positifs et négatifs (ou fournie par Marketaux et "
        "Alpha Vantage quand leurs clés sont actives). Indicatif : la méthode ne comprend pas la négation ni l'ironie."
    )

with st.expander("Voir les données en tableau", icon=":material/table:"):
    st.dataframe(
        volume.pivot_table(index="heure", columns="categorie", values="depeches", aggfunc="sum")
        .rename(columns=CATEGORIES)
        .sort_index(ascending=False),
    )
    st.dataframe(
        pd.DataFrame([{"Entreprise": COMPANIES[t][0], "Ticker": t, "Dépêches": n} for t, n in mentions.most_common()]),
        hide_index=True,
    )
