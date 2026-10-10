"""Page « Le brief » : l'édition du jour, rédigée automatiquement, à lire en deux minutes."""

from datetime import date, datetime, timedelta, timezone

import streamlit as st

import theme
from core import analytics, assistant, storage
from core.brief import HEADLINE_INSTRUMENTS, Brief, front_page, market_sentence, upcoming_events
from core.config import CATEGORIES
from core.glossary import GLOSSARY, term_of_the_day
from theme import esc, safe_url
from ui import ai_enabled, api_keys, complete_ai, current_user, load_articles, load_calendar, load_quotes, load_symbol_quotes

now = datetime.now(timezone.utc)
articles, _, _ = load_articles(api_keys())
recent = [a for a in articles if a.published >= now - timedelta(hours=24)]
quotes = {q.symbol: q for q in load_quotes()}

# --- Les marchés en une phrase --------------------------------------------------------------
market = market_sentence({symbol: q.change for symbol, q in quotes.items()})

# --- À la une : dans chaque rubrique, l'histoire reprise par le plus de sources -----------------
headlines = front_page(recent, CATEGORIES)

# --- Sujets qui montent ------------------------------------------------------------------------
topics = analytics.rising_topics(articles, now=now)

# --- Mes entreprises (suivis + portefeuille) et leur agenda --------------------------------------
user = current_user()  # le brief est public ; « Mes entreprises » n'apparaît que pour un utilisateur connecté
mine = {f["value"]: f["label"] for f in storage.list_follows(user, "company")} if user else {}
mine |= {p["symbol"]: p["label"] for p in (storage.list_positions(user) if user else []) if p["symbol"] not in mine}
my_quotes = load_symbol_quotes(tuple(sorted(mine)))
companies = [(mine[s], q.change) for s, q in my_quotes.items() if s in mine]
agenda = upcoming_events({symbol: load_calendar(symbol) for symbol in mine}, mine, date.today())

word = term_of_the_day()
brief = Brief(
    date_label=theme.fr_date(now.astimezone(theme.DISPLAY_TZ)),
    market=market,
    headlines=[(label, a.title, a.source, a.url) for label, a, _ in headlines],
    topics=topics,
    companies=[(name, theme.signed(change)) for name, change in companies],
    agenda=[(f"{theme.fr_day(day)}", event) for day, event in agenda],
    word=(word, GLOSSARY[word][1]),
)

# --- Affichage -----------------------------------------------------------------------------------
theme.page_header("Le brief", "L'essentiel de l'actualité financière, rédigé automatiquement à partir du fil.",
                  eyebrow="Actualité")
minutes = max(1, round(len(brief.to_markdown().split()) / 220))  # environ 220 mots lus par minute
st.html(f'<p class="fv-edition-line">Édition du {esc(brief.date_label)} · {len(recent)} dépêches analysées · '
        f"lecture {minutes} min</p>")

theme.section("Les marchés")
if market:
    st.html(f'<p class="fv-lede">{esc(market)}</p>')
figures = "".join(
    f"<tr><td>{esc(HEADLINE_INSTRUMENTS[s][1])}</td>"
    f"<td>{theme.price(quotes[s].last)}</td><td>{theme.change(quotes[s].change)}</td></tr>"
    for s in HEADLINE_INSTRUMENTS if s in quotes
)
if figures:
    st.html(theme.table(["Instrument", "Dernier cours", "Séance"], figures))

# --- L'édito de l'IA : une seule rédaction par heure pour tout le site (mémoire partagée, core/assistant.py) -----
if ai_enabled() and recent:
    picked = [a for _, a, _ in headlines]
    picked += [a for a in sorted(recent, key=lambda a: a.published, reverse=True) if a not in picked]
    messages, sources = assistant.digest_messages(picked[: assistant.MAX_SOURCES], list(quotes.values()), now)

    def write_digest() -> dict:
        return complete_ai(messages, max_tokens=500) | {"sources": [s.to_dict() for s in sources]}

    with st.spinner("L'IA rédige l'édito du jour…"):
        digest = assistant.ANALYSES.get_or_compute(f"digest|{now:%Y-%m-%d-%H}", write_digest)
    if digest["text"]:
        theme.section("L'édito de l'IA", "les histoires du jour, reliées entre elles")
        used = [assistant.Source(**s) for s in digest["sources"]]
        with st.container(key="fvdigest"):
            st.markdown(assistant.linkify(digest["text"], used))
        st.caption(f"Rédigé par {digest['engine']} à partir des dépêches, mis à jour chaque heure. Clique sur un "
                   "numéro pour lire la dépêche.")

left, right = st.columns([1.6, 1], gap="large")
with left:
    theme.section("À la une", "l'histoire la plus reprise de chaque rubrique")
    if headlines:
        items = "".join(
            f'<li>{theme.category_tag(next(k for k, v in CATEGORIES.items() if v == label), label)}'
            f'<a href="{safe_url(a.url)}" target="_blank" rel="noopener">{esc(a.title)}</a>'
            f"<small>{esc(a.source)} · {theme.time_ago(a.published)}"
            f"{f' · reprise par {echoes} autre(s) source(s)' if echoes else ''}</small></li>"
            for label, a, echoes in headlines
        )
        st.html(theme.card(f'<ul class="fv-front">{items}</ul>'))
    else:
        st.caption("Pas assez de dépêches sur les dernières 24 heures.")
    if companies:
        theme.section("Mes entreprises", "variation de la séance")
        rows = "".join(f"<li><span>{esc(name)}</span>{theme.change(change)}</li>"
                       for name, change in sorted(companies, key=lambda item: item[1], reverse=True))
        st.html(theme.card(f'<ul class="fv-ranking">{rows}</ul>'))
with right:
    theme.section("Les sujets qui montent", "24 h")
    if topics:
        items = "".join(
            f"<li><span>{esc(term)}</span>"
            f"<small>{count} dépêches · {'nouveau' if before == 0 else f'{before} avant'}</small></li>"
            for term, count, before in topics
        )
        st.html(theme.card(f'<ol class="fv-topics">{items}</ol>'))
    else:
        st.caption("Aucun sujet ne se détache pour l'instant.")
    if agenda:
        theme.section("Agenda", "45 prochains jours")
        rows = "".join(f"<li><span>{esc(event)}</span><span>{theme.fr_day(day)}</span></li>" for day, event in agenda)
        st.html(theme.card(f'<ul class="fv-agenda">{rows}</ul>'))
    theme.section("Le mot du jour")
    st.html(f'<div class="fv-word"><small>{esc(GLOSSARY[word][0])}</small><h3>{esc(word)}</h3>'
            f"<p>{esc(GLOSSARY[word][1])}</p></div>")

st.download_button("Télécharger le brief (.md)", data=brief.to_markdown().encode("utf-8"),
                   file_name=f"finveille-brief-{date.today().isoformat()}.md", mime="text/markdown",
                   icon=":material/download:")
st.caption("Format Markdown : il s'ouvre dans n'importe quel éditeur de texte et s'affiche joliment sur GitHub ou "
           "Notion. Brief généré automatiquement, sans conseil en investissement.")
