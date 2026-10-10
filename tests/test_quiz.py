"""Le quiz : questions bien formées, reproductibles, terme masqué dans sa définition."""

import random

from core import quiz
from core.glossary import GLOSSARY, SECTIONS


def test_une_question_a_quatre_choix_dont_la_bonne_reponse():
    question = quiz.make_question("Dividende", random.Random(1))
    assert len(question.choices) == 4 and len(set(question.choices)) == 4
    assert question.answer == "Dividende" and "Dividende" in question.choices
    assert question.section == "Marchés"


def test_les_pieges_viennent_de_la_meme_rubrique():
    question = quiz.make_question("PER", random.Random(2))
    sections = {GLOSSARY[choice][0] for choice in question.choices}
    assert sections == {GLOSSARY["PER"][0]}


def test_le_terme_est_masque_dans_sa_definition():
    assert quiz.mask("Le VIX mesure la peur. Sous 15, le vix est bas.", "VIX") == "Le … mesure la peur. Sous 15, le … est bas."
    assert "PIB" not in quiz.mask("Le PIB mesure la production.", "Produit intérieur brut (PIB)")
    for term in GLOSSARY:
        question = quiz.make_question(term, random.Random(0))
        assert term.lower() not in question.definition.lower(), term


def test_un_quiz_est_reproductible_et_sans_doublon():
    first, second = quiz.make_quiz(10, seed=42), quiz.make_quiz(10, seed=42)
    assert [q.answer for q in first] == [q.answer for q in second]
    assert len({q.answer for q in first}) == 10


def test_quiz_limite_a_une_rubrique():
    questions = quiz.make_quiz(5, seed=3, sections=["Crypto"])
    assert questions and all(q.section == "Crypto" for q in questions)
    assert len(quiz.make_quiz(500, seed=3)) == len(GLOSSARY)  # pas plus de questions que de termes
    assert set(SECTIONS) >= {q.section for q in quiz.make_quiz(len(GLOSSARY), seed=1)}


def test_verdicts():
    assert quiz.verdict(10, 10).startswith("Sans faute")
    assert quiz.verdict(2, 10).startswith("Un bon point de départ")
