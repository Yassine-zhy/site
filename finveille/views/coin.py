"""Fiche d'une cryptomonnaie (adresse « fiche-crypto?c=bitcoin ») : cours, graphique, chiffres clés, description et
dépêches du fil. Les données viennent de CoinGecko (core/crypto.py), chargées et gardées en cache par coins.py."""

import altair as alt
import pandas as pd
import streamlit as st

import coins
import theme
from core import storage
from core.crypto import mentions
from theme import esc, safe_url
from ui import NO_STATUS, api_keys, article_card, current_user, end_page, load_articles, load_crypto

PAGE_CSS = """<style>
.fvcoin-crumb { display: flex; flex-wrap: wrap; align-items: center; gap: .1rem .5rem; margin: .3rem 0 .2rem;
  font-size: .84rem; color: var(--fv-muted); }
.fvcoin-crumb a { color: var(--fv-muted) !important; text-decoration: none !important; }
.fvcoin-crumb a:hover { color: var(--fv-brand) !important; text-decoration: underline !important; }
.fvcoin-crumb b { color: var(--fv-text); font-weight: 600; }
.fvcoin-price { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem 1rem; margin: .1rem 0 .4rem; }
.fvcoin-price img { width: 44px; height: 44px; border-radius: 50%; }
.fvcoin-price b { font-family: var(--fv-mono); font-size: clamp(1.7rem, 4vw, 2.3rem); font-weight: 500; letter-spacing: -.03em; }
.fvcoin-price small { font-size: .8rem; color: var(--fv-muted); }
.fv-kpis.fvcoin-kpis { grid-template-columns: repeat(3, 1fr); }
@media (max-width: 900px) { .fv-kpis.fvcoin-kpis { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); } }
.fvcoin-moves { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: .9rem 1rem; }
.fvcoin-moves small { display: block; margin-bottom: .2rem; font-size: .76rem; font-weight: 600; color: var(--fv-muted); }
.fvcoin-moves b { font-size: 1.02rem; font-weight: 600; white-space: nowrap; }
.fvcoin-bar { height: 6px; margin-top: .6rem; border-radius: 3px; background: var(--fv-hover); overflow: hidden; }
.fvcoin-bar i { display: block; height: 100%; border-radius: 3px; background: var(--fv-brand); }
.fvcoin-text p { margin: 0 0 .8rem; font-size: .95rem; line-height: 1.6; }
.fvcoin-text p:last-child { margin-bottom: 0; }
.fvcoin-pills { display: flex; flex-wrap: wrap; gap: .4rem; margin: .2rem 0 .3rem; padding: 0; list-style: none; }
.fvcoin-pills li { margin: 0; padding: .18rem .65rem; border-radius: 999px; background: var(--fv-brand-soft);
  color: var(--fv-brand); font-size: .76rem; font-weight: 600; }
.fvcoin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: .7rem; }
.fvcoin-card { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: .1rem .7rem;
  padding: .8rem 1rem; border: 1px solid var(--fv-line); border-radius: var(--radius-lg); background: var(--fv-surface);
  color: var(--fv-text) !important; text-decoration: none !important; box-shadow: var(--fv-elev);
  transition: border-color .15s, transform .15s, box-shadow .15s; }
.fvcoin-card:hover { border-color: var(--fv-brand); transform: translateY(-2px); box-shadow: var(--fv-elev-hover); }
.fvcoin-card img { grid-row: span 2; width: 34px; height: 34px; border-radius: 50%; }
.fvcoin-card b { font-weight: 600; }
.fvcoin-card small { font-size: .74rem; color: var(--fv-muted); font-family: var(--fv-mono); }
.fvcoin-card span { font-variant-numeric: tabular-nums; font-size: .85rem; text-align: right; }
.fvcoin-card span:last-child { font-size: .78rem; }
</style>"""
st.html(coins.CSS + PAGE_CSS)

coin_id = str(st.query_params.get("c", "")).strip().lower()
detail, state = coins.load_coin(coin_id) if coin_id else (None, "")


def crumb(last: str) -> str:
    return ('<nav class="fvcoin-crumb" aria-label="Fil d\'Ariane"><a href="markets" target="_self">Marchés</a><span>›</span>'
            f'<a href="crypto" target="_self">Crypto</a><span>›</span><b aria-current="page">{esc(last)}</b></nav>')


# --- Sans fiche à montrer : la recherche et les 20 premières --------------------------------------------
if detail is None:
    st.html(crumb("Chercher"))
    theme.page_header("Chercher une", "Tape le nom d'une cryptomonnaie pour voir son cours, son graphique et ses "
                      "chiffres clés, ou choisis-en une parmi les plus grosses.",
                      eyebrow="Crypto", accent="cryptomonnaie.", art="crypto")
    if state == coins.UNKNOWN:
        st.warning(f"Je ne connais pas de cryptomonnaie nommée {theme.md_code(coin_id)}. Essaie de la chercher par son nom.",
                   icon=":material/search_off:")
    elif state == coins.UNAVAILABLE:
        st.warning("La fiche de cette cryptomonnaie est indisponible pour le moment (CoinGecko limite le nombre de "
                   "requêtes gratuites). Réessaie dans quelques minutes.", icon=":material/cloud_off:")
    coins.search_box("coin_search")
    top, _ = load_crypto()
    if top:
        theme.section("Les 20 premières cryptomonnaies", "par capitalisation")
        st.html('<div class="fvcoin-grid">' + "".join(
            f'<a class="fvcoin-card" href="{theme.coin_url(c.id)}" target="_self"><img src="{safe_url(c.image)}" alt="" '
            f'loading="lazy"><b>{esc(c.name)}</b><span>{coins.euros(c.price)}</span>'
            f'<small>{esc(c.symbol)}</small><span>{theme.change(c.change_24h) if c.change_24h is not None else "—"}</span></a>'
            for c in top if c.id) + "</div>")
    end_page()

# --- La fiche -------------------------------------------------------------------------------------------
crumb_col, search_col = st.columns([1.2, 1], gap="large", vertical_alignment="center")
crumb_col.html(crumb(detail.name))
with search_col:
    coins.search_box("coin_search_small")

rank_text = f"Rang n° {detail.rank} par capitalisation. " if detail.rank else ""
theme.page_header(
    detail.name, f"{rank_text}Cours en euros (CoinGecko), mis à jour toutes les 10 minutes.",
    eyebrow="Crypto", accent=f"({detail.symbol})", art="crypto",
    obj_data={"coins": [{"sym": detail.symbol, "name": detail.name, "price": coins.euros(detail.price or 0),
                         "c": None if detail.change_24h is None else round(detail.change_24h, 2)}]},
)

# Le cours, sa variation et le graphique
with st.container(key="fvchart_coin"):
    if detail.price is None:
        st.warning("CoinGecko ne donne pas de cours pour cette cryptomonnaie.", icon=":material/info:")
    else:
        st.html(f'<div class="fvcoin-price">'
                + (f'<img src="{safe_url(detail.image)}" alt="">' if detail.image else "")
                + f"<b>{coins.euros(detail.price)}</b>"
                + (f"{theme.change(detail.change_24h)}<small>sur 24 h</small>" if detail.change_24h is not None else "")
                + "</div>")
    period = st.segmented_control("Période du graphique", list(coins.CHART_PERIODS), default="7 jours",
                                  key="coin_period", label_visibility="collapsed") or "7 jours"
    days = coins.CHART_PERIODS[period]
    series = coins.load_chart(detail.id, days, detail.symbol)
    if len(series) < 2:
        st.caption("Le graphique est indisponible pour le moment (CoinGecko limite le nombre de requêtes gratuites).")
    else:
        frame = pd.DataFrame(series, columns=["date", "cours"])
        low, high = frame["cours"].min(), frame["cours"].max()
        number = (",.0f" if high >= 1000 else ",.2f" if high >= 1 else ",.4f" if high >= 0.01
                  else ",.6~f" if high >= 0.0001 else ",.8~f")
        short = days in ("1", "7", "30")
        axis_format = {"1": "%H:%M", "7": "%d %b", "30": "%d %b", "365": "%b %Y", "max": "%Y"}[days]
        base = alt.Chart(frame).encode(
            x=alt.X("date:T", title=None, axis=alt.Axis(grid=False, labelAngle=0, tickCount=6, domainOpacity=0.4,
                                                        format=axis_format)),
            y=alt.Y("cours:Q", title=None, scale=alt.Scale(zero=False), stack=None,
                    axis=alt.Axis(gridOpacity=0.18, domain=False, ticks=False, tickCount=5, format=number)),
        )
        blue = theme.SERIES_COLORS[0]
        hover = alt.selection_point(fields=["date"], nearest=True, on="pointerover", empty=False, clear="pointerout")
        area = base.mark_area(color=theme.area_fill(blue)).encode(y2=alt.value("height"))
        line = base.mark_line(color=blue, strokeWidth=2, strokeJoin="round")
        rule = base.mark_rule(color=theme.NEUTRAL, strokeWidth=1).encode(
            opacity=alt.condition(hover, alt.value(1), alt.value(0)),
            tooltip=[alt.Tooltip("date:T", title="Date", format="%d/%m/%Y %H:%M" if short else "%d/%m/%Y"),
                     alt.Tooltip("cours:Q", title="Cours (€)", format=number)],
        ).add_params(hover)
        dot = base.mark_circle(color=blue, size=70, stroke=theme.chart_surface(), strokeWidth=2).encode(
            opacity=alt.condition(hover, alt.value(1), alt.value(0)))
        st.altair_chart(theme.french((area + line + rule + dot).properties(height=300, background="transparent")),
                        width="stretch")
        first, last = series[0][1], series[-1][1]
        change = theme.signed((last / first - 1) * 100) if first else "—"  # pas de variation depuis un cours nul
        st.caption(f"{period} : {change} · de {coins.euros(low)} à {coins.euros(high)}.")

# Les chiffres clés
kpis = []
if detail.market_cap:
    kpis.append(("Capitalisation", theme.compact_money(detail.market_cap, "EUR"),
                 f"Rang n° {detail.rank} mondial" if detail.rank else ""))
if detail.volume:
    share = f"{theme.fr_number(detail.volume / detail.market_cap * 100, 1)} % de la capitalisation" \
        if detail.market_cap else ""
    kpis.append(("Volume échangé (24 h)", theme.compact_money(detail.volume, "EUR"), share))
if detail.circulating:
    sub = f"offre totale : {theme.compact_money(detail.total_supply)}" if detail.total_supply else ""
    if detail.max_supply:
        part = min(detail.circulating / detail.max_supply * 100, 100)
        sub = (f"sur {theme.compact_money(detail.max_supply)} au maximum · {theme.fr_number(part, 1)} %"
               f'<div class="fvcoin-bar" role="progressbar" aria-valuenow="{part:.0f}" aria-valuemin="0" '
               f'aria-valuemax="100" aria-label="Part de l\'offre maximale déjà en circulation"><i style="width:{part:.1f}%"></i></div>')
    elif detail.total_supply:
        sub += " · pas de plafond annoncé"
    else:
        sub = "pas de plafond annoncé"
    kpis.append(("Offre en circulation", f"{theme.compact_money(detail.circulating)} {esc(detail.symbol)}", sub))
if detail.fdv:
    kpis.append(("Valorisation diluée", theme.compact_money(detail.fdv, "EUR"), "si toute l'offre était en circulation"))
for label, value, moment, gap in [("Plus haut historique", detail.ath, detail.ath_date, detail.ath_change),
                                  ("Plus bas historique", detail.atl, detail.atl_date, detail.atl_change)]:
    if value:
        when = f"le {theme.period_label(moment, 'jour')}" if moment else ""
        since = f"{theme.change(gap, decimals=0 if abs(gap) >= 1000 else 2)} depuis" if gap is not None else ""
        kpis.append((label, coins.euros(value), " · ".join(part for part in (when, since) if part)))
if kpis:
    theme.section("Les chiffres clés", "en euros")
    st.html('<div class="fv-kpis fvcoin-kpis">' + "".join(
        f'<div class="fv-kpi"><div class="fv-kpi-label">{esc(label)}</div><div class="fv-kpi-value">{value}</div>'
        f'<div class="fv-kpi-sub">{sub}</div></div>' for label, value, sub in kpis) + "</div>")

moves = [("1 h", detail.change_1h), ("24 h", detail.change_24h), ("7 jours", detail.change_7d),
         ("30 jours", detail.change_30d), ("1 an", detail.change_1y)]
if any(value is not None for _, value in moves):
    theme.section("Variations du cours")
    st.html(theme.card('<div class="fvcoin-moves">' + "".join(
        f"<div><small>{label}</small><b>{theme.change(value) if value is not None else '—'}</b></div>"
        for label, value in moves) + "</div>"))

# C'est quoi ?
theme.section("C'est quoi ?", detail.name)
paragraphs = detail.description.split("\n\n") if detail.description else []
if paragraphs:
    def text_html(parts: list[str]) -> str:
        return '<div class="fvcoin-text">' + "".join(f"<p>{esc(part)}</p>" for part in parts) + "</div>"

    st.html(theme.card(text_html(paragraphs[:2])))
    if len(paragraphs) > 2:
        with st.expander("Lire la suite"):
            st.html(text_html(paragraphs[2:]))
    if detail.description_lang == "en":
        st.caption("Cette description n'existe qu'en anglais chez CoinGecko.")
else:
    st.caption("Pas de description disponible pour le moment.")
if detail.categories:
    st.html('<ul class="fvcoin-pills" aria-label="Catégories">'
            + "".join(f"<li>{esc(name)}</li>" for name in detail.categories[:8]) + "</ul>")
links = [(label, url, icon) for label, url, icon in [
    ("Site officiel", detail.website, ":material/language:"), ("Livre blanc", detail.whitepaper, ":material/description:")]
    if url.startswith(("http://", "https://"))]
if links or detail.created:
    with st.container(horizontal=True, vertical_alignment="center"):
        for label, url, icon in links:
            st.link_button(label, url, icon=icon)
        if detail.created:
            st.caption(f"Créée le {theme.fr_day(detail.created)} {detail.created.year}")

# Les dépêches du fil qui en parlent
articles, _, _ = load_articles(api_keys())
news = [a for a in articles if mentions(f"{a.title} {a.summary}", detail.name, detail.symbol)]
news = sorted(news, key=lambda a: a.published, reverse=True)
user = current_user()
statuses = storage.get_statuses(user) if user else {}
news = [a for a in news if not statuses.get(a.id, NO_STATUS)["is_hidden"]][:6]
theme.section(f"Les dépêches sur {detail.name}", "les plus récentes du fil")
if news:
    for article in news:
        article_card(article, statuses.get(article.id, NO_STATUS), key_prefix="coin", user=user)
else:
    st.caption(f"Aucune dépêche récente du fil ne parle de {detail.name}.")

st.caption("Données CoinGecko, différées. Pas un conseil en investissement.")
