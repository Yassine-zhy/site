"""Statistiques du fil, résumé local et chaîne de secours des moteurs de résumé."""

from unittest import mock

from conftest import make_article
from core import analytics, summarizer


def test_detecte_les_entreprises_citees():
    article = make_article("Nvidia and LVMH lead the market", summary="Airbus is flat")
    assert set(analytics.detect_companies(article)) == {"NVDA", "MC.PA", "AIR.PA"}


def test_tonalite_du_lexique():
    assert analytics.lexicon_sentiment("Stocks rally to a record") == 1.0
    assert analytics.lexicon_sentiment("Shares plunge amid recession fears") == -1.0
    assert analytics.lexicon_sentiment("The meeting is on Tuesday") is None


def test_volume_par_heure():
    rows = analytics.hourly_volume([make_article("A", hours_ago=0), make_article("B", hours_ago=0)], hours=3)
    assert sum(r["depeches"] for r in rows) == 2
    assert len(rows) == 3  # 3 heures × 1 catégorie présente


TEXT = (
    "The central bank raised interest rates by a quarter point on Thursday. "
    "Officials said inflation remains too high and rates could rise again. "
    "The weather in the capital was sunny and mild for the season. "
    "Markets expect another increase in interest rates before the end of the year. "
    "A local football club won its match on Sunday afternoon."
)


def test_resume_local_garde_les_phrases_sur_le_sujet_dans_l_ordre():
    points = summarizer.summarize_local(TEXT, count=2)
    assert len(points) == 2
    assert all("rates" in p for p in points)
    assert TEXT.index(points[0]) < TEXT.index(points[1])


def test_lecture_de_la_reponse_d_un_modele():
    points, why = summarizer._parse_llm_answer("- Un.\n- Deux.\n- Trois.\nPourquoi c'est important : parce que.")
    assert points == ["Un.", "Deux.", "Trois."] and why == "parce que."


def test_secours_sur_le_resume_local_si_l_ia_echoue():
    article = make_article("Taux", summary=TEXT)
    with mock.patch.object(summarizer, "extract_text", return_value=None), \
         mock.patch.object(summarizer, "summarize_gemini", side_effect=summarizer.SummaryError("Gemini a répondu 429")):
        summary = summarizer.summarize(article, {"GEMINI_API_KEY": "cle"})
    assert summary.engine == "Résumé local"
    assert "429" in summary.note
    assert summary.based_on.startswith("chapeau")
