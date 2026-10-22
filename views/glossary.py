"""Page « Glossaire » : les mots de la finance, expliqués simplement."""

from itertools import groupby

import streamlit as st

import theme
from core.filters import normalize
from core.glossary import GLOSSARY, SECTIONS, term_of_the_day
from theme import esc

theme.page_header("La finance,", f"{len(GLOSSARY)} termes de la finance et de l'économie, expliqués simplement.",
                  eyebrow="Glossaire", accent="expliquée simplement.", art="glossary")

word = term_of_the_day()
section_name, definition = GLOSSARY[word]
st.html(
    f'<div class="fv-word"><small>Le mot du jour · {esc(section_name)}</small>'
    f"<h3>{esc(word)}</h3><p>{esc(definition)}</p></div>"
)

# Le dialogue « Rechercher » (search.py) mène ici par `glossary?q=terme` : le champ s'en remplit, une fois par adresse
# (le visiteur peut ensuite l'effacer sans que l'adresse le remplisse de nouveau)
asked = st.query_params.get("q", "")[:60]
if st.session_state.get("glossary_asked") != asked:
    st.session_state["glossary_asked"] = asked
    if asked:
        st.session_state["glossary_q"] = asked
query = st.text_input("Chercher un terme", key="glossary_q", placeholder="PER, inflation, bêta…",
                      icon=":material/search:", label_visibility="collapsed")
chosen = st.pills("Rubriques", SECTIONS, selection_mode="multi", label_visibility="collapsed")

wanted = normalize(query)
entries = sorted(
    (term for term, (section, text) in GLOSSARY.items()
     if (not chosen or section in chosen) and (not wanted or wanted in normalize(f"{term} {text}"))),
    key=normalize,  # tri alphabétique sans tenir compte des accents ni des majuscules
)

if not entries:
    st.info("Aucun terme ne correspond. Essaie un autre mot.")

# groupby regroupe les termes consécutifs qui ont la même première lettre (d'où le tri juste avant)
for letter, terms in groupby(entries, key=lambda term: normalize(term)[0].upper()):
    items = "".join(
        f"<dt>{esc(term)}<small>{esc(GLOSSARY[term][0])}</small></dt><dd>{esc(GLOSSARY[term][1])}</dd>"
        for term in terms
    )
    st.html(f'<section class="fv-card"><div class="fv-letter">{letter}</div><dl class="fv-gloss">{items}</dl></section>')
