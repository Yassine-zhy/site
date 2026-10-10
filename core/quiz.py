"""Le quiz de la finance : une définition du glossaire, quatre termes proposés, un seul est le bon."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass

from core.glossary import GLOSSARY


@dataclass
class Question:
    definition: str  # la définition, où le terme à trouver est masqué
    choices: list[str]  # quatre termes, dans un ordre aléatoire
    answer: str  # le bon terme
    section: str  # sa rubrique (Marchés, Valorisation…)


def mask(definition: str, term: str) -> str:
    """Cache le terme (et son sigle entre parenthèses) s'il apparaît dans sa propre définition."""
    words = [term] + re.findall(r"\(([^)]+)\)", term)  # « Produit intérieur brut (PIB) » → aussi « PIB »
    for word in sorted(words, key=len, reverse=True):
        definition = re.sub(rf"\b{re.escape(word)}\b", "…", definition, flags=re.IGNORECASE)
    return definition


def make_question(answer: str, rng: random.Random, glossary=GLOSSARY) -> Question:
    """Une question sur `answer`. Les mauvaises réponses viennent si possible de la même rubrique (plus difficile)."""
    section, definition = glossary[answer]
    same = sorted(t for t, (s, _) in glossary.items() if s == section and t != answer)
    others = sorted(t for t, (s, _) in glossary.items() if s != section)
    distractors = rng.sample(same, min(3, len(same)))
    distractors += rng.sample(others, 3 - len(distractors))
    choices = distractors + [answer]
    rng.shuffle(choices)
    return Question(mask(definition, answer), choices, answer, section)


def make_quiz(count: int, seed: int, sections: list[str] | None = None, glossary=GLOSSARY) -> list[Question]:
    """`count` questions sur des termes tous différents. La même graine (seed) donne toujours le même quiz."""
    rng = random.Random(seed)
    pool = sorted(t for t, (s, _) in glossary.items() if not sections or s in sections)
    return [make_question(term, rng, glossary) for term in rng.sample(pool, min(count, len(pool)))]


def verdict(score: int, total: int) -> str:
    ratio = score / total if total else 0
    if ratio == 1:
        return "Sans faute ! Tu parles couramment la finance."
    if ratio >= 0.8:
        return "Excellent : tu maîtrises le vocabulaire."
    if ratio >= 0.5:
        return "Pas mal : encore quelques termes à revoir."
    return "Un bon point de départ : relis les définitions ci-dessous et rejoue."
