"""Le glossaire est cohérent : rubriques connues, définitions présentes, mot du jour stable."""

from datetime import date

from core.glossary import GLOSSARY, SECTIONS, term_of_the_day


def test_chaque_terme_a_une_rubrique_connue_et_une_definition():
    for term, (section, definition) in GLOSSARY.items():
        assert section in SECTIONS, term
        assert len(definition) > 30, term


def test_le_mot_du_jour_change_chaque_jour_mais_reste_stable_dans_la_journee():
    monday, tuesday = date(2026, 10, 5), date(2026, 10, 6)
    assert term_of_the_day(monday) == term_of_the_day(monday)
    assert term_of_the_day(monday) != term_of_the_day(tuesday)
