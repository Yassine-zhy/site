"""Le brief du jour : phrase sur les marchés, sujets qui montent, histoire la plus reprise, export."""

from datetime import datetime, timezone

from conftest import make_article
from core import analytics
from core.brief import Brief, market_sentence


def test_phrase_sur_les_marches():
    sentence = market_sentence({"^FCHI": 0.95, "^GSPC": -0.3, "GC=F": 1.6, "EURUSD=X": 0.01})
    assert sentence.startswith("Séance de hausse à Paris : le CAC 40 gagne 0,95")
    assert "le S&P 500 cède 0,30" in sentence
    assert "l'or s'envole de 1,60" in sentence
    assert "l'euro face au dollar est stable" in sentence
    assert market_sentence({"^GSPC": -0.3}).startswith("Sur les marchés, le S&P 500 cède")
    assert market_sentence({}) == ""


def test_sujets_qui_montent_et_ecriture_d_origine():
    now = datetime.now(timezone.utc)
    recent = [make_article(f"SpaceX unveils rocket number {i}", hours_ago=2) for i in range(4)]
    older = [make_article(f"Inflation report {i}", hours_ago=40) for i in range(6)]
    topics = analytics.rising_topics(recent + older, now=now, minimum=3)
    terms = [term for term, _, _ in topics]
    assert all(" " in term for term in terms[:2])  # à égalité, les paires de mots passent avant les mots seuls
    assert "SpaceX unveils" in terms  # écriture d'origine retrouvée dans les titres (et pas « spacex unveils »)
    assert topics[0][1:] == (4, 0)  # 4 dépêches récentes, aucune avant
    assert not any("inflation" in term.lower() for term in terms)  # sujet ancien : ne « monte » pas


def test_histoire_la_plus_reprise():
    same_story = [
        make_article("UK sanctions three crypto exchanges tied to Russia", source="CoinDesk"),
        make_article("UK slaps sanctions on three crypto exchanges over Russia links", source="Cointelegraph"),
        make_article("Apple unveils a new iPhone", source="CNBC"),
    ]
    best, echoes = analytics.most_covered(same_story)[0]
    assert best.source in {"CoinDesk", "Cointelegraph"} and echoes == 1


def test_export_markdown():
    brief = Brief(date_label="samedi 10 octobre 2026", market="Séance de hausse.",
                  headlines=[("Macro", "La BCE maintient ses taux", "BCE", "https://example.com")],
                  word=("PER", "Cours ÷ bénéfice par action."))
    text = brief.to_markdown()
    assert text.startswith("# FinVeille · Le brief du samedi 10 octobre 2026")
    assert "- **Macro** · [La BCE maintient ses taux](https://example.com) (BCE)" in text
    assert "**PER** : Cours ÷ bénéfice par action." in text
    assert "## Agenda" not in text  # une rubrique vide n'apparaît pas
